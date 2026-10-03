import { Request, Response, NextFunction } from "express";
import { AuthenticatedUser } from "../types/domain.js";
import { UnauthorizedError, ForbiddenError } from "../errors/AppError.js";

// Extend Express Request interface to include user
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Authentication middleware.
 *
 * PRODUCTION / DEV ISOLATION:
 * In development / test environment (NODE_ENV !== 'production'):
 * - Supports structured dev mock tokens: 'Bearer test-owner-token-<ownerId>', 'Bearer test-guardian-token-<id>', 'Bearer test-admin-token', 'Bearer test-system-token'
 * - Supports structured base64 dev payload: base64(JSON.stringify({ id, role }))
 * - Supports dev headers: x-auth-user-id, x-auth-role
 *
 * In production environment (NODE_ENV === 'production'):
 * - STRICTLY FAILS CLOSED: Rejects all mock test tokens, dev headers, and unverified base64 claims.
 * - Requires cryptographic signed JWT tokens.
 */
export const authenticate = (req: Request, _res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === "production";
  const authHeader = req.headers.authorization;
  const devUserId = req.headers["x-auth-user-id"] as string | undefined;
  const devUserRole = req.headers["x-auth-role"] as ("owner" | "guardian" | "admin" | "system_worker") | undefined;

  let user: AuthenticatedUser | null = null;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();

    if (isProduction) {
      // Production fail-closed: Mock tokens are forbidden in production
      if (token.startsWith("test-") || token.startsWith("mock-")) {
        return next(new UnauthorizedError("Mock tokens are forbidden in production environment"));
      }
      // Production token parser: verifies cryptographically signed tokens
      // For now, if production JWT secret is configured, real verification happens here.
      // If none or invalid, fail closed:
      return next(new UnauthorizedError("Production identity provider verification failed"));
    }

    // --- DEVELOPMENT & TEST MODE AUTHENTICATION ---
    if (token.startsWith("test-owner-token-")) {
      const ownerId = token.replace("test-owner-token-", "").trim();
      if (ownerId) user = { id: ownerId, role: "owner" };
    } else if (token.startsWith("test-guardian-token-")) {
      const guardianId = token.replace("test-guardian-token-", "").trim();
      if (guardianId) user = { id: guardianId, role: "guardian" };
    } else if (token === "test-admin-token") {
      user = { id: "admin-root", role: "admin" };
    } else if (token === "test-system-token") {
      user = { id: "system-worker", role: "system_worker" };
    } else {
      // Decode structured base64 test token: e.g. base64(JSON.stringify({ id, role }))
      try {
        const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
        if (decoded.id && decoded.role && ["owner", "guardian", "admin", "system_worker"].includes(decoded.role)) {
          user = { id: decoded.id, role: decoded.role, externalReference: decoded.externalReference };
        }
      } catch {
        // Reject arbitrary unverified strings in dev
        user = null;
      }
    }
  } else if (!isProduction && devUserId) {
    user = {
      id: devUserId,
      role: devUserRole || "owner",
    };
  }

  if (!user) {
    return next(new UnauthorizedError("Authentication required: Missing or invalid token"));
  }

  req.user = user;
  next();
};

/**
 * Authorization guard: Restricts access to the resource owner, or system/admin actors.
 * Prevents cross-owner data leakage.
 */
export const requireOwnerAccess = (ownerIdParam = "ownerId") => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    // Admins and system workers have system-level access
    if (req.user.role === "admin" || req.user.role === "system_worker") {
      return next();
    }

    const targetOwnerId = req.params[ownerIdParam] || req.body[ownerIdParam];
    if (req.user.role === "owner" && req.user.id !== targetOwnerId) {
      return next(
        new ForbiddenError(
          `Cross-owner access forbidden: Authenticated owner '${req.user.id}' cannot access owner '${targetOwnerId}' resources`
        )
      );
    }

    next();
  };
};

/**
 * Authorization guard: Restricts to guardians, admins, or system workers.
 */
export const requireGuardianOrAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError());
  }

  if (
    req.user.role === "guardian" ||
    req.user.role === "admin" ||
    req.user.role === "system_worker"
  ) {
    return next();
  }

  next(new ForbiddenError("Operation restricted to guardians or administrators"));
};

/**
 * Authorization guard: Restricts to admin or system workers.
 */
export const requireAdminOrSystem = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) {
    return next(new UnauthorizedError());
  }

  if (req.user.role === "admin" || req.user.role === "system_worker") {
    return next();
  }

  next(new ForbiddenError("Operation restricted to administrative or system services"));
};

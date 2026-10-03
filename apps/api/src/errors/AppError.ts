export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, code = "INTERNAL_SERVER_ERROR", details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id?: string) {
    const msg = id ? `${entity} with id '${id}' was not found` : `${entity} not found`;
    super(msg, 404, "NOT_FOUND");
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Access denied: insufficient permissions or cross-owner access forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, code = "BAD_REQUEST") {
    super(message, 400, code);
  }
}

export class StateTransitionError extends AppError {
  constructor(fromState: string, toState: string, reason?: string) {
    const msg = `Invalid state transition from '${fromState}' to '${toState}'${reason ? `: ${reason}` : ""}`;
    super(msg, 422, "INVALID_STATE_TRANSITION");
  }
}

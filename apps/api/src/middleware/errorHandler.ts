import { Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";
import { Prisma } from "@prisma/client";

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
) => {
  // 1. AppError (Operational expected errors)
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error(`Server error [${err.code}]: ${err.message}`, err, {
        path: req.path,
        method: req.method,
      });
    }

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // 2. Prisma Database Errors (Normalize to safe API responses without leaking internals)
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    logger.warn(`Prisma client error [${err.code}]: ${err.message}`, {
      path: req.path,
      method: req.method,
      prismaCode: err.code,
    });

    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(", ") : "resource";
      return res.status(409).json({
        success: false,
        error: {
          code: "DUPLICATE_ENTRY",
          message: `A record with this ${target} already exists.`,
        },
      });
    }

    if (err.code === "P2025") {
      return res.status(404).json({
        success: false,
        error: {
          code: "NOT_FOUND",
          message: "The requested entity was not found in the database.",
        },
      });
    }

    return res.status(400).json({
      success: false,
      error: {
        code: "DATABASE_ERROR",
        message: "A database constraint violation occurred.",
      },
    });
  }

  // 3. Syntax / JSON parse errors
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: "INVALID_JSON",
        message: "Malformed JSON payload provided.",
      },
    });
  }

  // 4. Unexpected / Unhandled Errors (Never leak stack trace or internal secrets)
  logger.error("Unhandled server exception:", err, {
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An internal server error occurred.",
    },
  });
};

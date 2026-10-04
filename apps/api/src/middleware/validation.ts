import { Request, Response, NextFunction } from "express";
import { ZodError, ZodType } from "zod";
import { ValidationError } from "../errors/AppError.js";

type RequestLocation = "body" | "query" | "params";

export const validateRequest = (
  schema: ZodType,
  location: RequestLocation = "body"
) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction
  ) => {
    try {
      const parsed = await schema.parseAsync(req[location]);
      req[location] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.errors.map((e) => ({
          field: e.path.join("."),
          message: e.message,
        }));

        return next(
          new ValidationError("Request validation failed", issues)
        );
      }

      next(error);
    }
  };
};
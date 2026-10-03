import express, { Express } from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config/env.js";
import { apiRateLimiter } from "./middleware/rateLimiter.js";
import { errorHandler } from "./middleware/errorHandler.js";
import apiRoutes from "./routes/index.js";

export const createApp = (): Express => {
  const app = express();

  // Security headers
  app.use(helmet());

  // CORS configuration
  app.use(
    cors({
      origin: "*", // Can be customized per environment
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "x-auth-user-id", "x-auth-role"],
    })
  );

  // Body parsing
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Global rate limiter
  if (config.NODE_ENV !== "test") {
    app.use(apiRateLimiter);
  }

  // Mount API routes
  app.use(config.API_PREFIX, apiRoutes);

  // 404 handler for undefined routes
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: "ROUTE_NOT_FOUND",
        message: `Route '${req.method} ${req.originalUrl}' not found`,
      },
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { HeartbeatScheduler } from "./heartbeat/scheduler.js";

export const app = createApp();

let server: import("http").Server | undefined;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(config.PORT, () => {
    logger.info(`Heirloom Backend API listening on port ${config.PORT}`, {
      environment: config.NODE_ENV,
      apiPrefix: config.API_PREFIX,
      member: "Member 3 (Backend, Heartbeat & Fraud Engine)",
    });

    // Start autonomous heartbeat overdue check-in scheduler
    HeartbeatScheduler.startScheduler(config.HEARTBEAT_SWEEP_INTERVAL_MS);
  });

  // Graceful shutdown handling
  const handleShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    HeartbeatScheduler.stopScheduler();

    if (server) {
      server.close(() => {
        logger.info("HTTP server closed successfully.");
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  };

  process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  process.on("SIGINT", () => handleShutdown("SIGINT"));
}

export default app;

import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";

const app = createApp();

app.listen(config.PORT, () => {
  logger.info(`Heirloom Base Backend API running on port ${config.PORT}`, {
    environment: config.NODE_ENV,
    apiPrefix: config.API_PREFIX,
  });
});

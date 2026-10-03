import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  API_PREFIX: z.string().default("/api/v1"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(120),
  AUTH_SECRET: z.string().default("heirloom-internal-secret-change-in-prod"),
  HEARTBEAT_SWEEP_INTERVAL_MS: z.coerce.number().default(60000),
});

export const config = envSchema.parse(process.env);

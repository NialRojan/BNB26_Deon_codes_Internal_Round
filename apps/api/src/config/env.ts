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
  // On-chain integration (Member 2 HeirloomVault on Sepolia)
  RPC_URL: z.string().default("https://ethereum-sepolia-rpc.publicnode.com"),
  VAULT_CONTRACT_ADDRESS: z.string().default("0x43CfaE0d89b26A6dBB235Df788F8f030Ea239EA8"),
  CHAIN_WATCHER_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  CHAIN_POLL_INTERVAL_MS: z.coerce.number().default(12000),
  OWNER_ALERT_RECIPIENT: z.string().default("owner@heirloom.local"),
  OWNER_ALERT_CHANNEL: z.string().default("EMAIL"),
  // Audit-log anchoring (HeirloomAuditAnchor). Disabled unless both are set.
  ANCHOR_CONTRACT_ADDRESS: z.string().optional(),
  ANCHOR_PRIVATE_KEY: z.string().optional(),
  ANCHOR_RPC_URL: z.string().optional(),
  ANCHOR_INTERVAL_MS: z.coerce.number().default(300000),
});

export const config = envSchema.parse(process.env);

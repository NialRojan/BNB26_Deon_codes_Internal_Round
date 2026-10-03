import { createApp } from "./app.js";
import { config } from "./config/env.js";
import { logger } from "./config/logger.js";
import { HeartbeatScheduler } from "./heartbeat/scheduler.js";
import { createChainClient } from "./chain/contractClient.js";
import { VaultEventWatcher } from "./chain/vaultWatcher.js";
import { AuditAnchorService, createChainAnchorWriter } from "./chain/auditAnchor.js";
import type { Address } from "viem";

export const app = createApp();

let server: import("http").Server | undefined;
let chainWatcher: VaultEventWatcher | undefined;
let auditAnchor: AuditAnchorService | undefined;

if (process.env.NODE_ENV !== "test") {
  server = app.listen(config.PORT, () => {
    logger.info(`Heirloom Backend API listening on port ${config.PORT}`, {
      environment: config.NODE_ENV,
      apiPrefix: config.API_PREFIX,
      member: "Member 3 (Backend, Heartbeat & Fraud Engine)",
    });

    // Start autonomous heartbeat overdue check-in scheduler
    HeartbeatScheduler.startScheduler(config.HEARTBEAT_SWEEP_INTERVAL_MS);

    // Listen to the HeirloomVault contract and turn its events into alerts + audit records
    if (config.CHAIN_WATCHER_ENABLED) {
      chainWatcher = new VaultEventWatcher(createChainClient(config.RPC_URL), config.VAULT_CONTRACT_ADDRESS as Address, {
        pollMs: config.CHAIN_POLL_INTERVAL_MS,
        recipient: config.OWNER_ALERT_RECIPIENT,
        channel: config.OWNER_ALERT_CHANNEL,
      });
      chainWatcher.start();
    }

    // Commit the audit log's Merkle root on-chain so database edits become detectable
    if (config.ANCHOR_CONTRACT_ADDRESS && config.ANCHOR_PRIVATE_KEY) {
      const rpc = config.ANCHOR_RPC_URL || config.RPC_URL;
      auditAnchor = new AuditAnchorService(
        createChainAnchorWriter(createChainClient(rpc), config.ANCHOR_CONTRACT_ADDRESS as Address, config.ANCHOR_PRIVATE_KEY as `0x${string}`, rpc)
      );
      auditAnchor.start(config.ANCHOR_INTERVAL_MS);
    }
  });

  // Graceful shutdown handling
  const handleShutdown = (signal: string) => {
    logger.info(`Received ${signal}. Initiating graceful shutdown...`);
    HeartbeatScheduler.stopScheduler();
    chainWatcher?.stop();
    auditAnchor?.stop();

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

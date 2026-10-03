import { db } from "../db/schema.js";
import { logger } from "../config/logger.js";
import { MissedPingTracker } from "./missedPingTracker.js";
import { PushChannel } from "./channels/push.js";
import { MessagingBotChannel } from "./channels/messagingBot.js";
import { WatchTransition } from "../watch/watchTransition.js";
import { VaultState } from "@heirloom/shared";

export interface ScheduledPingJobConfig {
  ownerId: string;
  channels: Array<"PUSH" | "BIOMETRIC" | "MESSAGING_BOT">;
  deviceToken?: string;
  phoneHandle?: string;
}

let activeIntervalTimer: NodeJS.Timeout | null = null;

export class HeartbeatScheduler {
  /**
   * Dispatches scheduled heartbeat prompts across configured channels.
   *
   * CHANNEL FAILURE RESILIENCE:
   * If a transport fails (e.g. network timeout or push gateway error),
   * the failed dispatch is recorded as a FAILED event.
   * The failure is NOT treated as an owner missed ping or proof-of-life failure,
   * and the scheduler attempts any fallback channels configured for the owner.
   */
  static async runScheduledPingCycle(jobs: ScheduledPingJobConfig[]): Promise<{ dispatched: number; errors: number }> {
    let dispatched = 0;
    let errors = 0;

    for (const job of jobs) {
      let atLeastOneSuccess = false;

      for (const channel of job.channels) {
        try {
          if (channel === "PUSH" && job.deviceToken) {
            await PushChannel.sendPing({
              ownerId: job.ownerId,
              deviceToken: job.deviceToken,
            });
            atLeastOneSuccess = true;
            dispatched++;
          } else if (channel === "MESSAGING_BOT" && job.phoneHandle) {
            await MessagingBotChannel.dispatchBotPing({
              ownerId: job.ownerId,
              recipientHandle: job.phoneHandle,
              platform: "WHATSAPP",
            });
            atLeastOneSuccess = true;
            dispatched++;
          }
        } catch (err: unknown) {
          errors++;
          const errorMessage = err instanceof Error ? err.message : String(err);
          logger.warn(
            `[HeartbeatScheduler] Channel transport failure for owner ${job.ownerId} on channel ${channel}: ${errorMessage}. Attempting remaining channels.`
          );

          // Record the failed dispatch attempt — NOT an owner proof-of-life failure
          await db.heartbeatEvent.create({
            data: {
              ownerId: job.ownerId,
              channel,
              eventType: "SCHEDULED_PING",
              responseStatus: "FAILED",
              externalEventId: `failed_ping_${job.ownerId}_${channel}_${Date.now()}`,
              metadata: JSON.stringify({
                transportError: errorMessage,
                note: "Transport failure does not count as missed owner check-in",
              }),
            },
          });
        }
      }

      if (!atLeastOneSuccess && job.channels.length > 0) {
        logger.error(`[HeartbeatScheduler] All configured channels failed dispatch for owner ${job.ownerId}`);
      }
    }

    return { dispatched, errors };
  }

  /**
   * Evaluates expired check-in windows across owners autonomously.
   *
   * AUTONOMOUS DB QUERY:
   * Queries the database for all owners whose nextCheckInDueAt has passed and who are
   * not already in WATCH state. Does not require callers to manually provide overdue IDs.
   *
   * If missed ping count exceeds threshold, invokes WatchTransition idempotently.
   */
  static async runOverdueCheckInSweep(overdueOwnerIds?: string[]): Promise<number> {
    let targetOwnerIds = overdueOwnerIds;

    // Autonomous database sweep if not explicitly specified
    if (!targetOwnerIds || targetOwnerIds.length === 0) {
      const now = new Date();
      const overdueRecords = await db.ownerAvailability.findMany({
        where: {
          nextCheckInDueAt: { lt: now },
          state: { notIn: [VaultState.WATCH, "WATCH"] },
        },
        select: { ownerId: true },
      });
      targetOwnerIds = overdueRecords.map((r) => r.ownerId);
    }

    let transitionedToWatchCount = 0;

    for (const ownerId of targetOwnerIds) {
      const current = await db.ownerAvailability.findUnique({ where: { ownerId } });
      if (current && (current.state === "WATCH" || current.state === "Watch")) {
        continue; // Already in WATCH state
      }
      const result = await MissedPingTracker.recordMissedPing(ownerId);
      if (result.shouldEscalateToWatch) {
        await WatchTransition.moveToWatch({
          ownerId,
          reason: result.reason,
          actor: "HEARTBEAT_SCHEDULER_CRON",
        });
        transitionedToWatchCount++;
      }
    }

    return transitionedToWatchCount;
  }

  /**
   * Safe interval background scheduler for local/demo runtime.
   */
  static startScheduler(intervalMs = 60_000): void {
    if (activeIntervalTimer) {
      logger.info("[HeartbeatScheduler] Scheduler is already running");
      return;
    }

    logger.info(`[HeartbeatScheduler] Starting autonomous background sweep (interval: ${intervalMs}ms)`);
    activeIntervalTimer = setInterval(async () => {
      try {
        await HeartbeatScheduler.runOverdueCheckInSweep();
      } catch (err) {
        logger.error("[HeartbeatScheduler] Background sweep cycle error:", err);
      }
    }, intervalMs);
  }

  static stopScheduler(): void {
    if (activeIntervalTimer) {
      clearInterval(activeIntervalTimer);
      activeIntervalTimer = null;
      logger.info("[HeartbeatScheduler] Scheduler stopped");
    }
  }
}

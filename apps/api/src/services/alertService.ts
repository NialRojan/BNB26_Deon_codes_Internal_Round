import { Alert } from "@prisma/client";
import { IAlertService, IOwnerService, IAuditService } from "./interfaces.js";
import { IAlertRepository } from "../repositories/interfaces.js";
import { AlertRepository } from "../repositories/alertRepository.js";
import { OwnerService } from "./ownerService.js";
import { AuditService } from "./auditService.js";
import { AlertType, AlertChannel, AlertSeverity } from "../types/domain.js";
import { ValidationError } from "../errors/AppError.js";
import { logger } from "../config/logger.js";

const VALID_ALERT_CHANNELS = ["EMAIL", "SMS", "WHATSAPP", "PUSH", "IN_APP"];
const VALID_ALERT_SEVERITIES: AlertSeverity[] = ["INFO", "WARNING", "CRITICAL"];

export class AlertService implements IAlertService {
  constructor(
    private readonly alertRepo: IAlertRepository = new AlertRepository(),
    private readonly ownerService: IOwnerService = new OwnerService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  async createAlert(data: {
    ownerId: string;
    recoveryAttemptId?: string | null;
    type: AlertType;
    severity: AlertSeverity;
    recipient: string;
    channel: AlertChannel;
    metadata?: Record<string, unknown> | null;
  }): Promise<Alert> {
    // 1. Verify owner exists
    await this.ownerService.getOwner(data.ownerId);

    // 2. Validate channel
    const channelUpper = data.channel.toUpperCase();
    if (!VALID_ALERT_CHANNELS.includes(channelUpper)) {
      throw new ValidationError(
        `Invalid channel '${data.channel}'. Allowed channels: ${VALID_ALERT_CHANNELS.join(", ")}`
      );
    }

    // 3. Validate severity
    const severityUpper = data.severity.toUpperCase() as AlertSeverity;
    if (!VALID_ALERT_SEVERITIES.includes(severityUpper)) {
      throw new ValidationError(
        `Invalid severity '${data.severity}'. Allowed: ${VALID_ALERT_SEVERITIES.join(", ")}`
      );
    }

    // 4. Validate recipient
    if (!data.recipient || data.recipient.trim() === "") {
      throw new ValidationError("Alert recipient is required");
    }

    // 5. Create alert (status PENDING or SENT)
    const alert = await this.alertRepo.create({
      ownerId: data.ownerId,
      recoveryAttemptId: data.recoveryAttemptId,
      type: data.type,
      severity: severityUpper,
      recipient: data.recipient,
      channel: channelUpper,
      status: "PENDING",
      metadata: data.metadata,
    });

    // 6. Record audit event
    await this.auditService.recordEvent({
      eventType: "ALERT_SENT",
      actorId: "ALERT_DISPATCHER",
      actorType: "SYSTEM",
      entityId: alert.id,
      entityType: "Alert",
      metadata: {
        ownerId: data.ownerId,
        recoveryAttemptId: data.recoveryAttemptId,
        type: data.type,
        channel: channelUpper,
        severity: severityUpper,
      },
    });

    logger.info(`Alert ${alert.id} created for owner ${data.ownerId} via ${channelUpper}`);
    return alert;
  }

  async getAlertsByOwner(ownerId: string, limit = 50, offset = 0): Promise<Alert[]> {
    await this.ownerService.getOwner(ownerId);
    return this.alertRepo.findManyByOwnerId(ownerId, limit, offset);
  }
}

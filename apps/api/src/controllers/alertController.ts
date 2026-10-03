import { Request, Response, NextFunction } from "express";
import { AlertService } from "../services/alertService.js";

const alertService = new AlertService();

export class AlertController {
  static async createAlert(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId, recoveryAttemptId, type, severity, recipient, channel, metadata } = req.body;

      const alert = await alertService.createAlert({
        ownerId,
        recoveryAttemptId,
        type,
        severity,
        recipient,
        channel,
        metadata,
      });

      return res.status(201).json({
        success: true,
        data: alert,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const alerts = await alertService.getAlertsByOwner(ownerId, limit, offset);
      return res.status(200).json({
        success: true,
        data: alerts,
      });
    } catch (err) {
      next(err);
    }
  }
}

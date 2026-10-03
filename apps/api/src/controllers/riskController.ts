import { Request, Response, NextFunction } from "express";
import { RiskService } from "../services/riskService.js";

const riskService = new RiskService();

export class RiskController {
  static async recordRiskEvent(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const { type, severity, score, timestamp, metadata } = req.body;

      const event = await riskService.recordRiskEvent({
        recoveryAttemptId: recoveryId,
        type,
        severity,
        score,
        timestamp,
        metadata,
      });

      return res.status(201).json({
        success: true,
        data: event,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRiskEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const events = await riskService.getRiskEvents(recoveryId);
      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRiskProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const profile = await riskService.evaluateRecoveryRisk(recoveryId);
      return res.status(200).json({
        success: true,
        data: profile,
      });
    } catch (err) {
      next(err);
    }
  }
}

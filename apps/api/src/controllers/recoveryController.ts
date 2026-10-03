import { Request, Response, NextFunction } from "express";
import { RecoveryService } from "../services/recoveryService.js";

const recoveryService = new RecoveryService();

export class RecoveryController {
  static async initiateRecovery(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId, reason, source, initiatedAt } = req.body;
      const attempt = await recoveryService.initiateRecovery({
        ownerId,
        reason,
        source: source || (req.user?.id ?? "UNKNOWN_SOURCE"),
        initiatedAt,
      });

      return res.status(201).json({
        success: true,
        data: attempt,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRecovery(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const attempt = await recoveryService.getRecovery(recoveryId);
      return res.status(200).json({
        success: true,
        data: attempt,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOwnerRecoveries(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const attempts = await recoveryService.getRecoveriesByOwner(ownerId, limit, offset);
      return res.status(200).json({
        success: true,
        data: attempts,
      });
    } catch (err) {
      next(err);
    }
  }

  static async cancelRecovery(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const { cancelReason } = req.body;
      const ownerId = req.user?.id || (req.body.ownerId as string);

      const cancelled = await recoveryService.cancelRecovery(recoveryId, ownerId, cancelReason);
      return res.status(200).json({
        success: true,
        data: cancelled,
      });
    } catch (err) {
      next(err);
    }
  }
}

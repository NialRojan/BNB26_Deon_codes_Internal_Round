import { Request, Response, NextFunction } from "express";
import { OwnerService } from "../services/ownerService.js";
import { AuditService } from "../services/auditService.js";

const ownerService = new OwnerService();
const auditService = new AuditService();

export class OwnerController {
  static async createOwner(req: Request, res: Response, next: NextFunction) {
    try {
      const owner = await ownerService.createOwner(req.body);
      return res.status(201).json({
        success: true,
        data: owner,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getOwner(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const owner = await ownerService.getOwner(ownerId);
      return res.status(200).json({
        success: true,
        data: owner,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const availability = await ownerService.getAvailability(ownerId);
      return res.status(200).json({
        success: true,
        data: availability,
      });
    } catch (err) {
      next(err);
    }
  }

  static async transitionAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const { state, reason } = req.body;
      const actorId = req.user?.id || "SYSTEM";

      const updated = await ownerService.transitionAvailability(ownerId, state, reason, actorId);
      return res.status(200).json({
        success: true,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const events = await auditService.getAuditEventsByOwner(ownerId, limit, offset);
      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }
}

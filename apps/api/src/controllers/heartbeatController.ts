import { Request, Response, NextFunction } from "express";
import { HeartbeatService } from "../services/heartbeatService.js";

const heartbeatService = new HeartbeatService();

export class HeartbeatController {
  static async recordHeartbeat(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const { channel, eventType, timestamp, responseStatus, externalEventId, metadata } = req.body;

      const event = await heartbeatService.recordHeartbeat({
        ownerId,
        channel,
        eventType,
        timestamp,
        responseStatus,
        externalEventId,
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

  static async getHeartbeatEvents(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const events = await heartbeatService.getHeartbeatEvents(ownerId, limit, offset);
      return res.status(200).json({
        success: true,
        data: events,
      });
    } catch (err) {
      next(err);
    }
  }
}

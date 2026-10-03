import { Request, Response, NextFunction } from "express";
import { AttestationService } from "../services/attestationService.js";

const attestationService = new AttestationService();

export class AttestationController {
  static async submitAttestation(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const { guardianId, status, signature, metadata } = req.body;

      // Prefer authenticated guardianId if present
      const effectiveGuardianId = req.user?.role === "guardian" ? req.user.id : guardianId;

      const attestation = await attestationService.submitAttestation({
        recoveryAttemptId: recoveryId,
        guardianId: effectiveGuardianId,
        status,
        signature,
        metadata,
      });

      return res.status(201).json({
        success: true,
        data: attestation,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAttestations(req: Request, res: Response, next: NextFunction) {
    try {
      const { recoveryId } = req.params;
      const attestations = await attestationService.getAttestations(recoveryId);
      return res.status(200).json({
        success: true,
        data: attestations,
      });
    } catch (err) {
      next(err);
    }
  }
}

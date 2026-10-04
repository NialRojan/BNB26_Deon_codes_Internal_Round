import { Request, Response, NextFunction } from "express";
import { WebAuthnService } from "../services/webAuthnService.js";

const webAuthnService = new WebAuthnService();

export class WebAuthnController {
  static async getRegistrationOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const options = await webAuthnService.generateRegistrationOptions(ownerId);
      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyRegistration(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const response = req.body;
      const result = await webAuthnService.verifyRegistrationResponse(ownerId, response);
      return res.status(201).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuthenticationOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const options = await webAuthnService.generateAuthenticationOptions(ownerId);
      return res.status(200).json({
        success: true,
        data: options,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyAuthentication(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const assertion = req.body;
      const result = await webAuthnService.verifyAuthenticationResponse(ownerId, assertion);
      return res.status(200).json({
        success: true,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async listCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId } = req.params;
      const credentials = await webAuthnService.listCredentials(ownerId);
      return res.status(200).json({
        success: true,
        data: credentials,
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCredential(req: Request, res: Response, next: NextFunction) {
    try {
      const { ownerId, credentialId } = req.params;
      const deleted = await webAuthnService.deleteCredential(ownerId, credentialId);
      return res.status(200).json({
        success: true,
        data: { deleted },
      });
    } catch (err) {
      next(err);
    }
  }
}

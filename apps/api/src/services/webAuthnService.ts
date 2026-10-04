import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { HeartbeatEvent } from "@prisma/client";
import { IWebAuthnService, IOwnerService, IAuditService } from "./interfaces.js";
import { IWebAuthnRepository } from "../repositories/interfaces.js";
import { WebAuthnRepository } from "../repositories/webAuthnRepository.js";
import { OwnerService } from "./ownerService.js";
import { AuditService } from "./auditService.js";
import { BiometricChannel, BiometricCheckInPayload } from "../heartbeat/channels/biometric.js";
import { challengeStore } from "../heartbeat/webauthn/challengeStore.js";
import { config } from "../config/env.js";
import { logger } from "../config/logger.js";
import { ValidationError, ConflictError, ForbiddenError, NotFoundError } from "../errors/AppError.js";

export class WebAuthnService implements IWebAuthnService {
  constructor(
    private readonly webAuthnRepo: IWebAuthnRepository = new WebAuthnRepository(),
    private readonly ownerService: IOwnerService = new OwnerService(),
    private readonly auditService: IAuditService = new AuditService()
  ) {}

  private getAllowedOrigins(): string[] {
    const configured = config.WEBAUTHN_ORIGIN.split(",").map((s) => s.trim());
    if (config.NODE_ENV === "production") {
      // Production strictly allows only configured production origins
      return configured;
    }
    return Array.from(
      new Set([
        ...configured,
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:4000",
        "http://127.0.0.1:5173",
      ])
    );
  }

  /**
   * Generates cryptographically secure WebAuthn registration options.
   */
  async generateRegistrationOptions(ownerId: string) {
    const owner = await this.ownerService.getOwner(ownerId);

    // Fetch existing credentials to exclude from re-registration on same device
    const existingCredentials = await this.webAuthnRepo.findManyByOwnerId(ownerId);

    const excludeCredentials = existingCredentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateRegistrationOptions({
      rpName: config.WEBAUTHN_RP_NAME,
      rpID: config.WEBAUTHN_RP_ID,
      userID: new Uint8Array(Buffer.from(owner.id, "utf-8")),
      userName: owner.externalReference || owner.id,
      userDisplayName: `Heirloom Owner (${owner.externalReference || owner.id})`,
      attestationType: "none",
      excludeCredentials,
      authenticatorSelection: {
        residentKey: "preferred",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    // Save single-use challenge strictly bound to ownerId with 5-minute TTL
    challengeStore.saveChallenge(ownerId, options.challenge, "registration");

    logger.info(`[WebAuthnService] Generated registration challenge for owner ${ownerId}`);
    return options;
  }

  /**
   * Verifies WebAuthn registration response and registers credential.
   */
  async verifyRegistrationResponse(ownerId: string, response: RegistrationResponseJSON) {
    await this.ownerService.getOwner(ownerId);

    // Extract candidate challenge from clientDataJSON
    let candidateChallenge: string | undefined;
    if (response?.response?.clientDataJSON) {
      try {
        const clientDataStr = Buffer.from(response.response.clientDataJSON, "base64url").toString("utf-8");
        const parsed = JSON.parse(clientDataStr);
        if (parsed.challenge && typeof parsed.challenge === "string") {
          candidateChallenge = parsed.challenge;
        }
      } catch {
        // Fall back
      }
    }

    // 1. Consume expected challenge atomically (single-use enforcement)
    const expectedChallenge = challengeStore.consumeChallenge(
      ownerId,
      "registration",
      candidateChallenge
    );

    if (!expectedChallenge) {
      logger.warn(`[WebAuthnService] Registration challenge expired or not found for owner ${ownerId}`);
      throw new ValidationError(
        "WebAuthn registration challenge expired or not found. Please request new registration options."
      );
    }

    // 2. Cryptographically verify registration response
    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.getAllowedOrigins(),
        expectedRPID: config.WEBAUTHN_RP_ID,
        requireUserVerification: true,
      });
    } catch (err: any) {
      logger.warn(`[WebAuthnService] Registration cryptographic verification failed for owner ${ownerId}:`, err);
      throw new ValidationError(
        `WebAuthn registration verification failed: ${err.message || "Invalid authenticator attestation"}`
      );
    }

    if (!verification.verified || !verification.registrationInfo) {
      logger.warn(`[WebAuthnService] Registration rejected (unverified) for owner ${ownerId}`);
      throw new ValidationError("WebAuthn registration verification failed: authenticator response rejected");
    }

    const regInfo = verification.registrationInfo;
    const credentialId: string =
      regInfo.credential?.id ||
      (typeof regInfo.credentialID === "string"
        ? regInfo.credentialID
        : Buffer.from(regInfo.credentialID || "").toString("base64url"));

    const publicKeyBytes: Uint8Array = regInfo.credential?.publicKey || (regInfo as any).credentialPublicKey;
    if (!publicKeyBytes || !credentialId) {
      throw new ValidationError("Registration result missing public key or credential ID");
    }

    const counter = regInfo.credential?.counter ?? regInfo.counter ?? 0;
    const transports = regInfo.credential?.transports ?? response.response?.transports ?? [];

    // 3. Prevent duplicate credential registration
    const existing = await this.webAuthnRepo.findByCredentialId(credentialId);
    if (existing) {
      logger.warn(`[WebAuthnService] Duplicate credential registration attempted: ${credentialId}`);
      throw new ConflictError("WebAuthn credential ID is already registered in the system");
    }

    // 4. Store credential in database (publicKey encoded as Base64URL)
    const publicKeyBase64Url = Buffer.from(publicKeyBytes).toString("base64url");
    const created = await this.webAuthnRepo.create({
      ownerId,
      credentialId,
      publicKey: publicKeyBase64Url,
      counter: BigInt(counter),
      transports,
    });

    // 5. Emit AuditEvent
    await this.auditService.recordEvent({
      eventType: "WEBAUTHN_CREDENTIAL_REGISTERED",
      actorId: ownerId,
      actorType: "OWNER",
      entityId: created.id,
      entityType: "WebAuthnCredential",
      metadata: {
        credentialId,
        transports,
      },
    });

    logger.info(`[WebAuthnService] Successfully registered WebAuthn credential ${credentialId} for owner ${ownerId}`);
    return {
      verified: true,
      credentialId,
    };
  }

  /**
   * Generates WebAuthn authentication options for biometric check-in.
   */
  async generateAuthenticationOptions(ownerId: string) {
    await this.ownerService.getOwner(ownerId);

    const credentials = await this.webAuthnRepo.findManyByOwnerId(ownerId);
    if (credentials.length === 0) {
      throw new ValidationError(
        "No WebAuthn credentials registered for this owner. Please register a biometric passkey first."
      );
    }

    const allowCredentials = credentials.map((c) => ({
      id: c.credentialId,
      transports: c.transports
        ? (JSON.parse(c.transports) as AuthenticatorTransportFuture[])
        : undefined,
    }));

    const options = await generateAuthenticationOptions({
      rpID: config.WEBAUTHN_RP_ID,
      allowCredentials,
      userVerification: "required",
    });

    // Save authentication challenge strictly bound to ownerId with 5-minute TTL
    challengeStore.saveChallenge(ownerId, options.challenge, "authentication");

    logger.info(`[WebAuthnService] Generated authentication challenge for owner ${ownerId}`);
    return options;
  }

  /**
   * Verifies WebAuthn biometric assertion and records proof-of-life heartbeat.
   */
  async verifyAuthenticationResponse(
    ownerId: string,
    assertionOrPayload: any
  ): Promise<{ verified: boolean; heartbeatEvent: HeartbeatEvent }> {
    await this.ownerService.getOwner(ownerId);

    // Explicit cross-owner parameter manipulation prevention
    if (assertionOrPayload.ownerId && assertionOrPayload.ownerId !== ownerId) {
      throw new ForbiddenError(
        `Cross-owner manipulation detected: request ownerId '${assertionOrPayload.ownerId}' does not match authenticated owner '${ownerId}'`
      );
    }

    // Normalize assertion / payload input
    let payload: BiometricCheckInPayload;

    if (assertionOrPayload.response && assertionOrPayload.id) {
      // Standard AuthenticationResponseJSON structure
      const resp = assertionOrPayload as AuthenticationResponseJSON;
      payload = {
        ownerId,
        credentialId: resp.id,
        signature: resp.response.signature,
        clientDataJson: resp.response.clientDataJSON,
        authenticatorData: resp.response.authenticatorData,
        userHandle: resp.response.userHandle,
        metadata: assertionOrPayload.metadata,
      };
    } else if (
      assertionOrPayload.credentialId &&
      assertionOrPayload.signature &&
      assertionOrPayload.clientDataJson &&
      assertionOrPayload.authenticatorData
    ) {
      // Direct BiometricCheckInPayload structure
      payload = {
        ...assertionOrPayload,
        ownerId,
      };
    } else {
      throw new ValidationError(
        "Invalid WebAuthn assertion payload: missing credentialId, signature, clientDataJson, or authenticatorData"
      );
    }

    // Authorization & Ownership Verification: Verify credential exists and belongs to owner
    const credential = await this.webAuthnRepo.findByCredentialId(payload.credentialId);
    if (!credential) {
      logger.warn(`[WebAuthnService] Assertion rejected: Credential ${payload.credentialId} not found`);
      throw new NotFoundError(`WebAuthn credential ${payload.credentialId} not found`);
    }

    if (credential.ownerId !== ownerId) {
      logger.warn(
        `[WebAuthnService] Cross-owner credential access attempted: Credential ${payload.credentialId} belongs to ${credential.ownerId}, not ${ownerId}`
      );
      throw new ForbiddenError("Credential does not belong to the authenticated owner");
    }

    // Hand off to BiometricChannel (which invokes WebAuthnVerifier cryptographically)
    const heartbeatEvent = await BiometricChannel.recordBiometricCheckIn(payload);

    return {
      verified: true,
      heartbeatEvent,
    };
  }

  /**
   * List registered credentials for owner (safe metadata only, never secrets or keys).
   */
  async listCredentials(ownerId: string) {
    await this.ownerService.getOwner(ownerId);
    const credentials = await this.webAuthnRepo.findManyByOwnerId(ownerId);

    return credentials.map((c) => ({
      id: c.id,
      credentialId: c.credentialId,
      transports: c.transports ? JSON.parse(c.transports) : [],
      createdAt: c.createdAt,
      lastUsedAt: c.lastUsedAt,
    }));
  }

  /**
   * Delete a registered credential for owner.
   */
  async deleteCredential(ownerId: string, credentialId: string): Promise<boolean> {
    await this.ownerService.getOwner(ownerId);

    const credential = await this.webAuthnRepo.findByCredentialId(credentialId);
    if (!credential) {
      throw new NotFoundError(`Credential ${credentialId} not found`);
    }

    if (credential.ownerId !== ownerId) {
      throw new ForbiddenError("Credential does not belong to the authenticated owner");
    }

    const deleted = await this.webAuthnRepo.deleteByCredentialId(ownerId, credentialId);

    if (deleted) {
      await this.auditService.recordEvent({
        eventType: "WEBAUTHN_CREDENTIAL_DELETED",
        actorId: ownerId,
        actorType: "OWNER",
        entityId: credential.id,
        entityType: "WebAuthnCredential",
        metadata: {
          credentialId,
        },
      });
    }

    return deleted;
  }
}

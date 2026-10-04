import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import crypto from "crypto";
import { app } from "../src/server.js";
import { db } from "../src/db/schema.js";
import { challengeStore } from "../src/heartbeat/webauthn/challengeStore.js";
import { WebAuthnRepository } from "../src/repositories/webAuthnRepository.js";
import { WebAuthnService } from "../src/services/webAuthnService.js";
import { WebAuthnVerifier, setWebAuthnVerifier } from "../src/heartbeat/channels/biometric.js";

/**
 * Generates a real cryptographic ES256 (P-256 ECDSA) key pair
 * and formats the public key as canonical CBOR COSE key bytes (Base64URL).
 */
function generateRealWebAuthnKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
    namedCurve: "P-256",
  });

  const jwk = publicKey.export({ format: "jwk" });
  const x = Buffer.from(jwk.x!, "base64url");
  const y = Buffer.from(jwk.y!, "base64url");

  // Canonical CBOR COSE key: { 1: 2, 3: -7, -1: 1, -2: x, -3: y }
  const coseKey = Buffer.concat([
    Buffer.from([0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20]),
    x,
    Buffer.from([0x22, 0x58, 0x20]),
    y,
  ]);

  return {
    privateKey,
    publicKeyBase64Url: coseKey.toString("base64url"),
  };
}

/**
 * Creates a real, cryptographically valid WebAuthn assertion signature
 * over authenticatorData and clientDataJSON.
 */
function createRealAssertionSignature(
  privateKey: crypto.KeyObject,
  challenge: string,
  rpId = "localhost",
  origin = "http://localhost:5173",
  signCount = 1
) {
  const clientDataJSON = JSON.stringify({
    type: "webauthn.get",
    challenge,
    origin,
    crossOrigin: false,
  });
  const clientDataHash = crypto
    .createHash("sha256")
    .update(Buffer.from(clientDataJSON, "utf-8"))
    .digest();

  const rpIdHash = crypto.createHash("sha256").update(rpId).digest();
  const flags = Buffer.from([0x05]); // UP (bit 0) and UV (bit 2) = User Present & Verified
  const counterBuf = Buffer.alloc(4);
  counterBuf.writeUInt32BE(signCount, 0);

  const authenticatorData = Buffer.concat([rpIdHash, flags, counterBuf]);
  const signatureData = Buffer.concat([authenticatorData, clientDataHash]);

  // Real ECDSA P-256 signature in DER format
  const signature = crypto.createSign("SHA256").update(signatureData).sign(privateKey);

  return {
    clientDataJson: Buffer.from(clientDataJSON, "utf-8").toString("base64url"),
    authenticatorData: authenticatorData.toString("base64url"),
    signature: signature.toString("base64url"),
  };
}

describe("Real WebAuthn Biometric Proof-of-Life System (Member 3)", () => {
  let ownerId: string;
  const repo = new WebAuthnRepository();
  const service = new WebAuthnService(repo);

  beforeEach(async () => {
    challengeStore.clear();
    setWebAuthnVerifier(new WebAuthnVerifier(repo));

    const owner = await db.owner.create({
      data: {
        externalReference: `owner_bio_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        availability: {
          create: {
            state: "ACTIVE",
            heartbeatIntervalDays: 30,
            gracePeriodDays: 7,
            missedCount: 0,
          },
        },
      },
      include: { availability: true },
    });
    ownerId = owner.id;
  });

  // =========================================================================
  // 1. Challenge Store Security & Replay Prevention
  // =========================================================================
  describe("Challenge Store Lifecycle & Replay Protection", () => {
    it("generates cryptographically random 32-byte Base64URL challenges", () => {
      const c1 = challengeStore.generateSecureChallenge();
      const c2 = challengeStore.generateSecureChallenge();
      expect(c1).toBeTypeOf("string");
      expect(c2).toBeTypeOf("string");
      expect(c1).not.toBe(c2);
      expect(c1.length).toBeGreaterThanOrEqual(40);
    });

    it("enforces strict single-use challenge consumption (replay protection)", () => {
      const challenge = challengeStore.generateSecureChallenge();
      challengeStore.saveChallenge(ownerId, challenge, "registration");

      // First consumption succeeds
      const consumed = challengeStore.consumeChallenge(ownerId, "registration", challenge);
      expect(consumed).toBe(challenge);

      // Immediate second consumption returns null (cannot be reused)
      const secondAttempt = challengeStore.consumeChallenge(ownerId, "registration", challenge);
      expect(secondAttempt).toBeNull();
    });

    it("rejects expired challenges beyond TTL", async () => {
      const challenge = challengeStore.generateSecureChallenge();
      // Save with 1ms TTL
      challengeStore.saveChallenge(ownerId, challenge, "authentication", 1);

      await new Promise((resolve) => setTimeout(resolve, 20));

      const consumed = challengeStore.consumeChallenge(ownerId, "authentication", challenge);
      expect(consumed).toBeNull();
    });

    it("isolates registration and authentication challenges for the same owner", () => {
      const regChallenge = challengeStore.generateSecureChallenge();
      const authChallenge = challengeStore.generateSecureChallenge();

      challengeStore.saveChallenge(ownerId, regChallenge, "registration");
      challengeStore.saveChallenge(ownerId, authChallenge, "authentication");

      // Consuming registration does not affect authentication
      expect(challengeStore.consumeChallenge(ownerId, "registration", regChallenge)).toBe(regChallenge);
      expect(challengeStore.consumeChallenge(ownerId, "registration", regChallenge)).toBeNull();
      expect(challengeStore.consumeChallenge(ownerId, "authentication", authChallenge)).toBe(authChallenge);
    });
  });

  // =========================================================================
  // 2. Authorization & Cross-Owner Security Boundaries
  // =========================================================================
  describe("Authorization & Security Boundaries", () => {
    it("requires authentication for registration and authentication option endpoints", async () => {
      const res = await request(app).post(`/api/v1/vault/${ownerId}/webauthn/register/options`);
      expect(res.status).toBe(401);
    });

    it("forbids cross-owner access when Owner A tries to access Owner B's ceremony", async () => {
      const otherOwner = await db.owner.create({
        data: {
          externalReference: "owner_b_target",
          availability: { create: { state: "ACTIVE" } },
        },
      });

      // Request with Owner A token targeting Owner B
      const res = await request(app)
        .post(`/api/v1/vault/${otherOwner.id}/webauthn/register/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(403);
    });

    it("forbids registering a credential for another owner", async () => {
      const otherOwner = await db.owner.create({
        data: {
          externalReference: "owner_b_other",
          availability: { create: { state: "ACTIVE" } },
        },
      });

      const res = await request(app)
        .post(`/api/v1/vault/${otherOwner.id}/webauthn/register/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          id: "cred_hack_01",
          response: {
            clientDataJSON: "eyJ0eXBlIjoid2ViYXV0aG4uY3JlYXRlIn0",
            attestationObject: "o2NmbXRkbm9uZ",
          },
        });

      expect(res.status).toBe(403);
    });
  });

  // =========================================================================
  // 3. WebAuthn Registration Flow
  // =========================================================================
  describe("WebAuthn Registration Ceremony", () => {
    it("generates proper WebAuthn registration options with RP config and userVerification", async () => {
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/register/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challenge).toBeDefined();
      expect(res.body.data.rp.name).toBe("Heirloom");
      expect(res.body.data.rp.id).toBe("localhost");
      expect(res.body.data.authenticatorSelection.userVerification).toBe("required");
      expect(res.body.data.authenticatorSelection.authenticatorAttachment).toBe("platform");
    });

    it("fails registration verification if challenge is missing or expired", async () => {
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/register/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          id: "cred_unsolicited_01",
          response: {
            clientDataJSON: Buffer.from(JSON.stringify({ challenge: "fake" })).toString("base64url"),
            attestationObject: "o2NmbXRkbm9uZ",
          },
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("challenge expired or not found");
    });

    it("cryptographically rejects invalid/corrupted registration attestation", async () => {
      // 1. Generate legitimate options and challenge
      const optRes = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/register/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      const challenge = optRes.body.data.challenge;

      // 2. Submit forged attestation with real challenge
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/register/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          id: "cred_corrupt_test_01",
          rawId: "cred_corrupt_test_01",
          response: {
            clientDataJSON: Buffer.from(
              JSON.stringify({
                type: "webauthn.create",
                challenge,
                origin: "http://localhost:5173",
              })
            ).toString("base64url"),
            attestationObject: "invalid_garbage_attestation_bytes",
          },
          type: "public-key",
        });

      // Must be rejected by real cryptographic parser
      expect(res.status).toBe(400);
      expect(res.body.message).toContain("registration verification failed");
    });

    it("prevents duplicate registration of the same credential ID", async () => {
      await repo.create({
        ownerId,
        credentialId: "cred_existing_unique_01",
        publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEfakeKey",
        counter: 0n,
      });

      const optRes = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/register/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(optRes.status).toBe(200);
      const excluded = optRes.body.data.excludeCredentials;
      expect(excluded.some((c: any) => c.id === "cred_existing_unique_01")).toBe(true);
    });
  });

  // =========================================================================
  // 4. WebAuthn Authentication / Proof-of-Life Flow (REAL Cryptography)
  // =========================================================================
  describe("WebAuthn Authentication & Biometric Proof-of-Life", () => {
    it("rejects authentication options request if owner has no registered credentials", async () => {
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("No WebAuthn credentials registered");
    });

    it("returns authentication options when credential is registered", async () => {
      await repo.create({
        ownerId,
        credentialId: "cred_registered_owner_01",
        publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEtestKey",
        counter: 1n,
      });

      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.challenge).toBeDefined();
      expect(res.body.data.allowCredentials).toHaveLength(1);
      expect(res.body.data.allowCredentials[0].id).toBe("cred_registered_owner_01");
      expect(res.body.data.userVerification).toBe("required");
    });

    it("rejects assertion if credential belongs to another owner", async () => {
      const victimOwner = await db.owner.create({
        data: {
          externalReference: "victim_owner_99",
          availability: { create: { state: "ACTIVE" } },
        },
      });

      await repo.create({
        ownerId: victimOwner.id,
        credentialId: "cred_victim_key",
        publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEotherKey",
        counter: 0n,
      });

      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          credentialId: "cred_victim_key",
          signature: "0x_attacker_sig",
          clientDataJson: "{}",
          authenticatorData: "{}",
        });

      // Must be forbidden (cross-owner credential hijacking attempt)
      expect(res.status).toBe(403);
      expect(res.body.message).toContain("does not belong to the authenticated owner");
    });

    it("CRITICAL: Failed biometric assertion NEVER resets availability or creates false proof-of-life", async () => {
      // Put owner into WATCH state with missed pings
      await db.ownerAvailability.update({
        where: { ownerId },
        data: {
          state: "WATCH",
          missedCount: 4,
          stateReason: "Extended silence in WATCH state",
        },
      });

      await repo.create({
        ownerId,
        credentialId: "cred_bio_test_01",
        publicKey: "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAErealKey",
        counter: 5n,
      });

      // Issue challenge
      await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      // Submit invalid assertion signature
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          credentialId: "cred_bio_test_01",
          signature: "forged_cryptographic_signature_value",
          clientDataJson: Buffer.from(
            JSON.stringify({
              type: "webauthn.get",
              challenge: "random_unknown_challenge",
              origin: "http://localhost:5173",
            })
          ).toString("base64url"),
          authenticatorData: Buffer.from("fake_auth_data").toString("base64url"),
        });

      // Assertion must fail
      expect(res.status).toBe(400);

      // Verify availability state in DB: MUST REMAIN WATCH, MISSED COUNT 4
      const avail = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(avail?.state).toBe("WATCH");
      expect(avail?.missedCount).toBe(4);

      // No successful biometric heartbeat event should be created
      const events = await db.heartbeatEvent.findMany({
        where: { ownerId, channel: "BIOMETRIC" },
      });
      expect(events).toHaveLength(0);
    });

    it("CRITICAL: Real cryptographic WebAuthn verification succeeds with authentic P-256 signature, resets WATCH to ACTIVE, and advances counter", async () => {
      // 1. Put owner in WATCH state
      await db.ownerAvailability.update({
        where: { ownerId },
        data: {
          state: "WATCH",
          missedCount: 3,
        },
      });

      // 2. Generate a REAL cryptographic P-256 ECDSA keypair
      const keypair = generateRealWebAuthnKeyPair();
      const credentialId = `cred_p256_${Date.now()}`;

      // 3. Register credential in DB with real COSE public key bytes
      await repo.create({
        ownerId,
        credentialId,
        publicKey: keypair.publicKeyBase64Url,
        counter: 1n,
      });

      // 4. Request authentication options to generate genuine server challenge
      const optRes = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/options`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(optRes.status).toBe(200);
      const challenge = optRes.body.data.challenge;

      // 5. Generate REAL cryptographic signature using the P-256 private key
      // Counter advances from 1 to 2
      const assertion = createRealAssertionSignature(
        keypair.privateKey,
        challenge,
        "localhost",
        "http://localhost:5173",
        2
      );

      // 6. Submit real WebAuthn assertion to verification endpoint
      const res = await request(app)
        .post(`/api/v1/vault/${ownerId}/webauthn/authenticate/verify`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`)
        .send({
          id: credentialId,
          rawId: credentialId,
          response: {
            clientDataJSON: assertion.clientDataJson,
            authenticatorData: assertion.authenticatorData,
            signature: assertion.signature,
          },
          type: "public-key",
        });

      // Expect real cryptographic verification to succeed!
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.verified).toBe(true);

      // 7. Verify availability is reset to ACTIVE and missedCount = 0
      const avail = await db.ownerAvailability.findUnique({ where: { ownerId } });
      expect(avail?.state).toBe("ACTIVE");
      expect(avail?.missedCount).toBe(0);
      expect(avail?.lastHeartbeatAt).toBeDefined();

      // 8. Verify authenticator counter was incremented in DB
      const updatedCred = await repo.findByCredentialId(credentialId);
      expect(Number(updatedCred?.counter)).toBe(2);

      // 9. Verify audit event was recorded with BIOMETRIC channel
      const audit = await db.auditEvent.findFirst({
        where: { actorId: ownerId, eventType: "HEARTBEAT_RECEIVED" },
      });
      expect(audit).toBeDefined();
      expect(JSON.parse(audit?.metadata || "{}").channel).toBe("BIOMETRIC");
    });
  });

  // =========================================================================
  // 5. Credential Registry Management
  // =========================================================================
  describe("Credential Registry Listing & Deletion", () => {
    it("lists registered credentials with safe metadata and NEVER exposes public key", async () => {
      await repo.create({
        ownerId,
        credentialId: "cred_meta_test_01",
        publicKey: "SUPER_SECRET_PUBLIC_KEY_MATERIAL",
        counter: 10n,
        transports: ["internal", "hybrid"],
      });

      const res = await request(app)
        .get(`/api/v1/vault/${ownerId}/webauthn/credentials`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);

      const cred = res.body.data[0];
      expect(cred.credentialId).toBe("cred_meta_test_01");
      expect(cred.transports).toEqual(["internal", "hybrid"]);
      // Crucial: Public key must NOT be returned in list
      expect(cred.publicKey).toBeUndefined();
    });

    it("allows owner to delete their registered credential", async () => {
      await repo.create({
        ownerId,
        credentialId: "cred_to_delete",
        publicKey: "key_data",
        counter: 0n,
      });

      const res = await request(app)
        .delete(`/api/v1/vault/${ownerId}/webauthn/credentials/cred_to_delete`)
        .set("Authorization", `Bearer test-owner-token-${ownerId}`);

      expect(res.status).toBe(200);
      expect(res.body.data.deleted).toBe(true);

      const remaining = await repo.findManyByOwnerId(ownerId);
      expect(remaining).toHaveLength(0);
    });
  });
});

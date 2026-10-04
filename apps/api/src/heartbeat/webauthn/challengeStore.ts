import crypto from "crypto";

export type ChallengeType = "registration" | "authentication";

export interface ChallengeRecord {
  challenge: string;
  ownerId: string;
  type: ChallengeType;
  createdAt: number;
  expiresAt: number;
}

/**
 * ChallengeStore
 *
 * Implements ephemeral, cryptographically secure challenge lifecycle management
 * for WebAuthn registration and authentication ceremonies.
 *
 * Security Guarantees:
 * - Cryptographically random (crypto.randomBytes 32-byte Base64URL)
 * - Bound to specific ownerId and operation type
 * - Dual-indexed (by challenge token and by owner latest) to prevent Denial-of-Service attacks
 *   where an attacker submitting a forged challenge would evict legitimate pending challenges
 * - Strictly single-use (atomically consumed and removed upon successful match)
 * - Short-lived (default 5 minute TTL)
 * - Automatic eviction of expired challenges
 * - Replay attack prevention: once consumed or expired, challenge cannot be reused
 */
export class ChallengeStore {
  private static instance: ChallengeStore;
  // Primary index: challenge string -> record
  private readonly challengesByToken: Map<string, ChallengeRecord> = new Map();
  // Secondary index: "ownerId:type" -> latest challenge string
  private readonly ownerLatestChallenge: Map<string, string> = new Map();
  private readonly sweepInterval: NodeJS.Timeout;

  constructor(private readonly defaultTtlMs: number = 300_000) {
    // Periodic background sweep to purge expired challenges
    this.sweepInterval = setInterval(() => {
      this.purgeExpired();
    }, 60_000);

    // Unref so that background timer does not hold node process open in tests
    if (this.sweepInterval.unref) {
      this.sweepInterval.unref();
    }
  }

  public static getInstance(): ChallengeStore {
    if (!ChallengeStore.instance) {
      ChallengeStore.instance = new ChallengeStore();
    }
    return ChallengeStore.instance;
  }

  private buildOwnerKey(ownerId: string, type: ChallengeType): string {
    return `${ownerId}:${type}`;
  }

  /**
   * Generates a cryptographically random Base64URL challenge string (32 bytes entropy).
   */
  public generateSecureChallenge(): string {
    return crypto.randomBytes(32).toString("base64url");
  }

  /**
   * Stores a challenge for an owner and operation type with TTL.
   * Any prior pending challenge for this owner and type is invalidated.
   */
  public saveChallenge(
    ownerId: string,
    challenge: string,
    type: ChallengeType,
    ttlMs: number = this.defaultTtlMs
  ): ChallengeRecord {
    const ownerKey = this.buildOwnerKey(ownerId, type);
    const now = Date.now();

    // Clean up any previous pending challenge for this owner and operation
    const priorChallenge = this.ownerLatestChallenge.get(ownerKey);
    if (priorChallenge) {
      this.challengesByToken.delete(priorChallenge);
    }

    const record: ChallengeRecord = {
      challenge,
      ownerId,
      type,
      createdAt: now,
      expiresAt: now + ttlMs,
    };

    this.challengesByToken.set(challenge, record);
    this.ownerLatestChallenge.set(ownerKey, challenge);
    return record;
  }

  /**
   * Consumes a challenge atomically (single-use guarantee).
   * If candidateChallenge is provided, only consumes if it strictly matches and is valid.
   * If not provided, consumes the latest active challenge for that owner and type.
   * Returns null if not found, expired, or mismatch.
   */
  public consumeChallenge(
    ownerId: string,
    type: ChallengeType,
    candidateChallenge?: string
  ): string | null {
    const now = Date.now();

    if (candidateChallenge) {
      const record = this.challengesByToken.get(candidateChallenge);
      if (!record) {
        return null;
      }

      // Verify owner and type binding
      if (record.ownerId !== ownerId || record.type !== type) {
        return null;
      }

      // Check expiry
      if (now > record.expiresAt) {
        this.challengesByToken.delete(candidateChallenge);
        const ownerKey = this.buildOwnerKey(ownerId, type);
        if (this.ownerLatestChallenge.get(ownerKey) === candidateChallenge) {
          this.ownerLatestChallenge.delete(ownerKey);
        }
        return null;
      }

      // Atomically delete upon successful match (single-use)
      this.challengesByToken.delete(candidateChallenge);
      const ownerKey = this.buildOwnerKey(ownerId, type);
      if (this.ownerLatestChallenge.get(ownerKey) === candidateChallenge) {
        this.ownerLatestChallenge.delete(ownerKey);
      }

      return record.challenge;
    }

    // Fallback: Consume latest challenge for owner and type
    const ownerKey = this.buildOwnerKey(ownerId, type);
    const latestChallenge = this.ownerLatestChallenge.get(ownerKey);
    if (!latestChallenge) {
      return null;
    }

    this.ownerLatestChallenge.delete(ownerKey);
    const record = this.challengesByToken.get(latestChallenge);
    if (!record) {
      return null;
    }

    this.challengesByToken.delete(latestChallenge);

    if (now > record.expiresAt) {
      return null;
    }

    return record.challenge;
  }

  /**
   * Validates whether a challenge matches the active challenge for the owner,
   * and consumes it if valid.
   */
  public verifyAndConsumeChallenge(
    ownerId: string,
    type: ChallengeType,
    candidateChallenge: string
  ): boolean {
    const consumed = this.consumeChallenge(ownerId, type, candidateChallenge);
    return consumed !== null && consumed === candidateChallenge;
  }

  /**
   * Explicitly invalidates any pending challenge for an owner.
   */
  public invalidate(ownerId: string, type?: ChallengeType): void {
    if (type) {
      const ownerKey = this.buildOwnerKey(ownerId, type);
      const challenge = this.ownerLatestChallenge.get(ownerKey);
      if (challenge) {
        this.challengesByToken.delete(challenge);
        this.ownerLatestChallenge.delete(ownerKey);
      }
    } else {
      this.invalidate(ownerId, "registration");
      this.invalidate(ownerId, "authentication");
    }
  }

  /**
   * Cleans up expired entries.
   */
  public purgeExpired(): void {
    const now = Date.now();
    for (const [token, record] of this.challengesByToken.entries()) {
      if (now > record.expiresAt) {
        this.challengesByToken.delete(token);
        const ownerKey = this.buildOwnerKey(record.ownerId, record.type);
        if (this.ownerLatestChallenge.get(ownerKey) === token) {
          this.ownerLatestChallenge.delete(ownerKey);
        }
      }
    }
  }

  /**
   * Clear all stored challenges (for test resets).
   */
  public clear(): void {
    this.challengesByToken.clear();
    this.ownerLatestChallenge.clear();
  }
}

export const challengeStore = ChallengeStore.getInstance();

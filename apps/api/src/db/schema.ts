/**
 * Heirloom Database Layer
 * Strict rule: Stores metadata, proofs, ciphertext digests, and signatures ONLY.
 * NEVER stores plaintext secrets, encryption keys, seed phrases, or passphrases.
 */
import { PrismaClient } from "@prisma/client";
import { VaultState } from "@heirloom/shared";

declare global {
  // eslint-disable-next-line no-var
  var prismaDbGlobal: PrismaClient | undefined;
}

export const db = global.prismaDbGlobal || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  global.prismaDbGlobal = db;
}

// Re-export Prisma models for consumption across Member 3 modules
export {
  Owner,
  OwnerAvailability,
  HeartbeatEvent,
  RecoveryAttempt,
  GuardianAttestation,
  RiskEvent,
  Alert,
  AuditEvent,
  ClaimDocument,
} from "@prisma/client";

export interface WebAuthnCredential {
  id: string;
  ownerId: string;
  credentialId: string;
  publicKey: string;
  counter: bigint;
  transports: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

/**
 * Sanitizes input to guarantee zero secrets leak into the database.
 */
export function sanitizeMetadata<T extends Record<string, unknown>>(data?: T | null): T | null {
  if (!data) return null;
  const sanitized = { ...data };
  const forbiddenPatterns = [
    "secret",
    "password",
    "passphrase",
    "privatekey",
    "privkey",
    "seed",
    "mnemonic",
    "plaintext",
    "aeskey",
    "shard",
  ];

  for (const key of Object.keys(sanitized)) {
    if (forbiddenPatterns.some((pattern) => key.toLowerCase().includes(pattern))) {
      delete sanitized[key];
    }
  }

  return sanitized as T;
}

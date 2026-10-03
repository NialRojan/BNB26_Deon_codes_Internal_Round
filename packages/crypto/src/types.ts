/**
 * Member 1 crypto module shared types.
 *
 * These describe what is encrypted, how it is packaged, who holds which
 * piece of key material, and the owner-signed release policy. They are
 * deliberately free of any trigger, guardian, or blockchain logic.
 */

/** Asset classes the vault can hold. */
export type AssetType = "crypto" | "access-kit" | "legal-packet";

/** Room to hang asset-specific metadata without coupling it to the crypto. */
export type AssetMetadata = Record<string, unknown>;

/**
 * A single ciphertext envelope produced by the browser.
 *
 * The plaintext never leaves the page; this object is what gets sent to the
 * backend (and later to the storage layer) for the inheritance work.
 */
export type EncryptedAsset = {
  /** Asset class this envelope protects. */
  assetType: AssetType;
  /** Stable asset identifier (owner-assigned). */
  assetId: string;
  /** Algorithm identifier for consumers. */
  algorithm: "AES-256-GCM";
  /** 96-bit random nonce, base64url-encoded. */
  iv: string;
  /** Raw ciphertext, base64url-encoded. */
  ciphertext: string;
  /** When the envelope was produced. */
  createdAt: string;
  /** Arbitrary, non-sensitive metadata the owner chose. */
  metadata?: AssetMetadata;
};

/** A single heir key pair held in the browser (public for encrypting, private stays client-side). */
export type HeirKeyPair = {
  publicKey: CryptoKey;
  privateKey: CryptoKey;
};

/** A share of the vault key, pure metadata + opaque share string. */
export type KeyShare = {
  /** Stable holder identifier chosen by members 2/3. */
  holderId: string;
  /** Role label. Metadata only — never used to grant or deny recovery. */
  holderType:
    | "guardian"
    | "timelock"
    | "heirloom"
    | "heir";
  share: string;
};

/** Check-in / grace period settings for a release policy. */
export type CheckInConfig = {
  /** Seconds the beneficiary may wait before the policy is exercisable. */
  gracePeriodSeconds: number;
};

/** Delay applied after all conditions are met before funds unlock. */
export type DelayConfig = {
  /** Seconds to wait after the policy is satisfied. */
  seconds: number;
};

/** Beneficiary tier used for tagging and later policy logic (metadata only). */
export type BeneficiaryTier = "standard" | "higher" | "restricted";

/** Owner-signed release policy, completely separated from recovery engines. */
export type ReleasePolicy = {
  /** Owner identifier. */
  owner: string;
  /** Asset identifier this policy governs. */
  assetId: string;
  /** Beneficiary identifier. */
  beneficiary: string;
  /** Check-in configuration. */
  checkIn: CheckInConfig;
  /** Guardian threshold required before release (metadata only). */
  guardianThreshold: number;
  /** Required evidence description. */
  requiredEvidence: string;
  /** Delay configuration. */
  delay: DelayConfig;
  /** Beneficiary tier. */
  beneficiaryTier: BeneficiaryTier;
  /** Asset type this policy wraps. */
  assetType: AssetType;
};

/**
 * Canonical serialization fields used as the signature domain.
 *
 * Any change to owner, assetId, beneficiary, threshold, evidence, delay, or
 * tier produces a different byte string, which fails verification.
 */
export type PolicySignFields = {
  owner: string;
  assetId: string;
  beneficiary: string;
  guardianThreshold: number;
  requiredEvidence: string;
  delaySeconds: number;
  beneficiaryTier: BeneficiaryTier;
  assetType: AssetType;
};

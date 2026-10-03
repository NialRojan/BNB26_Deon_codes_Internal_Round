import { describe, it, expect } from "vitest";
import {
  generateOwnerSigningKeyPair,
  signPolicy,
  verifyPolicy,
  policySignFields,
  canonicalPolicyBytesForSigning,
} from "../src/index";
import type { ReleasePolicy } from "../src/index";

describe("owner-signed release policy", () => {
  const policy: ReleasePolicy = {
    owner: "owner-alice",
    assetId: "asset-doc-001",
    beneficiary: "heir-bob",
    checkIn: { gracePeriodSeconds: 300 },
    guardianThreshold: 2,
    requiredEvidence: "two-notarized-identity-cards",
    delay: { seconds: 0 },
    beneficiaryTier: "standard",
    assetType: "legal-packet",
  };

  it("valid policy + valid signature -> passes", async () => {
    const kp = await generateOwnerSigningKeyPair();
    const sig = await signPolicy(policy, kp.privateKey);
    const ok = await verifyPolicy(policy, sig, kp.publicKey);
    expect(ok).toBe(true);
  });

  it("modified policy -> fails", async () => {
    const kp = await generateOwnerSigningKeyPair();
    const sig = await signPolicy(policy, kp.privateKey);
    const modified = { ...policy, owner: "owner-evil" };
    const ok = await verifyPolicy(modified, sig, kp.publicKey);
    expect(ok).toBe(false);
  });

  it("modified signature -> fails", async () => {
    const kp = await generateOwnerSigningKeyPair();
    const sig = await signPolicy(policy, kp.privateKey);
    const bad = new Uint8Array(sig).slice(0, sig.byteLength - 1).buffer;
    const ok = await verifyPolicy(policy, bad, kp.publicKey);
    expect(ok).toBe(false);
  });

  it("wrong public key -> fails", async () => {
    const kpA = await generateOwnerSigningKeyPair();
    const kpB = await generateOwnerSigningKeyPair();
    const sig = await signPolicy(policy, kpA.privateKey);
    const ok = await verifyPolicy(policy, sig, kpB.publicKey);
    expect(ok).toBe(false);
  });

  it("policySignFields covers the signing subset", () => {
    const fields = policySignFields(policy);
    expect(fields.owner).toBe(policy.owner);
    expect(fields.assetId).toBe(policy.assetId);
    expect(fields.beneficiary).toBe(policy.beneficiary);
    expect(fields.guardianThreshold).toBe(policy.guardianThreshold);
    expect(fields.requiredEvidence).toBe(policy.requiredEvidence);
    expect(fields.delaySeconds).toBe(policy.delay.seconds);
    expect(fields.beneficiaryTier).toBe(policy.beneficiaryTier);
    expect(fields.assetType).toBe(policy.assetType);
  });

  it("canonical bytes deterministic — identical policy => identical bytes", () => {
    const a = canonicalPolicyBytesForSigning(policy);
    const b = canonicalPolicyBytesForSigning(policy);
    expect(a).toEqual(b);
  });
});

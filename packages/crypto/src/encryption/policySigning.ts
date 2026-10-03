import type { PolicySignFields, ReleasePolicy } from "../types";
import { toArrayBuffer } from "../encoding";

export async function generateOwnerSigningKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey({ name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" }, true, ["sign", "verify"]);
}
export function serializePolicyForSigning(policy: ReleasePolicy): PolicySignFields {
  return { owner: policy.owner, assetId: policy.assetId, beneficiary: policy.beneficiary, guardianThreshold: policy.guardianThreshold, requiredEvidence: policy.requiredEvidence, delaySeconds: policy.delay.seconds, beneficiaryTier: policy.beneficiaryTier, assetType: policy.assetType };
}
export function canonicalPolicyBytes(policy: ReleasePolicy): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(serializePolicyForSigning(policy)));
}
export async function signReleasePolicy(policy: ReleasePolicy, privateKey: CryptoKey): Promise<ArrayBuffer> {
  return crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5" }, privateKey, toArrayBuffer(canonicalPolicyBytes(policy)));
}
export async function verifyReleasePolicy(policy: ReleasePolicy, signature: ArrayBuffer, publicKey: CryptoKey): Promise<boolean> {
  try { return await crypto.subtle.verify({ name: "RSASSA-PKCS1-v1_5" }, publicKey, signature, toArrayBuffer(canonicalPolicyBytes(policy))); } catch { return false; }
}
export const signPolicy = signReleasePolicy;
export const verifyPolicy = verifyReleasePolicy;
export function canonicalPolicyBytesForSigning(policy: ReleasePolicy) { return canonicalPolicyBytes(policy); }
export function policySignFields(policy: ReleasePolicy) { return serializePolicyForSigning(policy); }

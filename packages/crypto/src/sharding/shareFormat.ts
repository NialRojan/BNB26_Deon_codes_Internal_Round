import { fromBase64url, toBase64url } from "../encoding";
import type { KeyShare } from "../types";

const VERSION = 1;
export type SerializedShare = { version: 1; holderId: string; holderType: KeyShare["holderType"]; share: string };
export function serializeShare(share: KeyShare): string {
  return toBase64url(new TextEncoder().encode(JSON.stringify({ version: VERSION, ...share })));
}
export function parseShare(serialized: string): KeyShare {
  const parsed: unknown = JSON.parse(new TextDecoder().decode(fromBase64url(serialized)));
  if (!parsed || typeof parsed !== "object") throw new Error("Invalid share envelope");
  const value = parsed as Partial<SerializedShare>;
  if (value.version !== VERSION || typeof value.holderId !== "string" || typeof value.share !== "string" || !["guardian", "timelock", "heirloom", "heir"].includes(value.holderType ?? "")) throw new Error("Unsupported or malformed share envelope");
  return { holderId: value.holderId, holderType: value.holderType!, share: value.share };
}

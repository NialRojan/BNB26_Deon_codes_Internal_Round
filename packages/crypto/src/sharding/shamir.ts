import type { KeyShare } from "../types";
import { split, combine } from "shamir-secret-sharing";
import { fromBase64url, toBase64url } from "../encoding";

/**
 * Thin, well-defined interface over `shamir-secret-sharing`.
 *
 * The crypto layer never implements the polynomial math; it only:
 *  - maps the library's raw `Uint8Array` shares (each is `secret.length + 1`
 *    bytes long, with the final byte being the x-coordinate) onto opaque
 *    `KeyShare` objects the UI / recovery engine works with, and
 *  - maps back when reconstruction is requested.
 *
 * Members 2/3 decide which holders' shares count and in what order.
 * The recovery engine supplies k valid shares; this module just combines.
 */

/** A single share in the library's raw form: secret-length y bytes + x byte. */
export type RawShare = {
  x: number;
  y: Uint8Array;
};

/** Split result: k-of-n alongside the raw shares. */
export type KeySharingEnvelope = {
  k: number;
  n: number;
  shares: RawShare[];
};

/**
 * Split a vault key into n shares, requiring k of n.
 *
 * Rejects malformed or insecure parameters instead of silently falling back.
 */
export async function splitKey(
  secret: Uint8Array,
  k: number,
  n: number,
): Promise<KeySharingEnvelope> {
  if (!Number.isInteger(k) || !Number.isInteger(n)) {
    throw new Error("Shamir: k and n must be integers");
  }
  if (n < 2) throw new Error("Shamir: n must be >= 2");
  if (k < 2 || k >= n) throw new Error("Shamir: k must be >= 2 and < n");
  if (secret.length < 16) throw new Error("Shamir: secret must be at least 16 bytes");

  const rawShares = await split(secret, n, k); // (secret, n, k) in the library
  const shares = rawShares.map((share) => ({
    x: share[secret.length]!,
    y: share.subarray(0, secret.length), // commit value, exclude x
  }));
  return { k, n, shares };
}

/**
 * Reconstruct the vault key from a set of shares.
 *
 * Throws when fewer than k shares were supplied or any share is malformed.
 * Members 2/3 control how many valid shares are fed in.
 */
export async function combineKey(shares: RawShare[], k: number): Promise<Uint8Array> {
  if (!Array.isArray(shares) || shares.length < 2) {
    throw new Error("combineKey: need an array of at least 2 shares");
  }
  if (!Number.isInteger(k) || k < 2 || k > shares.length) {
    throw new Error("combineKey: k must be an integer 2..share count");
  }

  // Rebuild the full library shares: secret-length y bytes + x-byte.
  const ordered = shares
    .map((s) => ({ x: s.x, y: s.y }))
    .sort((a, b) => a.x - b.x);
  const libShares = ordered.map((s) => {
    const buf = new Uint8Array(s.y.length + 1);
    buf.set(s.y, 0);
    buf[s.y.length] = s.x & 0xff;
    return buf;
  });

  const recovered = await combine(libShares);
  if (!recovered) throw new Error("combineKey: could not reconstruct secret");
  return recovered as Uint8Array;
}

/** Turn a raw share into the UI-facing `KeyShare`, preserving x. */
export function toKeyShare(
  holderId: string,
  holderType: "guardian" | "timelock" | "heirloom" | "heir",
  share: RawShare,
): KeyShare {
  // Encode x (1 byte) + y so the recovery engine can reconstruct the
  // polynomial points later without needing trusted slot metadata.
  const payload = new Uint8Array(1 + share.y.length);
  payload[0] = share.x & 0xff;
  payload.set(share.y, 1);
  return {
    holderId,
    holderType,
    share: toBase64url(payload),
  };
}

export async function splitVaultKey(vaultKeyBytes: Uint8Array, totalShares: number, threshold: number): Promise<KeyShare[]> {
  if (!Number.isInteger(totalShares) || totalShares < 2) throw new Error("totalShares must be an integer >= 2");
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > totalShares) throw new Error("threshold must be 2..totalShares");
  const { shares } = await splitKey(vaultKeyBytes, threshold, totalShares);
  return shares.map((share, index) => toKeyShare(`member-${index + 1}`, "heirloom", share));
}

export async function combineVaultShares(shares: KeyShare[], threshold: number): Promise<Uint8Array> {
  if (shares.length < threshold) throw new Error("Insufficient shares to reconstruct the vault key");
  const raw = shares.map(({ share }) => {
    const bytes = fromBase64url(share);
    if (bytes.length < 17) throw new Error("Malformed share");
    return { x: bytes[0]!, y: bytes.subarray(1) };
  });
  return combineKey(raw, threshold);
}

/**
 * Messages signed by wallets for the key-escrow flow (option B: guardian-held Shamir shares,
 * released only after HeirloomVault.isExecuted()). Frontend signs, backend verifies — both
 * build the exact same string from here.
 */
import { keccak256, stringToHex } from "viem";

export type EscrowRole = "GUARDIAN" | "HEIR";

export const digest = (value: unknown) => keccak256(stringToHex(typeof value === "string" ? value : JSON.stringify(value)));

export const escrowMessages = {
  registerKey: (vault: string, role: EscrowRole, publicKey: string) =>
    `Heirloom: register ${role.toLowerCase()} encryption key\nvault: ${vault.toLowerCase()}\nkey: ${digest(publicKey)}`,
  sealSecret: (vault: string, label: string, asset: unknown, shares: unknown, recipients: string[] | null = null) =>
    `Heirloom: seal secret "${label}"\nvault: ${vault.toLowerCase()}\nfor: ${recipients ? recipients.map((r) => r.toLowerCase()).join(",") : "all heirs"}\ncontent: ${digest({ asset, shares })}`,
  releaseShare: (secretId: string, guardian: string, releases: unknown) =>
    `Heirloom: release key share\nsecret: ${secretId}\nguardian: ${guardian.toLowerCase()}\nshares: ${digest(releases)}`,
};

/** Messages signed by wallets in the B2B2C (law-firm) flow. Frontend signs, backend verifies. */
import { digest } from "./escrow.js";

export const b2bMessages = {
  firmLogin: (address: string, issuedAt: string) =>
    `Heirloom: law-firm sign-in\nwallet: ${address.toLowerCase()}\nissued: ${issuedAt}`,
  updateAssets: (vault: string, assets: unknown) =>
    `Heirloom: update asset register\nvault: ${vault.toLowerCase()}\ncontent: ${digest(assets)}`,
};

/** EIP-712 types for HeirloomVault.attestGuardianWithSig (domain name "HeirloomVault", version "2"). */
export const attestTypedData = (vault: `0x${string}`, chainId: number, epoch: bigint, deadline: bigint) =>
  ({
    domain: { name: "HeirloomVault", version: "2", chainId, verifyingContract: vault },
    types: { Attest: [{ name: "vault", type: "address" }, { name: "epoch", type: "uint256" }, { name: "deadline", type: "uint256" }] },
    primaryType: "Attest",
    message: { vault, epoch, deadline },
  }) as const;

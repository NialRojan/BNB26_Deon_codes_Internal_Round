import type { EncryptedAsset } from "../types";
import { decryptVaultBlob, encryptVaultBlob } from "../encryption/vaultCipher";

export type CryptoVaultPayload = EncryptedAsset;
export const packageCryptoVault = encryptVaultBlob;
export const openCryptoVault = decryptVaultBlob;

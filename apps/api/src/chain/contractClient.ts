import { createPublicClient, http, isAddress, type Address, type PublicClient } from "viem";
import { sepolia } from "viem/chains";
import { logger } from "../config/logger.js";
import { VaultState, heirloomVaultAbi, deployments } from "@heirloom/shared";

export interface OnChainVaultStateResponse {
  vaultAddress: string;
  state: VaultState;
  /** Raw HeirloomVault.currentState(): 0 Active, 1 Watch, 2 TriggerPending, 3 Executed */
  onChainState: number;
  owner: string;
  guardianCount: number;
  thresholdK: number;
  currentSignatures: number;
  vetoTimerActive: boolean;
  vetoDeadlineTimestamp?: number;
  lastHeartbeatTimestamp: number;
  watchStartsAtTimestamp: number;
  executedAtTimestamp?: number;
  ethBalanceWei: string;
}

/** Contract state (uint8) -> backend lifecycle state (packages/shared VaultState). */
export const ON_CHAIN_TO_VAULT_STATE: Record<number, VaultState> = {
  0: VaultState.ACTIVE,
  1: VaultState.WATCH,
  2: VaultState.VETO_ACTIVE,
  3: VaultState.RELEASED,
};

export function createChainClient(rpcUrl: string): PublicClient {
  return createPublicClient({ chain: sepolia, transport: http(rpcUrl) }) as PublicClient;
}

/**
 * Reads HeirloomVault (Member 2) state from Sepolia.
 *
 * The backend only reads the chain. Owner vetoes and guardian attestations are signed by the
 * owner's / guardians' own wallets in the frontend; the contract deliberately gives the backend no
 * power to change vault state.
 */
export class ContractClient {
  private readonly client: PublicClient;

  constructor(
    private readonly rpcUrl = process.env.RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com",
    private readonly contractAddress = process.env.VAULT_CONTRACT_ADDRESS || deployments.sepolia.demoVault,
    client?: PublicClient
  ) {
    this.client = client ?? createChainClient(this.rpcUrl);
  }

  get defaultVaultAddress(): string {
    return this.contractAddress;
  }

  /** Reads on-chain vault state from HeirloomVault.sol. `vaultId` may be a vault address; otherwise the configured vault is used. */
  async getVaultState(vaultId?: string): Promise<OnChainVaultStateResponse> {
    const address = (vaultId && isAddress(vaultId) ? vaultId : this.contractAddress) as Address;
    logger.info(`[ContractClient] Reading on-chain state for vault ${address}`);

    const info = await this.client.readContract({ address, abi: heirloomVaultAbi, functionName: "getVaultInfo" });
    const onChainState = Number(info.state);
    const vetoEnd = Number(info.vetoEndTime);
    const executedAt = Number(info.executedAt);

    return {
      vaultAddress: address,
      state: ON_CHAIN_TO_VAULT_STATE[onChainState],
      onChainState,
      owner: info.owner,
      guardianCount: info.guardians.length,
      thresholdK: Number(info.requiredSignatures),
      currentSignatures: Number(info.currentSignatures),
      vetoTimerActive: onChainState === 2,
      vetoDeadlineTimestamp: vetoEnd > 0 ? vetoEnd : undefined,
      lastHeartbeatTimestamp: Number(info.lastHeartbeat),
      watchStartsAtTimestamp: Number(info.watchStartsAt),
      executedAtTimestamp: executedAt > 0 ? executedAt : undefined,
      ethBalanceWei: info.ethBalance.toString(),
    };
  }

  private vault(address?: string): Address {
    return (address && isAddress(address) ? address : this.contractAddress) as Address;
  }

  async isExecuted(vault?: string): Promise<boolean> {
    return this.client.readContract({ address: this.vault(vault), abi: heirloomVaultAbi, functionName: "isExecuted" });
  }

  async isGuardian(vault: string, who: string): Promise<boolean> {
    return this.client.readContract({ address: this.vault(vault), abi: heirloomVaultAbi, functionName: "isGuardian", args: [who as Address] });
  }

  async isBeneficiary(vault: string, who: string): Promise<boolean> {
    return this.client.readContract({ address: this.vault(vault), abi: heirloomVaultAbi, functionName: "isBeneficiary", args: [who as Address] });
  }

  async ownerOf(vault: string): Promise<string> {
    return this.client.readContract({ address: this.vault(vault), abi: heirloomVaultAbi, functionName: "owner" });
  }

  /**
   * Not supported on-chain: the veto window length is fixed per vault and only the owner can change
   * timings. A high fraud score should instead alert the owner so they veto from their wallet.
   */
  async extendVetoOnChain(recoveryClaimId: string, additionalDays: number): Promise<{ txHash: string; success: boolean }> {
    logger.warn(
      `[ContractClient] Veto extension of +${additionalDays}d for claim ${recoveryClaimId} requested, but HeirloomVault does not allow the backend to extend vetoes. Alert the owner instead.`
    );
    return { txHash: "", success: false };
  }

  /**
   * Not supported from the backend: vetoRecovery() must be signed by the owner's wallet (frontend).
   */
  async abortRecoveryOnChain(vaultId: string, ownerAddress: string): Promise<{ txHash: string; success: boolean }> {
    logger.warn(
      `[ContractClient] Abort for vault ${vaultId} by ${ownerAddress} requested, but vetoRecovery() must be signed by the owner wallet in the frontend.`
    );
    return { txHash: "", success: false };
  }
}

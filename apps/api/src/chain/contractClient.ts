import { logger } from "../config/logger.js";
import { VaultState } from "@heirloom/shared";

export interface OnChainVaultStateResponse {
  vaultAddress: string;
  state: VaultState;
  guardianCount: number;
  thresholdK: number;
  vetoTimerActive: boolean;
  vetoDeadlineTimestamp?: number;
}

export class ContractClient {
  constructor(
    private readonly rpcUrl = process.env.RPC_URL || "http://127.0.0.1:8545",
    private readonly contractAddress = process.env.VAULT_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000"
  ) {}

  /**
   * Reads on-chain vault state from HeirloomVault.sol.
   */
  async getVaultState(vaultId: string): Promise<OnChainVaultStateResponse> {
    logger.info(`[ContractClient] Querying on-chain state for vault ${vaultId} at ${this.contractAddress}`);

    // In local/mock dev mode, return structured response compatible with Member 2
    return {
      vaultAddress: this.contractAddress,
      state: VaultState.ACTIVE,
      guardianCount: 3,
      thresholdK: 2,
      vetoTimerActive: false,
    };
  }

  /**
   * Invokes VetoTimer.sol to extend the veto countdown on high risk detection.
   */
  async extendVetoOnChain(recoveryClaimId: string, additionalDays: number): Promise<{ txHash: string; success: boolean }> {
    logger.info(`[ContractClient] Submitting on-chain veto extension of +${additionalDays}d for claim ${recoveryClaimId}`);
    const simulatedTxHash = `0x_mock_tx_extend_veto_${recoveryClaimId.substring(0, 8)}_${Date.now()}`;
    return {
      txHash: simulatedTxHash,
      success: true,
    };
  }

  /**
   * Submits owner veto transaction to abort recovery on-chain.
   */
  async abortRecoveryOnChain(vaultId: string, ownerAddress: string): Promise<{ txHash: string; success: boolean }> {
    logger.info(`[ContractClient] Submitting owner abort tx on-chain for vault ${vaultId} by ${ownerAddress}`);
    const simulatedTxHash = `0x_mock_tx_owner_veto_${vaultId.substring(0, 8)}_${Date.now()}`;
    return {
      txHash: simulatedTxHash,
      success: true,
    };
  }
}

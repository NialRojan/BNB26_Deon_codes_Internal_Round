/**
 * Heirloom Protocol Vault States
 * Shared state definitions across Contracts (Member 2), Backend (Member 3),
 * Crypto Vault (Member 1), and Frontend (Member 4).
 */
export enum VaultState {
  /** Normal state: Proof-of-life heartbeats verified within expected threshold */
  ACTIVE = "Active",

  /** Heartbeats missed: Insufficient proof of life. Escalation & monitoring active. Does NOT mean deceased. */
  WATCH = "Watch",

  /** Recovery claim submitted by heir/guardian, awaiting validation */
  TRIGGER_PENDING = "TriggerPending",

  /** Consensus reaching threshold or document review in progress */
  RECOVERY_PENDING = "RecoveryPending",

  /** Timed veto countdown active: Owner has window to cancel with single click */
  VETO_ACTIVE = "VetoActive",

  /** Progressive disclosure release stages active (e.g., stage 1 legal, stage 2 financial) */
  STAGED_RELEASE = "StagedRelease",

  /** Inheritance fully released to verified beneficiaries */
  RELEASED = "Released",

  /** Cancelled/Aborted via owner veto or fraudulent claim rejection */
  CANCELLED = "Cancelled",
}

export type VaultStateString =
  | "Active"
  | "Watch"
  | "TriggerPending"
  | "RecoveryPending"
  | "VetoActive"
  | "StagedRelease"
  | "Released"
  | "Cancelled";

export interface VaultStateTransition {
  from: VaultState;
  to: VaultState;
  reason: string;
  actor: string;
  timestamp: string;
  txHash?: string;
}

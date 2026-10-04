import { createContext, useContext, useState, type ReactNode } from "react";
import { useVault } from "./vault";
import { useLiveB2B, type LiveExtras } from "./b2b2cLive";
import type { VaultRules } from "./vaultPlan";
import {
  INITIAL_CLIENT_VAULTS,
  LAW_FIRM,
  type ClientVault,
  type LawFirmInfo,
  type VaultStatus,
  type AssetRecord,
} from "../data/mockData";

export type Role = "lawyer" | "client" | "guardian" | "heir";

export interface B2B2CContextType {
  role: Role;
  setRole: (r: Role) => void;
  lawFirm: LawFirmInfo;
  vaults: ClientVault[];
  activeVaultId: string;
  setActiveVaultId: (id: string) => void;
  activeVault: ClientVault;
  createVault: (newVault: Omit<ClientVault, "id">, opts?: { rules?: VaultRules; salt?: bigint }) => Promise<ClientVault>;
  updateVaultStatus: (vaultId: string, status: VaultStatus) => void;
  submitDeathCertificate: (vaultId: string, docName: string, uploadedBy: string, fileHash?: string) => void;
  verifyDeathCertificate: (vaultId: string, approve: boolean) => void;
  submitGuardianAttestation: (vaultId: string, guardianId: string, approve: boolean) => void;
  cancelRecovery: (vaultId: string) => void;
  executeDigitalWill: (vaultId: string) => void;
  addClientAsset: (vaultId: string, asset: Omit<AssetRecord, "id">) => void;
  updateAssetRule: (vaultId: string, assetId: string, rule: string) => void;
  sealSecret: (vaultId: string, name: string, category: AssetRecord["category"], detail: string) => void;
  recordDeposit: (vaultId: string, asset: string, amount: string, txHash: string) => void;
  auditLogs: { id: string; time: string; text: string; actor: string; tone: "ok" | "warn" | "risk" }[];
  addAuditLog: (text: string, actor: string, tone?: "ok" | "warn" | "risk") => void;
  /** null in Local demo mode; real law-firm session, onboarding links, deposits etc. on Sepolia. */
  live: LiveExtras | null;
}

const B2B2CContext = createContext<B2B2CContextType | null>(null);

export function useB2B2C() {
  const ctx = useContext(B2B2CContext);
  if (!ctx) throw new Error("useB2B2C must be used inside B2B2CProvider");
  return ctx;
}

export function B2B2CProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>("lawyer");
  const [vaults, setVaults] = useState<ClientVault[]>(INITIAL_CLIENT_VAULTS);
  const [activeVaultId, setActiveVaultId] = useState<string>("vault-1");
  const [auditLogs, setAuditLogs] = useState<{ id: string; time: string; text: string; actor: string; tone: "ok" | "warn" | "risk" }[]>([
    { id: "log-1", time: "Today, 10:45 AM", text: "Periodic client heartbeat acknowledged for Rahul Sharma", actor: "Client Rahul Sharma", tone: "ok" },
    { id: "log-2", time: "Oct 3, 04:30 PM", text: "Death certificate uploaded for Sunita Desai by Rohan Desai", actor: "Heir Rohan Desai", tone: "warn" },
    { id: "log-3", time: "Oct 2, 11:15 AM", text: "Institutional Guardian attested recovery for Devendra Patel", actor: "Mehta & Partners", tone: "warn" },
    { id: "log-4", time: "Oct 1, 09:00 AM", text: "Digital Will executed for Maya Sen by Mehta & Partners", actor: "Adv. Rohit Mehta", tone: "ok" },
  ]);

  const addAuditLog = (text: string, actor: string, tone: "ok" | "warn" | "risk" = "ok") => {
    setAuditLogs((prev) => [
      { id: `log-${Date.now()}`, time: "Just now", text, actor, tone },
      ...prev,
    ]);
  };

  const activeVault = vaults.find((v) => v.id === activeVaultId) || vaults[0];

  const createVault = async (data: Omit<ClientVault, "id">): Promise<ClientVault> => {
    const id = `vault-${Date.now()}`;
    const newVault: ClientVault = { ...data, id };
    setVaults((prev) => [newVault, ...prev]);
    setActiveVaultId(id);
    addAuditLog(`Created client vault for ${data.clientName} (${data.vaultAddress})`, LAW_FIRM.loggedLawyer, "ok");
    return newVault;
  };

  const updateVaultStatus = (vaultId: string, status: VaultStatus) => {
    setVaults((prev) =>
      prev.map((v) => (v.id === vaultId ? { ...v, status } : v))
    );
    addAuditLog(`Vault status changed to ${status}`, "System", "warn");
  };

  const submitDeathCertificate = (vaultId: string, docName: string, uploadedBy: string) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return {
          ...v,
          deathCertificateStatus: "Pending",
          deathCertificateUrl: docName,
          deathCertUploadedBy: uploadedBy,
          deathCertUploadedAt: "Just now",
          recoveryStatusDetail: `Death certificate submitted by ${uploadedBy} · Pending lawyer verification`,
        };
      })
    );
    addAuditLog(`Death certificate submitted for vault ${vaultId} by ${uploadedBy}`, uploadedBy, "warn");
  };

  const verifyDeathCertificate = (vaultId: string, approve: boolean) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        const newStatus: VaultStatus = approve
          ? v.guardianAttestationsCount >= v.requiredApprovals
            ? "VETO WINDOW"
            : "RECOVERY PENDING"
          : v.status;
        return {
          ...v,
          deathCertificateStatus: approve ? "Verified" : "Rejected",
          status: approve ? newStatus : v.status,
          recoveryStatusDetail: approve
            ? "Death certificate verified by Mehta & Partners"
            : "Death certificate rejected upon document inspection",
        };
      })
    );
    addAuditLog(
      `Death certificate ${approve ? "VERIFIED" : "REJECTED"} for vault ${vaultId}`,
      LAW_FIRM.loggedLawyer,
      approve ? "ok" : "risk"
    );
  };

  const submitGuardianAttestation = (vaultId: string, guardianId: string, approve: boolean) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        const updatedGuardians = v.guardians.map((g) =>
          g.id === guardianId ? { ...g, hasAttested: approve } : g
        );
        const newAttestationCount = updatedGuardians.filter((g) => g.hasAttested).length;
        let newStatus: VaultStatus = v.status;

        // If threshold reached and death cert verified, enter Veto Window
        if (newAttestationCount >= v.requiredApprovals && v.deathCertificateStatus === "Verified") {
          newStatus = "VETO WINDOW";
        } else if (newAttestationCount >= v.requiredApprovals) {
          newStatus = "RECOVERY PENDING";
        }

        return {
          ...v,
          guardians: updatedGuardians,
          guardianAttestationsCount: newAttestationCount,
          status: newStatus,
          recoveryStatusDetail: approve
            ? `${newAttestationCount} of ${v.requiredApprovals} guardian approvals recorded`
            : "Guardian rejected recovery attestation",
        };
      })
    );
    addAuditLog(`Guardian attestation submitted for vault ${vaultId} (${approve ? "Approved" : "Rejected"})`, "Guardian", approve ? "ok" : "risk");
  };

  const cancelRecovery = (vaultId: string) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return {
          ...v,
          status: "ACTIVE",
          recoveryStatusDetail: "Recovery cancelled by client veto · Vault restored to ACTIVE",
          vetoTimeRemainingHours: undefined,
          lastCheckIn: "Today, just now (Client Veto Action)",
        };
      })
    );
    addAuditLog(`CLIENT VETO TRIGGERED: Active recovery cancelled for vault ${vaultId}`, "Client (Owner Veto)", "ok");
  };

  const executeDigitalWill = (vaultId: string) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return {
          ...v,
          status: "EXECUTED",
          recoveryStatusDetail: "Digital Will executed by Mehta & Partners · Staged release initiated",
        };
      })
    );
    addAuditLog(`DIGITAL WILL EXECUTED for vault ${vaultId}. Stage 1 released to Executor.`, LAW_FIRM.loggedLawyer, "ok");
  };

  const addClientAsset = (vaultId: string, asset: Omit<AssetRecord, "id">) => {
    const id = `asset-${Date.now()}`;
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return { ...v, assets: [...v.assets, { ...asset, id }] };
      })
    );
    addAuditLog(`New asset registered: "${asset.name}" (${asset.category})`, "Client", "ok");
  };

  const updateAssetRule = (vaultId: string, assetId: string, rule: string) => {
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return {
          ...v,
          assets: v.assets.map((a) => (a.id === assetId ? { ...a, customRule: rule } : a)),
        };
      })
    );
    addAuditLog(`Inheritance policy updated for asset ${assetId}: ${rule}`, "Client (Authorized)", "ok");
  };

  const sealSecret = (vaultId: string, name: string, category: AssetRecord["category"], detail: string) => {
    const id = `sealed-${Date.now()}`;
    const newAsset: AssetRecord = {
      id,
      category,
      name,
      detail: `Encrypted client-side (AES-256-GCM): ${detail}`,
      sealed: true,
      sealedAt: "Just now",
    };
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return { ...v, assets: [...v.assets, newAsset] };
      })
    );
    addAuditLog(`Sensitive secret sealed browser-side: "${name}"`, "Client (Local Device)", "ok");
  };

  const recordDeposit = (vaultId: string, asset: string, amount: string, txHash: string) => {
    const id = `dep-${Date.now()}`;
    const newAsset: AssetRecord = {
      id,
      category: "Crypto",
      name: `${asset} Deposit`,
      detail: `${amount} ${asset} deposited (tx: ${txHash.slice(0, 10)}...)`,
      valueOrSize: `${amount} ${asset}`,
    };
    setVaults((prev) =>
      prev.map((v) => {
        if (v.id !== vaultId) return v;
        return { ...v, assets: [newAsset, ...v.assets] };
      })
    );
    addAuditLog(`Client deposited ${amount} ${asset} into vault (${txHash.slice(0, 10)}...)`, "Client Wallet", "ok");
  };

  const { live: isLive, chain } = useVault();
  const liveStore = useLiveB2B(chain, role, isLive);

  const mockValue: B2B2CContextType = {
    role,
    setRole,
    lawFirm: LAW_FIRM,
    vaults,
    activeVaultId,
    setActiveVaultId,
    activeVault,
    createVault,
    updateVaultStatus,
    submitDeathCertificate,
    verifyDeathCertificate,
    submitGuardianAttestation,
    cancelRecovery,
    executeDigitalWill,
    addClientAsset,
    updateAssetRule,
    sealSecret,
    recordDeposit,
    auditLogs,
    addAuditLog,
    live: null,
  };
  // On Sepolia the same screens are driven by the contracts + backend; Local demo keeps the mock data.
  const value: B2B2CContextType = isLive && liveStore.activeVault ? { ...liveStore, role, setRole, activeVault: liveStore.activeVault } : mockValue;

  return <B2B2CContext.Provider value={value}>{children}</B2B2CContext.Provider>;
}

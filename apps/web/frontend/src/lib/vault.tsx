import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { Address } from "viem";
import {
  connectWallet,
  switchAccount,
  currentAccount,
  ETH,
  explainError,
  onAccountsChanged,
  readClaimable,
  readHasAttested,
  readReleased,
  readIsBeneficiary,
  readPlan,
  readNextUnlock,
  readVault,
  writeVault,
  type OnChainVault,
  type Allocation,
} from "./chain";
// TODO: replace these local types with imports from packages/shared once the schema is agreed.
export type VaultState =
  | "Active"
  | "Watch"
  | "TriggerPending"
  | "VetoWindow"
  | "StagedRelease"
  | "Executed";
export type Tier = "Executor" | "Family" | "Business" | "Crypto heir";
export type AssetKind = "crypto" | "access" | "legal";
export type CheckKey =
  | "bankNominees"
  | "googleLegacy"
  | "appleLegacy"
  | "duressPin";
export type Scenario = "rogue" | "collusion" | "legit";

export interface Guardian {
  id: string;
  name: string;
  contact: string;
}
export interface Heir {
  id: string;
  name: string;
  contact: string;
  tier: Tier;
}
export interface Asset {
  id: string;
  kind: AssetKind;
  label: string;
  detail: string;
}
export interface AuditEvent {
  id: string;
  at: number;
  text: string;
  tone: "ok" | "warn" | "risk";
}
export interface Policy {
  checkInDays: number;
  missedLimit: number;
}

export interface Vault {
  state: VaultState;
  stage: number;
  risk: number;
  vetoEndsAt: number;
  lastCheckIn: number;
  k: number;
  vetoDays: number;
  policy: Policy;
  guardians: Guardian[];
  heirs: Heir[];
  assets: Asset[];
  events: AuditEvent[];
  checklist: Record<CheckKey, boolean>;
  setVaultState: (s: VaultState) => void;
  setK: (k: number) => void;
  setVetoDays: (d: number) => void;
  setPolicy: (p: Policy) => void;
  checkIn: () => void;
  cancelRecovery: () => void;
  advance: () => void;
  runScenario: (s: Scenario) => void;
  reset: () => void;
  addGuardian: (g: Omit<Guardian, "id">) => void;
  removeGuardian: (id: string) => void;
  addHeir: (h: Omit<Heir, "id">) => void;
  removeHeir: (id: string) => void;
  addAsset: (a: Omit<Asset, "id">) => void;
  removeAsset: (id: string) => void;
  toggleCheck: (k: CheckKey) => void;
  log: (text: string, tone?: AuditEvent["tone"]) => void;
  /** true = state comes from the HeirloomVault contract on Sepolia; false = local demo state */
  live: boolean;
  setLive: (live: boolean) => void;
  chain: Chain;
}

export interface Chain {
  vault: OnChainVault | null;
  account: Address | null;
  role: { owner: boolean; guardian: boolean; heir: boolean; executor: boolean };
  hasAttested: boolean;
  claimable: bigint;
  /** True once everything currently due has been paid and nothing is scheduled. */
  hasClaimed: boolean;
  /** ETH already paid to the connected wallet. */
  released: bigint;
  /** The split that applies to ETH (its own plan or the default). */
  ethPlan: Allocation[];
  /** Next unlock / installment time for the connected heir (ms, 0 = none). */
  nextUnlock: number;
  busy: string | null;
  error: string | null;
  lastTx: string | null;
  connect: () => Promise<void>;
  switchAccount: () => Promise<void>;
  attest: () => Promise<void>;
  claimEth: () => Promise<void>;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const ON_CHAIN_STATE: VaultState[] = ["Active", "Watch", "VetoWindow", "Executed"];
const POLL_MS = 4000;
const eq = (a?: string | null, b?: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

const DAY = 864e5;
const uid = () => Math.random().toString(36).slice(2, 9);
const Ctx = createContext<Vault | null>(null);

export function useVault() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useVault must be used inside VaultProvider");
  return v;
}

export function VaultProvider({ children }: { children: ReactNode }) {
  const [state, setVaultState] = useState<VaultState>("Active");
  const [stage, setStage] = useState(0);
  const [risk, setRisk] = useState(8);
  const [vetoEndsAt, setVetoEndsAt] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useState(() => Date.now() - 2 * 3600e3);
  const [k, setK] = useState(3);
  const [vetoDays, setVetoDays] = useState(10);
  const [policy, setPolicy] = useState<Policy>({
    checkInDays: 7,
    missedLimit: 3,
  });
  const [checklist, setChecklist] = useState<Record<CheckKey, boolean>>({
    bankNominees: false,
    googleLegacy: false,
    appleLegacy: false,
    duressPin: false,
  });
  const [guardians, setGuardians] = useState<Guardian[]>([
    { id: "g1", name: "Meera Shah", contact: "meera@example.com" },
    { id: "g2", name: "Rohan Iyer", contact: "+91 98200 11111" },
    { id: "g3", name: "Kavya Nair", contact: "kavya@example.com" },
    { id: "g4", name: "Dev Patel", contact: "+91 98200 22222" },
    { id: "g5", name: "Anika Rao", contact: "anika@example.com" },
  ]);
  const [heirs, setHeirs] = useState<Heir[]>([
    {
      id: "h1",
      name: "Sana Khan",
      contact: "sana@example.com",
      tier: "Executor",
    },
    {
      id: "h2",
      name: "Arjun Khan",
      contact: "arjun@example.com",
      tier: "Family",
    },
    {
      id: "h3",
      name: "Vikram Rao",
      contact: "vikram@example.com",
      tier: "Business",
    },
  ]);
  const [assets, setAssets] = useState<Asset[]>([
    {
      id: "a1",
      kind: "legal",
      label: "HDFC savings account",
      detail: "Bank account, nominee Sana Khan",
    },
    {
      id: "a2",
      kind: "access",
      label: "Password manager recovery key",
      detail: "Encrypted on this device",
    },
    {
      id: "a3",
      kind: "crypto",
      label: "Hardware wallet seed phrase",
      detail: "Encrypted on this device",
    },
  ]);
  const [events, setEvents] = useState<AuditEvent[]>([
    {
      id: "e1",
      at: Date.now() - 2 * 3600e3,
      text: "You checked in from this device.",
      tone: "ok",
    },
    {
      id: "e2",
      at: Date.now() - 26 * 3600e3,
      text: "Release policy signed with a 3 of 5 guardian threshold.",
      tone: "ok",
    },
  ]);

  const log = useCallback((text: string, tone: AuditEvent["tone"] = "ok") => {
    setEvents((e) =>
      [{ id: uid(), at: Date.now(), text, tone }, ...e].slice(0, 30),
    );
  }, []);

  // ---------------------------------------------------------------- on-chain (Sepolia)
  const [live, setLive] = useState(true);
  const [cv, setCv] = useState<OnChainVault | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [hasAttested, setHasAttested] = useState(false);
  const [claimable, setClaimable] = useState<bigint>(0n);
  const [releasedAmt, setReleasedAmt] = useState<bigint>(0n);
  const [ethPlan, setEthPlan] = useState<Allocation[]>([]);
  const [nextUnlock, setNextUnlock] = useState(0);
  const [isHeir, setIsHeir] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const prevState = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    try {
      const v = await readVault();
      setCv(v);
      setEthPlan(await readPlan(ETH));
      if (prevState.current !== null && prevState.current !== v.state) {
        const tone = v.state === 0 ? "ok" : v.state === 3 ? "risk" : "warn";
        log(`On-chain: vault is now ${["Active", "Watch", "TriggerPending", "Executed"][v.state]}.`, tone);
      }
      prevState.current = v.state;
      if (account) {
        const [att, cl, rel, next, heir] = await Promise.all([
          readHasAttested(account),
          readClaimable(account, ETH),
          readReleased(account, ETH),
          readNextUnlock(account, ETH),
          readIsBeneficiary(account),
        ]);
        setIsHeir(heir);
        setHasAttested(att);
        setClaimable(cl);
        setReleasedAmt(rel);
        setNextUnlock(next);
      }
    } catch (e) {
      setError(explainError(e));
    }
  }, [account, log]);

  useEffect(() => {
    currentAccount().then(setAccount).catch(() => {});
    return onAccountsChanged(setAccount);
  }, []);

  useEffect(() => {
    if (!live) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [live, refresh]);

  const run = async (label: string, call: Parameters<typeof writeVault>[0], done: string) => {
    setBusy(label);
    setError(null);
    try {
      const hash = await writeVault(call);
      setLastTx(hash);
      log(done, "ok");
      await refresh();
    } catch (e) {
      setError(explainError(e));
    } finally {
      setBusy(null);
    }
  };

  const role = {
    owner: eq(account, cv?.owner),
    guardian: !!cv?.guardians.some((g) => eq(g, account)),
    heir: !!account && isHeir,
    executor: eq(account, cv?.executor),
  };

  const chain: Chain = {
    vault: cv,
    account,
    role,
    hasAttested,
    claimable,
    hasClaimed: releasedAmt > 0n && claimable === 0n && nextUnlock === 0,
    released: releasedAmt,
    ethPlan,
    nextUnlock,
    busy,
    error,
    lastTx,
    connect: async () => {
      try {
        setAccount(await connectWallet());
      } catch (e) {
        setError(explainError(e));
      }
    },
    switchAccount: async () => {
      try {
        setAccount(await switchAccount());
      } catch (e) {
        setError(explainError(e));
      }
    },
    attest: () => run("Confirming", { functionName: "attestGuardian" }, "Guardian attestation recorded on-chain."),
    claimEth: () =>
      account
        ? run("Claiming", { functionName: "claim", args: [ETH, account] }, "Inheritance claimed. ETH sent to your wallet.")
        : chain.connect(),
    refresh,
    clearError: () => setError(null),
  };

  const checkIn = () => {
    if (live) return void run("Checking in", { functionName: "pingHeartbeat" }, "You checked in on-chain. Proof of life recorded.");
    setLastCheckIn(Date.now());
    if (state === "Watch") setVaultState("Active");
    log("You checked in. Proof of life recorded.", "ok");
  };

  const cancelRecovery = () => {
    if (live) return void run("Cancelling", { functionName: "vetoRecovery" }, "You vetoed the recovery on-chain. Your vault is Active again.");
    setVaultState("Active");
    setStage(0);
    setRisk(8);
    setVetoEndsAt(0);
    log("You cancelled the recovery. Your vault is Active again.", "ok");
  };

  const advance = () => {
    if (live) return void run("Releasing", { functionName: "executeRelease" }, "Veto window over. Release executed on-chain.");
    if (state === "TriggerPending" || state === "VetoWindow") {
      setVaultState("StagedRelease");
      setStage(1);
      log(
        "Veto window ended. Stage 1 is open: the executor can read the legal packet.",
      );
    } else if (state === "StagedRelease") {
      if (stage === 1) {
        setStage(2);
        log(
          "Stage 2 is open: the access kit goes to family and business contacts.",
        );
      } else if (stage === 2) {
        setStage(3);
        log(
          "Stage 3 is open: crypto shards can be merged after the final timelock.",
        );
      } else {
        setVaultState("Executed");
        log("All stages complete. Shares are revoked and keys are rotating.");
      }
    }
  };

  const runScenario = (s: Scenario) => {
    setStage(0);
    if (s === "rogue") {
      setVaultState("Active");
      setRisk(8);
      log(
        "One guardian attested alone. Rejected: 3 attestations needed, 1 received.",
        "warn",
      );
    } else if (s === "collusion") {
      setVaultState("VetoWindow");
      setRisk(86);
      setVetoEndsAt(Date.now() + (vetoDays + 7) * DAY);
      log(
        "Two attestations arrived 3 minutes apart from the same device.",
        "risk",
      );
      log(
        "Risk score 86. Veto window extended by 7 days and re-confirmation required.",
        "risk",
      );
    } else {
      setVaultState("VetoWindow");
      setRisk(12);
      setVetoEndsAt(Date.now() + vetoDays * DAY);
      log(
        "Three of five guardians attested. Death certificate verified. Veto window started.",
        "warn",
      );
    }
  };

  const reset = () => {
    setVaultState("Active");
    setStage(0);
    setRisk(8);
    setVetoEndsAt(0);
    log("Demo reset. Vault is Active.", "ok");
  };

  // When live, the contract is the source of truth for lifecycle fields.
  const onChain = live && cv;
  const value: Vault = {
    state: onChain ? ON_CHAIN_STATE[cv.state] : state,
    stage: onChain ? (cv.state === 3 ? 3 : 0) : stage,
    risk,
    vetoEndsAt: onChain ? cv.vetoEndTime : vetoEndsAt,
    lastCheckIn: onChain ? cv.lastHeartbeat : lastCheckIn,
    k: onChain ? cv.requiredSignatures : k,
    vetoDays: onChain ? cv.vetoGracePeriod / 86400 : vetoDays,
    policy: onChain ? { ...policy, checkInDays: cv.inactivityThreshold / 86400 } : policy,
    guardians,
    heirs,
    assets,
    events,
    checklist,
    setVaultState,
    setK,
    setVetoDays,
    setPolicy,
    checkIn,
    cancelRecovery,
    advance,
    runScenario,
    reset,
    log,
    addGuardian: (g) => setGuardians((x) => [...x, { ...g, id: uid() }]),
    removeGuardian: (id) => setGuardians((x) => x.filter((g) => g.id !== id)),
    addHeir: (h) => setHeirs((x) => [...x, { ...h, id: uid() }]),
    removeHeir: (id) => setHeirs((x) => x.filter((h) => h.id !== id)),
    addAsset: (a) => setAssets((x) => [...x, { ...a, id: uid() }]),
    removeAsset: (id) => setAssets((x) => x.filter((a) => a.id !== id)),
    toggleCheck: (key) => setChecklist((c) => ({ ...c, [key]: !c[key] })),
    live,
    setLive,
    chain,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

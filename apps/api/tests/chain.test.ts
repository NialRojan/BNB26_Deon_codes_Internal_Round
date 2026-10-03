import { describe, it, expect } from "vitest";
import type { PublicClient } from "viem";
import { VaultState } from "@heirloom/shared";
import { ContractClient, ON_CHAIN_TO_VAULT_STATE } from "../src/chain/contractClient.js";
import { VaultEventWatcher } from "../src/chain/vaultWatcher.js";
import { db } from "../src/db/schema.js";

const VAULT = "0x8085f0EF193B9dD3F7501394bD3d054c045aB575";

const fakeInfo = (state: number, extra: Record<string, unknown> = {}) => ({
  state, owner: "0x668A3BB33A89E2fF21652E190fB425a59D46AF84", executor: "0x0000000000000000000000000000000000000000",
  assetMapCID: "", lastHeartbeat: 100n, inactivityThreshold: 120n, vetoGracePeriod: 180n, watchStartsAt: 220n,
  vetoEndTime: 0n, executedAt: 0n, epoch: 3n, currentSignatures: 0n, requiredSignatures: 2n,
  guardians: ["0x1", "0x2", "0x3"], beneficiaries: [], ethBalance: 20000000000000000n, ...extra,
});
const chainWith = (info: unknown) => ({ readContract: async () => info }) as unknown as PublicClient;

describe("On-chain integration (HeirloomVault, Member 2)", () => {
  it("maps contract states to backend vault states", () => {
    expect(ON_CHAIN_TO_VAULT_STATE[0]).toBe(VaultState.ACTIVE);
    expect(ON_CHAIN_TO_VAULT_STATE[1]).toBe(VaultState.WATCH);
    expect(ON_CHAIN_TO_VAULT_STATE[2]).toBe(VaultState.VETO_ACTIVE);
    expect(ON_CHAIN_TO_VAULT_STATE[3]).toBe(VaultState.RELEASED);
  });

  it("reads a pending trigger with its veto deadline", async () => {
    const client = new ContractClient("http://unused", VAULT, chainWith(fakeInfo(2, { vetoEndTime: 999n, currentSignatures: 2n })));
    const s = await client.getVaultState(VAULT);
    expect(s.state).toBe(VaultState.VETO_ACTIVE);
    expect(s.vetoTimerActive).toBe(true);
    expect(s.vetoDeadlineTimestamp).toBe(999);
    expect(s.currentSignatures).toBe(2);
    expect(s.ethBalanceWei).toBe("20000000000000000");
  });

  it("turns TriggerPending into a CRITICAL owner alert and an audit record", async () => {
    const watcher = new VaultEventWatcher({} as PublicClient, VAULT, { recipient: "owner@test.dev", channel: "EMAIL" });
    await watcher.handle({ eventName: "TriggerPending", args: { epoch: 1n, vetoEndTime: 1791054000n }, transactionHash: "0xabc", logIndex: 0, blockNumber: 1n });

    const owner = await db.owner.findUnique({ where: { externalReference: VAULT.toLowerCase() } });
    expect(owner).not.toBeNull();
    const alerts = await db.alert.findMany({ where: { ownerId: owner!.id } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("RECOVERY_INITIATED");
    expect(alerts[0].severity).toBe("CRITICAL");
    expect(alerts[0].recipient).toBe("owner@test.dev");
    expect(alerts[0].metadata).toContain("VETO");
    const audits = await db.auditEvent.findMany({ where: { eventType: "RECOVERY_INITIATED", entityId: owner!.id } });
    expect(audits).toHaveLength(1);
  });

  it("records heartbeats without alerting, and ignores duplicate logs", async () => {
    const watcher = new VaultEventWatcher({} as PublicClient, VAULT);
    const ev = { eventName: "HeartbeatPinged", args: { timestamp: 1n, epoch: 2n }, transactionHash: "0xdef", logIndex: 3, blockNumber: 2n };
    await watcher.handle(ev);
    await watcher.handle(ev);
    const owner = await db.owner.findUnique({ where: { externalReference: VAULT.toLowerCase() } });
    expect(await db.alert.count({ where: { ownerId: owner!.id } })).toBe(0);
    expect(await db.auditEvent.count({ where: { eventType: "HEARTBEAT_RECEIVED", entityId: owner!.id } })).toBe(1);
  });
});

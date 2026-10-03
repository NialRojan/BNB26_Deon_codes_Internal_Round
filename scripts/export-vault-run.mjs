#!/usr/bin/env node
// Exports the full on-chain history of a HeirloomVault as proof of a demo run:
//   docs/demo-runs/<date>-<name>.md   (human-readable timeline with Etherscan links)
//   docs/demo-runs/<date>-<name>.json (raw events)
// Usage: node scripts/export-vault-run.mjs <vaultAddress> [name]
//   e.g. node scripts/export-vault-run.mjs 0x0B4E0D3a3c756533acbfe1e64196eA7B731D2bB9 rehearsal
import { createPublicClient, formatEther, http, parseAbiItem } from "viem";
import { sepolia } from "viem/chains";
import { mkdirSync, writeFileSync } from "node:fs";
import { heirloomVaultAbi, deployments } from "../packages/shared/dist/contracts/index.js";

const vault = process.argv[2];
const name = process.argv[3] || "demo-run";
if (!/^0x[0-9a-fA-F]{40}$/.test(vault ?? "")) {
  console.error("Usage: node scripts/export-vault-run.mjs <vaultAddress> [name]");
  process.exit(1);
}

const rpc = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const client = createPublicClient({ chain: sepolia, transport: http(rpc) });
const SCAN = "https://sepolia.etherscan.io";

// MetaMask names used in the team demo (public addresses only).
const NAMES = {
  "0x668a3bb33a89e2ff21652e190fb425a59d46af84": "Imported Account 8 (Owner)",
  "0x0915c233a1ad6092a0529e0b63e3e4ec41371cdd": "Imported Account 7 (Guardian 1)",
  "0xa5bf598dc07395c21f5bf39cf969e8977ee58ea6": "Imported Account 6 (Guardian 2)",
  "0x8bcfda887cbbc1f202766ef40a18a4d93f77a434": "Imported Account 5 (Guardian 3)",
  "0x66163667d14b859929697c89e591ff5d624bc71d": "Imported Account 4 (Heir A, 60%)",
  "0x806d387fa3fcf6093e4b0feadd9ffaf425deedda": "Imported Account 3 (Heir B, 40%)",
  "0x0000000071727de22e5e9d8baf0edac6f37da032": "ERC-4337 EntryPoint",
};
const who = (a) => (a ? NAMES[a.toLowerCase()] ?? `${a.slice(0, 6)}…${a.slice(-4)}` : "");
const STATES = ["Active", "Watch", "TriggerPending", "Executed"];

// Find the block where the factory created this vault, then read logs from there in chunks.
const created = await client.getLogs({
  address: deployments.sepolia.factory,
  event: parseAbiItem("event VaultCreated(address indexed vault, address indexed owner, uint256 salt)"),
  args: { vault },
  fromBlock: 11_836_900n,
});
const fromBlock = created[0]?.blockNumber ?? 11_836_900n;
const latest = await client.getBlockNumber();
const logs = [];
for (let b = fromBlock; b <= latest; b += 500n) {
  const to = b + 499n > latest ? latest : b + 499n;
  logs.push(...(await client.getContractEvents({ address: vault, abi: heirloomVaultAbi, fromBlock: b, toBlock: to })));
}

const blockTimes = new Map();
const txFrom = new Map();
for (const l of logs) {
  if (!blockTimes.has(l.blockNumber)) blockTimes.set(l.blockNumber, (await client.getBlock({ blockNumber: l.blockNumber })).timestamp);
  if (!txFrom.has(l.transactionHash)) txFrom.set(l.transactionHash, (await client.getTransaction({ hash: l.transactionHash })).from);
}

const describe = (l) => {
  const a = l.args ?? {};
  switch (l.eventName) {
    case "VaultInitialized": return `Vault created for ${who(a.owner)}`;
    case "GuardiansUpdated": return `Guardians set: ${a.guardians.map(who).join(", ")} (${a.requiredSignatures} required)`;
    case "BeneficiariesUpdated": return `Heirs set: ${a.beneficiaries.map((b) => who(b.wallet)).join(", ")}`;
    case "PlanUpdated": {
      const target = a.token?.toLowerCase() === "0xffffffffffffffffffffffffffffffffffffffff" ? "Default split" : a.token === "0x0000000000000000000000000000000000000000" ? "ETH split" : `Split for token ${who(a.token)}`;
      const parts = a.allocations.map((x) => `${who(x.beneficiary)} ${Number(x.bps) / 100}%${Number(x.unlockAt) ? ` from ${new Date(Number(x.unlockAt) * 1000).toISOString().slice(0, 10)}` : ""}${Number(x.installments) > 1 ? ` in ${x.installments} installments` : ""}`);
      return `${target}: ${parts.join(", ")}`;
    }
    case "NftRuleUpdated": return `NFT ${who(a.collection)} #${a.tokenId} left to ${who(a.beneficiary)}`;
    case "NftFallbackUpdated": return `Other NFTs go to ${who(a.beneficiary)}`;
    case "NftClaimed": return `${who(a.heir)} received NFT ${who(a.collection)} #${a.tokenId}`;
    case "TimingsUpdated": return `Timers: ${a.inactivityThreshold}s inactivity, ${a.vetoGracePeriod}s veto window`;
    case "HeartbeatPinged": return `Owner proof of life (round ${a.epoch})`;
    case "GuardianAttested": return `${who(a.guardian)} confirmed passing (${a.count} so far, round ${a.epoch})`;
    case "AttestationRevoked": return `${who(a.guardian)} withdrew their confirmation`;
    case "TriggerPending": return `Threshold reached: veto window open until ${new Date(Number(a.vetoEndTime) * 1000).toISOString()}`;
    case "RecoveryVetoed": return `Owner vetoed the recovery`;
    case "ReleaseExecuted": return `Release executed. Owner key locked, heirs unlocked`;
    case "Claimed": return `${who(a.heir)} claimed ${formatEther(a.amount)} ${a.token === "0x0000000000000000000000000000000000000000" ? "ETH" : a.token}`;
    case "ActivityRecorded": return `Off-chain activity recorded by ${who(a.source)}`;
    default: return l.eventName;
  }
};

const rows = logs.map((l) => ({
  time: new Date(Number(blockTimes.get(l.blockNumber)) * 1000).toISOString(),
  block: Number(l.blockNumber),
  event: l.eventName,
  description: describe(l),
  sentBy: who(txFrom.get(l.transactionHash)),
  tx: l.transactionHash,
  args: JSON.parse(JSON.stringify(l.args ?? {}, (_, v) => (typeof v === "bigint" ? v.toString() : v))),
}));

const state = await client.readContract({ address: vault, abi: heirloomVaultAbi, functionName: "currentState" });
const balance = await client.getBalance({ address: vault });
const date = new Date().toISOString().slice(0, 10);
const dir = new URL("../docs/demo-runs/", import.meta.url);
mkdirSync(dir, { recursive: true });
const base = `${date}-${name}`;

writeFileSync(new URL(`${base}.json`, dir), JSON.stringify({ vault, network: "sepolia", exportedAt: new Date().toISOString(), finalState: STATES[state], balanceWei: balance.toString(), events: rows }, null, 2) + "\n");
writeFileSync(
  new URL(`${base}.md`, dir),
  [
    `# Heirloom demo run: ${name}`,
    "",
    `Vault [\`${vault}\`](${SCAN}/address/${vault}) on Sepolia · final state **${STATES[state]}** · balance ${formatEther(balance)} ETH · exported ${new Date().toISOString()}`,
    "",
    "Every row is an on-chain transaction; click the link to verify it on Etherscan.",
    "",
    "| Time (UTC) | What happened | Sent by | Tx |",
    "|---|---|---|---|",
    ...rows.map((r) => `| ${r.time.replace("T", " ").slice(0, 19)} | ${r.description} | ${r.sentBy} | [${r.tx.slice(0, 10)}…](${SCAN}/tx/${r.tx}) |`),
    "",
  ].join("\n"),
);
console.log(`Wrote docs/demo-runs/${base}.md and .json (${rows.length} events, final state ${STATES[state]})`);

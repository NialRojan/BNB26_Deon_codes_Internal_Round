# Heirloom Contracts

ERC-4337 smart-account vault with a guardian-attested, veto-protected inheritance state machine.

| Contract | Purpose |
|---|---|
| `src/HeirloomVault.sol` | The user's smart account: holds assets, tracks heartbeat, guardian votes, veto window, and pays heirs. |
| `src/HeirloomVaultFactory.sol` | CREATE2 factory: one vault per user, address known before deployment (works as 4337 `initCode`). |

EntryPoint: canonical v0.7 `0x0000000071727De22E5E9d8BAf0edAc6f37da032`.

## Lifecycle

```
Active ──(no owner activity for inactivityThreshold)──▶ Watch          [computed from time, not stored]
Watch  ──(requiredSignatures guardians attestGuardian())──▶ TriggerPending  (veto window opens)
TriggerPending ──(owner vetoRecovery() or ANY owner tx)──▶ Active      (all votes discarded)
TriggerPending ──(veto window over, anyone executeRelease())──▶ Executed  [terminal]
```

`currentState()` returns `uint8`: **0 Active, 1 Watch, 2 TriggerPending, 3 Executed**.

Rules worth knowing:
- **Every owner action is a heartbeat**: `execute`, `executeBatch`, `pingHeartbeat`, `vetoRecovery`, any setter, direct or via UserOp.
- A heartbeat starts a **new attestation round** (`epoch`), so old guardian votes never carry over.
- After `Executed` the **owner key is locked out** (in validation and in execution).
- Heirs claim **gaslessly**: they sign a UserOp whose `callData` is exactly `claim(token, theirOwnAddress)`. Gas comes from the vault's ETH. Anyone can also call `claim(token, heir)` directly. Funds always go to `heir`.
- Payouts: each heir gets `liveBalance * bps / bpsNotYetClaimed`, so the last heir to claim gets the remainder. `token = 0x0` means ETH.

## Setup

```bash
curl -L https://foundry.paradigm.xyz | bash && foundryup
git submodule update --init --recursive
cd contracts
forge build
forge test            # 47 tests, including real EntryPoint UserOp flows
./script/demo-local.sh  # full lifecycle on a local anvil chain
```

## Deploy (Sepolia)

```bash
cp .env.example .env    # fill in RPC URL, Etherscan key, deployer key, demo vault addresses
source .env
forge script script/Deploy.s.sol --rpc-url sepolia --broadcast --verify
```

This writes `deployments/<chainId>.json` with `entryPoint`, `factory` and `demoVault`.

---

## Team handoff

### Frontend (Member 4)
- ABIs: `abi/HeirloomVault.json`, `abi/HeirloomVaultFactory.json`; addresses: `deployments/11155111.json`.
- Create a vault: `factory.createVault(Config, salt)`; preview its address with `factory.getAddress(Config, salt)`; list a user's vaults with `factory.getVaultsByOwner(owner)`.
- Dashboard: `vault.getVaultInfo()` returns state, timers, guardians, beneficiaries, vote count and balance in one call.

| Button | Who | Call |
|---|---|---|
| I'm alive | owner | `pingHeartbeat()` |
| VETO | owner | `vetoRecovery()` |
| Confirm death | guardian | `attestGuardian()` (reverts `OwnerStillActive` before the threshold) |
| Undo my vote | guardian | `revokeAttestation()` |
| Finalize | anyone | `executeRelease()` (after `vetoEndTime`) |
| Claim | heir / anyone | `claim(tokenOr0x0, heir)`; preview with `claimable(token, heir)` |
| Settings | owner | `setGuardians`, `setBeneficiaries`, `setExecutor`, `setAssetMapCID`, `setTimings` |

`Config` struct: `{ owner, executor, guardians[], requiredSignatures, beneficiaries[{wallet, bps}], inactivityThreshold, vetoGracePeriod, assetMapCID }`. Shares must sum to 10000. The owner cannot be a guardian or heir.

### Lit Protocol (Member 1)
Ready-made conditions in `integrations/lit-access-condition.json`:
- **Heirs' Web2 secrets:** `isExecuted() == true`.
- **Executor's legal asset map (Stage 1):** `canAccessAssetMap(:userAddress) == true`.

Replace `<VAULT_ADDRESS>` with the user's vault address. Store the encrypted asset map's IPFS CID on-chain with `setAssetMapCID`.

### Backend (Member 3)
Webhook on these vault events:

| Event | Meaning | Action |
|---|---|---|
| `GuardianAttested(guardian, epoch, count)` | a guardian voted | warn owner early |
| `TriggerPending(epoch, vetoEndTime)` | threshold reached | **URGENT: "log in to VETO before vetoEndTime"** |
| `RecoveryVetoed(epoch, ts)` | owner vetoed | notify guardians |
| `ReleaseExecuted(ts)` | inheritance released | notify executor + heirs |
| `Claimed(heir, token, amount)` | heir paid | receipt |
| `HeartbeatPinged(ts, epoch)` | owner alive | reset reminder timers |
| `VaultCreated(vault, owner, salt)` *(factory)* | new user | start monitoring |

There is no `Watch` event, because time passing doesn't produce a transaction. The cron job should poll `currentState()` or `watchStartsAt()` and remind the owner to `pingHeartbeat()` before `watchStartsAt`.

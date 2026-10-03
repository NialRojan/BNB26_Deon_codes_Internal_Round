# Heirloom Backend Architecture & Member 3 Implementation Guide

**Member 3: Backend, Heartbeat & Fraud Detection Engine Lead**

---

## 1. Overview & System Mission

Heirloom is a trust-minimized digital inheritance protocol. Member 3 owns:
- Backend foundation & database models
- Proof-of-life heartbeat signals & multi-channel check-ins
- Autonomous missed-ping tracking & scheduling
- Watch-state transition pipeline & multi-channel alert matrix
- Fraud and anomaly detection engine (evaluating only trusted database state)
- Guardian collusion detection (exact device fingerprinting, IPv4/IPv6 subnets, temporal clustering)
- Behavioral baseline analyzer with cold-start fallback
- Canonical risk scoring engine & dynamic veto-extension recommendation
- Document intake & deterministic verification infrastructure
- Protocol auditability and append-only tamper-evident audit logging
- Backend integration boundary interfaces with other team members

---

## 2. High-Level Architecture Diagram

```
+----------------------------------------------------------------------------------------------------+
|                                    HEIRLOOM SYSTEM ARCHITECTURE                                    |
+----------------------------------------------------------------------------------------------------+

   [ MEMBER 4: Frontend UI / UX ]           [ MEMBER 1: Client Crypto Vault ]
         | (React / Web UI)                       | (AES-256-GCM, Shamir Secret Sharing, Access Kits)
         |                                        |
         +-------------------+--------------------+
                             |
                             v
+----------------------------------------------------------------------------------------------------+
|                                  MEMBER 3: BACKEND FOUNDATION                                      |
|                                                                                                    |
|  [ API Layer: Express, Routers, Zod Schemas, Security & Dev/Prod Auth Boundary ]                   |
|                                                                                                    |
|  [ Heartbeat Pipeline ]                 [ Watch Pipeline ]                                         |
|  - Multi-channel check-ins              - Idempotent Watch transition                              |
|  - Push, Biometric, WhatsApp            - Deduplicated AlertMatrix                                 |
|  - nextCheckInDueAt calculation         - Fallback channels                                        |
|  - Channel failure resilience           - Autonomous overdue sweep                                 |
|                                                                                                    |
|  [ Fraud & Risk Detection Engine ]      [ Document Intake & Verification ]                         |
|  - Trusted DB data only (no forgery)    - Server-side SHA-256 hash check                           |
|  - International geo detection          - Chronology check vs heartbeats                           |
|  - Subnet & temporal collusion          - Evidence-based decision enforcement                      |
|  - Internal sort & cold-start baseline  - Safe metadata-only tagging                               |
|  - Canonical risk scoring & veto rec                                                               |
|                                                                                                    |
|  [ Append-Only Audit Logging ]          [ Prisma ORM & Database Layer ]                             |
+----------------------------------------------------------------------------------------------------+
                             |
                             v
               [ Backend ContractClient Boundary ]
                             | (Mock adapter for local dev)
                             v
             [ MEMBER 2: Smart Contracts (Solidity) ]
           (HeirloomVault.sol, GuardianConsensus.sol, VetoTimer.sol)
```

---

## 3. Team Ownership Boundaries

| Component | Owner | Scope & Implementation Rules |
|---|---|---|
| **Backend & Heartbeat** | **Member 3** | Proof of life, scheduler, missed pings, Watch transition, availability alerts |
| **Fraud & Risk Engine** | **Member 3** | Collusion detector, behavioral baseline, trigger anomaly, risk scoring, veto recommendation |
| **Documents & Auditing** | **Member 3** | Intake hashing, metadata verification, append-only `AuditEvent` mechanism |
| **Shared Contracts** | **Shared** | `packages/shared/` types, schemas, enums, protocol interfaces (`VaultState`, `RiskScoreProfile`) |
| **Client Cryptography** | **Member 1** | AES-256-GCM, Shamir secret sharing, vault encryption, access kits, key rotation |
| **Smart Contracts** | **Member 2** | `contracts/` Solidity contracts (`HeirloomVault.sol`, `VetoTimer.sol`, staged release) |
| **Web Frontend** | **Member 4** | `apps/web/` Next.js / React UI, beneficiary claim portal, guardian approval UX |

---

## 4. Key Workflows

### 4.1 Heartbeat & Proof-of-Life Flow
```
Owner Check-In (Biometric / Push / WhatsApp)
      │
      ▼
Credential / Webhook Verification Boundary
      │
      ▼
HeartbeatEvent Record (status: RECEIVED)
      │
      ▼
OwnerAvailability Reset
  - state: ACTIVE
  - missedCount: 0
  - lastHeartbeatAt: now
  - nextCheckInDueAt: now + policyIntervalDays
```

- **Interval Computation**: Every successful check-in dynamically computes `nextCheckInDueAt = now + (heartbeatIntervalDays * 86,400,000)`.
- **Channel Failure Handling**: If a push or messaging provider fails transport, a `FAILED` dispatch event is logged. It is **never** counted as missed proof-of-life or used to penalize the owner. Fallback channels are attempted in order.
- **Biometric Boundary**: WebAuthn presence requires verifiable cryptographic proofs. Production mode fails closed against unverified signatures.

### 4.2 Autonomous Sweep & Watch Transition
```
Scheduler Background Sweep
      │
      ▼
Database Query: nextCheckInDueAt < now AND state != WATCH
      │
      ▼
MissedPingTracker: increment missedCount (until threshold)
      │
      ▼ (threshold exceeded)
WatchTransition.moveToWatch()
      │
      ├─► Idempotency check: if already WATCH, return cleanly without duplicate events
      ├─► Transition state: WATCH
      ├─► Emit AuditEvent: VAULT_ENTERED_WATCH
      └─► AlertMatrix: dispatch alerts
            └─► Deduplication check: suppress alert if PENDING alert already exists on channel
```

### 4.3 Fraud Detection & Risk Scoring Flow (Trusted Data Only)
```
Recovery Claim Initiated
      │
      ▼
POST /api/v1/claims/:recoveryId/evaluate-risk
      │
      ▼
Backend Queries Trusted Database:
  - HeartbeatEvent records (owner interaction timestamps & country codes)
  - GuardianAttestation records (IPs, device fingerprints, submission times)
  - OwnerAvailability & AuditEvent records (password/security reset history)
  *(Client-provided evidence in req.body is strictly ignored)*
      │
      ▼
Fraud Sub-Modules:
  1. TriggerAnomalyDetector: international historical country deviation + activity within 24h
  2. CollusionDetector: exact device fingerprint, IPv4 /24 subnet, IPv6 /48 subnet, temporal clustering (<2m)
  3. BehaviorBaseline: internally sorted check-in gaps + cold-start fallback
      │
      ▼
ScoringEngine (Canonical):
  - Weighted blend: (maxScore * 0.7 + avgScore * 0.3)
  - Deterministic Level: LOW | MEDIUM | HIGH | CRITICAL
  - Persists RiskEvent records & updates RecoveryAttempt
  - Recommends Veto Extension (+0d, +7d, +14d) and shouldHaltAutomaticRelease
  *(Does NOT execute on-chain veto)*
```

### 4.4 Document Intake & Verification Flow
```
Document Submission (Death Certificate / Medical Attestation)
      │
      ▼
DocumentIntake.submitDocument()
  - If rawContent provided: compute SHA-256 server-side. Reject client hash mismatches.
  - If no rawContent: record as METADATA_ONLY (no cryptographic claim).
  - Chronology check: reject documentDate in the future.
  - Persist to ClaimDocument (zero plaintext document contents stored).
      │
      ▼
DocumentVerification.evaluateDocument()
  - Chronology check vs owner heartbeats: flag inconsistency if death certificate is dated
    before owner's last confirmed active heartbeat.
  - Evidence enforcement: require cryptographic validation before granting VERIFIED status.
```

---

## 5. Shared Package & Integration Boundaries

### 5.1 `packages/shared/`
Contains strictly cross-member definitions:
- `VaultState`: Shared protocol states (`Active`, `Watch`, `TriggerPending`, `RecoveryPending`, `VetoActive`, etc.)
- `RiskScoreProfile`, `RiskFactor`, `RiskLevel`: Standard fraud interfaces
- `ReleasePolicySchema`: Staged asset release schema
- `AuditEventType`: Canonical protocol event identifiers

### 5.2 Member 2 Integration Boundary (`ContractClient`)
Located at `apps/api/src/chain/contractClient.ts`:
- Exposes standard backend contract interfaces: `getVaultState()`, `extendVetoOnChain()`, `abortRecoveryOnChain()`.
- Implemented as an isolated mock adapter during development and testing without Solidity or Hardhat dependencies in the API package.

---

## 6. Security Guarantees

1. **Zero Secret Storage**: No seed phrases, plaintext passwords, private keys, or raw decryption keys are ever stored in backend models.
2. **Cross-Owner Isolation**: All endpoints verify user identity against route parameters; cross-owner access returns `403 Forbidden`.
3. **Environment Authentication Isolation**: Mock dev tokens are strictly restricted to non-production environments (`NODE_ENV !== 'production'`); production fails closed.
4. **Append-Only Auditing**: `AuditEvent` table has no update or delete mutations, guaranteeing complete tamper-evident audit trails.

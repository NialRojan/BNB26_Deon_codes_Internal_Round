# Heirloom: Trust-Minimized Digital Inheritance

> A decentralized protocol ensuring seamless, trust-minimized asset transfer upon verified absence, with multi-layered fraud prevention, proof-of-life heartbeats, and immutable owner veto guarantees.

## Monorepo Architecture

```
heirloom/
├── README.md
├── package.json                  # workspaces: apps/*, packages/*
├── .env.example
│
├── packages/
│   ├── crypto/                   # MEMBER 1: client-side crypto & vault
│   └── shared/                   # Shared types, policy schema, and contract interfaces
│       ├── src/
│       │   ├── policy.schema.ts         # Release policy (owner-signed)
│       │   ├── vaultState.ts            # Active, Watch, TriggerPending, ...
│       │   ├── events.ts                # Audit event types
│       │   ├── riskScore.ts             # Fraud score shape
│       │   └── index.ts
│       └── package.json
│
├── contracts/                    # MEMBER 2: smart contracts & release engine
│
├── apps/
│   ├── api/                      # MEMBER 3: backend, heartbeat, fraud engine
│   │   ├── src/
│   │   │   ├── server.ts                # Server bootstrap entrypoint
│   │   │   ├── heartbeat/
│   │   │   │   ├── scheduler.ts         # Cron coordinator
│   │   │   │   ├── channels/
│   │   │   │   │   ├── push.ts          # Mobile / web push channel
│   │   │   │   │   ├── biometric.ts     # WebAuthn / Passkey biometric channel
│   │   │   │   │   └── messagingBot.ts  # WhatsApp / Telegram messaging bot
│   │   │   │   └── missedPingTracker.ts # Grace period & threshold evaluator
│   │   │   ├── watch/
│   │   │   │   ├── watchTransition.ts   # Moves vault to Watch state
│   │   │   │   └── alertMatrix.ts       # Fanout: email, SMS, WhatsApp, push
│   │   │   ├── fraud/
│   │   │   │   ├── scoringEngine.ts     # Aggregated risk scoring
│   │   │   │   ├── triggerAnomaly.ts    # Resets, unexpected geo/IP
│   │   │   │   ├── collusionDetector.ts # Same device or subnet co-location
│   │   │   │   ├── behaviorBaseline.ts  # Historical check-in cadence deviations
│   │   │   │   └── vetoExtender.ts      # Dynamically extends veto window on risk
│   │   │   ├── documents/
│   │   │   │   ├── intake.ts            # Medical attestation, death certificate
│   │   │   │   └── verification.ts      # Document verification workflow
│   │   │   ├── routes/
│   │   │   │   ├── vault.ts             # Vault & availability routes
│   │   │   │   ├── guardians.ts         # Guardian queries & pending requests
│   │   │   │   ├── attestations.ts      # Guardian consensus attestations
│   │   │   │   └── claims.ts            # Recovery claims, veto & fraud scoring
│   │   │   ├── chain/
│   │   │   │   └── contractClient.ts    # Client interface for HeirloomVault.sol
│   │   │   └── db/
│   │   │       ├── schema.ts            # Metadata only, never secrets
│   │   │       └── migrations/          # Prisma database migrations
│   │   └── tests/                       # 10 test suites, 41 unit/integration tests
│   │
│   └── web/                      # MEMBER 4: frontend & demo
│
└── docs/
    └── backend-architecture.md
```

## Quick Start (Member 3 Backend)

### 1. Install Dependencies
```bash
npm install
```

### 2. Build Shared & API Packages
```bash
npm run build --workspace=packages/shared
npm run build --workspace=apps/api
```

### 3. Run Test Suite
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev:api
```
Server will start on `http://localhost:4000/api/v1`.
Health check available at: `GET http://localhost:4000/api/v1/health`.

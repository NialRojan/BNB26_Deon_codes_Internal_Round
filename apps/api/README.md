# Heirloom Backend API (`apps/api`)

Base backend service for Heirloom: Trust-Minimized Digital Inheritance.

## Features
- **Clean Layered Architecture**: Routes -> Controllers -> Services -> Repositories -> Database (Prisma + SQLite).
- **Core Domain Models**: Owner, OwnerAvailability, HeartbeatEvent, RecoveryAttempt, GuardianAttestation, RiskEvent, Alert, AuditEvent.
- **Availability State Machine**: `ACTIVE` -> `CHECK_IN_PENDING` -> `MISSED` -> `WATCH` (with owner recovery / veto restoration).
- **Owner Veto Power**: Allows the owner to immediately cancel fraudulent recovery attempts, restore availability, and log immutable veto events.
- **Append-Only Audit Trail**: Dedicated `AuditEvent` mechanism with scrubbing of secrets.
- **Security & Authorization**: Cross-owner protection, rate limiting, Helmet, Zod request validation, and zero secret leakage.

## Commands

```bash
# Run tests
npm test

# Run type check
npx tsc --noEmit

# Build production bundle
npm run build

# Start server
npm run dev
```

For full architecture details, refer to `docs/backend-architecture.md`.

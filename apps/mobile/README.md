# Heirloom Mobile

Flutter companion app for the Heirloom web experience. Android and iOS project scaffolding is included.

## Run

```sh
flutter pub get
flutter run
```

## Current demo scope

The app is an in-memory product demo. It provides role-focused owner, guardian, beneficiary, and executor navigation; owner assets, people, readiness and recovery previews; local check-in and attestation examples; notifications, activity, and settings screens.

No backend exists in this repository yet. The demo does not authenticate users, send invitations, submit check-ins or attestations, authorize recovery, reveal protected materials, or persist changes across restarts. Demo actions are labeled in the UI. Do not enter seed phrases, passwords, PINs, OTPs, or recovery codes.

Before production use, connect typed clients to the implemented backend contracts, add authenticated role authorization, secure session storage, server-confirmed sensitive actions, push delivery, and platform build/signing configuration.

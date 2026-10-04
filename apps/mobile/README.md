# Heirloom Mobile

Flutter client for the Heirloom protocol. Mobile account roles are Client, Guardian, and Heir. Executor assignment and law-firm administration remain part of the web client.

## Demo mode

Run without protocol configuration:

```sh
flutter pub get
flutter run
```

Demo mode keeps the local sample vault and labels actions as local previews.

## Live configuration

Copy `.env.example` as a reference and provide the values as Dart defines. Flutter does not load `.env` files automatically. For the Android emulator, the API host usually maps to `10.0.2.2`; for a USB-connected phone, use `adb reverse tcp:4000 tcp:4000` and `http://localhost:4000/api/v1`.

```sh
flutter run \
  --dart-define=API_URL=http://10.0.2.2:4000/api/v1 \
  --dart-define=SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com \
  --dart-define=WC_PROJECT_ID=YOUR_REOWN_PROJECT_ID
```

Live mode must validate these values before initializing wallet, API, or chain services. Sepolia chain ID is `11155111`.

#!/usr/bin/env bash
# Deploys HeirloomVaultFactory to Sepolia using the encrypted keystore account "deployer".
# Usage (from anywhere): ./contracts/script/deploy-sepolia.sh
# Set DEPLOY_DEMO_VAULT=true and the DEMO_* vars in .env to also create a demo vault.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin"

set -a; source .env; set +a
: "${SEPOLIA_RPC_URL:?missing in .env}"
: "${ETHERSCAN_API_KEY:?missing in .env}"

echo "Unlocking keystore 'deployer' to read its address..."
DEPLOYER=$(cast wallet address --account deployer)
BALANCE=$(cast balance "$DEPLOYER" --ether --rpc-url "$SEPOLIA_RPC_URL")
GAS=$(cast from-wei "$(cast gas-price --rpc-url "$SEPOLIA_RPC_URL")" gwei)

echo
echo "  Network : Sepolia ($(cast chain-id --rpc-url "$SEPOLIA_RPC_URL"))"
echo "  Deployer: $DEPLOYER"
echo "  Balance : $BALANCE ETH"
echo "  Gas     : $GAS gwei"
echo "  Deploy  : HeirloomVaultFactory$( [ "${DEPLOY_DEMO_VAULT:-false}" = true ] && echo ' + demo vault')"
echo
read -r -p "Deploy with this account? [y/N] " ok
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "Aborted."; exit 1; }

forge script script/Deploy.s.sol \
  --rpc-url "$SEPOLIA_RPC_URL" \
  --account deployer --sender "$DEPLOYER" \
  --broadcast --verify --etherscan-api-key "$ETHERSCAN_API_KEY"

echo
echo "Addresses written to contracts/deployments/11155111.json:"
cat deployments/11155111.json

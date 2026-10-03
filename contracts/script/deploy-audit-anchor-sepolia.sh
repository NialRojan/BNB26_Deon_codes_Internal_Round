#!/usr/bin/env bash
# Deploys HeirloomAuditAnchor to Sepolia with the encrypted 'deployer' keystore, funds the backend
# anchoring wallet (address derived from ANCHOR_PRIVATE_KEY in apps/api/.env), and wires the address
# into apps/api/.env. Usage: ./contracts/script/deploy-audit-anchor-sepolia.sh
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin"
set -a; source .env; set +a
API_ENV=../apps/api/.env
ANCHORER=$(cast wallet address "$(grep '^ANCHOR_PRIVATE_KEY=' $API_ENV | cut -d= -f2)")

echo "Unlocking keystore 'deployer'..."
DEPLOYER=$(cast wallet address --account deployer)
echo "  Admin (deployer): $DEPLOYER  balance $(cast balance "$DEPLOYER" --ether --rpc-url "$SEPOLIA_RPC_URL") ETH"
echo "  Backend anchorer: $ANCHORER  (will be topped up to 0.02 ETH)"
read -r -p "Deploy HeirloomAuditAnchor? [y/N] " ok
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "Aborted."; exit 1; }

ANCHORER=$ANCHORER forge script script/DeployAuditAnchor.s.sol --rpc-url "$SEPOLIA_RPC_URL" \
  --account deployer --sender "$DEPLOYER" --broadcast --verify --etherscan-api-key "$ETHERSCAN_API_KEY"

ADDR=$(jq -r .auditAnchor deployments/11155111.json)
sed -i '/^ANCHOR_CONTRACT_ADDRESS=/d' $API_ENV && echo "ANCHOR_CONTRACT_ADDRESS=$ADDR" >> $API_ENV
echo "HeirloomAuditAnchor: $ADDR (written to apps/api/.env)"

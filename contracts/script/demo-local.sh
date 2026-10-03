#!/usr/bin/env bash
# Runs the full Heirloom lifecycle on a local Anvil chain:
#   deploy -> fund -> owner goes silent -> 2/3 guardians attest -> veto window -> execute -> heirs claim.
# Usage: ./script/demo-local.sh   (from contracts/; starts and stops its own anvil)
set -euo pipefail
cd "$(dirname "$0")/.."

RPC=http://127.0.0.1:8545
# Anvil's well-known dev accounts (never use these keys on a real network).
OWNER_PK=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
G1_PK=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
G2_PK=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
G3_PK=0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6
HEIR_A=0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65
HEIR_B=0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc
G1=$(cast wallet address $G1_PK); G2=$(cast wallet address $G2_PK); G3=$(cast wallet address $G3_PK)

anvil --silent &
ANVIL_PID=$!
trap 'kill $ANVIL_PID' EXIT
sleep 1

step() { printf '\n\033[1;36m== %s\033[0m\n' "$*"; }
state() {
  local s; s=$(cast call "$VAULT" "currentState()(uint8)" --rpc-url $RPC)
  local names=(Active Watch TriggerPending Executed)
  echo "   state = $s (${names[$s]})"
}
warp() { cast rpc evm_increaseTime "$1" --rpc-url $RPC >/dev/null; cast rpc evm_mine --rpc-url $RPC >/dev/null; }

step "Deploy factory + demo vault (inactivity 120s, veto 180s, 2-of-3 guardians, heirs 60/40)"
PRIVATE_KEY=$OWNER_PK DEPLOY_DEMO_VAULT=true \
DEMO_GUARDIANS="$G1,$G2,$G3" DEMO_REQUIRED_SIGS=2 \
DEMO_HEIRS="$HEIR_A,$HEIR_B" DEMO_SHARES="6000,4000" \
DEMO_ASSET_MAP_CID="ipfs://demo-asset-map" \
  forge script script/Deploy.s.sol --rpc-url $RPC --broadcast --silent
VAULT=$(jq -r .demoVault deployments/31337.json)
echo "   vault = $VAULT"
state

step "Owner deposits 10 ETH"
cast send "$VAULT" --value 10ether --private-key $OWNER_PK --rpc-url $RPC >/dev/null
echo "   vault balance = $(cast balance "$VAULT" --ether --rpc-url $RPC) ETH"

step "Guardian tries to attest while owner is active (should revert)"
cast send "$VAULT" "attestGuardian()" --private-key $G1_PK --rpc-url $RPC >/dev/null 2>&1 \
  && echo "   UNEXPECTED: succeeded" || echo "   reverted as expected (OwnerStillActive)"

step "Owner goes silent for 121s"
warp 121; state

step "Guardians 1 and 2 attest -> veto window opens"
cast send "$VAULT" "attestGuardian()" --private-key $G1_PK --rpc-url $RPC >/dev/null
cast send "$VAULT" "attestGuardian()" --private-key $G2_PK --rpc-url $RPC >/dev/null
state

step "Owner is actually alive -> VETO"
cast send "$VAULT" "vetoRecovery()" --private-key $OWNER_PK --rpc-url $RPC >/dev/null
state

step "Owner really goes silent; guardians attest again (new round)"
warp 121
cast send "$VAULT" "attestGuardian()" --private-key $G1_PK --rpc-url $RPC >/dev/null
cast send "$VAULT" "attestGuardian()" --private-key $G3_PK --rpc-url $RPC >/dev/null
state

step "Veto window (180s) expires; anyone calls executeRelease()"
warp 181
cast send "$VAULT" "executeRelease()" --private-key $G3_PK --rpc-url $RPC >/dev/null
state
echo "   isExecuted() = $(cast call "$VAULT" "isExecuted()(bool)" --rpc-url $RPC)   <- Lit condition now passes"

step "Owner key is dead: owner tries to withdraw (should revert)"
cast send "$VAULT" "execute(address,uint256,bytes)" "$HEIR_A" 1ether 0x --private-key $OWNER_PK --rpc-url $RPC >/dev/null 2>&1 \
  && echo "   UNEXPECTED: succeeded" || echo "   reverted as expected (VaultAlreadyExecuted)"

step "Heirs claim ETH (60/40)"
A0=$(cast balance $HEIR_A --rpc-url $RPC); B0=$(cast balance $HEIR_B --rpc-url $RPC)
cast send "$VAULT" "claim(address,address)" 0x0000000000000000000000000000000000000000 $HEIR_A --private-key $G1_PK --rpc-url $RPC >/dev/null
cast send "$VAULT" "claim(address,address)" 0x0000000000000000000000000000000000000000 $HEIR_B --private-key $G1_PK --rpc-url $RPC >/dev/null
A1=$(cast balance $HEIR_A --rpc-url $RPC); B1=$(cast balance $HEIR_B --rpc-url $RPC)
echo "   heir A received $(cast from-wei $(( A1 - A0 ))) ETH"
echo "   heir B received $(cast from-wei $(( B1 - B0 ))) ETH"
echo "   vault balance = $(cast balance "$VAULT" --ether --rpc-url $RPC) ETH"

step "Done"

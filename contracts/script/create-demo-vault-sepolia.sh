#!/usr/bin/env bash
# Creates the pitch demo vault on Sepolia via the deployed factory and funds it with a little ETH.
# Timers: 120s inactivity, 180s veto window. 2-of-3 guardians. Heirs 60/40 (Heir A is also executor).
# Usage: ./contracts/script/create-demo-vault-sepolia.sh   (asks for the 'deployer' keystore password)
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$PATH:$HOME/.foundry/bin"
set -a; source .env; set +a
RPC="$SEPOLIA_RPC_URL"

FACTORY=$(jq -r .factory deployments/11155111.json)
OWNER=0x668A3BB33A89E2fF21652E190fB425a59D46AF84
G1=0x0915C233A1Ad6092a0529e0b63E3E4ec41371cdD
G2=0xa5Bf598dC07395c21f5Bf39Cf969E8977Ee58Ea6
G3=0x8bcFDA887Cbbc1f202766eF40a18A4d93F77a434
HEIR_A=0x66163667D14B859929697c89e591FF5d624bc71D
HEIR_B=0x806D387Fa3fcF6093E4b0FeAdd9fFaF425DeEddA
SALT=1
FUND=${FUND:-0.02ether}

SIG='(address,address,address[],uint256,(address,uint16)[],uint64,uint64,string)'
CFG="($OWNER,$HEIR_A,[$G1,$G2,$G3],2,[($HEIR_A,6000),($HEIR_B,4000)],120,180,ipfs://heirloom-demo-asset-map)"

VAULT=$(cast call "$FACTORY" "getAddress($SIG,uint256)(address)" "$CFG" $SALT --rpc-url "$RPC")
echo "Factory : $FACTORY"
echo "Vault   : $VAULT (predicted)"
echo "Owner   : $OWNER"
echo "Guards  : $G1, $G2, $G3  (2 of 3)"
echo "Heirs   : A $HEIR_A 60% (executor), B $HEIR_B 40%"
echo "Timers  : 120s inactivity, 180s veto"
echo "Funding : $FUND"
read -r -p "Create and fund this vault? [y/N] " ok
[ "$ok" = y ] || [ "$ok" = Y ] || { echo "Aborted."; exit 1; }

if [ "$(cast code "$VAULT" --rpc-url "$RPC")" = "0x" ]; then
  echo "Creating vault (password prompt)..."
  cast send "$FACTORY" "createVault($SIG,uint256)" "$CFG" $SALT --account deployer --rpc-url "$RPC"
else
  echo "Vault already exists, skipping creation."
fi

echo "Funding vault with $FUND (password prompt)..."
cast send "$VAULT" --value "$FUND" --account deployer --rpc-url "$RPC"

jq --arg v "$VAULT" '.demoVault = $v' deployments/11155111.json > deployments/11155111.json.tmp \
  && mv deployments/11155111.json.tmp deployments/11155111.json

echo
echo "state       : $(cast call "$VAULT" 'currentState()(uint8)' --rpc-url "$RPC")  (0=Active)"
echo "balance     : $(cast balance "$VAULT" --ether --rpc-url "$RPC") ETH"
echo "watchStarts : $(cast call "$VAULT" 'watchStartsAt()(uint64)' --rpc-url "$RPC")"
echo "Etherscan   : https://sepolia.etherscan.io/address/$VAULT"

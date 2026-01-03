#!/bin/bash
#
# Emergency Routing System - Fixed Network Script
# Matches the "File Bootstrap" configuration we validated manually.
#

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/configtx
export VERBOSE=false

# Print formatting
print_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# Mode check
MODE=$1

if [ "$MODE" == "up" ]; then
  print_info "Starting network setup..."
elif [ "$MODE" == "down" ]; then
  print_info "Stopping network..."
  docker-compose -f docker/docker-compose-net.yaml down --volumes --remove-orphans
  exit 0
elif [ "$MODE" == "clean" ]; then
  print_info "Cleaning up..."
  docker-compose -f docker/docker-compose-net.yaml down --volumes --remove-orphans
  sudo rm -rf organizations/peerOrganizations
  sudo rm -rf organizations/ordererOrganizations
  sudo rm -rf channel-artifacts/*
  print_success "Cleanup complete"
  exit 0
elif [ "$MODE" == "restart" ]; then
  $0 down
  $0 up
  exit 0
else
  # Default to help if no valid arg
  echo "Usage: ./network.sh [up|down|clean|restart]"
  exit 1
fi

# ====================================================
# 1. CLEANUP (Safety First)
# ====================================================
# We do a light cleanup to ensure no ID conflicts, but we rely on the clean command for deep cleaning.
print_info "Ensuring clean state for generation..."
rm -rf channel-artifacts/*

# ====================================================
# 2. GENERATE CRYPTO
# ====================================================
print_info "Generating crypto material..."

# Check which crypto config file exists based on your folder structure
if [ -f "organizations/cryptogen/crypto-config.yaml" ]; then
    cryptogen generate --config=./organizations/cryptogen/crypto-config.yaml --output="organizations"
else
    # Fallback/Safety check
    print_info "Using split crypto configs..."
    cryptogen generate --config=./organizations/cryptogen/crypto-config-org1.yaml --output="organizations"
    cryptogen generate --config=./organizations/cryptogen/crypto-config-org2.yaml --output="organizations"
    cryptogen generate --config=./organizations/cryptogen/crypto-config-orderer.yaml --output="organizations"
fi

# ====================================================
# 3. GENERATE ARTIFACTS (The Fix)
# ====================================================
print_info "Generating network artifacts..."

# 3a. Genesis Block (CRITICAL: This allows the Orderer to start)
print_info "Generating Orderer Genesis Block (Profile: EmergencyOrdererGenesis)..."
configtxgen -profile EmergencyOrdererGenesis -channelID system-channel -outputBlock ./channel-artifacts/genesis.block

# 3b. Channel Tx
print_info "Generating Channel Creation Tx (Profile: EmergencyChannel)..."
configtxgen -profile EmergencyChannel -outputCreateChannelTx ./channel-artifacts/emergency.tx -channelID emergency-channel

# ====================================================
# 4. START NETWORK
# ====================================================
print_info "Starting containers..."
# We only start the NET yaml. We do NOT start CAs.
docker-compose -f docker/docker-compose-net.yaml up -d

print_info "Waiting 5 seconds for Orderer to stabilize..."
sleep 5

# ====================================================
# 5. CREATE & JOIN CHANNEL
# ====================================================
print_info "Creating and joining channel..."

# Define Variables
CHANNEL_NAME="emergency-channel"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem"

# 5a. Create Channel
print_info "Creating channel..."
docker exec cli peer channel create -o orderer.emergency.net:7050 -c $CHANNEL_NAME \
    --ordererTLSHostnameOverride orderer.emergency.net \
    -f ./channel-artifacts/emergency.tx \
    --outputBlock ./channel-artifacts/emergency.block \
    --tls --cafile $ORDERER_CA

# 5b. Join Medical
print_info "Joining Medical Peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=MedicalMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp \
    -e CORE_PEER_ADDRESS=peer0.medical.emergency.net:7051 \
    cli peer channel join -b ./channel-artifacts/emergency.block

# 5c. Join Police
print_info "Joining Police Peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=PoliceMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
    -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
    cli peer channel join -b ./channel-artifacts/emergency.block

print_success "Network setup completed successfully!"
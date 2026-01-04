#!/bin/bash
#
# Emergency Routing System - Fixed Network Script
# Matches the "File Bootstrap" configuration we validated manually.
#

export PATH=${PWD}/../bin:$PATH
export FABRIC_CFG_PATH=${PWD}/../configtx
export VERBOSE=false

# Print formatting
print_info() { echo -e "\033[0;34m[INFO]\033[0m $1"; }
print_success() { echo -e "\033[0;32m[SUCCESS]\033[0m $1"; }
print_error() { echo -e "\033[0;31m[ERROR]\033[0m $1"; }

# Detect docker compose command (v2 or v1)
if command -v docker &> /dev/null && docker compose version &> /dev/null; then
  DOCKER_COMPOSE="docker compose"
elif command -v docker-compose &> /dev/null; then
  DOCKER_COMPOSE="docker-compose"
else
  print_error "Neither 'docker compose' (v2) nor 'docker-compose' (v1) is available"
  exit 1
fi

# Mode check
MODE=$1

if [ "$MODE" == "up" ]; then
  print_info "Starting network setup..."
elif [ "$MODE" == "down" ]; then
  print_info "Stopping network..."
  $DOCKER_COMPOSE -f ../docker/docker-compose-net.yaml down --volumes --remove-orphans
  exit 0
elif [ "$MODE" == "clean" ]; then
  print_info "Cleaning up..."
  $DOCKER_COMPOSE -f ../docker/docker-compose-net.yaml down --volumes --remove-orphans
  sudo rm -rf ../organizations/peerOrganizations
  sudo rm -rf ../organizations/ordererOrganizations
  sudo rm -rf ../channel-artifacts/*
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
rm -rf ../channel-artifacts/*

# ====================================================
# 2. CRYPTO MATERIAL GENERATION  
# ====================================================
print_info "Generating crypto material..."

# Using test-network crypto structure but generating fresh with correct domain names
print_info "Generating crypto material..."

if [ -f "../organizations/cryptogen/crypto-config-medical.yaml" ]; then
   cryptogen generate --config=../organizations/cryptogen/crypto-config-medical.yaml --output="../organizations"
   cryptogen generate --config=../organizations/cryptogen/crypto-config-police.yaml --output="../organizations"
   cryptogen generate --config=../organizations/cryptogen/crypto-config-orderer.yaml --output="../organizations"
else
   print_error "Crypto config files not found!"
   exit 1
fi

# ====================================================
# 3. GENERATE ARTIFACTS (The Fix)
# ====================================================
print_info "Generating network artifacts..."

# 3a. Genesis Block (for Orderer bootstrap)
print_info "Generating Orderer Genesis Block (Profile: EmergencyOrdererGenesis)..."
configtxgen -profile EmergencyOrdererGenesis -channelID system-channel -outputBlock ../channel-artifacts/genesis.block

# 3b. Channel Transaction
print_info "Generating Channel Transaction (Profile: EmergencyChannel)..."
configtxgen -profile EmergencyChannel -outputCreateChannelTx ../channel-artifacts/emergency.tx -channelID emergency-channel

# ====================================================
# 4. START NETWORK
# ====================================================
print_info "Starting containers..."
$DOCKER_COMPOSE -f ../docker/docker-compose-net.yaml up -d

print_info "Waiting 10 seconds for Orderer and peers to fully start..."
sleep 10

# Verify orderer is ready
print_info "Verifying orderer readiness..."
for i in {1..10}; do
  if docker logs orderer.emergency.net 2>&1 | grep -q "Beginning to serve requests"; then
    print_success "Orderer is ready"
    break
  fi
  echo "Waiting for orderer... ($i/10)"
  sleep 2
done

# ====================================================
# 5. JOIN CHANNEL (No channel create needed - genesis block already exists)
# ====================================================
print_info "Joining peers to channel..."

CHANNEL_NAME="emergency-channel"
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem"

# 5a. Create Channel
print_info "Creating channel..."
docker exec \
    -e CORE_PEER_LOCALMSPID=MedicalMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp \
    -e CORE_PEER_ADDRESS=peer0.medical.emergency.net:7051 \
    cli peer channel create \
    -o orderer.emergency.net:7050 \
    -c $CHANNEL_NAME \
    --ordererTLSHostnameOverride orderer.emergency.net \
    -f ./channel-artifacts/emergency.tx \
    --outputBlock ./channel-artifacts/emergency.block \
    --tls --cafile $ORDERER_CA || echo "Channel creation failed or channel exists"

sleep 2

# 5b. Join Medical Peer
print_info "Joining Medical Peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=MedicalMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp \
    -e CORE_PEER_ADDRESS=peer0.medical.emergency.net:7051 \
    cli peer channel join -b ./channel-artifacts/emergency.block

if [ $? -ne 0 ]; then
    print_error "Medical peer failed to join channel!"
    exit 1
fi

print_success "Medical peer joined channel"

# 5b. Join Police Peer
print_info "Joining Police Peer..."
docker exec \
    -e CORE_PEER_LOCALMSPID=PoliceMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
    -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
    cli peer channel join -b ./channel-artifacts/emergency.block

if [ $? -ne 0 ]; then
    print_error "Police peer failed to join channel!"
    exit 1
fi

print_success "Police peer joined channel"
print_success "Network setup completed successfully!"
#!/bin/bash
#
# Emergency Routing System - CCAAS Deployment Script
# Deploys the routing chaincode using Chaincode-as-a-Service
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
CHANNEL_NAME="emergency-channel"
CHAINCODE_NAME="routing"
CHAINCODE_VERSION="1.0"
CHAINCODE_SEQUENCE="1"
CC_ADDRESS="routing-chaincode:9999"

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"

# Print functions
print_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Orderer TLS CA
ORDERER_CA="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem"

# Medical Peer settings
MEDICAL_PEER="peer0.medical.emergency.net:7051"
MEDICAL_MSP="MedicalMSP"
MEDICAL_TLS_ROOTCERT="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt"
MEDICAL_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp"

# Police Peer settings
POLICE_PEER="peer0.police.emergency.net:9051"
POLICE_MSP="PoliceMSP"
POLICE_TLS_ROOTCERT="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt"
POLICE_MSPCONFIGPATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp"

# Package chaincode for CCAAS
package_chaincode() {
    print_info "Creating CCAAS package..."
    
    # Create temporary directory
    TEMP_DIR=$(mktemp -d)
    
    # Create connection.json
    cat > "$TEMP_DIR/connection.json" << EOF
{
    "address": "${CC_ADDRESS}",
    "dial_timeout": "10s",
    "tls_required": false
}
EOF
    
    # Create metadata.json
    cat > "$TEMP_DIR/metadata.json" << EOF
{
    "type": "ccaas",
    "label": "${CHAINCODE_NAME}_${CHAINCODE_VERSION}"
}
EOF
    
    # Create code.tar.gz with connection.json
    cd "$TEMP_DIR"
    tar cfz code.tar.gz connection.json
    
    # Create final package
    tar cfz "${CHAINCODE_NAME}.tar.gz" code.tar.gz metadata.json
    
    # Copy to chaincode dir so it's accessible from CLI
    docker cp "${CHAINCODE_NAME}.tar.gz" cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/
    
    # Cleanup
    rm -rf "$TEMP_DIR"
    
    print_success "CCAAS package created"
}

# Install chaincode on Medical peer
install_on_medical() {
    print_info "Installing chaincode on Medical peer..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz
    
    print_success "Chaincode installed on Medical peer"
}

# Install chaincode on Police peer
install_on_police() {
    print_info "Installing chaincode on Police peer..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$POLICE_PEER \
        -e CORE_PEER_LOCALMSPID=$POLICE_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$POLICE_MSPCONFIGPATH \
        cli peer lifecycle chaincode install ${CHAINCODE_NAME}.tar.gz
    
    print_success "Chaincode installed on Police peer"
}

# Get package ID
get_package_id() {
    print_info "Getting package ID..."
    
    PACKAGE_ID=$(docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode queryinstalled | grep "${CHAINCODE_NAME}_${CHAINCODE_VERSION}" | awk '{print $3}' | cut -d',' -f1)
    
    if [ -z "$PACKAGE_ID" ]; then
        print_error "Could not find package ID"
        exit 1
    fi
    
    echo "Package ID: $PACKAGE_ID"
}

# Start chaincode container
start_chaincode_container() {
    print_info "Starting chaincode container..."
    
    # Stop existing container if running
    docker stop routing-chaincode 2>/dev/null || true
    docker rm routing-chaincode 2>/dev/null || true
    
    # Start chaincode container with the package ID
    docker run -d \
        --name routing-chaincode \
        --network emergency-routing_fabric \
        -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
        -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" \
        -p 9999:9999 \
        routing-chaincode:1.0
    
    # Wait for it to start
    sleep 3
    
    print_success "Chaincode container started"
}

# Approve chaincode for Medical
approve_for_medical() {
    print_info "Approving chaincode for Medical organization..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode approveformyorg \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile $ORDERER_CA \
        --signature-policy "OR('MedicalMSP.peer','PoliceMSP.peer')"
    
    print_success "Chaincode approved for Medical"
}

# Approve chaincode for Police
approve_for_police() {
    print_info "Approving chaincode for Police organization..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$POLICE_PEER \
        -e CORE_PEER_LOCALMSPID=$POLICE_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$POLICE_MSPCONFIGPATH \
        cli peer lifecycle chaincode approveformyorg \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --package-id $PACKAGE_ID \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile $ORDERER_CA \
        --signature-policy "OR('MedicalMSP.peer','PoliceMSP.peer')"
    
    print_success "Chaincode approved for Police"
}

# Commit chaincode
commit_chaincode() {
    print_info "Committing chaincode..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode commit \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile $ORDERER_CA \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        --signature-policy "OR('MedicalMSP.peer','PoliceMSP.peer')"
    
    print_success "Chaincode committed with OR endorsement policy"
}

# Initialize chaincode
init_chaincode() {
    print_info "Initializing chaincode..."
    
    # NOTE: The default endorsement policy requires BOTH Medical AND Police peers to endorse
    # All invoke commands must include --peerAddresses for BOTH peers
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer chaincode invoke \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --tls \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        -c '{"function":"SegmentContract:InitSegments","Args":[]}'
    
    sleep 2
    
    # Register test vehicles
    print_info "Registering Medical vehicles (priority 1)..."
    
    # AMB-001 - Medical, priority 1
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer chaincode invoke \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --tls \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        -c '{"function":"VehicleContract:RegisterVehicle","Args":["AMB-001","medical","ambulance","1"]}'
    
    sleep 1
    
    # AMB-002 - Medical, priority 1
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer chaincode invoke \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --tls \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        -c '{"function":"VehicleContract:RegisterVehicle","Args":["AMB-002","medical","ambulance","1"]}'
    
    sleep 1
    
    print_info "Registering Police vehicles (priority 2)..."
    
    # POL-001 - Police, priority 2
    docker exec \
        -e CORE_PEER_ADDRESS=$POLICE_PEER \
        -e CORE_PEER_LOCALMSPID=$POLICE_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$POLICE_MSPCONFIGPATH \
        cli peer chaincode invoke \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --tls \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        -c '{"function":"VehicleContract:RegisterVehicle","Args":["POL-001","police","patrol","2"]}'
    
    sleep 1
    
    # POL-002 - Police, priority 2
    docker exec \
        -e CORE_PEER_ADDRESS=$POLICE_PEER \
        -e CORE_PEER_LOCALMSPID=$POLICE_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$POLICE_MSPCONFIGPATH \
        cli peer chaincode invoke \
        -o orderer.emergency.net:7050 \
        --ordererTLSHostnameOverride orderer.emergency.net \
        --tls \
        --cafile $ORDERER_CA \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        --peerAddresses $MEDICAL_PEER \
        --tlsRootCertFiles $MEDICAL_TLS_ROOTCERT \
        --peerAddresses $POLICE_PEER \
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT \
        -c '{"function":"VehicleContract:RegisterVehicle","Args":["POL-002","police","patrol","2"]}'
    
    print_success "Chaincode initialized with segments and 4 vehicles (2 Medical P1, 2 Police P2)"
}

# Main
main() {
    print_info "Starting CCAAS deployment..."
    
    package_chaincode
    install_on_medical
    install_on_police
    get_package_id
    start_chaincode_container
    
    sleep 2
    
    approve_for_medical
    approve_for_police
    commit_chaincode
    
    print_success "CCAAS deployment completed!"
    
    # Initialize
    print_info "Initializing chaincode data..."
    init_chaincode
}

main "$@"


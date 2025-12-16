#!/bin/bash
#
# Emergency Routing System - Chaincode Deployment Script
# Deploys the routing chaincode to the network
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
CHAINCODE_VERSION="3.0"
CHAINCODE_SEQUENCE="3"
CHAINCODE_PATH="/opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/routing"

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

# Set environment for Medical peer
set_medical_env() {
    export CORE_PEER_ADDRESS=$MEDICAL_PEER
    export CORE_PEER_LOCALMSPID=$MEDICAL_MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT
    export CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH
}

# Set environment for Police peer
set_police_env() {
    export CORE_PEER_ADDRESS=$POLICE_PEER
    export CORE_PEER_LOCALMSPID=$POLICE_MSP
    export CORE_PEER_TLS_ROOTCERT_FILE=$POLICE_TLS_ROOTCERT
    export CORE_PEER_MSPCONFIGPATH=$POLICE_MSPCONFIGPATH
}

# Package chaincode
package_chaincode() {
    print_info "Packaging chaincode..."
    
    docker exec cli peer lifecycle chaincode package ${CHAINCODE_NAME}.tar.gz \
        --path ${CHAINCODE_PATH} \
        --lang golang \
        --label ${CHAINCODE_NAME}_${CHAINCODE_VERSION}
    
    print_success "Chaincode packaged"
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
    
    echo "Package ID: $PACKAGE_ID"
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
        --cafile $ORDERER_CA
    
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
        --cafile $ORDERER_CA
    
    print_success "Chaincode approved for Police"
}

# Check commit readiness
check_commit_readiness() {
    print_info "Checking commit readiness..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode checkcommitreadiness \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME \
        --version $CHAINCODE_VERSION \
        --sequence $CHAINCODE_SEQUENCE \
        --tls \
        --cafile $ORDERER_CA \
        --output json
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
        --tlsRootCertFiles $POLICE_TLS_ROOTCERT
    
    print_success "Chaincode committed"
}

# Query committed chaincode
query_committed() {
    print_info "Querying committed chaincode..."
    
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer lifecycle chaincode querycommitted \
        --channelID $CHANNEL_NAME \
        --name $CHAINCODE_NAME
}

# Initialize chaincode (init segments)
init_chaincode() {
    print_info "Initializing chaincode (creating 5x5 grid segments)..."
    
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
    
    print_success "Chaincode initialized - 40 segments created"
}

# Test chaincode
test_chaincode() {
    print_info "Testing chaincode..."
    
    # Test GetAllSegments
    print_info "Query: GetAllSegments"
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer chaincode query \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'
    
    echo ""
    
    # Test RegisterVehicle (Medical)
    print_info "Invoke: RegisterVehicle (AMB-001)"
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
        -c '{"function":"VehicleContract:RegisterVehicle","Args":["AMB-001","medical","ambulance","1"]}'
    
    sleep 2
    
    # Query the vehicle
    print_info "Query: GetVehicle (AMB-001)"
    docker exec \
        -e CORE_PEER_ADDRESS=$MEDICAL_PEER \
        -e CORE_PEER_LOCALMSPID=$MEDICAL_MSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=$MEDICAL_TLS_ROOTCERT \
        -e CORE_PEER_MSPCONFIGPATH=$MEDICAL_MSPCONFIGPATH \
        cli peer chaincode query \
        -C $CHANNEL_NAME \
        -n $CHAINCODE_NAME \
        -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-001"]}'
    
    print_success "Chaincode tests completed"
}

# Main deployment function
deploy() {
    print_info "Starting chaincode deployment..."
    
    package_chaincode
    install_on_medical
    install_on_police
    get_package_id
    approve_for_medical
    approve_for_police
    check_commit_readiness
    commit_chaincode
    query_committed
    
    print_success "Chaincode deployment completed!"
    
    # Ask if user wants to initialize
    read -p "Initialize chaincode (create segments)? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        init_chaincode
    fi
    
    # Ask if user wants to test
    read -p "Run chaincode tests? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_chaincode
    fi
}

# Show help
show_help() {
    echo "Chaincode Deployment Script"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  deploy    - Full deployment (package, install, approve, commit)"
    echo "  package   - Package the chaincode"
    echo "  install   - Install on all peers"
    echo "  approve   - Approve for all organizations"
    echo "  commit    - Commit the chaincode"
    echo "  init      - Initialize chaincode (create segments)"
    echo "  test      - Test chaincode functions"
    echo "  help      - Show this help"
}

# Main
case "$1" in
    deploy)
        deploy
        ;;
    package)
        package_chaincode
        ;;
    install)
        install_on_medical
        install_on_police
        ;;
    approve)
        get_package_id
        approve_for_medical
        approve_for_police
        ;;
    commit)
        commit_chaincode
        ;;
    init)
        init_chaincode
        ;;
    test)
        test_chaincode
        ;;
    help|--help|-h|"")
        show_help
        ;;
    *)
        print_error "Unknown command: $1"
        show_help
        exit 1
        ;;
esac


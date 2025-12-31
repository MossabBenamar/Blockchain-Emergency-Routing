#!/bin/bash
#
# Emergency Routing System - Network Management Script
# This script handles the Hyperledger Fabric network lifecycle
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NETWORK_DIR="$(dirname "$SCRIPT_DIR")"
DOCKER_DIR="$NETWORK_DIR/docker"
CRYPTO_DIR="$NETWORK_DIR/organizations"
CONFIGTX_DIR="$NETWORK_DIR/configtx"

# Channel name
CHANNEL_NAME="emergency-channel"

# Determine Docker Compose command (v1 uses docker-compose, v2+ uses docker compose)
if command -v docker-compose &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker-compose"
elif docker compose version &> /dev/null; then
    DOCKER_COMPOSE_CMD="docker compose"
else
    DOCKER_COMPOSE_CMD="docker-compose"  # fallback
fi

# Print functions
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if cryptogen is available
    if ! command -v cryptogen &> /dev/null; then
        print_warning "cryptogen not found in PATH. Will use Docker image."
    fi
    
    # Check if configtxgen is available
    if ! command -v configtxgen &> /dev/null; then
        print_warning "configtxgen not found in PATH. Will use Docker image."
    fi
    
    print_success "Prerequisites check passed"
}

# Generate crypto material using cryptogen
generate_crypto() {
    print_info "Generating crypto material..."
    
    # Create directories
    mkdir -p "$CRYPTO_DIR/peerOrganizations"
    mkdir -p "$CRYPTO_DIR/ordererOrganizations"
    
    # Use cryptogen if available, otherwise use docker
    if command -v cryptogen &> /dev/null; then
        cryptogen generate --config="$NETWORK_DIR/organizations/cryptogen/crypto-config.yaml" --output="$CRYPTO_DIR"
    else
        print_info "Using Docker to run cryptogen..."
        docker run --rm \
            -v "$NETWORK_DIR/organizations/cryptogen:/crypto-config" \
            -v "$CRYPTO_DIR:/output" \
            hyperledger/fabric-tools:2.5 \
            cryptogen generate --config=/crypto-config/crypto-config.yaml --output=/output
    fi
    
    print_success "Crypto material generated"
}

# Generate channel artifacts for Fabric 2.5+ (no system channel)
generate_genesis() {
    print_info "Generating channel configuration for Fabric 2.5+..."
    
    mkdir -p "$NETWORK_DIR/channel-artifacts"
    
    # Export path for configtxgen
    export FABRIC_CFG_PATH="$CONFIGTX_DIR"
    
    # For Fabric 2.5+ with no system channel, we only need to generate the channel genesis block
    # This will be done in the create_channel function using osnadmin
    
    print_success "Channel artifacts directory prepared"
}

# Remove existing network if it needs to be recreated
cleanup_network() {
    print_info "Checking for existing network..."
    
    # Check if network exists and remove it if needed
    if docker network ls | grep -q "emergency-routing_fabric"; then
        print_warning "Existing network found. Removing it to avoid recreation errors..."
        
        # First, stop all containers that might be using the network
        cd "$DOCKER_DIR"
        print_info "Stopping containers that might be using the network..."
        $DOCKER_COMPOSE_CMD -f docker-compose-net.yaml down 2>/dev/null || true
        $DOCKER_COMPOSE_CMD -f docker-compose-ca.yaml down 2>/dev/null || true
        
        # Wait a moment for containers to stop
        sleep 2
        
        # Now try to remove the network
        print_info "Removing existing network..."
        docker network rm emergency-routing_fabric 2>/dev/null || {
            # If still in use, force disconnect all containers
            print_warning "Network still in use. Force removing..."
            docker network inspect emergency-routing_fabric 2>/dev/null | \
                grep -oP '"Name": "\K[^"]+' | \
                xargs -r -I {} docker network disconnect -f emergency-routing_fabric {} 2>/dev/null || true
            docker network rm emergency-routing_fabric 2>/dev/null || true
        }
        
        # Wait a moment for network removal to complete
        sleep 1
        
        # Verify network is gone
        if docker network ls | grep -q "emergency-routing_fabric"; then
            print_warning "Network still exists. Will attempt to continue..."
        else
            print_success "Network removed successfully"
        fi
    fi
}

# Start the network
start_network() {
    print_info "Starting the Fabric network..."
    
    # Clean up existing network if needed
    cleanup_network
    
    cd "$DOCKER_DIR"
    
    # Create the network externally first with explicit settings to avoid conflicts
    print_info "Creating network with explicit configuration..."
    docker network create \
        --driver bridge \
        --subnet 172.28.0.0/16 \
        emergency-routing_fabric 2>/dev/null || {
        # Network might already exist, try to remove and recreate
        docker network rm emergency-routing_fabric 2>/dev/null || true
        sleep 1
        docker network create \
            --driver bridge \
            --subnet 172.28.0.0/16 \
            emergency-routing_fabric
    }
    
    # Start CAs first (they will use the existing network)
    print_info "Starting Certificate Authorities..."
    $DOCKER_COMPOSE_CMD -f "$DOCKER_DIR/docker-compose-ca.yaml" up -d
    sleep 3
    
    # Start network components (they will use the existing network)
    print_info "Starting network components..."
    $DOCKER_COMPOSE_CMD -f "$DOCKER_DIR/docker-compose-net.yaml" up -d
    
    print_success "Network started"
    
    # Wait for containers to be ready
    print_info "Waiting for containers to be ready..."
    sleep 5
    
    # Show running containers
    docker ps --filter "name=emergency" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Stop the network
stop_network() {
    print_info "Stopping the Fabric network..."
    
    cd "$DOCKER_DIR"
    
    $DOCKER_COMPOSE_CMD -f "$DOCKER_DIR/docker-compose-net.yaml" down --volumes --remove-orphans
    $DOCKER_COMPOSE_CMD -f "$DOCKER_DIR/docker-compose-ca.yaml" down --volumes --remove-orphans
    
    # Remove the network if it exists
    docker network rm emergency-routing_fabric 2>/dev/null || true
    
    print_success "Network stopped"
}

# Clean up everything
clean_network() {
    print_info "Cleaning up network..."
    
    # Stop containers
    stop_network 2>/dev/null || true
    
    # Remove generated files
    rm -rf "$CRYPTO_DIR/peerOrganizations"
    rm -rf "$CRYPTO_DIR/ordererOrganizations"
    rm -rf "$CRYPTO_DIR/fabric-ca"
    rm -rf "$NETWORK_DIR/channel-artifacts"
    
    # Remove Docker volumes
    docker volume prune -f
    
    # Remove chaincode images
    docker images -q "dev-peer*" | xargs -r docker rmi -f 2>/dev/null || true
    
    # Ensure network is removed
    docker network rm emergency-routing_fabric 2>/dev/null || true
    docker network prune -f
    
    print_success "Network cleaned up"
}

# Create channel using osnadmin for Fabric 2.5+
create_channel() {
    print_info "Creating channel: $CHANNEL_NAME..."
    
    # First, generate the channel genesis block using configtxgen
    print_info "Generating channel genesis block..."
    export FABRIC_CFG_PATH="$CONFIGTX_DIR"
    
    # Use configtxgen if available, otherwise use Docker
    if command -v configtxgen &> /dev/null; then
        configtxgen -profile EmergencyChannel -outputBlock "$NETWORK_DIR/channel-artifacts/${CHANNEL_NAME}.block" -channelID $CHANNEL_NAME
    else
        print_info "Using Docker to run configtxgen..."
        docker run --rm \
            -v "$CONFIGTX_DIR:/configtx" \
            -v "$NETWORK_DIR/organizations:/organizations" \
            -v "$NETWORK_DIR/channel-artifacts:/output" \
            -e FABRIC_CFG_PATH=/configtx \
            hyperledger/fabric-tools:2.5 \
            configtxgen -profile EmergencyChannel -outputBlock /output/${CHANNEL_NAME}.block -channelID $CHANNEL_NAME
    fi
    
    # Use osnadmin to join orderer to channel (run via Docker)
    print_info "Joining orderer to channel using osnadmin..."
    docker exec cli osnadmin channel join \
        --channelID $CHANNEL_NAME \
        --config-block /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block \
        -o orderer.emergency.net:7053 \
        --ca-file /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
        --client-cert /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.crt \
        --client-key /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.key
    
    print_success "Channel created and orderer joined"
}

# Join peers to channel
join_channel() {
    print_info "Joining peers to channel..."
    
    # Wait a bit for orderer to be ready
    sleep 2
    
    # Join Medical peer
    print_info "Joining peer0.medical..."
    docker exec cli peer channel join \
        -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block
    
    # Join Police peer
    print_info "Joining peer0.police..."
    docker exec -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
        -e CORE_PEER_LOCALMSPID=PoliceMSP \
        -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
        -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
        cli peer channel join \
        -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/${CHANNEL_NAME}.block
    
    print_success "Peers joined to channel"
}

# Show help
show_help() {
    echo "Emergency Routing System - Network Management"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  up        - Generate crypto, start network, create and join channel"
    echo "  down      - Stop the network"
    echo "  restart   - Restart the network"
    echo "  clean     - Clean up all generated files and volumes"
    echo "  generate  - Generate crypto material and genesis block"
    echo "  start     - Start the network containers"
    echo "  stop      - Stop the network containers"
    echo "  channel   - Create and join channel"
    echo "  status    - Show network status"
    echo "  help      - Show this help message"
    echo ""
}

# Show network status
show_status() {
    print_info "Network Status:"
    echo ""
    docker ps --filter "name=emergency" --filter "name=cli" --filter "name=couchdb" --filter "name=orderer" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# Main function
main() {
    case "$1" in
        up)
            check_prerequisites
            generate_crypto
            generate_genesis
            start_network
            sleep 5
            create_channel
            join_channel
            print_success "Network is up and running!"
            ;;
        down)
            stop_network
            ;;
        restart)
            stop_network
            start_network
            ;;
        clean)
            clean_network
            ;;
        generate)
            check_prerequisites
            generate_crypto
            generate_genesis
            ;;
        start)
            start_network
            ;;
        stop)
            stop_network
            ;;
        channel)
            create_channel
            join_channel
            ;;
        status)
            show_status
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            print_error "Unknown command: $1"
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"


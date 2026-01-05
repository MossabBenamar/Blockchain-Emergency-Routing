#!/bin/bash
set -e

# Clean and simple startup script for Blockchain Emergency Routing

# Go to project root
cd "$(dirname "$0")"

# Ensure Fabric binaries (cryptogen, configtxgen) exist
BIN_DIR="blockchain/network/bin"
for bin in cryptogen configtxgen; do
    if [ ! -f "$BIN_DIR/$bin" ]; then
        echo "Missing $bin. Installing Fabric binaries..."
        mkdir -p "$BIN_DIR"
        curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
        chmod +x install-fabric.sh
        ./install-fabric.sh --fabric-version 2.5.0 binary
        # Binaries are extracted to ./bin/ in current directory
        if [ -d ./bin ]; then
            cp ./bin/$bin "$BIN_DIR/" 2>/dev/null || true
            chmod +x "$BIN_DIR/$bin" 2>/dev/null || true
        fi
        rm -f install-fabric.sh
        [ -f "$BIN_DIR/$bin" ] || { echo "Failed to install $bin. Install manually."; exit 1; }
    fi
done

# Build chaincode Docker image
echo "Building chaincode Docker image..."
docker build -t routing-chaincode:1.0 ./blockchain/chaincode/routing

# Restart Fabric Network
echo "Restarting Fabric network..."
make network-down || true
make network-up
sleep 10

# Deploy chaincode
echo "Deploying chaincode..."
./blockchain/network/scripts/deploy-ccaas.sh

# Fix ownership on generated files (if needed)
if [ -d "blockchain/network/organizations" ]; then
    USER=$(whoami)
    GROUP=$(id -gn)
    echo "Fixing file permissions..."
    sudo chown -R "$USER:$GROUP" blockchain/network/organizations/ 2>/dev/null || \
        echo "Could not fix permissions. Run ./fix-permissions.sh if you hit errors."
fi

# Final instructions
cat <<EOF

All services started!
To run backend/medical:   cd backend && ORG_TYPE=medical  PORT=3001 WS_PORT=3002 npm run dev
To run backend/police:    cd backend && ORG_TYPE=police   PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
To run frontend:          cd frontend && npm run dev

EOF
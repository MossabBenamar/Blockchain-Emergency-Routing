#!/bin/bash

set -e

# This script may require sudo permissions for certain operations:
# 1. Docker commands (if your user is not in the 'docker' group)
# 2. make network-down and make network-up commands (if these use docker or modify system files)
# 3. gnome-terminal launch (typically doesn't require sudo)
#
# In most development setups, it's recommended to add your user to the 'docker' group to avoid using sudo for Docker.
# If you hit permission errors, try running the script with sudo, or adjust system permissions as needed.
#
# Example to add your user to the docker group (then reboot or log out/in):
#   sudo usermod -aG docker $USER

# Change to the project root directory
cd "$(dirname "$0")"

echo "Building chaincode Docker image..."
cd blockchain/chaincode/routing
docker build -t routing-chaincode:1.0 .
cd ../../..

echo "Bringing network up..."
make network-down || true
make network-up
sleep 10

echo "Deploying chaincode..."
./blockchain/network/scripts/deploy-ccaas.sh

echo "Fixing blockchain network file permissions..."
# Fix file permissions for blockchain network files
# The network setup creates files owned by root, but the backend runs as the current user
# We fix the entire organizations directory to avoid permission issues with cleanup and backend access
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

if [ -d "blockchain/network/organizations" ]; then
    echo "Fixing ownership of organizations directory..."
    sudo chown -R $CURRENT_USER:$CURRENT_GROUP blockchain/network/organizations/ 2>/dev/null || {
        echo "Warning: Could not fix permissions automatically. You may need to run ./fix-permissions.sh manually."
    }
    echo "✓ Permissions fixed"
fi

echo "All services started. You can now start the backend and frontend services in separate terminals. using the following commands:"
echo "cd backend && ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev"
echo "cd backend && ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev"
echo "cd frontend && npm run dev"

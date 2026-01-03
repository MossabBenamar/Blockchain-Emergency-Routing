#!/bin/bash
# Fix file permissions for blockchain network files
# This script changes ownership of all blockchain network files from root to the current user
# This is needed because the network setup creates files owned by root, but the backend runs as a regular user

echo "Fixing blockchain network file permissions..."

# Get the current user
CURRENT_USER=$(whoami)
CURRENT_GROUP=$(id -gn)

# Fix the entire organizations directory (includes all peer organizations, orderer organizations, etc.)
if [ -d "blockchain/network/organizations" ]; then
    echo "Fixing ownership of entire organizations directory..."
    sudo chown -R $CURRENT_USER:$CURRENT_GROUP blockchain/network/organizations/ 2>/dev/null || {
        echo "Error: Could not fix permissions. You may need to run this script with sudo or enter your password."
        exit 1
    }
    echo "✓ Organizations directory fixed"
else
    echo "Warning: organizations directory not found"
fi

# Also fix any other blockchain network directories that might be owned by root
if [ -d "blockchain/network" ]; then
    echo "Fixing ownership of blockchain network directory..."
    sudo chown -R $CURRENT_USER:$CURRENT_GROUP blockchain/network/ 2>/dev/null || {
        echo "Warning: Could not fix all network directory permissions"
    }
    echo "✓ Network directory fixed"
fi

# Verify the fix
echo ""
echo "Verifying permissions..."
if [ -d "blockchain/network/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp/keystore" ]; then
    ls -la blockchain/network/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp/keystore/ 2>/dev/null | head -3
fi

echo ""
echo "✓ Permissions fixed! You can now run the backend service and clean the network."

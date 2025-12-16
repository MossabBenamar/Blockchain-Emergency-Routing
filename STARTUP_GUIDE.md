# 🚀 Emergency Vehicle Routing System - Startup Guide

This guide contains all commands needed to start the project after closing it.

---

## 📋 Prerequisites

Before starting, ensure you have:
- **Docker** and **Docker Compose** installed and running
- **Node.js** >= 18.0.0
- **Hyperledger Fabric binaries** (cryptogen, configtxgen) in PATH
- All project dependencies installed

---

## 🔄 Quick Start (If Network Was Already Running)

If you just closed the terminals and the Docker containers are still running:

```bash
# Check if network is running
cd /home/mossab/hyper-project
make status

# If containers are running, just start the backends and frontend
```

**Terminal 1 - Medical Backend:**
```bash
cd /home/mossab/hyper-project/backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

**Terminal 2 - Police Backend:**
```bash
cd /home/mossab/hyper-project/backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd /home/mossab/hyper-project/frontend
npm run dev
```

---

## 🔧 Full Restart (After System Reboot or Network Down)

If the Docker containers are not running or you need a clean start:

### Step 1: Clean and Start Network

```bash
cd /home/mossab/hyper-project

# Stop any running containers
make network-down

# Clean old crypto materials and volumes
docker volume prune -f
rm -rf blockchain/network/organizations/peerOrganizations
rm -rf blockchain/network/organizations/ordererOrganizations
rm -rf blockchain/network/channel-artifacts

# Generate fresh crypto materials
cryptogen generate --config=blockchain/network/organizations/cryptogen/crypto-config.yaml --output=blockchain/network/organizations

# Start the network
cd blockchain/network/docker
docker-compose -f docker-compose-ca.yaml up -d
sleep 3
docker-compose -f docker-compose-net.yaml up -d
sleep 5
```

### Step 2: Create Channel and Join Orderer

```bash
cd /home/mossab/hyper-project

# Generate channel genesis block
mkdir -p blockchain/network/channel-artifacts
export FABRIC_CFG_PATH=/home/mossab/hyper-project/blockchain/network/configtx
configtxgen -profile EmergencyChannel -outputBlock blockchain/network/channel-artifacts/emergency-channel.block -channelID emergency-channel

# Join orderer to channel
docker exec cli osnadmin channel join \
    --channelID emergency-channel \
    --config-block /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block \
    -o orderer.emergency.net:7053 \
    --ca-file /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
    --client-cert /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.crt \
    --client-key /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.key
```

### Step 3: Join Peers to Channel

```bash
# Join Medical peer
docker exec cli peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block

# Join Police peer
docker exec \
    -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
    -e CORE_PEER_LOCALMSPID=PoliceMSP \
    -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
    -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
    cli peer channel join \
    -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block
```

### Step 4: Deploy Chaincode

```bash
cd /home/mossab/hyper-project

# Run the CCAAS deployment script
chmod +x blockchain/network/scripts/deploy-ccaas.sh
./blockchain/network/scripts/deploy-ccaas.sh
```

**If the script fails, deploy manually:**

```bash
# Create CCAAS package
TEMP_DIR=$(mktemp -d)
cat > "$TEMP_DIR/connection.json" << EOF
{
    "address": "routing-chaincode:9999",
    "dial_timeout": "10s",
    "tls_required": false
}
EOF
cat > "$TEMP_DIR/metadata.json" << EOF
{
    "type": "ccaas",
    "label": "routing_1.0"
}
EOF
cd "$TEMP_DIR"
tar cfz code.tar.gz connection.json
tar cfz routing.tar.gz code.tar.gz metadata.json
docker cp routing.tar.gz cli:/opt/gopath/src/github.com/hyperledger/fabric/peer/
cd /home/mossab/hyper-project
rm -rf "$TEMP_DIR"

# Install on both peers
docker exec cli peer lifecycle chaincode install routing.tar.gz
docker exec -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 -e CORE_PEER_LOCALMSPID=PoliceMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp cli peer lifecycle chaincode install routing.tar.gz

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing_1.0 | awk '{print $3}' | cut -d',' -f1)
echo "Package ID: $PACKAGE_ID"

# Start chaincode container
docker run -d --name routing-chaincode --network emergency-routing_fabric \
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
    -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" \
    -p 9999:9999 routing-chaincode:1.0

# Approve for Medical
docker exec cli peer lifecycle chaincode approveformyorg \
    -o orderer.emergency.net:7050 --ordererTLSHostnameOverride orderer.emergency.net \
    --channelID emergency-channel --name routing --version 1.0 \
    --package-id $PACKAGE_ID --sequence 1 --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem

# Approve for Police
docker exec -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 -e CORE_PEER_LOCALMSPID=PoliceMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp cli peer lifecycle chaincode approveformyorg \
    -o orderer.emergency.net:7050 --ordererTLSHostnameOverride orderer.emergency.net \
    --channelID emergency-channel --name routing --version 1.0 \
    --package-id $PACKAGE_ID --sequence 1 --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem

# Commit chaincode
docker exec cli peer lifecycle chaincode commit \
    -o orderer.emergency.net:7050 --ordererTLSHostnameOverride orderer.emergency.net \
    --channelID emergency-channel --name routing --version 1.0 --sequence 1 --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
    --peerAddresses peer0.medical.emergency.net:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    --peerAddresses peer0.police.emergency.net:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt

# Initialize chaincode
docker exec cli peer chaincode invoke \
    -o orderer.emergency.net:7050 --ordererTLSHostnameOverride orderer.emergency.net --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
    -C emergency-channel -n routing \
    --peerAddresses peer0.medical.emergency.net:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    --peerAddresses peer0.police.emergency.net:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
    -c '{"function":"SegmentContract:InitSegments","Args":[]}'
```

### Step 5: Start Backend Servers

**Terminal 1 - Medical Backend:**
```bash
cd /home/mossab/hyper-project/backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

**Terminal 2 - Police Backend:**
```bash
cd /home/mossab/hyper-project/backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

### Step 6: Start Frontend

**Terminal 3 - Frontend:**
```bash
cd /home/mossab/hyper-project/frontend
npm run dev
```

---

## 🌐 Access Points

| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Medical API** | http://localhost:3001/api |
| **Police API** | http://localhost:3003/api |
| **Medical WebSocket** | ws://localhost:3002 |
| **Police WebSocket** | ws://localhost:3004 |
| **CouchDB (Medical)** | http://localhost:5984/_utils (admin/adminpw) |
| **CouchDB (Police)** | http://localhost:6984/_utils (admin/adminpw) |

---

## 🔧 Useful Commands

### Network Management

```bash
cd /home/mossab/hyper-project

# Check network status
make status

# View Docker logs
make logs

# View specific peer logs
docker logs -f peer0.medical.emergency.net
docker logs -f peer0.police.emergency.net
docker logs -f orderer.emergency.net
docker logs -f routing-chaincode

# Stop network (keeps data)
make network-down

# Clean everything (removes all data)
make network-clean
```

### Verify Chaincode

```bash
# Query segments
docker exec cli peer chaincode query -C emergency-channel -n routing \
    -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'

# Query vehicle
docker exec cli peer chaincode query -C emergency-channel -n routing \
    -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-001"]}'
```

---

## 🐳 Docker Containers

When the network is running, these containers should be active:

| Container | Purpose |
|-----------|---------|
| `orderer.emergency.net` | Ordering service |
| `peer0.medical.emergency.net` | Medical peer node |
| `peer0.police.emergency.net` | Police peer node |
| `couchdb.medical` | Medical state database |
| `couchdb.police` | Police state database |
| `ca.medical.emergency.net` | Medical CA |
| `ca.police.emergency.net` | Police CA |
| `ca.orderer.emergency.net` | Orderer CA |
| `routing-chaincode` | Chaincode container (CCAAS) |
| `cli` | CLI tools container |

Check running containers:
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

---

## ❌ Troubleshooting

### "Database does not exist" Error
The chaincode wasn't initialized. Run the init command:
```bash
docker exec cli peer chaincode invoke \
    -o orderer.emergency.net:7050 --ordererTLSHostnameOverride orderer.emergency.net --tls \
    --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
    -C emergency-channel -n routing \
    --peerAddresses peer0.medical.emergency.net:7051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
    --peerAddresses peer0.police.emergency.net:9051 \
    --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
    -c '{"function":"SegmentContract:InitSegments","Args":[]}'
```

### TLS Certificate Errors
Delete crypto materials and regenerate:
```bash
rm -rf blockchain/network/organizations/peerOrganizations
rm -rf blockchain/network/organizations/ordererOrganizations
cryptogen generate --config=blockchain/network/organizations/cryptogen/crypto-config.yaml --output=blockchain/network/organizations
```

### Chaincode Connection Errors
Restart the chaincode container with correct ID:
```bash
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing_1.0 | awk '{print $3}' | cut -d',' -f1)
docker stop routing-chaincode && docker rm routing-chaincode
docker run -d --name routing-chaincode --network emergency-routing_fabric \
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
    -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" \
    -p 9999:9999 routing-chaincode:1.0
```

### Backend Connection Errors
Verify network is running:
```bash
make status
curl http://localhost:5984/  # Should return CouchDB info
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3001
# Kill process
kill -9 <PID>
```

---

## 📁 Project Structure

```
hyper-project/
├── backend/           # Node.js Backend API
│   ├── src/
│   │   ├── api/       # Express routes
│   │   ├── services/  # Business logic
│   │   └── models/    # TypeScript types
│   └── package.json
├── frontend/          # React Frontend
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── hooks/
│   └── package.json
├── blockchain/
│   ├── chaincode/     # Go smart contracts
│   └── network/       # Fabric network config
├── docs/              # Documentation
├── Makefile           # Convenience commands
└── STARTUP_GUIDE.md   # This file
```

---

**Happy Routing! 🚑🚔**

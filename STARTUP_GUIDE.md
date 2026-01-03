# 🚀 Emergency Vehicle Routing System - Startup Guide

This guide contains all commands needed to start the project after closing it.

> **Important:** Throughout this guide, `<project-root>` refers to the directory where you cloned this repository. Replace it with your actual path (e.g., `~/Blockchain-Emergency-Routing` or `./Blockchain-Emergency-Routing`).

---

## ⚡ Quick Reference

**First time setup:**
1. Install dependencies: `cd backend && npm install && cd ../frontend && npm install`
2. Build chaincode: `cd blockchain/chaincode/routing && docker build -t routing-chaincode:1.0 .`
3. Start network: `make network-up`
4. Deploy chaincode: `./blockchain/network/scripts/deploy-ccaas.sh`
5. Start services: Backend (2 terminals) + Frontend (1 terminal)

**If network is already running:**
- Just start the 3 services (2 backends + 1 frontend) in separate terminals

**Complete restart:**
- `make network-clean && make network-up && ./blockchain/network/scripts/deploy-ccaas.sh`

---

## 📋 Prerequisites

Before starting, ensure you have:
- **Docker** and **Docker Compose** installed and running
- **Node.js** >= 18.0.0
- **Hyperledger Fabric binaries** (cryptogen, configtxgen) in PATH
- **Go** 1.21+ (for building chaincode Docker image)

> **Note:** The chaincode uses CCAAS (Chaincode-as-a-Service) deployment, which requires a pre-built Docker image (`routing-chaincode:1.0`). This image must be built before deploying chaincode.

---

## 🛠️ Initial Setup (First Time Only)

If this is your first time setting up the project:

```bash
# 1. Clone the repository (if you haven't already)
git clone <repository-url>
cd Blockchain-Emergency-Routing

# 2. Install backend dependencies
cd backend
npm install
cd ..

# 3. Install frontend dependencies
cd frontend
npm install
cd ..

# 4. Build the chaincode Docker image (required for CCAAS deployment)
cd blockchain/chaincode/routing
docker build -t routing-chaincode:1.0 .
cd ../../..
```

> **Note:** The chaincode image (`routing-chaincode:1.0`) must be built before deploying. This is a one-time step unless you modify the chaincode.

---

## 🔄 Quick Start (If Network Was Already Running)

If you just closed the terminals and the Docker containers are still running:

```bash
# Navigate to project root (where you cloned the repository)
cd <project-root>

# Check if network is running
make status

# Verify chaincode container is running
docker ps | grep routing-chaincode

# If everything is running, just start the backends and frontend
```

**Terminal 1 - Medical Backend:**
```bash
cd <project-root>/backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

**Terminal 2 - Police Backend:**
```bash
cd <project-root>/backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd <project-root>/frontend
npm run dev
```

> **Note:** Replace `<project-root>` with the actual path where you cloned this repository (e.g., `~/Blockchain-Emergency-Routing` or `./Blockchain-Emergency-Routing` if you're already in the parent directory).

---

## 🔧 Full Restart (After System Reboot or Network Down)

If the Docker containers are not running or you need a clean start:

### Step 1: Start Network (Automated)

The `make network-up` command automatically handles:
- Generating crypto materials
- Starting all containers (CAs, peers, orderer, CouchDB, CLI)
- Creating the channel
- Joining the orderer to the channel
- Joining both peers to the channel

```bash
# Navigate to project root
cd <project-root>

# Start the network (this does everything automatically)
make network-up

# Wait for network to be fully ready (about 10-15 seconds)
sleep 10
```

> **Note:** If you need a completely clean start, first run `make network-clean` to remove all data, then `make network-up`.

### Step 2: Build Chaincode Image (First Time Only)

Before deploying chaincode, ensure the Docker image is built:

```bash
cd <project-root>/blockchain/chaincode/routing
docker build -t routing-chaincode:1.0 .
cd ../../..
```

> **Note:** Only needed once, or when you modify the chaincode source code.

### Step 3: Deploy Chaincode

```bash
# Navigate to project root
cd <project-root>

# Run the CCAAS deployment script
# This script automatically:
# - Packages the chaincode
# - Installs on both peers
# - Approves for both organizations
# - Commits to the channel
# - Initializes segments (40 road segments)
# - Registers test vehicles (2 Medical P1, 2 Police P2)
chmod +x blockchain/network/scripts/deploy-ccaas.sh
./blockchain/network/scripts/deploy-ccaas.sh
```

> **Note:** The CCAAS deployment script automatically initializes the chaincode with segments and vehicles, so you don't need to run `make init-chaincode` separately.

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
cd <project-root>
rm -rf "$TEMP_DIR"

# Install on both peers
docker exec cli peer lifecycle chaincode install routing.tar.gz
docker exec -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 -e CORE_PEER_LOCALMSPID=PoliceMSP -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp cli peer lifecycle chaincode install routing.tar.gz

# Get package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing_1.0 | awk '{print $3}' | cut -d',' -f1)
echo "Package ID: $PACKAGE_ID"

# Find the Docker network name (usually based on the directory where docker-compose was run)
# You can find it with: docker network ls | grep fabric
NETWORK_NAME=$(docker network ls | grep fabric | awk '{print $2}' | head -1)
if [ -z "$NETWORK_NAME" ]; then
    echo "Error: Could not find Fabric network. Make sure the network is running."
    exit 1
fi
echo "Using network: $NETWORK_NAME"

# Start chaincode container
docker run -d --name routing-chaincode --network "$NETWORK_NAME" \
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

### Step 4: Start Backend Servers

**Terminal 1 - Medical Backend:**
```bash
cd <project-root>/backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

**Terminal 2 - Police Backend:**
```bash
cd <project-root>/backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

### Step 5: Start Frontend

**Terminal 3 - Frontend:**
```bash
cd <project-root>/frontend
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

## 🚀 Complete Setup (One Command)

For a complete fresh setup from scratch:

```bash
cd <project-root>

# 1. Build chaincode image (first time only)
cd blockchain/chaincode/routing
docker build -t routing-chaincode:1.0 .
cd ../../..

# 2. Start network (creates channel, joins peers)
make network-up
sleep 10

# 3. Deploy and initialize chaincode
./blockchain/network/scripts/deploy-ccaas.sh

# 4. Start backends and frontend (in separate terminals)
## Terminal 1: 
cd backend && ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
## Terminal 2: 
cd backend && ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
## Terminal 3: 
cd frontend && npm run dev
```

---

## 🔧 Useful Commands

### Network Management

```bash
# Navigate to project root
cd <project-root>

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
The chaincode wasn't initialized. This should be handled automatically by the CCAAS deployment script. If you see this error:

1. **Check if chaincode is deployed:**
   ```bash
   docker ps | grep routing-chaincode
   ```

2. **If chaincode is deployed but not initialized, run:**
   ```bash
   cd <project-root>
   make init-chaincode
   ```

3. **Or manually initialize:**
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

### Network "needs to be recreated" Error
If you see an error like `Network "emergency-routing_fabric" needs to be recreated`, the `network.sh` script automatically handles this by:

1. Creating the network externally with explicit configuration before starting containers
2. Using the network as an external network in both docker-compose files to avoid configuration mismatches

If you encounter this error manually, you can fix it by:

```bash
# Stop all containers first
cd <project-root>
make network-down

# Remove the network (it will be recreated automatically)
docker network rm emergency-routing_fabric 2>/dev/null || true

# If the network is still in use, force remove it
docker network prune -f

# Now try starting the network again
make network-up
```

> **Note:** The `network.sh` script now automatically:
> - Detects and removes existing networks before starting
> - Creates the network externally with explicit settings (bridge driver, no IPv6)
> - Uses the network as external in both docker-compose files to prevent configuration conflicts

### Docker Credential Store Error (WSL/Windows)
If you see `Credentials store error` or `Exec format error` with `docker-credential-desktop.exe`, this is a WSL/Docker Desktop issue. Fix it by:
```bash
# Remove the credential helper from Docker config
mkdir -p ~/.docker
cat > ~/.docker/config.json << EOF
{
  "auths": {}
}
EOF

# Or edit ~/.docker/config.json and remove/comment out the "credsStore" line
# Then try the docker-compose command again
```

### TLS Certificate Errors
Delete crypto materials and regenerate:
```bash
rm -rf blockchain/network/organizations/peerOrganizations
rm -rf blockchain/network/organizations/ordererOrganizations
cryptogen generate --config=blockchain/network/organizations/cryptogen/crypto-config.yaml --output=blockchain/network/organizations
```

### Chaincode Connection Errors
If the chaincode container is not running or needs to be restarted:

```bash
# Get the package ID
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing_1.0 | awk '{print $3}' | cut -d',' -f1)

# Get the network name
NETWORK_NAME=$(docker network ls | grep fabric | awk '{print $2}' | head -1)

# Stop and remove existing container
docker stop routing-chaincode 2>/dev/null || true
docker rm routing-chaincode 2>/dev/null || true

# Start chaincode container with correct package ID
docker run -d --name routing-chaincode --network "$NETWORK_NAME" \
    -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
    -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" \
    -p 9999:9999 routing-chaincode:1.0
```

> **Note:** Make sure the chaincode image is built: `docker images | grep routing-chaincode`

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
Blockchain-Emergency-Routing/
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
├── data/              # Map data and other static files
├── docs/              # Documentation
├── Makefile           # Convenience commands
└── STARTUP_GUIDE.md   # This file
```

---

**Happy Routing! 🚑🚔**

# 🚀 Emergency Vehicle Routing System - Quick Start Guide

**Project Root:** `~/Desktop/Master/Blockchain/Blockchain-Emergency-Routing`

## Prerequisites (Already Done)
- ✅ Docker + Docker Compose
- ✅ Node.js ≥18
- ✅ Hyperledger Fabric binaries
- ✅ Go 1.21+

## 📋 Step-by-Step Startup

### 1. Start Fabric Network
```bash
cd ~/Desktop/Master/Blockchain/Blockchain-Emergency-Routing
make network-clean && make network-up
# Wait for: [SUCCESS] Network is up and running!
```

### 2. Deploy Chaincode
```bash
# Verify image (you pulled it)
docker images | grep routing-chaincode  # routing-chaincode:1.0

# Deploy (auto-installs/approves/commits/initializes)
./blockchain/network/scripts/deploy-ccaas.sh
# Wait for: [SUCCESS] Chaincode initialized with segments and 4 vehicles
```

### 3. Start Services (3 Terminals)

**Terminal 1 - Medical Backend:**
```bash
cd backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
# Wait: "Server running on port 3001"
```

**Terminal 2 - Police Backend:**
```bash
cd backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
# Wait: "Server running on port 3003"
```

**Terminal 3 - Frontend:**
```bash
cd frontend
npm run dev
# Wait: "Local: http://localhost:5173"
```

## 🌐 Access Points
| Service | URL |
|---------|-----|
| **Frontend** | http://localhost:5173 |
| **Medical API** | http://localhost:3001/api |
| **Police API** | http://localhost:3003/api |

## ✅ Verify Everything
```bash
# Network + chaincode running (~11 containers)
docker ps

# All services healthy
make status

# Test chaincode data
docker exec cli peer chaincode query -C emergency-channel -n routing -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'
```

## 🛑 Shutdown
```bash
# Stop services (Ctrl+C in each terminal)

# Stop network (keeps data)
make network-down

# Full clean (removes everything)
make network-clean
```

## 🐛 Troubleshooting
- **Port conflicts:** `lsof -i :3001` → `kill -9 <PID>`
- **Chaincode down:** `./blockchain/network/scripts/deploy-ccaas.sh`
- **Network issues:** `make network-clean && make network-up`
- **Logs:** `make logs` or `docker logs routing-chaincode`

**Total startup time:** ~2 minutes
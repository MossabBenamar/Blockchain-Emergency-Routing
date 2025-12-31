# Emergency Vehicle Routing System - Command Reference

## 🚀 Initial Setup (First Time Only)

```bash
# Install dependencies
cd backend && npm install && cd ../frontend && npm install

# Build chaincode Docker image
cd blockchain/chaincode/routing && docker build -t routing-chaincode:1.0 . && cd ../../..
```

## ⚡ Quick Start (Network Already Running)

**Terminal 1 - Medical Backend:**
```bash
cd <project-root>/backend && ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

**Terminal 2 - Police Backend:**
```bash
cd <project-root>/backend && ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

**Terminal 3 - Frontend:**
```bash
cd <project-root>/frontend && npm run dev
```

## 🔄 Full Restart (Network Down)

```bash
cd <project-root> && make network-clean && make network-up && sleep 10 && ./blockchain/network/scripts/deploy-ccaas.sh
```

## 🛠️ Complete Fresh Setup (One Command)

```bash
cd <project-root> && cd blockchain/chaincode/routing && docker build -t routing-chaincode:1.0 . && cd ../../.. && make network-up && sleep 10 && ./blockchain/network/scripts/deploy-ccaas.sh
```

## 🔍 Network Management

```bash
# Status check
make status

# View logs
make logs
docker logs -f peer0.medical.emergency.net
docker logs -f peer0.police.emergency.net
docker logs -f routing-chaincode

# Containers status
docker ps | grep routing-chaincode
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Stop/Clean
make network-down
make network-clean
```

## 🚀 Deploy Chaincode

```bash
cd <project-root> && chmod +x blockchain/network/scripts/deploy-ccaas.sh && ./blockchain/network/scripts/deploy-ccaas.sh
```

## ✅ Verify Chaincode

```bash
# Query all segments
docker exec cli peer chaincode query -C emergency-channel -n routing -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'

# Query specific vehicle
docker exec cli peer chaincode query -C emergency-channel -n routing -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-001"]}'
```

## 🐛 Troubleshooting Commands

**Check CouchDB:**
```bash
curl http://localhost:5984/
```

**Kill port conflicts:**
```bash
lsof -i :3001 && kill -9 <PID>
```

**Restart chaincode container:**
```bash
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing_1.0 | awk '{print $3}' | cut -d',' -f1)
NETWORK_NAME=$(docker network ls | grep fabric | awk '{print $2}' | head -1)
docker stop routing-chaincode && docker rm routing-chaincode
docker run -d --name routing-chaincode --network "$NETWORK_NAME" -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" -p 9999:9999 routing-chaincode:1.0
```

**Network fix:**
```bash
make network-down && docker network rm emergency-routing_fabric 2>/dev/null || true && docker network prune -f && make network-up
```

## 🌐 Access URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:5173 |
| Medical API | http://localhost:3001/api |
| Police API | http://localhost:3003/api |
| Medical WS | ws://localhost:3002 |
| Police WS | ws://localhost:3004 |

**Replace `<project-root>` with your actual path (e.g., `~/Blockchain-Emergency-Routing`)**
# Phase 1: Blockchain Foundation Setup

This document describes the setup process for the Emergency Vehicle Routing System's Hyperledger Fabric network.

---

## Prerequisites

- Docker & Docker Compose
- Go 1.21+
- Hyperledger Fabric binaries (cryptogen, configtxgen)

---

## Network Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FABRIC NETWORK                          │
│                                                             │
│  ┌─────────────────┐          ┌─────────────────┐           │
│  │   OrgMedical    │          │   OrgPolice     │           │
│  │                 │          │                 │           │
│  │ peer0.medical   │          │ peer0.police    │           │
│  │ [CouchDB]       │          │ [CouchDB]       │           │
│  │ ca.medical      │          │ ca.police       │           │
│  └─────────────────┘          └─────────────────┘           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           orderer.emergency.net (Raft)               │   │
│  │           ca.orderer.emergency.net                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  Channel: emergency-channel                                 │
│  Chaincode: routing (Go, CCAAS)                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step 1: Project Structure Creation

```bash
cd /home/mossab/hyper-project

mkdir -p blockchain/network/docker \
         blockchain/network/configtx \
         blockchain/network/organizations/cryptogen \
         blockchain/network/scripts \
         blockchain/chaincode/routing/contracts \
         blockchain/chaincode/routing/models \
         blockchain/chaincode/routing/utils \
         backend frontend data/maps scripts docs
```

---

## Step 2: Generate Crypto Material

Using cryptogen to generate certificates for all organizations:

```bash
export PATH=$PATH:/home/mossab/hyperledger-fabric/fabric-samples/bin

cryptogen generate \
  --config=blockchain/network/organizations/cryptogen/crypto-config.yaml \
  --output=blockchain/network/organizations
```

---

## Step 3: Generate Channel Artifacts

Generate genesis block and channel configuration:

```bash
export FABRIC_CFG_PATH=/home/mossab/hyper-project/blockchain/network/configtx

# Generate channel genesis block (Fabric 2.5+ without system channel)
configtxgen -profile EmergencyChannel \
  -outputBlock blockchain/network/channel-artifacts/emergency-channel.block \
  -channelID emergency-channel
```

---

## Step 4: Start the Network

### Start Certificate Authorities

```bash
cd blockchain/network/docker
docker compose -f docker-compose-ca.yaml up -d
```

### Start Peers, Orderer, CouchDB

```bash
docker compose -f docker-compose-net.yaml up -d
```

### Verify All Containers Running

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

Expected output (10 containers):
- `ca.medical.emergency.net`
- `ca.police.emergency.net`
- `ca.orderer.emergency.net`
- `orderer.emergency.net`
- `peer0.medical.emergency.net`
- `peer0.police.emergency.net`
- `couchdb.medical`
- `couchdb.police`
- `cli`
- `routing-chaincode`

---

## Step 5: Create Channel

### Join Orderer to Channel (Fabric 2.5+ osnadmin)

```bash
docker exec cli osnadmin channel join \
  --channelID emergency-channel \
  --config-block /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block \
  -o orderer.emergency.net:7053 \
  --ca-file /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/ca.crt \
  --client-cert /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.crt \
  --client-key /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/server.key
```

### Fetch Channel Block

```bash
docker exec cli peer channel fetch oldest \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block \
  -c emergency-channel \
  -o orderer.emergency.net:7050 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/tls/ca.crt
```

### Join Medical Peer

```bash
docker exec cli peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block
```

### Join Police Peer

```bash
docker exec \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
  -e CORE_PEER_LOCALMSPID=PoliceMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  cli peer channel join \
  -b /opt/gopath/src/github.com/hyperledger/fabric/peer/channel-artifacts/emergency-channel.block
```

### Verify Channel Membership

```bash
docker exec cli peer channel list
# Output: emergency-channel
```

---

## Step 6: Deploy Chaincode (CCAAS Method)

### Build Chaincode Docker Image

```bash
cd blockchain/chaincode/routing
go mod tidy
docker build -t routing-chaincode:1.0 .
```

### Create CCAAS Package

```bash
mkdir -p /tmp/ccaas_pkg
cp connection.json metadata.json /tmp/ccaas_pkg/
cd /tmp/ccaas_pkg
tar cfz code.tar.gz connection.json
tar cfz routing-ccaas.tar.gz code.tar.gz metadata.json
cp routing-ccaas.tar.gz /home/mossab/hyper-project/blockchain/chaincode/
```

### Install Package on Both Peers

```bash
# Medical peer
docker exec cli peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/routing-ccaas.tar.gz

# Police peer
docker exec \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
  -e CORE_PEER_LOCALMSPID=PoliceMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  cli peer lifecycle chaincode install \
  /opt/gopath/src/github.com/hyperledger/fabric/peer/chaincode/routing-ccaas.tar.gz
```

### Get Package ID

```bash
docker exec cli peer lifecycle chaincode queryinstalled
# Output: routing_1.0:75a8e28cb7a714898c58e53a9d9ea55b6d4ed67b743e5e27a3736b7ef0f8dd2d
```

### Start Chaincode Container

```bash
export CHAINCODE_ID="routing_1.0:75a8e28cb7a714898c58e53a9d9ea55b6d4ed67b743e5e27a3736b7ef0f8dd2d"
cd blockchain/network/docker
CHAINCODE_ID=$CHAINCODE_ID docker compose -f docker-compose-chaincode.yaml up -d
```

### Approve for Both Organizations

```bash
# Approve for Medical
docker exec cli peer lifecycle chaincode approveformyorg \
  -o orderer.emergency.net:7050 \
  --ordererTLSHostnameOverride orderer.emergency.net \
  --channelID emergency-channel \
  --name routing \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem

# Approve for Police (with peer environment variables)
docker exec \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
  -e CORE_PEER_LOCALMSPID=PoliceMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  cli peer lifecycle chaincode approveformyorg \
  -o orderer.emergency.net:7050 \
  --ordererTLSHostnameOverride orderer.emergency.net \
  --channelID emergency-channel \
  --name routing \
  --version 1.0 \
  --package-id $PACKAGE_ID \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem
```

### Check Commit Readiness

```bash
docker exec cli peer lifecycle chaincode checkcommitreadiness \
  --channelID emergency-channel \
  --name routing \
  --version 1.0 \
  --sequence 1 \
  --output json

# Expected: {"approvals": {"MedicalMSP": true, "PoliceMSP": true}}
```

### Commit Chaincode

```bash
docker exec cli peer lifecycle chaincode commit \
  -o orderer.emergency.net:7050 \
  --ordererTLSHostnameOverride orderer.emergency.net \
  --channelID emergency-channel \
  --name routing \
  --version 1.0 \
  --sequence 1 \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
  --peerAddresses peer0.medical.emergency.net:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
  --peerAddresses peer0.police.emergency.net:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt
```

---

## Step 7: Initialize and Test Chaincode

### Initialize 5x5 Grid Segments

**Important:** Must send to BOTH peers for endorsement (MAJORITY policy).

```bash
docker exec cli peer chaincode invoke \
  -o orderer.emergency.net:7050 \
  --ordererTLSHostnameOverride orderer.emergency.net \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
  -C emergency-channel \
  -n routing \
  --peerAddresses peer0.medical.emergency.net:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
  --peerAddresses peer0.police.emergency.net:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -c '{"function":"SegmentContract:InitSegments","Args":[]}'
```

### Register a Test Vehicle

```bash
docker exec cli peer chaincode invoke \
  -o orderer.emergency.net:7050 \
  --ordererTLSHostnameOverride orderer.emergency.net \
  --tls \
  --cafile /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem \
  -C emergency-channel \
  -n routing \
  --peerAddresses peer0.medical.emergency.net:7051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt \
  --peerAddresses peer0.police.emergency.net:9051 \
  --tlsRootCertFiles /opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -c '{"function":"VehicleContract:RegisterVehicle","Args":["AMB-001","medical","ambulance","1"]}'
```

### Query Vehicle

```bash
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-001"]}'
```

### Query All Vehicles

```bash
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'
```

### Verify Data in CouchDB

```bash
curl -s "http://admin:adminpw@localhost:5984/emergency-channel_routing/_all_docs"
# Should show 41 records (1 vehicle + 40 segments)
```

---

## Useful Commands

### Check Network Status

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

### View Peer Logs

```bash
docker logs peer0.medical.emergency.net
docker logs peer0.police.emergency.net
```

### View Chaincode Logs

```bash
docker logs routing-chaincode
```

### Enter CLI Container

```bash
docker exec -it cli bash
```

### Stop Network

```bash
cd blockchain/network/docker
docker compose -f docker-compose-chaincode.yaml down
docker compose -f docker-compose-net.yaml down
docker compose -f docker-compose-ca.yaml down
```

### Clean Up Everything

```bash
docker compose -f docker-compose-net.yaml down --volumes --remove-orphans
docker compose -f docker-compose-ca.yaml down --volumes --remove-orphans
rm -rf blockchain/network/organizations/peerOrganizations
rm -rf blockchain/network/organizations/ordererOrganizations
rm -rf blockchain/network/channel-artifacts
```

---

## Troubleshooting

### Issue: Endorsement Policy Failure

**Error:** `1 sub-policies were satisfied, but this policy requires 2`

**Solution:** Include both peers in invoke commands:
```bash
--peerAddresses peer0.medical.emergency.net:7051 \
--tlsRootCertFiles <medical-tls-cert> \
--peerAddresses peer0.police.emergency.net:9051 \
--tlsRootCertFiles <police-tls-cert>
```

### Issue: Docker Socket Connection Error

**Error:** `write unix @->/run/docker.sock: write: broken pipe`

**Solution:** Use CCAAS (Chaincode as a Service) approach instead of Docker-in-Docker. Build chaincode image on host and run as separate container.

### Issue: Channel Already Exists

**Error:** `ledger [emergency-channel] already exists`

**Solution:** Peers retained their ledger in volumes. This is expected after restart.

---

## Files Created

```
blockchain/
├── chaincode/routing/
│   ├── main.go
│   ├── go.mod
│   ├── contracts/vehicle.go
│   ├── contracts/segment.go
│   ├── models/models.go
│   ├── connection.json
│   ├── metadata.json
│   └── Dockerfile
└── network/
    ├── docker/
    │   ├── docker-compose-ca.yaml
    │   ├── docker-compose-net.yaml
    │   ├── docker-compose-chaincode.yaml
    │   └── .env
    ├── configtx/
    │   └── configtx.yaml
    ├── organizations/
    │   └── cryptogen/crypto-config.yaml
    └── scripts/
        ├── network.sh
        └── deploy-chaincode.sh
```

---

## Verification Checklist

- [x] All 10 Docker containers running
- [x] Channel `emergency-channel` created
- [x] Both peers joined to channel
- [x] Chaincode installed and committed
- [x] 40 segments initialized
- [x] Vehicle registration working
- [x] CouchDB populated with data


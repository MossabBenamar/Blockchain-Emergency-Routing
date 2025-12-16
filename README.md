# Emergency Vehicle Routing System

A blockchain-based dynamic routing system for emergency vehicles using Hyperledger Fabric.

## Project Overview

This system enables multiple emergency services (Medical, Police) to coordinate vehicle routing through a shared, immutable ledger while maintaining organizational autonomy and priority-based access.

### Features

- **Vehicle Registration**: Register emergency vehicles with priority levels
- **Segment Reservation**: Reserve road segments for emergency routes
- **Priority-Based Conflict Resolution**: Higher priority vehicles can preempt lower priority reservations
- **Same-Priority Negotiation**: Conflicts between same-priority vehicles require negotiation
- **Audit Trail**: All actions are recorded on the blockchain

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FABRIC NETWORK                           │
│                                                              │
│  ┌─────────────────┐          ┌─────────────────┐          │
│  │   OrgMedical    │          │   OrgPolice     │          │
│  │                 │          │                 │          │
│  │ peer0.medical   │          │ peer0.police    │          │
│  │ [CouchDB]       │          │ [CouchDB]       │          │
│  └─────────────────┘          └─────────────────┘          │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                 Orderer (Raft)                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Channel: emergency-channel                                  │
│  Chaincode: routing (Go)                                     │
└─────────────────────────────────────────────────────────────┘
```

### 5x5 Grid Map

```
     N1 ──── N2 ──── N3 ──── N4 ──── N5
     │       │       │       │       │
     N6 ──── N7 ──── N8 ──── N9 ──── N10
     │       │       │       │       │
     N11 ─── N12 ─── N13 ─── N14 ─── N15
     │       │       │       │       │
     N16 ─── N17 ─── N18 ─── N19 ─── N20
     │       │       │       │       │
     N21 ─── N22 ─── N23 ─── N24 ─── N25

POIs:
- N1: Hospital (Medical HQ)
- N25: Police Station
- N13: Central Hub
```

## Prerequisites

- Docker & Docker Compose
- Go 1.21+ (for chaincode development)
- Hyperledger Fabric binaries (optional, can use Docker)

### Installing Fabric Binaries (optional)

```bash
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary
```

## Quick Start

### 1. Start the Network

```bash
make network-up
```

This will:
- Generate crypto material for all organizations
- Start all Docker containers (CAs, peers, orderer, CouchDB)
- Create the `emergency-channel`
- Join all peers to the channel

### 2. Deploy Chaincode

```bash
make deploy-chaincode
```

This will:
- Package the Go chaincode
- Install on all peers
- Approve for both organizations
- Commit to the channel

### 3. Initialize Segments

```bash
make init-chaincode
```

This creates the 40 road segments (20 horizontal + 20 vertical) in the world state.

### 4. Test Chaincode

```bash
make test-chaincode
```

## Manual Commands

### Network Management

```bash
# Start network
cd blockchain/network/scripts
./network.sh up

# Stop network
./network.sh down

# Clean everything
./network.sh clean

# Check status
./network.sh status
```

### Chaincode Operations

```bash
# Enter CLI container
docker exec -it cli bash

# Register a vehicle (Medical)
peer chaincode invoke \
  -o orderer.emergency.net:7050 \
  --tls --cafile $ORDERER_CA \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:RegisterVehicle","Args":["AMB-001","medical","ambulance","1"]}'

# Get all vehicles
peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'

# Reserve a segment
peer chaincode invoke \
  -o orderer.emergency.net:7050 \
  --tls --cafile $ORDERER_CA \
  -C emergency-channel \
  -n routing \
  -c '{"function":"SegmentContract:ReserveSegment","Args":["S1","AMB-001","MISSION-001","1"]}'

# Get segment status
peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"SegmentContract:GetSegment","Args":["S1"]}'

# Release a segment
peer chaincode invoke \
  -o orderer.emergency.net:7050 \
  --tls --cafile $ORDERER_CA \
  -C emergency-channel \
  -n routing \
  -c '{"function":"SegmentContract:ReleaseSegment","Args":["S1","AMB-001"]}'
```

### Switch to Police Organization

```bash
# In CLI container
export CORE_PEER_ADDRESS=peer0.police.emergency.net:9051
export CORE_PEER_LOCALMSPID=PoliceMSP
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp

# Now commands run as Police org
peer chaincode invoke ... -c '{"function":"VehicleContract:RegisterVehicle","Args":["POL-001","police","patrol_car","3"]}'
```

## Project Structure

```
emergency-routing/
├── blockchain/
│   ├── network/
│   │   ├── docker/
│   │   │   ├── docker-compose-ca.yaml     # Certificate Authorities
│   │   │   ├── docker-compose-net.yaml    # Peers, Orderer, CouchDB
│   │   │   └── .env                       # Environment variables
│   │   ├── configtx/
│   │   │   └── configtx.yaml              # Channel configuration
│   │   ├── organizations/
│   │   │   └── cryptogen/
│   │   │       └── crypto-config.yaml     # Crypto material config
│   │   └── scripts/
│   │       ├── network.sh                 # Network lifecycle
│   │       └── deploy-chaincode.sh        # Chaincode deployment
│   └── chaincode/
│       └── routing/
│           ├── go.mod
│           ├── main.go
│           ├── contracts/
│           │   ├── vehicle.go             # Vehicle registration
│           │   └── segment.go             # Segment reservation
│           └── models/
│               └── models.go              # Data structures
├── data/
│   └── maps/
│       └── grid-5x5.json                  # Synthetic map data
├── Makefile
└── README.md
```

## Chaincode Functions

### VehicleContract

| Function | Description |
|----------|-------------|
| `RegisterVehicle(vehicleId, orgType, vehicleType, priorityLevel)` | Register a new vehicle |
| `GetVehicle(vehicleId)` | Get vehicle details |
| `GetAllVehicles()` | List all vehicles |
| `GetVehiclesByOrg(orgType)` | List vehicles by organization |
| `UpdateVehicleStatus(vehicleId, status)` | Update vehicle status |

### SegmentContract

| Function | Description |
|----------|-------------|
| `InitSegments()` | Initialize the 5x5 grid (40 segments) |
| `GetSegment(segmentId)` | Get segment details |
| `GetAllSegments()` | List all segments |
| `ReserveSegment(segmentId, vehicleId, missionId, priorityLevel)` | Reserve a segment |
| `ReleaseSegment(segmentId, vehicleId)` | Release a reservation |
| `OccupySegment(segmentId, vehicleId)` | Mark segment as occupied |
| `GetSegmentsByStatus(status)` | List segments by status |
| `ResolveConflict(conflictId, resolution)` | Resolve a conflict |
| `GetPendingConflicts()` | List pending conflicts |

## Priority Rules

1. **Priority 1** (Highest): Medical emergencies
2. **Priority 2**: Fire & Rescue
3. **Priority 3**: Police
4. **Priority 4-5**: Infrastructure, other

### Conflict Resolution

- **Higher priority wins**: A priority 1 vehicle can preempt a priority 3 reservation
- **Same priority**: Creates a conflict that must be negotiated/resolved
- **Lower priority denied**: Cannot take segment from higher priority

## Troubleshooting

### Common Issues

1. **"Error: chaincode not found"**
   - Ensure chaincode is deployed: `make deploy-chaincode`

2. **"Error: peer not joined to channel"**
   - Run: `make network-up` (includes channel join)

3. **"MVCC conflict"**
   - Two transactions tried to modify the same key
   - Retry the transaction

4. **Docker errors**
   - Clean up: `make network-clean`
   - Start fresh: `make network-up`

### View Logs

```bash
# All containers
make logs

# Specific peer
docker logs -f peer0.medical.emergency.net

# Chaincode container
docker logs -f $(docker ps -q --filter "name=routing")
```

## Next Steps (Phase 2+)

- [ ] Backend API (Node.js + Express)
- [ ] Frontend Map Visualization (React)
- [ ] Vehicle Simulation
- [ ] Mission Management
- [ ] Real-time WebSocket updates

## License

This project is for educational purposes as part of a Smart City blockchain demonstration.


# Emergency Vehicle Routing System

A blockchain-based dynamic routing system for emergency vehicles using Hyperledger Fabric.

## Project Overview

This system enables multiple emergency services (Medical, Police) to coordinate vehicle routing through a shared, immutable ledger while maintaining organizational autonomy and priority-based access.

### Features

- **Vehicle Registration**: Register emergency vehicles with priority levels
- **Mission Management**: Create and manage emergency missions with route planning
- **Path Calculation**: A* algorithm with priority-based dynamic routing
- **Real-World Maps**: Manhattan map with real coordinates (lat/lon)
- **OSRM Integration**: Optional integration with Open Source Routing Machine for real-world route geometry
- **Priority-Based Conflict Resolution**: Higher priority vehicles can preempt lower priority reservations
- **Automatic Rerouting**: Lower-priority missions automatically rerouted when preempted
- **Real-Time Updates**: WebSocket/Socket.IO for live vehicle tracking and mission updates
- **Vehicle Simulation**: Discrete segment-by-segment movement simulation
- **Audit Trail**: All actions are recorded on the blockchain

### Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Frontend (React + TypeScript + Leaflet)                     │  │
│  │  - Interactive map visualization                             │  │
│  │  - Mission management UI                                     │  │
│  │  - Real-time vehicle tracking                                │  │
│  │  - Route planning and visualization                          │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP/REST + WebSocket
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                            │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Backend API (Node.js + TypeScript + Express)                │  │
│  │  - REST API endpoints                                        │  │
│  │  - A* Pathfinding Algorithm                                  │  │
│  │  - Conflict Resolution Service                               │  │
│  │  - Mission Management Service                                │  │
│  │  - Vehicle Simulation Service                                │  │
│  │  - WebSocket/Socket.IO Server                                │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  External Services (Optional)                                │  │
│  │  - OSRM (Open Source Routing Machine)                        │  │
│  │    For real-world route geometry calculation                 │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ gRPC + Fabric Gateway SDK
                              │
┌─────────────────────────────────────────────────────────────────────┐
│                      BLOCKCHAIN LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Hyperledger Fabric Network                                  │  │
│  │                                                               │  │
│  │  ┌─────────────────┐          ┌─────────────────┐           │  │
│  │  │   OrgMedical    │          │   OrgPolice     │           │  │
│  │  │                 │          │                 │           │  │
│  │  │ peer0.medical   │          │ peer0.police    │           │  │
│  │  │ [CouchDB]       │          │ [CouchDB]       │           │  │
│  │  └─────────────────┘          └─────────────────┘           │  │
│  │                                                               │  │
│  │  ┌──────────────────────────────────────────────────────┐   │  │
│  │  │        Orderer (Raft Consensus)                      │   │  │
│  │  └──────────────────────────────────────────────────────┘   │  │
│  │                                                               │  │
│  │  Channel: emergency-channel                                   │  │
│  │  Chaincode: routing (Go, CCAAS deployment)                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Map Structure

The system uses a **Manhattan-based map** with real-world coordinates:

- **Real Coordinates**: Uses latitude/longitude coordinates for Manhattan, NY
- **POIs (Points of Interest)**: 
  - Hospitals (Medical organizations)
  - Police Stations
  - Fire Stations
  - Key intersections
- **Road Network**: Street segments connecting intersections and POIs
- **Bidirectional Segments**: Most segments allow travel in both directions

The map covers Lower Manhattan (Canal St) to Central Park South (59th St), providing a realistic urban environment for emergency vehicle routing.

## Prerequisites

- **Docker** & **Docker Compose** (v1 or v2)
- **Node.js** >= 18.0.0 (for backend and frontend)
- **Go** 1.21+ (for building chaincode Docker image)
- **Hyperledger Fabric binaries** (`cryptogen` and `configtxgen`)

### Installing Fabric Binaries

The network setup script requires Fabric binaries in `blockchain/network/bin/`. Install them as follows:

```bash
# Create the bin directory
mkdir -p blockchain/network/bin

# Download and install Fabric binaries
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh
./install-fabric.sh --fabric-version 2.5.0 binary

# Copy binaries to the expected location (adjust path if needed)
cp ~/fabric-samples/bin/cryptogen blockchain/network/bin/
cp ~/fabric-samples/bin/configtxgen blockchain/network/bin/
chmod +x blockchain/network/bin/*

# Clean up
rm install-fabric.sh
```

## Quick Start

> **For detailed setup instructions, see [STARTUP_GUIDE.md](STARTUP_GUIDE.md)**

### Automated Setup (Recommended)

The easiest way to start the entire system:

```bash
# First time: Install dependencies
cd backend && npm install && cd ../frontend && npm install && cd ..

# Build chaincode image and start everything
./start.sh
```

This script automatically:
- Builds the chaincode Docker image
- Starts the Fabric network
- Deploys chaincode (CCAAS)
- Initializes segments and test vehicles
- Fixes file permissions

Then start the backend and frontend in separate terminals (see commands printed by `start.sh`).

### Manual Setup

**1. Install Dependencies**
```bash
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
```

**2. Build Chaincode Image**
```bash
cd blockchain/chaincode/routing
docker build -t routing-chaincode:1.0 .
cd ../../..
```

**3. Start Network**
```bash
make network-up
```

**4. Deploy Chaincode (CCAAS)**
```bash
./blockchain/network/scripts/deploy-ccaas.sh
```

The deployment script automatically:
- Packages the chaincode for CCAAS
- Installs on both peers
- Approves for both organizations
- Commits to the channel
- Initializes 40 road segments
- Registers test vehicles (2 Medical P1, 2 Police P2)

**5. Start Backend and Frontend**

Terminal 1 - Medical Backend:
```bash
cd backend
ORG_TYPE=medical PORT=3001 WS_PORT=3002 npm run dev
```

Terminal 2 - Police Backend:
```bash
cd backend
ORG_TYPE=police PORT=3003 WS_PORT=3004 MSP_ID=PoliceMSP PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

Terminal 3 - Frontend:
```bash
cd frontend
npm run dev
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

### Using the CLI Container

```bash
# Enter CLI container
make shell
# or
docker exec -it cli bash

# Query all segments
peer chaincode query -C emergency-channel -n routing \
  -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'

# Query all vehicles
peer chaincode query -C emergency-channel -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'

# Get specific segment
peer chaincode query -C emergency-channel -n routing \
  -c '{"function":"SegmentContract:GetSegment","Args":["S1"]}'
```

> **Note**: For full chaincode interaction, use the Backend API or see [STARTUP_GUIDE.md](STARTUP_GUIDE.md) for detailed CLI examples.

## Project Structure

```
emergency-routing/
├── backend/                               # Node.js/TypeScript API server
│   ├── src/
│   │   ├── services/                      # Business logic
│   │   ├── routes/                        # API endpoints
│   │   └── config/                        # Configuration
│   └── package.json
├── frontend/                              # React + TypeScript frontend
│   ├── src/
│   │   ├── components/                    # UI components
│   │   ├── services/                      # API clients
│   │   └── App.tsx
│   └── package.json
├── blockchain/
│   ├── network/
│   │   ├── bin/                           # Fabric binaries (cryptogen, configtxgen)
│   │   ├── docker/
│   │   │   ├── docker-compose-ca.yaml     # Certificate Authorities
│   │   │   └── docker-compose-net.yaml    # Peers, Orderer, CouchDB
│   │   ├── configtx/
│   │   │   └── configtx.yaml              # Channel configuration
│   │   ├── organizations/                 # Crypto material (generated)
│   │   │   └── cryptogen/
│   │   │       └── crypto-config-*.yaml   # Crypto material configs
│   │   └── scripts/
│   │       ├── network.sh                 # Network lifecycle
│   │       └── deploy-ccaas.sh            # CCAAS chaincode deployment
│   └── chaincode/
│       └── routing/                       # Go chaincode
│           ├── go.mod
│           ├── main.go
│           ├── contracts/
│           │   ├── vehicle.go             # Vehicle registration
│           │   └── segment.go             # Segment reservation
│           ├── models/
│           │   └── models.go              # Data structures
│           └── Dockerfile                 # Chaincode image
├── data/
│   └── maps/
│       └── grid-5x5.json                  # Synthetic map data
├── start.sh                               # Automated startup script
├── Makefile                               # Convenience commands
├── README.md
└── STARTUP_GUIDE.md                       # Detailed startup guide
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

## Path Calculation & Routing

### A* Algorithm

The system uses the **A* pathfinding algorithm** with a heuristic-based approach:

- **Heuristic Function**: Haversine distance (straight-line distance) between nodes using lat/lon coordinates
- **Priority-Based Edge Weights**: Path costs are dynamically adjusted based on:
  - **Free segments**: Base weight (normal travel time)
  - **Reserved segments (higher priority)**: Small penalty (2x) - can preempt
  - **Reserved segments (same priority)**: Very high penalty (2000x) - forces detour
  - **Reserved segments (lower priority)**: Extremely high penalty (10000x) - effectively blocked
  - **Occupied segments**: High penalty (100x) - nearly blocked
- **Dynamic Recalculation**: Weights update based on real-time blockchain state

### Route Calculation Modes

1. **Node-Based Routing** (Primary):
   - Uses Manhattan map nodes and segments
   - A* algorithm finds optimal path considering current reservations
   - Returns segment path and node path
   - Integrates with blockchain segment status

2. **Coordinate-Based Routing** (OSRM Integration):
   - Uses real-world coordinates (lat/lon)
   - Optional integration with OSRM for accurate route geometry
   - Returns detailed route geometry for map visualization
   - Falls back to node-based routing if OSRM unavailable

### Alternative Routes

The system can calculate alternative routes by:
- Excluding segments from the primary path
- Finding multiple path options
- Selecting best alternative based on current traffic/reservations

## Priority Rules

1. **Priority 1** (Highest): Medical emergencies
2. **Priority 2**: Fire & Rescue  
3. **Priority 3**: Police
4. **Priority 4-5**: Infrastructure, other

### Conflict Resolution

- **Higher priority wins**: A priority 1 vehicle can preempt a priority 3 reservation
- **Automatic Rerouting**: Lower-priority missions are automatically rerouted to alternative paths when preempted
- **Same priority**: Very high penalty forces detour (FCFS rule applies)
- **Lower priority denied**: Cannot take segment from higher priority (effectively infinite penalty)

## Troubleshooting

### Common Issues

1. **"cryptogen: command not found" or "configtxgen: command not found"**
   - Ensure Fabric binaries are in `blockchain/network/bin/`
   - See Prerequisites section for installation instructions

2. **"Error: chaincode not found"**
   - Ensure chaincode is deployed: `./blockchain/network/scripts/deploy-ccaas.sh`
   - Verify chaincode container is running: `docker ps | grep routing-chaincode`

3. **"Error: peer not joined to channel"**
   - Run: `make network-up` (includes channel join)

4. **"EACCES: permission denied" when starting backend**
   - Fix file permissions: `sudo chown -R $USER:$USER blockchain/network/organizations/`
   - Or run `./start.sh` which handles permissions automatically

5. **"MVCC conflict"**
   - Two transactions tried to modify the same key
   - Retry the transaction

6. **Docker errors**
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

## Components

The system consists of:

- **Blockchain Network**: Hyperledger Fabric network with 2 organizations (Medical, Police)
- **Chaincode**: Go-based smart contracts for vehicle and segment management (CCAAS deployment)
- **Backend API**: Node.js/TypeScript REST API with WebSocket support for real-time updates
- **Frontend**: React + TypeScript web application for visualization and control

## Makefile Commands

```bash
make help              # Show all available commands
make network-up        # Start the Fabric network
make network-down      # Stop the network
make network-clean     # Clean all data and containers
make network-restart   # Restart the network
make status            # Check network status
make logs              # View container logs
make deploy-chaincode  # Deploy chaincode (legacy command)
make init-chaincode    # Initialize segments (done automatically by deploy-ccaas.sh)
make test-chaincode    # Test chaincode functions
make shell             # Open CLI container shell
```

## License

This project is for educational purposes as part of a Smart City blockchain demonstration.


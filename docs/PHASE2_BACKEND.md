# Phase 2: Backend API Setup

This document describes the setup and implementation of the Node.js Backend API for the Emergency Vehicle Routing System.

---

## Overview

The backend provides a REST API and WebSocket server that:
- Connects to the Hyperledger Fabric blockchain via the Gateway SDK
- Exposes endpoints for vehicle and segment management
- Provides real-time updates via WebSocket
- Queries CouchDB directly for optimized read operations

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API SERVER                          │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │   HTTP Server   │    │  WebSocket      │                     │
│  │   Port: 3001    │    │  Port: 3002     │                     │
│  └────────┬────────┘    └────────┬────────┘                     │
│           │                      │                               │
│           ▼                      ▼                               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    Express Router                        │    │
│  │  /api/vehicles  /api/segments  /api/map  /health        │    │
│  └─────────────────────────┬───────────────────────────────┘    │
│                            │                                     │
│           ┌────────────────┴────────────────┐                   │
│           ▼                                 ▼                    │
│  ┌─────────────────┐              ┌─────────────────┐           │
│  │  Fabric Gateway │              │  CouchDB Client │           │
│  │  (Write Ops)    │              │  (Read Ops)     │           │
│  └────────┬────────┘              └────────┬────────┘           │
│           │                                │                     │
└───────────┼────────────────────────────────┼─────────────────────┘
            │                                │
            ▼                                ▼
┌───────────────────────┐        ┌───────────────────────┐
│  Hyperledger Fabric   │        │      CouchDB          │
│  Peer (Chaincode)     │        │  (State Database)     │
└───────────────────────┘        └───────────────────────┘
```

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Running Hyperledger Fabric network (Phase 1 complete)
- All Docker containers from Phase 1 running

---

## Project Structure

```
backend/
├── src/
│   ├── index.ts                    # Main entry point
│   ├── config/
│   │   └── index.ts                # Configuration management
│   ├── models/
│   │   └── types.ts                # TypeScript type definitions
│   ├── api/
│   │   ├── routes/
│   │   │   ├── vehicles.ts         # Vehicle API endpoints
│   │   │   ├── segments.ts         # Segment API endpoints
│   │   │   └── map.ts              # Map data endpoints
│   │   └── middleware/
│   │       └── errorHandler.ts     # Error handling middleware
│   └── services/
│       ├── fabric/
│       │   ├── gateway.ts          # Fabric Gateway connection
│       │   ├── vehicle.service.ts  # Vehicle chaincode operations
│       │   ├── segment.service.ts  # Segment chaincode operations
│       │   └── index.ts            # Service exports
│       ├── couchdb/
│       │   └── index.ts            # Direct CouchDB queries
│       └── realtime/
│           └── websocket.ts        # WebSocket server
├── package.json
├── tsconfig.json
├── Dockerfile
└── .gitignore
```

---

## Step 1: Install Dependencies

```bash
cd /home/mossab/hyper-project/backend
npm install
```

### Dependencies Installed

| Package | Version | Purpose |
|---------|---------|---------|
| `express` | ^4.18.2 | HTTP server framework |
| `@hyperledger/fabric-gateway` | ^1.4.0 | Fabric blockchain SDK |
| `@grpc/grpc-js` | ^1.9.12 | gRPC for Fabric communication |
| `ws` | ^8.14.2 | WebSocket server |
| `cors` | ^2.8.5 | Cross-origin resource sharing |
| `dotenv` | ^16.3.1 | Environment variables |
| `typescript` | ^5.3.3 | TypeScript compiler |
| `ts-node-dev` | ^2.0.0 | Development server with hot-reload |

---

## Step 2: Build the Project

```bash
cd /home/mossab/hyper-project/backend
npm run build
```

This compiles TypeScript to JavaScript in the `dist/` folder.

---

## Step 3: Start the Backend Server

### Development Mode (with hot-reload)

```bash
cd /home/mossab/hyper-project/backend
npm run dev
```

### Production Mode

```bash
cd /home/mossab/hyper-project/backend
npm run build
npm start
```

### Expected Output

```
Starting Emergency Vehicle Routing API...
Environment: development
Organization: medical
Connecting to Hyperledger Fabric...
Connecting to Fabric Gateway as medical...
Connected to channel: emergency-channel
Connected to Fabric Gateway
WebSocket server started on port 3002

========================================
  Emergency Vehicle Routing API
========================================
  HTTP Server:     http://localhost:3001
  WebSocket:       ws://localhost:3002
  Organization:    medical
  Channel:         emergency-channel
  Chaincode:       routing
========================================
```

---

## Step 4: Test API Endpoints

### Health Check

```bash
curl -s http://localhost:3001/health | python3 -m json.tool
```

Expected response:
```json
{
    "success": true,
    "data": {
        "status": "healthy",
        "blockchain": "connected",
        "websocketClients": 0,
        "timestamp": "2025-12-05T19:39:54.468Z"
    }
}
```

### API Info

```bash
curl -s http://localhost:3001/api | python3 -m json.tool
```

---

## API Reference

### Vehicle Endpoints

#### Get All Vehicles

```bash
curl -s http://localhost:3001/api/vehicles | python3 -m json.tool
```

#### Get Vehicles by Organization

```bash
curl -s "http://localhost:3001/api/vehicles?org=medical" | python3 -m json.tool
curl -s "http://localhost:3001/api/vehicles?org=police" | python3 -m json.tool
```

#### Get Single Vehicle

```bash
curl -s http://localhost:3001/api/vehicles/AMB-001 | python3 -m json.tool
```

#### Register New Vehicle

```bash
curl -s -X POST http://localhost:3001/api/vehicles \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "AMB-002",
    "orgType": "medical",
    "vehicleType": "ambulance",
    "priorityLevel": 1
  }' | python3 -m json.tool
```

#### Update Vehicle Status

```bash
curl -s -X PUT http://localhost:3001/api/vehicles/AMB-001/status \
  -H "Content-Type: application/json" \
  -d '{"status": "on_mission"}' | python3 -m json.tool
```

### Segment Endpoints

#### Get All Segments

```bash
curl -s http://localhost:3001/api/segments | python3 -m json.tool
```

#### Get Segments by Status

```bash
curl -s "http://localhost:3001/api/segments?status=free" | python3 -m json.tool
curl -s "http://localhost:3001/api/segments?status=reserved" | python3 -m json.tool
curl -s "http://localhost:3001/api/segments?status=occupied" | python3 -m json.tool
```

#### Get Single Segment

```bash
curl -s http://localhost:3001/api/segments/S1 | python3 -m json.tool
```

#### Reserve a Segment

```bash
curl -s -X POST http://localhost:3001/api/segments/reserve \
  -H "Content-Type: application/json" \
  -d '{
    "segmentId": "S1",
    "vehicleId": "AMB-001",
    "missionId": "MISSION-001",
    "priorityLevel": 1
  }' | python3 -m json.tool
```

#### Release a Segment

```bash
curl -s -X POST http://localhost:3001/api/segments/S1/release \
  -H "Content-Type: application/json" \
  -d '{"vehicleId": "AMB-001"}' | python3 -m json.tool
```

#### Occupy a Segment

```bash
curl -s -X POST http://localhost:3001/api/segments/S1/occupy \
  -H "Content-Type: application/json" \
  -d '{"vehicleId": "AMB-001"}' | python3 -m json.tool
```

#### Initialize Segments (Admin)

```bash
curl -s -X POST http://localhost:3001/api/segments/init | python3 -m json.tool
```

### Map Endpoints

#### Get Static Map Data

```bash
curl -s http://localhost:3001/api/map | python3 -m json.tool
```

#### Get Map Nodes

```bash
curl -s http://localhost:3001/api/map/nodes | python3 -m json.tool
```

#### Get Map State (with live segment status)

```bash
curl -s http://localhost:3001/api/map/state | python3 -m json.tool
```

#### Get Map Statistics

```bash
curl -s http://localhost:3001/api/map/statistics | python3 -m json.tool
```

Expected response:
```json
{
    "success": true,
    "data": {
        "totalNodes": 25,
        "totalSegments": 40,
        "pointsOfInterest": 3,
        "gridSize": {
            "rows": 5,
            "cols": 5
        },
        "segmentStatus": {
            "free": 40,
            "reserved": 0,
            "occupied": 0
        },
        "utilizationRate": "0.00%"
    }
}
```

#### Get Points of Interest

```bash
curl -s http://localhost:3001/api/map/pois | python3 -m json.tool
```

### Conflict Endpoints

#### Get Pending Conflicts

```bash
curl -s http://localhost:3001/api/segments/conflicts/pending | python3 -m json.tool
```

#### Resolve a Conflict

```bash
curl -s -X POST http://localhost:3001/api/segments/conflicts/CONFLICT-ID/resolve \
  -H "Content-Type: application/json" \
  -d '{"resolution": "mission1_wins"}' | python3 -m json.tool
```

Resolution options: `mission1_wins`, `mission2_wins`, `both_reroute`

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3002');

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

### Events (Server → Client)

| Event Type | Description |
|------------|-------------|
| `CONNECTED` | Connection established |
| `SEGMENT_UPDATED` | Segment status changed |
| `VEHICLE_UPDATED` | Vehicle registered or status changed |
| `CONFLICT_DETECTED` | Priority conflict detected |
| `CONFLICT_RESOLVED` | Conflict has been resolved |

### Message Format

```json
{
  "type": "SEGMENT_UPDATED",
  "payload": {
    "action": "reserved",
    "segment": { ... }
  },
  "timestamp": 1764963637000
}
```

### Client Commands

| Command | Description |
|---------|-------------|
| `PING` | Check connection (server responds with `PONG`) |
| `SUBSCRIBE` | Subscribe to specific event types |

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | HTTP server port |
| `WS_PORT` | `3002` | WebSocket server port |
| `NODE_ENV` | `development` | Environment mode |
| `CHANNEL_NAME` | `emergency-channel` | Fabric channel name |
| `CHAINCODE_NAME` | `routing` | Chaincode name |
| `ORG_TYPE` | `medical` | Organization type |
| `COUCHDB_HOST` | `localhost` | CouchDB host |
| `COUCHDB_PORT` | `5984` | CouchDB port |
| `COUCHDB_USER` | `admin` | CouchDB username |
| `COUCHDB_PASSWORD` | `adminpw` | CouchDB password |

---

## Docker Deployment

### Build Docker Image

```bash
cd /home/mossab/hyper-project/backend
docker build -t emergency-routing-backend:1.0 .
```

### Run Container

```bash
docker run -d \
  --name emergency-backend \
  --network host \
  -e PORT=3001 \
  -e WS_PORT=3002 \
  -e ORG_TYPE=medical \
  emergency-routing-backend:1.0
```

---

## Troubleshooting

### Issue: Cannot connect to Fabric Gateway

**Error:** `Failed to connect to network`

**Solution:** 
1. Verify Fabric network is running:
   ```bash
   docker ps | grep peer0
   ```
2. Check crypto material paths exist:
   ```bash
   ls -la /home/mossab/hyper-project/blockchain/network/organizations/peerOrganizations/
   ```

### Issue: CouchDB connection refused

**Error:** `CouchDB query error: ECONNREFUSED`

**Solution:**
1. Verify CouchDB is running:
   ```bash
   docker ps | grep couchdb
   curl -s http://admin:adminpw@localhost:5984/
   ```
2. Check the database exists:
   ```bash
   curl -s http://admin:adminpw@localhost:5984/_all_dbs
   ```

### Issue: Chaincode schema validation errors

**Error:** `Value did not match schema: missionId is required`

**Solution:** This is a known issue with the fabric-contract-api-go schema validation. The backend uses direct CouchDB queries for read operations to bypass this issue. Write operations through the chaincode still work correctly.

---

## Verification Checklist

- [x] Backend server starts without errors
- [x] Health endpoint returns "connected" status
- [x] Vehicle CRUD operations working
- [x] Segment queries returning 40 segments
- [x] Map data endpoints returning correct grid
- [x] WebSocket server accepting connections
- [x] Direct CouchDB queries working
- [x] Chaincode write operations working

---

## Next Steps

Proceed to **Phase 3: Frontend Map Visualization** to build the React application with real-time map display.

---

## Files Created

```
backend/
├── src/
│   ├── index.ts
│   ├── config/index.ts
│   ├── models/types.ts
│   ├── api/
│   │   ├── routes/vehicles.ts
│   │   ├── routes/segments.ts
│   │   ├── routes/map.ts
│   │   └── middleware/errorHandler.ts
│   └── services/
│       ├── fabric/gateway.ts
│       ├── fabric/vehicle.service.ts
│       ├── fabric/segment.service.ts
│       ├── fabric/index.ts
│       ├── couchdb/index.ts
│       └── realtime/websocket.ts
├── package.json
├── tsconfig.json
├── Dockerfile
└── .gitignore
```

---

*Document Version: 1.0*  
*Last Updated: December 2025*


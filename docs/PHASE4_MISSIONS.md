# Phase 4: Missions & Routing

This document describes the implementation of the Mission and Routing system for the Emergency Vehicle Routing System.

---

## Overview

Phase 4 adds mission lifecycle management and intelligent routing:
- Mission chaincode contract for blockchain-based mission tracking
- Dijkstra's algorithm for optimal route calculation (off-chain)
- Route visualization on the frontend map
- Mission creation and management UI
- CouchDB direct queries for read operations (bypasses chaincode schema validation)
- Chaincode-as-a-Service (CCAAS) deployment model

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MISSION FLOW                                        │
│                                                                              │
│  1. MISSION CREATION                                                         │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │   Frontend   │  ──>  │   Backend    │  ──>  │  Chaincode   │          │
│     │ MissionPanel │       │ /api/missions│       │MissionContract│         │
│     └──────────────┘       └──────────────┘       └──────────────┘          │
│                                                                              │
│  2. ROUTE CALCULATION (Off-chain)                                            │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │   Frontend   │  ──>  │   Backend    │  ──>  │   Routing    │          │
│     │ Route Preview│       │/routes/calc  │       │   Service    │          │
│     └──────────────┘       └──────────────┘       │  (Dijkstra)  │          │
│                                                   └──────────────┘          │
│                                                                              │
│  3. MISSION ACTIVATION (Reserves segments on blockchain)                     │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │   Frontend   │  ──>  │   Backend    │  ──>  │  Chaincode   │          │
│     │   Confirm    │       │ /activate    │       │ActivateMission│         │
│     └──────────────┘       └──────────────┘       │ + Reserve all│          │
│                                                   │   segments   │          │
│                                                   └──────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components Created

### 1. Mission Chaincode Contract (`mission.go`)

Location: `blockchain/chaincode/routing/contracts/mission.go`

Functions:
| Function | Description |
|----------|-------------|
| `CreateMission` | Creates a new mission in pending state |
| `ActivateMission` | Activates mission and reserves all path segments |
| `CompleteMission` | Completes mission and releases all segments |
| `AbortMission` | Aborts mission and releases segments |
| `GetMission` | Retrieves a mission by ID |
| `GetAllMissions` | Retrieves all missions |
| `GetActiveMissions` | Retrieves all active missions |
| `GetMissionsByStatus` | Retrieves missions by status |
| `GetMissionsByOrg` | Retrieves missions by organization |
| `GetVehicleActiveMission` | Gets active mission for a vehicle |
| `UpdateMissionPath` | Updates path for re-routing |

### 2. Routing Service (`routing/index.ts`)

Location: `backend/src/services/routing/index.ts`

Features:
- **Dijkstra's Algorithm**: Finds optimal path between nodes
- **Priority-aware routing**: Considers segment reservations and vehicle priority
- **Conflict detection**: Identifies potential conflicts with existing reservations
- **Alternative routes**: Calculates alternative paths when needed

Weight Calculation:
```typescript
// Free segment: base weight
// Reserved by lower priority: base * 2 (can preempt)
// Reserved by same priority: base * 5 (conflict possible)
// Reserved by higher priority: base * 20 (will be denied)
// Occupied: base * 100 (almost blocked)
```

### 3. Mission Service (`mission.service.ts`)

Location: `backend/src/services/fabric/mission.service.ts`

Backend service for interacting with the Mission chaincode.

### 4. Mission API Routes (`missions.ts`)

Location: `backend/src/api/routes/missions.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/missions` | GET | List all missions (with filters) |
| `/api/missions/active` | GET | List active missions |
| `/api/missions/:id` | GET | Get single mission |
| `/api/missions` | POST | Create new mission |
| `/api/missions/:id/activate` | POST | Activate with path |
| `/api/missions/:id/complete` | POST | Complete mission |
| `/api/missions/:id/abort` | POST | Abort mission |
| `/api/missions/routes/calculate` | POST | Calculate optimal route |
| `/api/missions/routes/alternatives` | POST | Get alternative routes |
| `/api/missions/create-and-activate` | POST | Create & activate in one call |

### 5. MissionPanel Component

Location: `frontend/src/components/Mission/MissionPanel.tsx`

Features:
- Vehicle selection (filtered by organization)
- Origin/destination node selection with POI shortcuts
- Route preview with path visualization
- Route analysis (free/reserved segments, conflicts)
- Quick launch (one-click create & activate)
- Active missions list with complete/abort actions

### 6. Route Visualization

Updated: `frontend/src/components/Map/GridMap.tsx`

Features:
- **Highlighted routes**: Dashed golden lines for route preview
- **Route order badges**: Numbered circles showing segment order
- **Active mission routes**: Glowing effect on mission paths
- **Animated effects**: Pulsing and dashing animations

---

## Mission Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                     MISSION LIFECYCLE                            │
│                                                                  │
│         ┌──────────┐                                            │
│         │ PENDING  │  ← CreateMission()                         │
│         └────┬─────┘                                            │
│              │                                                   │
│              │ ActivateMission(path)                            │
│              │ (reserves all segments)                          │
│              ▼                                                   │
│         ┌──────────┐                                            │
│         │  ACTIVE  │  ← Vehicle travels along path              │
│         └────┬─────┘                                            │
│              │                                                   │
│        ┌─────┴─────┐                                            │
│        │           │                                             │
│        ▼           ▼                                             │
│  ┌──────────┐ ┌──────────┐                                      │
│  │COMPLETED │ │ ABORTED  │                                      │
│  └──────────┘ └──────────┘                                      │
│  (segments    (segments                                          │
│   released)    released)                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Usage Examples

### Calculate Route

```bash
curl -X POST http://localhost:3001/api/missions/routes/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "originNode": "N1",
    "destNode": "N25",
    "vehicleId": "AMB-001"
  }' | jq
```

Response:
```json
{
  "success": true,
  "data": {
    "path": ["S1", "S2", "S3", "S4", "S37", "S38", "S39", "S40"],
    "nodePath": ["N1", "N2", "N3", "N4", "N5", "N10", "N15", "N20", "N25"],
    "totalWeight": 8,
    "estimatedTime": 240,
    "analysis": {
      "freeSegments": 8,
      "reservedSegments": 0,
      "occupiedSegments": 0,
      "potentialConflicts": []
    }
  }
}
```

### Create and Activate Mission

```bash
curl -X POST http://localhost:3001/api/missions/create-and-activate \
  -H "Content-Type: application/json" \
  -d '{
    "vehicleId": "AMB-001",
    "originNode": "N1",
    "destNode": "N13"
  }' | jq
```

### Complete Mission

```bash
curl -X POST http://localhost:3001/api/missions/MISSION-123456/complete
```

---

## Key Implementation Details

### CouchDB Direct Queries

To bypass Fabric Gateway SDK schema validation issues, read operations use CouchDB directly:

```typescript
// backend/src/services/couchdb/index.ts
export async function getAllSegments(): Promise<Segment[]> {
  return queryDocuments<Segment>({ docType: 'segment' });
}

export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  return getDocument<Vehicle>(vehicleId);
}

export async function getActiveMissions(): Promise<Mission[]> {
  return queryDocuments<Mission>({ docType: 'mission', status: 'active' });
}
```

**Why?** The Fabric chaincode schema validator requires ALL fields to be present, even optional ones. CouchDB queries return raw JSON without validation.

### Chaincode-as-a-Service (CCAAS) Deployment

The chaincode runs as a separate Docker container instead of being managed by the peer:

```bash
# Chaincode container runs on port 9999
docker run -d \
  --name routing-chaincode \
  --network emergency-routing_fabric \
  -p 9999:9999 \
  -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
  -e CORE_CHAINCODE_ID_NAME="routing_1.0:PACKAGE_ID" \
  routing-chaincode:2.0
```

**To rebuild and redeploy chaincode:**
```bash
cd /home/mossab/hyper-project/blockchain/chaincode/routing
docker build -t routing-chaincode:2.0 .
docker stop routing-chaincode && docker rm routing-chaincode
docker run -d --name routing-chaincode ... routing-chaincode:2.0
```

### Mission Model (Important)

The Mission struct must NOT use `omitempty` tags for required fields, as the Fabric Gateway SDK expects all fields:

```go
// blockchain/chaincode/routing/models/models.go
type Mission struct {
    DocType       string   `json:"docType"`       
    MissionID     string   `json:"missionId"`     
    Path          []string `json:"path"`          // NO omitempty!
    ActivatedAt   int64    `json:"activatedAt"`   // NO omitempty!
    CompletedAt   int64    `json:"completedAt"`   // NO omitempty!
    // ...
}
```

### Dijkstra Algorithm - Visited Set

The routing service uses a `visited` set to prevent infinite loops:

```typescript
// backend/src/services/routing/index.ts
const visited = new Set<string>();  // REQUIRED to prevent infinite loops

while (!pq.isEmpty()) {
  const current = pq.dequeue()!;
  
  if (visited.has(current)) continue;  // Skip already processed nodes
  visited.add(current);
  
  // Process neighbors...
}
```

---

## Running Both Organization Backends

Both Medical and Police backends must run simultaneously for full functionality:

### Terminal 1: Medical Backend (default)
```bash
cd /home/mossab/hyper-project/backend
npm run dev
# Runs on HTTP:3001, WebSocket:3002
```

### Terminal 2: Police Backend
```bash
cd /home/mossab/hyper-project/backend
PORT=3003 WS_PORT=3004 ORG_TYPE=police MSP_ID=PoliceMSP \
PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net \
npm run dev
# Runs on HTTP:3003, WebSocket:3004
```

| Organization | HTTP Port | WebSocket Port |
|--------------|-----------|----------------|
| Medical      | 3001      | 3002           |
| Police       | 3003      | 3004           |

---

## Testing the System

### 1. Start the Fabric Network

```bash
cd /home/mossab/hyper-project/blockchain/network/docker
docker compose -f docker-compose-ca.yaml up -d
docker compose -f docker-compose-net.yaml up -d
docker compose -f docker-compose-chaincode.yaml up -d
```

### 2. Start Backend (Medical)

```bash
cd /home/mossab/hyper-project/backend
npm run dev
```

### 3. Start Frontend

```bash
cd /home/mossab/hyper-project/frontend
npm run dev
```

### 4. Test Mission Creation

1. Open `http://localhost:3000`
2. Click "Open Panel" in the bottom info bar
3. Select a vehicle (e.g., AMB-001)
4. Choose origin (e.g., Hospital - N1)
5. Choose destination (e.g., Central Hub - N13)
6. Click "Preview Route" to see the calculated path
7. Click "Confirm & Launch Mission" to activate

---

## Files Created/Modified

### New Files

```
blockchain/chaincode/routing/contracts/mission.go    # Mission chaincode contract
backend/src/services/routing/index.ts                # Dijkstra routing service
backend/src/services/fabric/mission.service.ts       # Mission Fabric service
backend/src/api/routes/missions.ts                   # Mission API routes
frontend/src/components/Mission/MissionPanel.tsx     # Mission UI component
frontend/src/components/Mission/MissionPanel.css     # Mission UI styles
docs/PHASE4_MISSIONS.md                              # This documentation
```

### Modified Files

```
blockchain/chaincode/routing/main.go                 # Added MissionContract
backend/src/index.ts                                 # Added mission routes
backend/src/models/types.ts                          # Added Mission types
backend/src/services/fabric/index.ts                 # Export mission service
frontend/src/types/index.ts                          # Added Mission types
frontend/src/services/api.ts                         # Added mission API methods
frontend/src/components/Map/GridMap.tsx              # Route visualization
frontend/src/components/Map/GridMap.css              # Route animation styles
frontend/src/App.tsx                                 # Mission integration
frontend/src/App.css                                 # Mission panel styles
```

---

## Next Steps

Proceed to **Phase 5: Vehicle Simulation** to implement:
- Vehicle simulator service
- Discrete segment-by-segment movement
- Real-time position updates via WebSocket
- Vehicle markers on map
- Simulation controls (start/pause/stop)

---

## Troubleshooting

### Issue: Route calculation hangs/times out

**Symptom:** API request never returns

**Cause:** Missing `visited` set in Dijkstra algorithm causes infinite loop

**Solution:** Ensure the routing service has a visited set:
```typescript
const visited = new Set<string>();
while (!pq.isEmpty()) {
  const current = pq.dequeue()!;
  if (visited.has(current)) continue;
  visited.add(current);
  // ...
}
```

### Issue: Contract not found with name MissionContract

**Error:** `chaincode response 500, Contract not found with name MissionContract`

**Solution:** The chaincode container needs to be rebuilt with the MissionContract:
```bash
cd /home/mossab/hyper-project/blockchain/chaincode/routing
docker build --no-cache -t routing-chaincode:2.0 .
docker stop routing-chaincode && docker rm routing-chaincode
PACKAGE_ID=$(docker exec cli peer lifecycle chaincode queryinstalled | grep routing | awk -F'Package ID: ' '{print $2}' | awk -F',' '{print $1}')
docker run -d --name routing-chaincode --network emergency-routing_fabric \
  -p 9999:9999 -e CHAINCODE_SERVER_ADDRESS=0.0.0.0:9999 \
  -e CORE_CHAINCODE_ID_NAME="$PACKAGE_ID" routing-chaincode:2.0
```

### Issue: Schema validation errors (activatedAt, path required)

**Error:** `Value did not match schema: activatedAt is required, path is required`

**Solution:** Remove `omitempty` tags from Mission struct in `models/models.go` and rebuild chaincode:
```go
Path        []string `json:"path"`        // NOT json:"path,omitempty"
ActivatedAt int64    `json:"activatedAt"` // NOT json:"activatedAt,omitempty"
```

### Issue: WebSocket connection failed (port 3004)

**Error:** `Firefox can't establish a connection to the server at ws://localhost:3004/`

**Solution:** The Police backend is not running. Start it:
```bash
cd /home/mossab/hyper-project/backend
PORT=3003 WS_PORT=3004 ORG_TYPE=police MSP_ID=PoliceMSP \
PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net npm run dev
```

### Issue: Route calculation fails

**Error:** `No path found to destination`

**Solution:** Verify that all segment data is loaded. Check:
```bash
curl http://localhost:3001/api/segments | jq '.data | length'
# Should return 40
```

### Issue: Mission activation fails

**Error:** `Failed to reserve segment S1`

**Solution:** The segment may already be reserved. Check segment status:
```bash
curl http://localhost:3001/api/segments/S1 | jq
```

### Issue: Vehicle not available for mission

**Error:** `Vehicle AMB-001 is already on a mission`

**Solution:** Complete or abort the existing mission first:
```bash
curl -X POST http://localhost:3001/api/missions/MISSION-ID/complete
```

### Issue: Docker socket error during chaincode install

**Error:** `write unix @->/run/docker.sock: write: broken pipe`

**Solution:** The chaincode uses CCAAS (external service), not Docker-managed containers. Rebuild and restart the chaincode container manually instead of using `make deploy-chaincode`.

---

## Summary

Phase 4 implements the complete mission lifecycle:

1. **Create Mission** - Registers mission in blockchain (pending state)
2. **Calculate Route** - Dijkstra algorithm finds optimal path (off-chain)
3. **Activate Mission** - Reserves all path segments on blockchain
4. **Complete/Abort** - Releases all segments, updates vehicle status

Key technical decisions:
- **CouchDB for reads**: Bypasses Fabric SDK schema validation issues
- **CCAAS deployment**: Chaincode runs as external Docker container
- **Off-chain routing**: Dijkstra runs in backend, not in chaincode
- **Dual backend**: Separate backends per organization with different ports

---

*Document Version: 2.0*  
*Last Updated: December 2025*


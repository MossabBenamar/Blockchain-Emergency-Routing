# Phase 5: Vehicle Simulation

This document describes the implementation of the Vehicle Simulation system for the Emergency Vehicle Routing System.

---

## Overview

Phase 5 adds real-time vehicle movement simulation:
- Vehicle simulator service with segment-by-segment movement
- Real-time WebSocket position updates
- Animated vehicle markers on the map
- Simulation controls (start/pause/stop/speed)
- Automatic mission completion when vehicle arrives

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VEHICLE SIMULATION FLOW                               │
│                                                                              │
│  1. MISSION ACTIVATION                                                       │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │   Frontend   │  ──>  │   Backend    │  ──>  │  Simulation  │          │
│     │ Create Mission│      │ ActivateMission│     │   Service    │          │
│     └──────────────┘       └──────────────┘       └──────────────┘          │
│                                                          │                   │
│  2. SIMULATION START                                     │                   │
│     ┌──────────────┐       ┌──────────────┐       ┌─────▼────────┐          │
│     │   Frontend   │  ──>  │   Backend    │  ──>  │  Add Vehicle │          │
│     │ Start Button │       │ /simulation  │       │  to Sim Loop │          │
│     └──────────────┘       │   /start     │       └──────────────┘          │
│                            └──────────────┘                                  │
│                                                                              │
│  3. MOVEMENT UPDATES (Every 500ms)                                           │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │  WebSocket   │  <──  │   Backend    │  <──  │   Update     │          │
│     │ VEHICLE_POSITION│    │  Broadcast   │       │  Vehicle Pos │          │
│     └──────────────┘       └──────────────┘       └──────────────┘          │
│                                                                              │
│  4. SEGMENT TRANSITION                                                       │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │  Chaincode   │  <──  │   Backend    │  <──  │ Progress=100 │          │
│     │ OccupySegment│       │ ReleaseSegment│      │  Move Next   │          │
│     └──────────────┘       └──────────────┘       └──────────────┘          │
│                                                                              │
│  5. ARRIVAL                                                                  │
│     ┌──────────────┐       ┌──────────────┐       ┌──────────────┐          │
│     │  Chaincode   │  <──  │   Backend    │  <──  │Last Segment  │          │
│     │CompleteMission│      │VEHICLE_ARRIVED│      │  Complete    │          │
│     └──────────────┘       └──────────────┘       └──────────────┘          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Components Created

### 1. Simulation Service (`simulation/index.ts`)

Location: `backend/src/services/simulation/index.ts`

The core simulation engine that:
- Tracks vehicle positions and progress along routes
- Broadcasts position updates via WebSocket every 500ms
- Handles segment transitions (occupy/release on blockchain)
- Completes missions automatically when vehicles arrive

**Key Functions:**

| Function | Description |
|----------|-------------|
| `startSimulation()` | Start or resume simulation loop |
| `pauseSimulation()` | Pause all moving vehicles |
| `stopSimulation()` | Stop simulation and clear all vehicles |
| `setSimulationSpeed(multiplier)` | Set simulation speed (0.1x - 5.0x) |
| `addVehicleToSimulation(mission)` | Add a vehicle from an active mission |
| `removeVehicleFromSimulation(vehicleId)` | Remove a vehicle |
| `getSimulationStatus()` | Get current simulation state |
| `getVehiclePositions()` | Get all vehicle positions |
| `simulateMission(missionId)` | Start simulation for specific mission |

**Configuration:**

```typescript
const DEFAULT_SEGMENT_TRAVEL_TIME_MS = 3000;  // 3 seconds per segment
const POSITION_UPDATE_INTERVAL_MS = 500;       // Update every 500ms
```

### 2. Simulation API Routes (`simulation.ts`)

Location: `backend/src/api/routes/simulation.ts`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/simulation/status` | GET | Get simulation status |
| `/api/simulation/positions` | GET | Get all vehicle positions |
| `/api/simulation/start` | POST | Start/resume simulation |
| `/api/simulation/pause` | POST | Pause simulation |
| `/api/simulation/stop` | POST | Stop simulation |
| `/api/simulation/speed` | POST | Set speed (body: `{speed: 0.1-5.0}`) |
| `/api/simulation/mission/:id` | POST | Start simulation for specific mission |

### 3. SimulationControls Component

Location: `frontend/src/components/Simulation/SimulationControls.tsx`

Features:
- **Status Display**: Shows running/paused/stopped state
- **Statistics**: Active vehicles, total in simulation, current speed
- **Control Buttons**: Start, Pause, Stop
- **Speed Controls**: 0.5x, 1x, 2x, 3x speed options
- **Vehicle List**: Shows all vehicles in simulation with progress bars

### 4. Animated Vehicle Markers

Updated: `frontend/src/components/Map/GridMap.tsx`

Features:
- **Interpolated Position**: Smooth movement along segments based on progress
- **Animated Effects**: Glowing pulse, movement animation
- **Vehicle Label**: Shows vehicle ID and current segment
- **Progress Indicator**: Shows segment number (e.g., 3/8)
- **Trail Effect**: Subtle trail when vehicle is moving

---

## WebSocket Events

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `VEHICLE_POSITION` | `VehiclePosition` | Real-time vehicle position update |
| `SEGMENT_TRANSITION` | `{vehicleId, fromSegment, toSegment}` | Vehicle moved to new segment |
| `VEHICLE_ARRIVED` | `{vehicleId, missionId}` | Vehicle reached destination |
| `SIMULATION_STARTED` | `{status: SimulationStatus}` | Simulation started |
| `SIMULATION_PAUSED` | `{status: SimulationStatus}` | Simulation paused |
| `SIMULATION_STOPPED` | `{status: SimulationStatus}` | Simulation stopped |
| `SIMULATION_SPEED_CHANGED` | `{speedMultiplier}` | Speed changed |

### VehiclePosition Payload

```typescript
interface VehiclePosition {
  vehicleId: string;
  missionId: string;
  currentSegment: string | null;
  previousSegment: string | null;
  nextSegment: string | null;
  progress: number;          // 0-100 (percentage along current segment)
  segmentIndex: number;      // Current segment index in path
  totalSegments: number;     // Total segments in path
  status: 'idle' | 'moving' | 'paused' | 'arrived' | 'aborted';
  orgType: string;
}
```

---

## Usage Guide

### 1. Start the Backend

```bash
cd /home/mossab/hyper-project/backend
npm run dev
```

### 2. Start the Frontend

```bash
cd /home/mossab/hyper-project/frontend
npm run dev
```

### 3. Create a Mission

1. Open `http://localhost:3000`
2. Click "Mission Control" → "Open Panel"
3. Select a vehicle (e.g., AMB-001)
4. Choose origin (e.g., Hospital - N1)
5. Choose destination (e.g., Police Station - N25)
6. Click "Preview Route" to see the path
7. Click "Confirm & Launch Mission"

### 4. Start Simulation

1. Click "Simulation" panel
2. Click "▶️ Start"
3. Watch the vehicle move along the route!

### 5. Control Simulation

- **Pause**: Click "⏸️ Pause" to pause all vehicles
- **Resume**: Click "▶️ Resume" to continue
- **Stop**: Click "⏹️ Stop" to end simulation
- **Speed**: Click 0.5x, 1x, 2x, or 3x to change speed

---

## API Usage Examples

### Get Simulation Status

```bash
curl -s http://localhost:3001/api/simulation/status | jq
```

Response:
```json
{
  "success": true,
  "data": {
    "isRunning": true,
    "isPaused": false,
    "speedMultiplier": 1.0,
    "activeVehicles": 1,
    "totalVehicles": 1,
    "vehicles": [
      {
        "vehicleId": "AMB-001",
        "missionId": "MISSION-123456",
        "currentSegmentIndex": 3,
        "currentSegment": "S4",
        "progress": 45,
        "status": "moving",
        "totalSegments": 8
      }
    ]
  }
}
```

### Start Simulation

```bash
curl -X POST http://localhost:3001/api/simulation/start | jq
```

### Set Simulation Speed

```bash
curl -X POST http://localhost:3001/api/simulation/speed \
  -H "Content-Type: application/json" \
  -d '{"speed": 2.0}' | jq
```

### Get Vehicle Positions

```bash
curl -s http://localhost:3001/api/simulation/positions | jq
```

---

## Simulation Behavior

### Movement Mechanics

1. **Progress Calculation**: Each update (500ms) increments progress based on speed
   - At 1x speed: 3 seconds per segment, ~16.6% progress per update
   - At 2x speed: 1.5 seconds per segment, ~33.3% progress per update

2. **Segment Transition**: When progress reaches 100%:
   - Release current segment on blockchain (status: free)
   - Move to next segment
   - Occupy new segment on blockchain (status: occupied)
   - Reset progress to 0%

3. **Arrival**: When reaching last segment:
   - Release final segment
   - Complete mission on blockchain
   - Remove vehicle from simulation
   - Broadcast `VEHICLE_ARRIVED` event

### Auto-Load Active Missions

When simulation starts:
1. Fetches all active missions from blockchain
2. Adds each mission's vehicle to simulation
3. Starts movement from current position

---

## Files Created/Modified

### New Files

```
backend/src/services/simulation/index.ts      # Simulation service
backend/src/api/routes/simulation.ts          # Simulation API routes
frontend/src/components/Simulation/SimulationControls.tsx  # Controls UI
frontend/src/components/Simulation/SimulationControls.css  # Controls styles
docs/PHASE5_SIMULATION.md                     # This documentation
```

### Modified Files

```
backend/src/index.ts                          # Added simulation routes
backend/src/models/types.ts                   # Added simulation types
frontend/src/types/index.ts                   # Added VehiclePosition, SimulationStatus
frontend/src/services/api.ts                  # Added simulation API methods
frontend/src/components/Map/GridMap.tsx       # Added animated vehicle markers
frontend/src/components/Map/GridMap.css       # Added vehicle animations
frontend/src/App.tsx                          # Integrated simulation controls
frontend/src/App.css                          # Added simulation panel styles
```

---

## Troubleshooting

### Issue: Vehicles not moving

**Possible Causes:**
1. Simulation not started
2. No active missions
3. WebSocket disconnected

**Solution:**
```bash
# Check simulation status
curl http://localhost:3001/api/simulation/status | jq

# Check active missions
curl http://localhost:3001/api/missions/active | jq

# Start simulation
curl -X POST http://localhost:3001/api/simulation/start
```

### Issue: Vehicle position not updating on map

**Possible Causes:**
1. Frontend not receiving WebSocket events
2. Vehicle position interpolation failing

**Solution:**
1. Check browser console for WebSocket messages
2. Verify segment exists in map data
3. Check that `vehiclePositions` array is being updated in React state

### Issue: Segment status not updating

**Possible Causes:**
1. Chaincode call failing
2. CouchDB query cache

**Solution:**
```bash
# Check segment status directly
curl http://localhost:3001/api/segments/S1 | jq

# Check chaincode logs
docker logs routing-chaincode
```

### Issue: Mission not completing

**Possible Causes:**
1. CompleteMission chaincode function failing
2. Vehicle stuck at last segment

**Solution:**
```bash
# Complete mission manually
curl -X POST http://localhost:3001/api/missions/MISSION-ID/complete
```

---

## Next Steps

Proceed to **Phase 6: Conflict Resolution** to implement:
- Same-priority conflict detection
- Negotiation workflow for dispatchers
- Conflict resolution UI
- Auto-fallback mechanism (first-come-first-served)

---

## Summary

Phase 5 implements the complete vehicle simulation system:

✅ Vehicle simulator service with segment-by-segment movement  
✅ Real-time WebSocket position broadcasts (500ms interval)  
✅ Animated vehicle markers on the map  
✅ Smooth position interpolation along segments  
✅ Simulation controls (start/pause/stop/speed)  
✅ Automatic segment occupy/release on blockchain  
✅ Automatic mission completion on arrival  
✅ Multiple speed options (0.5x to 3x)  

---

*Document Version: 1.0*  
*Last Updated: December 2025*


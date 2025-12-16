# Phase 6: Conflict Resolution

> Automatic priority-based conflict resolution with rerouting for the Emergency Vehicle Routing System.

## Overview

Phase 6 implements automatic conflict resolution when multiple emergency vehicles compete for the same road segments. The system uses priority-based preemption and automatic rerouting to ensure higher-priority missions always get through.

## Key Features

### 1. Priority-Based Resolution

| Scenario | Resolution | Action |
|----------|------------|--------|
| Higher priority requests segment | Preemption | New mission wins, existing mission rerouted |
| Same priority requests segment | FCFS | Existing reservation wins, new mission rerouted |
| Lower priority requests segment | Rejection | Existing reservation wins, new mission must find alternative |

### 2. Automatic Rerouting

When a mission loses a segment:
1. System automatically calculates alternative route
2. Mission path is updated on the blockchain
3. Simulation adjusts vehicle movement to new path
4. All parties are notified via WebSocket

### 3. Real-Time Notifications

The system broadcasts several events:

| Event | Description |
|-------|-------------|
| `MISSION_PREEMPTED` | A mission lost segments to higher priority |
| `MISSION_REROUTED` | A mission's path was updated |
| `MISSION_ABORTED` | A mission was cancelled (no alternative route) |
| `CONFLICT_RESOLVED` | A conflict was automatically resolved |
| `VEHICLE_REROUTED` | A vehicle changed course during simulation |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          Frontend (React)                           │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐ │
│  │  ConflictAlert  │  │ ConflictHistory │  │      GridMap        │ │
│  │  (Toast Notifs) │  │    (History)    │  │ (Route Highlight)   │ │
│  └────────┬────────┘  └────────┬────────┘  └──────────┬──────────┘ │
│           │                    │                       │            │
│           └────────────────────┼───────────────────────┘            │
│                     WebSocket Events                                │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (Node.js)                           │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   Conflict Resolution Service                │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │   │
│  │  │handleConflict│  │rerouteMission│  │checkSegmentAvailability│ │
│  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                │                                    │
│  ┌─────────────────┐  ┌────────┴─────────┐  ┌─────────────────┐   │
│  │ Segment Service │  │ Routing Service  │  │Simulation Service│   │
│  └────────┬────────┘  └──────────────────┘  └────────┬────────┘   │
│           │                                           │            │
└───────────┼───────────────────────────────────────────┼────────────┘
            │                                           │
            ▼                                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Blockchain (Hyperledger Fabric)                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Chaincode Contracts                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ReserveSegment│  │UpdateMissionPath│  │ResolveConflict  │   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### Chaincode Updates

**models.go** - Added event constant:
```go
EventMissionRerouted = "MISSION_REROUTED"
```

**mission.go** - `UpdateMissionPath` function:
- Validates mission is active
- Releases old segments no longer in path
- Reserves new segments in updated path
- Emits `MISSION_REROUTED` event

### Backend Services

**Conflict Service** (`services/conflict/index.ts`):
- `handleConflict()` - Resolves conflicts based on priority
- `preemptMission()` - Takes segments from lower-priority mission
- `rerouteMission()` - Calculates new path avoiding contested segments
- `abortMissionDueToConflict()` - Aborts mission if no route possible
- `checkSegmentAvailability()` - Checks if segment can be reserved
- `getConflictHistory()` - Returns past conflict resolutions

**Simulation Service Updates** (`services/simulation/index.ts`):
- `handleMissionRerouted()` - Updates vehicle path during simulation
- `updateVehiclePath()` - Direct path update for vehicle
- `handleMissionAborted()` - Removes vehicle from simulation

**API Routes** (`api/routes/segments.ts`):
- `GET /api/segments/conflicts/history` - Get conflict history

### Frontend Components

**ConflictAlert** (`components/Conflict/ConflictAlert.tsx`):
- Toast notifications for conflict events
- Auto-dismissing after 6 seconds
- Color-coded by event type

**ConflictHistory** (`components/Conflict/ConflictHistory.tsx`):
- Table showing past conflict resolutions
- Winner/loser mission details
- Resolution type and outcome badges

## API Endpoints

### Conflict History
```
GET /api/segments/conflicts/history
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "conflictId": "CONFLICT-S10-1702165000",
      "timestamp": 1702165000000,
      "segmentId": "S10",
      "winnerMissionId": "MISSION-abc123",
      "winnerPriority": 1,
      "loserMissionId": "MISSION-xyz789",
      "loserPriority": 2,
      "resolution": "preempted",
      "loserOutcome": "rerouted",
      "newPath": ["S9", "S11", "S12"]
    }
  ]
}
```

## WebSocket Events

### MISSION_PREEMPTED
```json
{
  "type": "MISSION_PREEMPTED",
  "payload": {
    "preemptorMissionId": "MISSION-abc123",
    "targetMissionId": "MISSION-xyz789",
    "preemptedSegments": ["S10", "S11"]
  },
  "timestamp": 1702165000000
}
```

### MISSION_REROUTED
```json
{
  "type": "MISSION_REROUTED",
  "payload": {
    "missionId": "MISSION-xyz789",
    "oldPath": ["S10", "S11", "S12"],
    "newPath": ["S9", "S14", "S15", "S12"],
    "reason": "Preempted from segment(s): S10, S11"
  },
  "timestamp": 1702165001000
}
```

### CONFLICT_RESOLVED
```json
{
  "type": "CONFLICT_RESOLVED",
  "payload": {
    "conflictId": "CONFLICT-S10-1702165000",
    "winner": "MISSION-abc123",
    "loser": "MISSION-xyz789",
    "segmentId": "S10",
    "resolution": "preempted",
    "loserRerouted": true,
    "newPath": ["S9", "S14", "S15", "S12"]
  },
  "timestamp": 1702165001000
}
```

## Testing Scenarios

### Scenario 1: Higher Priority Preemption

1. Create Police mission (priority 2) on path S1→S2→S3
2. Activate mission and start simulation
3. Create Medical mission (priority 1) that needs S2
4. Expected: Medical wins S2, Police is rerouted

### Scenario 2: Same Priority FCFS

1. Create Medical mission A (priority 1) on path S1→S2
2. Create Medical mission B (priority 1) on path S2→S3
3. Expected: Mission A keeps S2 (first-come-first-served)
4. Expected: Mission B finds alternative route

### Scenario 3: No Alternative Route

1. Reserve all segments except one path to destination
2. Create lower-priority mission that needs blocked segments
3. Expected: Mission is aborted with "No alternative route" message

## Files Changed

| File | Change |
|------|--------|
| `blockchain/chaincode/routing/models/models.go` | Added `EventMissionRerouted` constant |
| `blockchain/chaincode/routing/contracts/mission.go` | Updated to use new constant |
| `backend/src/services/conflict/index.ts` | **NEW** - Conflict resolution service |
| `backend/src/services/simulation/index.ts` | Added rerouting handlers |
| `backend/src/api/routes/segments.ts` | Added conflict history endpoint |
| `frontend/src/components/Conflict/ConflictAlert.tsx` | **NEW** - Toast notifications |
| `frontend/src/components/Conflict/ConflictAlert.css` | **NEW** - Alert styles |
| `frontend/src/components/Conflict/ConflictHistory.tsx` | **NEW** - History panel |
| `frontend/src/components/Conflict/ConflictHistory.css` | **NEW** - History styles |
| `frontend/src/services/api.ts` | Added `getConflictHistory()` method |
| `frontend/src/App.tsx` | Integrated ConflictAlert component |

## Next Steps

Phase 7 (Polish & Demo) should include:
- Demo scenarios for conflict resolution
- Recording demonstration video
- Final documentation updates
- End-to-end testing of all phases

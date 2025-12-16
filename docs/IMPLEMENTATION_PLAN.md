# Emergency Vehicle Routing System - Implementation Plan

## Project Configuration

| Decision | Choice |
|----------|--------|
| Map Source | Synthetic 5x5 grid |
| Organizations | 2 orgs (Medical + Police) |
| Frontend Priority | Map-first (real-time visualization) |
| Chaincode Language | Go |
| Simulation Fidelity | Simple (discrete segment transitions) |
| Priority Conflict | Same priority = negotiate |
| Segment TTL | No TTL, manual release only |

---

## Phase 1: Foundation & Blockchain ✅ COMPLETED
**Duration: Week 1-2**

- Set up 2-organization Hyperledger Fabric network
- Create crypto material and channel configuration
- Write Go chaincode (Vehicle + Segment contracts)
- Deploy chaincode using CCAAS approach
- Initialize 5x5 grid with 40 road segments
- Test basic operations (register vehicle, query segments)

---

## Phase 2: Backend API
**Duration: Week 2-3**

- Create Node.js + Express REST API
- Integrate Fabric Gateway SDK for blockchain interaction
- Implement endpoints:
  - `POST/GET /api/vehicles` - Vehicle management
  - `GET /api/map` - Grid map data
  - `POST/GET /api/segments` - Segment status and reservation
- Add WebSocket support for real-time updates

---

## Phase 3: Frontend Map Visualization
**Duration: Week 3-4**

- Create React application with Vite
- Build 5x5 grid visualization using Canvas/SVG
- Implement color-coded segment status display
- Add interactive segment selection
- Create organization context switcher (Medical/Police)
- Connect to backend API

---

## Phase 4: Missions & Routing
**Duration: Week 4-5**

- Add Mission chaincode contract
- Implement Dijkstra routing algorithm (off-chain)
- Create mission lifecycle: create → activate → complete
- Add route visualization on frontend map
- Build mission creation UI

---

## Phase 5: Vehicle Simulation ✅ COMPLETED
**Duration: Week 5-6**

- Create vehicle simulator service
- Implement discrete segment-by-segment movement
- Add WebSocket real-time position updates
- Display vehicle markers on map
- Add simulation controls (start/pause/stop)

---

## Phase 6: Conflict Resolution
**Duration: Week 6-7**

- Implement same-priority conflict detection
- Add negotiation workflow for dispatchers
- Create conflict resolution UI
- Add auto-fallback mechanism (first-come-first-served)

---

## Phase 7: Polish & Demo
**Duration: Week 7-8**

- Improve error handling
- Add audit log viewer
- Create demo scenarios
- Record demonstration video
- Write final documentation

---

## Technology Stack

| Component | Technology |
|-----------|------------|
| Blockchain | Hyperledger Fabric 2.5 |
| Chaincode | Go |
| State Database | CouchDB |
| Backend | Node.js + Express |
| Fabric SDK | @hyperledger/fabric-gateway |
| Frontend | React 18 + Vite |
| Real-time | WebSocket |
| Containerization | Docker Compose |

---

## Key Deliverables

1. Working Fabric network with 2 organizations
2. Chaincode for vehicle registration, segment reservation, missions
3. REST API with Fabric Gateway integration
4. Interactive map visualization
5. Vehicle movement simulation
6. Conflict resolution system
7. Demo scenarios and documentation


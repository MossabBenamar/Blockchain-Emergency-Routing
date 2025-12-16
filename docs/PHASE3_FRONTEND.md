# Phase 3: Frontend Map Visualization

This document describes the implementation of the React frontend for the Emergency Vehicle Routing System.

---

## Overview

The frontend provides an interactive map visualization that:
- Displays a 5×5 grid of road segments and intersections
- Shows real-time segment status (free/reserved/occupied)
- Allows organization switching between Medical and Police
- Enables segment reservation and release operations
- Connects to **organization-specific backends** for proper blockchain identity
- Provides real-time updates via WebSocket

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          FRONTEND APPLICATION                                │
│                          http://localhost:3000                               │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐         │
│  │     Header      │    │    GridMap      │    │    Sidebar      │         │
│  │ (Org Switcher)  │    │    (SVG)        │    │   (Controls)    │         │
│  └────────┬────────┘    └─────────────────┘    └─────────────────┘         │
│           │                                                                  │
│           ▼                                                                  │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Organization-Aware Services                        │   │
│  │                                                                       │   │
│  │   api.setOrganization('medical' | 'police')                          │   │
│  │   wsService.setOrganization('medical' | 'police')                    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
└────────────────────────────────────┼─────────────────────────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│      MEDICAL BACKEND            │   │      POLICE BACKEND             │
│                                 │   │                                 │
│  HTTP:  http://localhost:3001   │   │  HTTP:  http://localhost:3003   │
│  WS:    ws://localhost:3002     │   │  WS:    ws://localhost:3004     │
│                                 │   │                                 │
│  Identity: MedicalMSP           │   │  Identity: PoliceMSP            │
│  Peer: peer0.medical            │   │  Peer: peer0.police             │
└─────────────────────────────────┘   └─────────────────────────────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │    HYPERLEDGER FABRIC NETWORK   │
                    │                                 │
                    │  Channel: emergency-channel     │
                    │  Chaincode: routing             │
                    └─────────────────────────────────┘
```

---

## Multi-Organization Support

The system requires **two backend instances** to properly support blockchain identity for each organization:

| Organization | HTTP API | WebSocket | MSP Identity | Peer |
|--------------|----------|-----------|--------------|------|
| **Medical** | localhost:3001 | localhost:3002 | MedicalMSP | peer0.medical.emergency.net |
| **Police** | localhost:3003 | localhost:3004 | PoliceMSP | peer0.police.emergency.net |

When the user switches organizations in the frontend, the API and WebSocket services automatically reconnect to the appropriate backend, ensuring all transactions are signed with the correct blockchain identity.

---

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header/
│   │   │   ├── Header.tsx       # Organization switcher and status indicators
│   │   │   └── Header.css
│   │   ├── Map/
│   │   │   ├── GridMap.tsx      # SVG-based 5×5 grid visualization
│   │   │   └── GridMap.css
│   │   ├── Sidebar/
│   │   │   ├── Sidebar.tsx      # Control panel, segment details, vehicles
│   │   │   └── Sidebar.css
│   │   └── Vehicles/            # (Reserved for future vehicle management)
│   ├── hooks/
│   │   └── useWebSocket.ts      # WebSocket connectivity hook
│   ├── services/
│   │   ├── api.ts               # REST API service (multi-org support)
│   │   └── websocket.ts         # WebSocket service (multi-org support)
│   ├── types/
│   │   └── index.ts             # TypeScript type definitions
│   ├── App.tsx                  # Main application component
│   ├── App.css                  # Application styles
│   ├── index.css                # Global styles and CSS variables
│   └── main.tsx                 # Entry point
├── public/
│   └── vite.svg                 # Custom favicon
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Prerequisites

- Node.js 18+
- npm or yarn
- Hyperledger Fabric network running (Phase 1 complete)
- Backend API running (Phase 2 complete)

---

## Installation

```bash
cd /home/mossab/hyper-project/frontend
npm install
```

---

## Running the Application

### 1. Start the Fabric Network (if not running)

```bash
cd /home/mossab/hyper-project/blockchain/network/docker
docker compose -f docker-compose-ca.yaml up -d
docker compose -f docker-compose-net.yaml up -d
docker compose -f docker-compose-chaincode.yaml up -d
```

### 2. Start Medical Backend (Terminal 1)

```bash
cd /home/mossab/hyper-project/backend
npm run dev
```

This starts the medical backend on ports 3001 (HTTP) and 3002 (WebSocket).

### 3. Start Police Backend (Terminal 2)

```bash
cd /home/mossab/hyper-project/backend
PORT=3003 WS_PORT=3004 ORG_TYPE=police MSP_ID=PoliceMSP \
  PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net \
  npm run dev
```

This starts the police backend on ports 3003 (HTTP) and 3004 (WebSocket).

### 4. Start Frontend (Terminal 3)

```bash
cd /home/mossab/hyper-project/frontend
npm run dev
```

The application will be available at `http://localhost:3000`

### Production Build

```bash
npm run build
npm run preview
```

---

## Features

### 1. Organization Switcher

Toggle between Medical and Police organizations in the header:
- **Medical** (Red theme): Connects to medical backend, shows medical vehicles
- **Police** (Blue theme): Connects to police backend, shows police vehicles

When you switch organizations:
- API service reconnects to the organization's backend
- WebSocket reconnects for real-time updates
- Data refreshes from the new backend
- Vehicle list updates to show organization's vehicles

### 2. Grid Map Visualization

Interactive SVG-based 5×5 grid showing:

| Element | Count | Description |
|---------|-------|-------------|
| **Nodes** | 25 | Intersections displayed as circles with numbers |
| **POIs** | 3 | Hospital (N1), Central Hub (N13), Police Station (N25) |
| **Segments** | 40 | Road segments connecting nodes (20 horizontal, 20 vertical) |

### 3. Segment Status Colors

| Status | Color | Description |
|--------|-------|-------------|
| Free | 🟢 Green (`#51cf66`) | Available for reservation |
| Reserved (Medical) | 🔴 Red (`#ff6b6b`) | Reserved by Medical organization |
| Reserved (Police) | 🔵 Blue (`#4dabf7`) | Reserved by Police organization |
| Selected | 🔵 Cyan (`#00d4ff`) | Currently selected segment |
| Occupied | 🔴 Bright Red (`#ff4757`) | Vehicle currently on segment |

### 4. Segment Interaction

Click any segment to:
- View segment details (ID, route from→to, status)
- See reservation info (vehicle, organization, priority level)
- Reserve the segment with one of your vehicles
- Release the segment (if reserved by your organization)

### 5. Sidebar Controls

The sidebar displays:
- **Segment Status**: Count of free/reserved/occupied segments with progress bar
- **Selected Segment**: Details of the clicked segment
- **Actions**: Reserve/Release buttons based on segment state
- **Your Vehicles**: List of vehicles belonging to current organization
- **Legend**: Color coding reference

### 6. Real-time Updates

WebSocket integration provides live updates for:
- Segment status changes (reserve/release/occupy)
- Vehicle updates
- Conflict notifications

---

## API Integration

### REST Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/map` | Fetch static map data (nodes, segment geometry) |
| GET | `/api/segments` | Fetch all segment statuses from blockchain |
| GET | `/api/vehicles` | Fetch registered vehicles |
| POST | `/api/segments/reserve` | Reserve a segment |
| POST | `/api/segments/:id/release` | Release a segment |
| POST | `/api/segments/:id/occupy` | Mark segment as occupied |
| GET | `/health` | Backend health check |

### Data Merging

The frontend merges data from two sources:
1. **`/api/map`**: Provides segment geometry (`from`, `to`, `id`)
2. **`/api/segments`**: Provides segment status from blockchain (`status`, `reservedBy`, etc.)

This ensures the grid can be rendered with coordinates while reflecting real-time blockchain state.

### WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `CONNECTED` | Server→Client | Connection established |
| `SEGMENT_UPDATED` | Server→Client | Segment reserved/released/occupied |
| `VEHICLE_UPDATED` | Server→Client | Vehicle registered/updated |
| `CONFLICT_DETECTED` | Server→Client | Priority conflict detected |

---

## Component Reference

### Header

```tsx
<Header
  currentOrg="medical"           // Current organization
  onOrgChange={handleOrgChange}  // Switches backend + refreshes data
  isConnected={true}             // WebSocket connection status
  blockchainStatus="connected"   // Blockchain connection status
/>
```

### GridMap

```tsx
<GridMap
  nodes={nodes}                    // Array of Node objects with x,y coordinates
  segments={segments}              // Array of Segment objects with status
  vehicles={vehicles}              // Array of Vehicle objects
  selectedSegment="S1"             // Currently selected segment ID
  onSegmentClick={handleClick}     // Segment click handler
  currentOrg="medical"             // Current organization for styling
/>
```

### Sidebar

```tsx
<Sidebar
  selectedSegment={segment}          // Selected Segment object (or null)
  segments={segments}                // All segments for statistics
  vehicles={vehicles}                // All vehicles (filtered by org internally)
  currentOrg="medical"               // Current organization
  onReserveSegment={handleReserve}   // Reserve handler
  onReleaseSegment={handleRelease}   // Release handler
  onRefresh={handleRefresh}          // Manual refresh handler
  isLoading={false}                  // Loading state
/>
```

---

## Styling

### Theme Colors (CSS Variables)

```css
:root {
  --bg-primary: #0a0a14;
  --bg-secondary: #1a1a2e;
  --accent-cyan: #00d4ff;
  --medical-primary: #ff6b6b;
  --police-primary: #4dabf7;
  --segment-free: #51cf66;
  --segment-occupied: #ff4757;
}
```

### Fonts

- **Primary**: Space Grotesk (headers, UI)
- **Monospace**: JetBrains Mono (code, IDs)

---

## Testing Scenarios

### Scenario 1: Basic Map Interaction

1. Open `http://localhost:3000`
2. Verify 25 nodes and 40 green segments are displayed
3. Click on a segment → Details appear in sidebar
4. Hover over segments → Segment ID label appears

### Scenario 2: Medical Reservation

1. Stay on **Medical** tab
2. Select a free (green) segment
3. Choose AMB-001 from vehicle dropdown
4. Click "Reserve Segment"
5. Segment turns red, sidebar shows reservation details

### Scenario 3: Police Reservation

1. Switch to **Police** tab
2. Verify POL-002 appears in "Your Vehicles"
3. Select a free segment
4. Reserve with POL-002
5. Segment turns blue, organization shows "police"

### Scenario 4: Cross-Organization View

1. Reserve a segment as Medical
2. Switch to Police tab
3. Click the reserved segment
4. Verify it shows "Reserved by medical" 
5. Release button should show warning (can't release other org's segment)

### Scenario 5: Release Segment

1. Select a segment reserved by your organization
2. Click "Release Segment"
3. Segment turns green (free)
4. Reservation details clear from sidebar

---

## Troubleshooting

### Issue: Segments not rendering (only nodes visible)

**Cause:** API returns segment data with different property names than expected.

**Solution:** The frontend merges `/api/map` (geometry) with `/api/segments` (status). Ensure both endpoints are responding correctly:
```bash
curl http://localhost:3001/api/map | head -c 500
curl http://localhost:3001/api/segments | head -c 500
```

### Issue: Reservations show wrong organization

**Cause:** Only one backend is running, so all transactions use that organization's identity.

**Solution:** Start both backends:
```bash
# Medical backend (default)
npm run dev

# Police backend (separate terminal)
PORT=3003 WS_PORT=3004 ORG_TYPE=police MSP_ID=PoliceMSP \
  PEER_ENDPOINT=localhost:9051 PEER_HOST_ALIAS=peer0.police.emergency.net \
  npm run dev
```

### Issue: WebSocket disconnects when switching organizations

**Cause:** Expected behavior - WebSocket reconnects to new backend.

**Solution:** The app will auto-reconnect. Wait 1-2 seconds after switching organizations.

### Issue: "Release segment" fails with schema error

**Cause:** Chaincode schema validation issue when reading released segments.

**Solution:** Fixed in Phase 2 - backend now uses CouchDB for reading segments after release. Ensure you have the latest backend code.

### Issue: Vehicle not appearing in sidebar

**Cause:** Vehicle registered with wrong `orgType` in blockchain.

**Solution:** Register vehicle with correct organization via CLI:
```bash
docker exec -e CORE_PEER_ADDRESS=peer0.police.emergency.net:9051 \
  -e CORE_PEER_LOCALMSPID=PoliceMSP \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  cli peer chaincode invoke ... -c '{"function":"VehicleContract:RegisterVehicle","Args":["POL-002","police","patrol_car","2"]}'
```

---

## Files Created/Modified

```
frontend/
├── src/
│   ├── components/
│   │   ├── Header/Header.tsx          # Organization switcher, status indicators
│   │   ├── Header/Header.css          # Header styling
│   │   ├── Map/GridMap.tsx            # SVG grid with click handling
│   │   ├── Map/GridMap.css            # Segment/node styling, animations
│   │   ├── Sidebar/Sidebar.tsx        # Control panel, segment details
│   │   └── Sidebar/Sidebar.css        # Sidebar styling
│   ├── hooks/useWebSocket.ts          # WebSocket hook with auto-reconnect
│   ├── services/
│   │   ├── api.ts                     # Multi-org API service
│   │   └── websocket.ts               # Multi-org WebSocket service
│   ├── types/index.ts                 # TypeScript interfaces
│   ├── App.tsx                        # Main app with data merging logic
│   ├── App.css                        # App layout styles
│   └── index.css                      # Global styles, CSS variables
├── public/vite.svg                    # Custom favicon
├── index.html                         # HTML template
├── vite.config.ts                     # Vite configuration with proxy
└── package.json                       # Dependencies
```

---

## Next Steps

Proceed to **Phase 4: Missions & Routing** to implement:
- Mission creation and lifecycle management (create → activate → complete)
- Dijkstra routing algorithm for optimal path calculation
- Route visualization on the map (highlight path segments)
- Vehicle movement simulation along routes
- Mission progress tracking

---

## Summary

Phase 3 delivers a fully functional frontend with:

✅ Interactive 5×5 grid map visualization  
✅ Color-coded segment status (free/reserved/occupied)  
✅ Organization switching (Medical/Police)  
✅ Multi-backend architecture for proper blockchain identity  
✅ Segment reservation and release  
✅ Real-time WebSocket updates  
✅ Responsive sidebar with segment details  
✅ Vehicle listing by organization  

---

*Document Version: 2.0*  
*Last Updated: December 2025*

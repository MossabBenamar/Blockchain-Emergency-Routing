# Emergency Vehicle Dynamic Routing System
## Architecture Documentation

**Project**: Blockchain-Based Dynamic Routing for Emergency Vehicles  
**Technology**: Hyperledger Fabric  
**Version**: 1.0  
**Last Updated**: December 2024

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Context](#2-system-context)
3. [Architecture Overview](#3-architecture-overview)
4. [Component Details](#4-component-details)
5. [Data Models](#5-data-models)
6. [Smart Contract Design](#6-smart-contract-design)
7. [Key Flows](#7-key-flows)
8. [Technology Stack](#8-technology-stack)
9. [Project Structure](#9-project-structure)
10. [Security & Access Control](#10-security--access-control)
11. [Simulation Strategy](#11-simulation-strategy)
12. [Open Questions](#12-open-questions)

---

## 1. Executive Summary

### 1.1 Purpose

This document defines the end-to-end architecture for a **blockchain-based emergency vehicle routing system** designed for Smart City environments. The system enables multiple emergency services (medical, fire, police, infrastructure) to coordinate vehicle routing through a shared, immutable ledger while maintaining organizational autonomy and priority-based access.

### 1.2 Scope

The system handles:
- Dynamic route calculation for emergency vehicles
- Road segment reservation with priority-based conflict resolution
- Real-time vehicle tracking and progression monitoring
- Cross-agency coordination through shared blockchain state
- Complete audit trail for all routing decisions

### 1.3 Key Design Principles

| Principle | Description |
|-----------|-------------|
| **Hybrid Architecture** | High-frequency operations off-chain, authoritative state on-chain |
| **Single Channel** | All organizations share one Fabric channel for interoperability |
| **Priority-Based Resolution** | Higher-priority emergencies can preempt lower-priority reservations |
| **Simulation-First** | All physical components (GPS, vehicles) are simulated for academic context |
| **Minimal On-Chain Data** | Only state transitions and decisions stored on blockchain |

---

## 2. System Context

### 2.1 Emergency Vehicle Categories

The system supports multiple categories of emergency vehicles, each operated by different organizational authorities:

| Category | Examples | Typical Priority |
|----------|----------|------------------|
| **Medical Emergency** | Ambulances, Mobile ICU, Emergency Medical Response | 1 (Highest) |
| **Fire & Rescue** | Fire trucks, Ladder trucks, Hazmat vehicles | 2 |
| **Law Enforcement** | Police patrol, Rapid intervention units | 3 |
| **Civil Protection** | Disaster response, Search & rescue | 2-3 |
| **Infrastructure** | Power grid emergency, Gas leak response, Water utility | 4 |
| **Special Authorization** | Military convoy, Prisoner transport | Variable |

### 2.2 Stakeholders

```
┌─────────────────────────────────────────────────────────────────┐
│                         SMART CITY                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Hospital   │  │ Fire Station│  │   Police    │              │
│  │  Dispatch   │  │   Dispatch  │  │   Dispatch  │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
│         └────────────────┼────────────────┘                      │
│                          ▼                                       │
│         ┌────────────────────────────────┐                       │
│         │   EMERGENCY ROUTING SYSTEM     │                       │
│         │      (This Project)            │                       │
│         └────────────────────────────────┘                       │
│                          │                                       │
│         ┌────────────────┼────────────────┐                      │
│         ▼                ▼                ▼                      │
│   ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│   │ Vehicle 1│    │ Vehicle 2│    │ Vehicle N│                  │
│   └──────────┘    └──────────┘    └──────────┘                  │
│                                                                  │
│                    ROAD NETWORK                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Simulation Context

Since this is an academic project, real-world components are replaced with simulations:

| Real World Component | Simulation Replacement |
|---------------------|------------------------|
| GPS devices on vehicles | `VehicleSimulator` service emitting position updates |
| Traffic sensors | Randomized/scripted edge weights on road graph |
| Dispatch radio systems | Web-based dispatch console |
| Physical road network | GeoJSON file (synthetic or OSM extract) |
| Vehicle movement | Interpolated position along path geometry |

---

## 3. Architecture Overview

### 3.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              PRESENTATION LAYER                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────┐   │
│  │  Dispatch Console │  │  Map Visualizer  │  │  Admin/Monitoring Panel  │   │
│  │  (per org type)   │  │  (real-time)     │  │  (audit logs, metrics)   │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────────┬─────────────┘   │
└───────────┼─────────────────────┼─────────────────────────┼─────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               API GATEWAY                                    │
│                     (REST/WebSocket - Node.js or Python)                     │
│                                                                              │
│  Endpoints:                                                                  │
│  • POST /missions          - Create new mission                             │
│  • GET  /missions/:id      - Get mission status                             │
│  • POST /vehicles          - Register vehicle                               │
│  • GET  /segments/:id      - Get segment reservation status                 │
│  • WS   /live              - Real-time updates                              │
└─────────────────────────────────────────────────────────────────────────────┘
            │                     │                         │
            ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            APPLICATION LAYER                                 │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │ Routing Service │  │ Reservation     │  │    Vehicle Simulator        │  │
│  │                 │  │ Service         │  │                             │  │
│  │ • Path finding  │  │ • Fast-path     │  │ • Spawn vehicles            │  │
│  │ • Constraint    │  │   protocol      │  │ • Emit GPS updates          │  │
│  │   handling      │  │ • Conflict      │  │ • Simulate movement         │  │
│  │ • Weight calc   │  │   detection     │  │ • Handle deviations         │  │
│  └────────┬────────┘  └────────┬────────┘  └─────────────┬───────────────┘  │
│           │                    │                         │                   │
│  ┌────────┴────────────────────┴─────────────────────────┴───────────────┐  │
│  │                     Off-Chain State Manager                            │  │
│  │                                                                        │  │
│  │  PostgreSQL + PostGIS          Redis                                   │  │
│  │  ├── Road graph (nodes/edges)  ├── Vehicle positions cache            │  │
│  │  ├── Geometry data             ├── Active reservations cache          │  │
│  │  └── Historical analytics      └── Pub/Sub for real-time events       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BLOCKCHAIN LAYER                                   │
│                        (Hyperledger Fabric 2.5)                              │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Channel: smartcity-routing                          │  │
│  │                                                                        │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐  │  │
│  │  │ OrgMedical  │ │  OrgFire    │ │  OrgPolice  │ │OrgInfrastructure│  │  │
│  │  │             │ │             │ │             │ │                 │  │  │
│  │  │ peer0.med   │ │ peer0.fire  │ │peer0.police │ │  peer0.infra    │  │  │
│  │  │ [CouchDB]   │ │ [CouchDB]   │ │ [CouchDB]   │ │   [CouchDB]     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────┘  │  │
│  │                                                                        │  │
│  │  ┌──────────────────────────────────────────────────────────────────┐ │  │
│  │  │                     Smart Contracts (Chaincode)                   │ │  │
│  │  │                                                                   │ │  │
│  │  │  ┌──────────────┐ ┌───────────────────┐ ┌──────────────────┐    │ │  │
│  │  │  │VehicleContract│ │ReservationContract│ │ MissionContract  │    │ │  │
│  │  │  └──────────────┘ └───────────────────┘ └──────────────────┘    │ │  │
│  │  │                                                                   │ │  │
│  │  │  ┌──────────────┐ ┌───────────────────┐ ┌──────────────────┐    │ │  │
│  │  │  │ConflictContract│ │  AuditContract   │ │  MapContract     │    │ │  │
│  │  │  └──────────────┘ └───────────────────┘ └──────────────────┘    │ │  │
│  │  └──────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Ordering Service (Raft)                        │   │
│  │           orderer0          orderer1          orderer2                │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Layer Responsibilities

| Layer | Responsibility | Latency Requirement |
|-------|---------------|---------------------|
| **Presentation** | User interaction, visualization | < 100ms UI response |
| **API Gateway** | Request routing, authentication, WebSocket management | < 50ms |
| **Application** | Business logic, routing algorithms, simulation | < 200ms for route calc |
| **Off-Chain State** | High-frequency data, caching, spatial queries | < 10ms cache hits |
| **Blockchain** | Authoritative state, audit trail, conflict resolution | < 2s transaction commit |

### 3.3 On-Chain vs Off-Chain Decision Matrix

| Data/Operation | Location | Justification |
|----------------|----------|---------------|
| Vehicle registration | **On-chain** | Identity must be immutable and verifiable |
| Mission creation/completion | **On-chain** | Audit trail required |
| Segment reservations | **On-chain** | Authoritative state for conflict resolution |
| GPS telemetry (continuous) | **Off-chain** | Too high frequency (1-10 Hz) |
| Route calculation | **Off-chain** | Computationally intensive |
| Real-time vehicle positions | **Off-chain** | High update frequency |
| Road graph data | **Off-chain** | Large dataset, hash stored on-chain |
| Traffic weights | **Off-chain** | Frequently changing |
| Conflict resolution decisions | **On-chain** | Must be auditable |
| Audit events | **On-chain** | Immutability required |

---

## 4. Component Details

### 4.1 Presentation Layer

#### 4.1.1 Dispatch Console

**Purpose**: Interface for dispatchers to create and monitor emergency missions.

**Features**:
- Create new mission (select vehicle, set destination)
- View all active missions for organization
- Monitor vehicle progress in real-time
- Receive alerts on conflicts or delays
- View mission history and audit logs

**Per-Organization Views**:
- Each organization sees only their vehicles by default
- Shared view of reserved road segments
- Cross-org missions visible when in conflict

#### 4.1.2 Map Visualizer

**Purpose**: Real-time visualization of the road network, vehicles, and reservations.

**Features**:
- Interactive map with road network overlay
- Color-coded segment status:
  - 🟢 Green: Available
  - 🟡 Yellow: Reserved (with org indicator)
  - 🔴 Red: Occupied by active vehicle
- Vehicle markers with:
  - Type icon (ambulance, fire truck, etc.)
  - Direction of travel
  - Current speed
  - Mission info on hover
- Route visualization for active missions
- Real-time position updates via WebSocket

#### 4.1.3 Admin/Monitoring Panel

**Purpose**: System administration and observability.

**Features**:
- System health dashboard
- Blockchain transaction metrics
- Audit log viewer with filters
- Vehicle registry management
- Map data management
- Conflict resolution history

### 4.2 API Gateway

**Technology**: Node.js (Express) or Python (FastAPI)

#### REST Endpoints

```yaml
# Vehicle Management
POST   /api/v1/vehicles                 # Register new vehicle
GET    /api/v1/vehicles                 # List vehicles (filtered by org)
GET    /api/v1/vehicles/:vehicleId      # Get vehicle details
PUT    /api/v1/vehicles/:vehicleId      # Update vehicle status

# Mission Management  
POST   /api/v1/missions                 # Create new mission
GET    /api/v1/missions                 # List missions (filtered)
GET    /api/v1/missions/:missionId      # Get mission details
PUT    /api/v1/missions/:missionId      # Update mission (activate/abort)
DELETE /api/v1/missions/:missionId      # Cancel mission

# Routing
POST   /api/v1/routes/calculate         # Calculate optimal route
GET    /api/v1/routes/alternatives      # Get alternative routes

# Segments
GET    /api/v1/segments                 # List segments (with status)
GET    /api/v1/segments/:segmentId      # Get segment details

# Audit
GET    /api/v1/audit                    # Query audit logs

# Simulation Control
POST   /api/v1/simulation/start         # Start vehicle simulation
POST   /api/v1/simulation/stop          # Stop simulation
POST   /api/v1/simulation/scenario      # Load test scenario
```

#### WebSocket Events

```yaml
# Client -> Server
subscribe:vehicles          # Subscribe to vehicle position updates
subscribe:segments          # Subscribe to segment status changes
subscribe:missions:orgType  # Subscribe to mission updates for org

# Server -> Client
vehicle:position            # Vehicle position update
segment:status              # Segment reservation change
mission:created             # New mission created
mission:updated             # Mission status changed
conflict:detected           # Conflict requiring attention
alert:preemption            # Vehicle preempted, needs re-route
```

### 4.3 Application Services

#### 4.3.1 Routing Service

**Purpose**: Calculate optimal paths considering current reservations and traffic.

**Algorithm**: Modified Dijkstra/A* with dynamic edge weights

**Inputs**:
- Origin node ID
- Destination node ID
- Vehicle priority level
- Current segment reservation states
- Traffic weights

**Process**:
```
1. Load road graph from cache (or DB if cache miss)
2. Apply current traffic weights to edges
3. Mark reserved segments:
   - If reserved by lower priority: apply moderate penalty
   - If reserved by same/higher priority: apply high penalty or exclude
4. Run shortest path algorithm
5. Return ordered list of segment IDs with ETA
```

**Outputs**:
- Ordered list of segment IDs
- Total distance (meters)
- Estimated travel time
- List of potential conflicts

#### 4.3.2 Reservation Service

**Purpose**: Handle segment reservation requests with conflict detection.

**Fast-Path Protocol**:
```
1. Receive reservation request (missionId, path[], priority)
2. Acquire local locks on all segments
3. Check for conflicts:
   a. No conflict → proceed to blockchain commit
   b. Lower priority conflict → trigger preemption
   c. Same/higher priority conflict → negotiate or fail
4. Submit transaction to Fabric
5. On success: update cache, notify subscribers
6. On failure: release locks, return error
```

#### 4.3.3 Progression Service

**Purpose**: Track vehicle movement and detect state transitions.

**Responsibilities**:
- Receive GPS updates from Vehicle Simulator
- Map-match coordinates to road segments
- Detect segment entry/exit events
- Trigger on-chain state updates for transitions
- Detect route deviations
- Calculate ETA updates

**Map-Matching Algorithm**:
```
1. Receive GPS point (lat, lon, timestamp)
2. Query nearby segments (within radius R)
3. For each candidate segment:
   a. Calculate perpendicular distance to segment geometry
   b. Calculate heading alignment
   c. Score = f(distance, heading_diff, prev_segment)
4. Select highest scoring segment
5. Calculate progress along segment (0-100%)
6. If segment changed from previous: emit transition event
```

#### 4.3.4 Vehicle Simulator

**Purpose**: Simulate vehicle movement for testing and demonstration.

**Features**:
- Spawn vehicles with configurable parameters
- Move vehicles along assigned paths
- Configurable speed (default, emergency)
- Emit position updates at configurable frequency
- Simulate delays and deviations
- Support for scripted scenarios

**Vehicle State Machine**:
```
         ┌──────────┐
         │  IDLE    │
         └────┬─────┘
              │ assignMission()
              ▼
         ┌──────────┐
         │ EN_ROUTE │◄──────────┐
         └────┬─────┘           │
              │ arrive()        │ reroute()
              ▼                 │
         ┌──────────┐           │
         │ ON_SCENE │           │
         └────┬─────┘           │
              │ complete()      │
              ▼                 │
         ┌──────────┐           │
         │RETURNING │───────────┘
         └────┬─────┘
              │ arrive()
              ▼
         ┌──────────┐
         │  IDLE    │
         └──────────┘
```

### 4.4 Off-Chain State Manager

#### 4.4.1 PostgreSQL + PostGIS

**Schema**:

```sql
-- Nodes (intersections, endpoints)
CREATE TABLE nodes (
    node_id VARCHAR(50) PRIMARY KEY,
    lat DOUBLE PRECISION NOT NULL,
    lon DOUBLE PRECISION NOT NULL,
    geom GEOMETRY(Point, 4326),
    node_type VARCHAR(20), -- 'intersection', 'endpoint', 'poi'
    metadata JSONB
);

-- Edges (road segments)
CREATE TABLE segments (
    segment_id VARCHAR(50) PRIMARY KEY,
    from_node VARCHAR(50) REFERENCES nodes(node_id),
    to_node VARCHAR(50) REFERENCES nodes(node_id),
    length_meters DOUBLE PRECISION,
    base_weight DOUBLE PRECISION, -- base travel time in seconds
    current_weight DOUBLE PRECISION, -- with traffic
    geom GEOMETRY(LineString, 4326),
    road_type VARCHAR(30),
    lanes INTEGER,
    speed_limit INTEGER,
    is_bidirectional BOOLEAN DEFAULT true,
    metadata JSONB
);

-- Spatial indexes
CREATE INDEX idx_nodes_geom ON nodes USING GIST(geom);
CREATE INDEX idx_segments_geom ON segments USING GIST(geom);

-- Map snapshots (for integrity verification)
CREATE TABLE map_snapshots (
    snapshot_id VARCHAR(50) PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    node_count INTEGER,
    segment_count INTEGER,
    hash VARCHAR(64), -- SHA-256 of map data
    blockchain_tx_id VARCHAR(100)
);
```

#### 4.4.2 Redis

**Key Patterns**:

```
# Vehicle positions (updated frequently)
vehicle:position:{vehicleId} = {
    lat, lon, heading, speed, 
    currentSegment, progress, 
    timestamp
}
TTL: 60 seconds (auto-cleanup if no updates)

# Segment reservation cache (mirrors on-chain)
segment:status:{segmentId} = {
    status: "free" | "reserved" | "occupied",
    missionId, vehicleId, priority,
    reservedAt, expiresAt
}

# Active missions cache
mission:active:{missionId} = {
    vehicleId, orgType, priority,
    path: [segmentIds],
    currentSegmentIndex,
    status
}

# Pub/Sub channels
channel:vehicles      # Position updates
channel:segments      # Reservation changes  
channel:missions      # Mission state changes
channel:alerts        # Conflicts, preemptions
```

---

## 5. Data Models

### 5.1 On-Chain Data Models

#### 5.1.1 Vehicle

```go
type Vehicle struct {
    VehicleID     string    `json:"vehicleId"`
    OrgType       string    `json:"orgType"`       // "medical", "fire", "police", "infrastructure"
    VehicleType   string    `json:"vehicleType"`   // "ambulance", "ladder_truck", etc.
    PriorityLevel int       `json:"priorityLevel"` // 1 (highest) to 5 (lowest)
    LicensePlate  string    `json:"licensePlate"`
    RegisteredBy  string    `json:"registeredBy"`  // MSP identity
    RegisteredAt  int64     `json:"registeredAt"`  // Unix timestamp
    Status        string    `json:"status"`        // "active", "inactive", "maintenance"
}
```

#### 5.1.2 Mission

```go
type Mission struct {
    MissionID      string      `json:"missionId"`
    VehicleID      string      `json:"vehicleId"`
    OrgType        string      `json:"orgType"`
    PriorityLevel  int         `json:"priorityLevel"`
    Origin         Location    `json:"origin"`
    Destination    Location    `json:"destination"`
    ReservedPath   []string    `json:"reservedPath"`   // Array of segment IDs
    Status         string      `json:"status"`         // "pending", "active", "completed", "aborted"
    CreatedAt      int64       `json:"createdAt"`
    ActivatedAt    int64       `json:"activatedAt"`
    CompletedAt    int64       `json:"completedAt"`
    CreatedBy      string      `json:"createdBy"`      // Dispatcher identity
}

type Location struct {
    NodeID    string  `json:"nodeId"`
    Lat       float64 `json:"lat"`
    Lon       float64 `json:"lon"`
    Name      string  `json:"name,omitempty"` // e.g., "City Hospital"
}
```

#### 5.1.3 SegmentReservation

```go
type SegmentReservation struct {
    SegmentID     string `json:"segmentId"`
    MissionID     string `json:"missionId"`
    VehicleID     string `json:"vehicleId"`
    OrgType       string `json:"orgType"`
    PriorityLevel int    `json:"priorityLevel"`
    Status        string `json:"status"`      // "reserved", "occupied", "released"
    ReservedAt    int64  `json:"reservedAt"`
    ExpiresAt     int64  `json:"expiresAt"`   // TTL for safety
    EnteredAt     int64  `json:"enteredAt"`   // When vehicle entered segment
    ExitedAt      int64  `json:"exitedAt"`    // When vehicle exited segment
}
```

#### 5.1.4 AuditEvent

```go
type AuditEvent struct {
    EventID     string                 `json:"eventId"`
    EventType   string                 `json:"eventType"`
    Timestamp   int64                  `json:"timestamp"`
    OrgID       string                 `json:"orgId"`
    ActorID     string                 `json:"actorId"`
    MissionID   string                 `json:"missionId,omitempty"`
    VehicleID   string                 `json:"vehicleId,omitempty"`
    SegmentID   string                 `json:"segmentId,omitempty"`
    Details     map[string]interface{} `json:"details"`
    TxID        string                 `json:"txId"`
}

// Event Types
const (
    EVENT_VEHICLE_REGISTERED    = "VEHICLE_REGISTERED"
    EVENT_MISSION_CREATED       = "MISSION_CREATED"
    EVENT_MISSION_ACTIVATED     = "MISSION_ACTIVATED"
    EVENT_MISSION_COMPLETED     = "MISSION_COMPLETED"
    EVENT_MISSION_ABORTED       = "MISSION_ABORTED"
    EVENT_SEGMENT_RESERVED      = "SEGMENT_RESERVED"
    EVENT_SEGMENT_ENTERED       = "SEGMENT_ENTERED"
    EVENT_SEGMENT_EXITED        = "SEGMENT_EXITED"
    EVENT_CONFLICT_DETECTED     = "CONFLICT_DETECTED"
    EVENT_CONFLICT_RESOLVED     = "CONFLICT_RESOLVED"
    EVENT_PREEMPTION_TRIGGERED  = "PREEMPTION_TRIGGERED"
    EVENT_ROUTE_DEVIATION       = "ROUTE_DEVIATION"
)
```

#### 5.1.5 MapSnapshot

```go
type MapSnapshot struct {
    SnapshotID   string `json:"snapshotId"`
    Hash         string `json:"hash"`          // SHA-256 of map data
    NodeCount    int    `json:"nodeCount"`
    SegmentCount int    `json:"segmentCount"`
    CreatedAt    int64  `json:"createdAt"`
    CreatedBy    string `json:"createdBy"`
}
```

### 5.2 Composite Keys for CouchDB

```go
// Key patterns for efficient queries

// Vehicles by organization
"vehicle~{orgType}~{vehicleId}"

// Missions by status
"mission~{status}~{missionId}"

// Missions by vehicle
"mission~vehicle~{vehicleId}~{missionId}"

// Reservations by segment
"reservation~{segmentId}"

// Reservations by mission
"reservation~mission~{missionId}~{segmentId}"

// Audit events by time
"audit~{timestamp}~{eventId}"

// Audit events by mission
"audit~mission~{missionId}~{timestamp}~{eventId}"
```

---

## 6. Smart Contract Design

### 6.1 Contract Organization

```
chaincode/routing/
├── main.go                 # Entry point, contract registration
├── contracts/
│   ├── vehicle.go          # Vehicle registration and management
│   ├── mission.go          # Mission lifecycle management
│   ├── reservation.go      # Segment reservation logic
│   ├── conflict.go         # Conflict detection and resolution
│   ├── audit.go            # Audit event logging
│   └── map.go              # Map snapshot registry
├── models/
│   └── models.go           # Data structures
└── utils/
    ├── access.go           # Access control helpers
    └── validation.go       # Input validation
```

### 6.2 Contract Functions

#### 6.2.1 VehicleContract

```go
// RegisterVehicle - Register a new emergency vehicle
// Access: Only dispatchers of the same org type
func (c *VehicleContract) RegisterVehicle(
    ctx contractapi.TransactionContextInterface,
    vehicleID string,
    orgType string,
    vehicleType string,
    priorityLevel int,
    licensePlate string,
) error

// UpdateVehicleStatus - Change vehicle operational status
// Access: Only owning organization
func (c *VehicleContract) UpdateVehicleStatus(
    ctx contractapi.TransactionContextInterface,
    vehicleID string,
    status string,
) error

// GetVehicle - Retrieve vehicle details
// Access: Any authenticated user
func (c *VehicleContract) GetVehicle(
    ctx contractapi.TransactionContextInterface,
    vehicleID string,
) (*Vehicle, error)

// GetVehiclesByOrg - List vehicles for an organization
// Access: Any authenticated user
func (c *VehicleContract) GetVehiclesByOrg(
    ctx contractapi.TransactionContextInterface,
    orgType string,
) ([]*Vehicle, error)
```

#### 6.2.2 MissionContract

```go
// CreateMission - Create a new emergency mission
// Access: Dispatchers of the vehicle's organization
func (c *MissionContract) CreateMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
    vehicleID string,
    originNodeID string,
    originLat float64,
    originLon float64,
    destNodeID string,
    destLat float64,
    destLon float64,
    destName string,
) error

// ActivateMission - Activate mission and reserve path
// Access: Dispatchers of the vehicle's organization
func (c *MissionContract) ActivateMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
    reservedPath []string, // Segment IDs
    ttlSeconds int64,
) error

// CompleteMission - Mark mission as completed
// Access: System or dispatcher
func (c *MissionContract) CompleteMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
) error

// AbortMission - Abort mission and release segments
// Access: Dispatcher or system (on timeout/conflict)
func (c *MissionContract) AbortMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
    reason string,
) error

// GetMission - Get mission details
func (c *MissionContract) GetMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
) (*Mission, error)

// GetActiveMissions - List all active missions
func (c *MissionContract) GetActiveMissions(
    ctx contractapi.TransactionContextInterface,
) ([]*Mission, error)
```

#### 6.2.3 ReservationContract

```go
// ReserveSegment - Reserve a road segment for a mission
// Called internally by ActivateMission
func (c *ReservationContract) ReserveSegment(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
    missionID string,
    vehicleID string,
    orgType string,
    priorityLevel int,
    ttlSeconds int64,
) (*ConflictResult, error)

// EnterSegment - Record vehicle entering a segment
// Access: Progression service
func (c *ReservationContract) EnterSegment(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
    missionID string,
) error

// ExitSegment - Record vehicle exiting a segment
// Access: Progression service
func (c *ReservationContract) ExitSegment(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
    missionID string,
) error

// ReleaseSegment - Release a segment reservation
func (c *ReservationContract) ReleaseSegment(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
    missionID string,
) error

// GetSegmentStatus - Get current reservation status
func (c *ReservationContract) GetSegmentStatus(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
) (*SegmentReservation, error)

// GetActiveReservations - List all active reservations
func (c *ReservationContract) GetActiveReservations(
    ctx contractapi.TransactionContextInterface,
) ([]*SegmentReservation, error)
```

#### 6.2.4 ConflictContract

```go
type ConflictResult struct {
    HasConflict       bool   `json:"hasConflict"`
    Resolution        string `json:"resolution"` // "granted", "preempted", "denied"
    PreemptedMission  string `json:"preemptedMission,omitempty"`
    Message           string `json:"message"`
}

// ResolveConflict - Handle reservation conflict
// Returns: resolution decision
func (c *ConflictContract) ResolveConflict(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
    newMissionID string,
    newPriority int,
    existingMissionID string,
    existingPriority int,
) (*ConflictResult, error)

// Priority Rules:
// 1. Lower number = higher priority (1 is highest)
// 2. If newPriority < existingPriority: preempt existing
// 3. If newPriority == existingPriority: first-come-first-served
// 4. If newPriority > existingPriority: deny new request

// GetConflictHistory - Retrieve conflict resolution history
func (c *ConflictContract) GetConflictHistory(
    ctx contractapi.TransactionContextInterface,
    segmentID string,
) ([]*AuditEvent, error)
```

#### 6.2.5 AuditContract

```go
// LogEvent - Record an audit event
// Called internally by other contracts
func (c *AuditContract) LogEvent(
    ctx contractapi.TransactionContextInterface,
    eventType string,
    missionID string,
    vehicleID string,
    segmentID string,
    details map[string]interface{},
) error

// QueryEvents - Query audit events with filters
func (c *AuditContract) QueryEvents(
    ctx contractapi.TransactionContextInterface,
    queryJSON string, // CouchDB query
) ([]*AuditEvent, error)

// GetEventsByMission - Get all events for a mission
func (c *AuditContract) GetEventsByMission(
    ctx contractapi.TransactionContextInterface,
    missionID string,
) ([]*AuditEvent, error)
```

#### 6.2.6 MapContract

```go
// RegisterMapSnapshot - Store map integrity hash
// Access: Authorized infrastructure managers
func (c *MapContract) RegisterMapSnapshot(
    ctx contractapi.TransactionContextInterface,
    snapshotID string,
    hash string,
    nodeCount int,
    segmentCount int,
) error

// GetMapSnapshot - Retrieve map snapshot info
func (c *MapContract) GetMapSnapshot(
    ctx contractapi.TransactionContextInterface,
    snapshotID string,
) (*MapSnapshot, error)

// GetLatestMapSnapshot - Get most recent map version
func (c *MapContract) GetLatestMapSnapshot(
    ctx contractapi.TransactionContextInterface,
) (*MapSnapshot, error)
```

### 6.3 Access Control Implementation

```go
// utils/access.go

// GetCallerOrg - Extract organization from caller's MSP
func GetCallerOrg(ctx contractapi.TransactionContextInterface) (string, error) {
    mspID, err := ctx.GetClientIdentity().GetMSPID()
    if err != nil {
        return "", err
    }
    // Map MSP ID to org type
    // e.g., "MedicalMSP" -> "medical"
    return mapMSPToOrgType(mspID), nil
}

// GetCallerRole - Extract role attribute from certificate
func GetCallerRole(ctx contractapi.TransactionContextInterface) (string, error) {
    role, found, err := ctx.GetClientIdentity().GetAttributeValue("role")
    if err != nil || !found {
        return "user", nil // default role
    }
    return role, nil
}

// RequireDispatcher - Ensure caller has dispatcher role
func RequireDispatcher(ctx contractapi.TransactionContextInterface) error {
    role, err := GetCallerRole(ctx)
    if err != nil {
        return err
    }
    if role != "dispatcher" && role != "admin" {
        return fmt.Errorf("access denied: dispatcher role required")
    }
    return nil
}

// RequireSameOrg - Ensure caller belongs to specified org
func RequireSameOrg(ctx contractapi.TransactionContextInterface, targetOrg string) error {
    callerOrg, err := GetCallerOrg(ctx)
    if err != nil {
        return err
    }
    if callerOrg != targetOrg {
        return fmt.Errorf("access denied: operation restricted to %s organization", targetOrg)
    }
    return nil
}
```

---

## 7. Key Flows

### 7.1 Mission Creation & Route Reservation

```
┌──────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐     ┌────────────┐
│ Dispatch │     │    API    │     │   Routing    │     │  Off-Chain │     │ Blockchain │
│ Console  │     │  Gateway  │     │   Service    │     │   Cache    │     │  (Fabric)  │
└────┬─────┘     └─────┬─────┘     └──────┬───────┘     └──────┬─────┘     └──────┬─────┘
     │                 │                  │                    │                  │
     │ 1. POST /missions                  │                    │                  │
     │ {vehicleId, origin, destination}   │                    │                  │
     │────────────────>│                  │                    │                  │
     │                 │                  │                    │                  │
     │                 │ 2. Validate vehicle (check active)    │                  │
     │                 │──────────────────────────────────────────────────────────>│
     │                 │<──────────────────────────────────────────────────────────│
     │                 │                  │                    │                  │
     │                 │ 3. POST /routes/calculate             │                  │
     │                 │ {origin, dest, priority}              │                  │
     │                 │─────────────────>│                    │                  │
     │                 │                  │                    │                  │
     │                 │                  │ 4. Load road graph │                  │
     │                 │                  │───────────────────>│                  │
     │                 │                  │<───────────────────│                  │
     │                 │                  │                    │                  │
     │                 │                  │ 5. Get current segment states         │
     │                 │                  │───────────────────>│                  │
     │                 │                  │<───────────────────│                  │
     │                 │                  │                    │                  │
     │                 │                  │ 6. Calculate path  │                  │
     │                 │                  │    (Dijkstra/A*)   │                  │
     │                 │                  │                    │                  │
     │                 │ 7. Return {path: [segments], eta}     │                  │
     │                 │<─────────────────│                    │                  │
     │                 │                  │                    │                  │
     │                 │ 8. CreateMission(missionId, vehicleId, origin, dest)     │
     │                 │──────────────────────────────────────────────────────────>│
     │                 │                  │                    │                  │
     │                 │                  │                    │ 9. Validate      │
     │                 │                  │                    │    Store mission │
     │                 │                  │                    │    status=pending│
     │                 │                  │                    │                  │
     │                 │ 10. ActivateMission(missionId, path[], ttl)              │
     │                 │──────────────────────────────────────────────────────────>│
     │                 │                  │                    │                  │
     │                 │                  │                    │ 11. For each     │
     │                 │                  │                    │     segment:     │
     │                 │                  │                    │   - Check conflict│
     │                 │                  │                    │   - Reserve      │
     │                 │                  │                    │   - Log audit    │
     │                 │                  │                    │                  │
     │                 │ 12. Mission confirmed {path, eta}     │                  │
     │                 │<──────────────────────────────────────────────────────────│
     │                 │                  │                    │                  │
     │                 │ 13. Update cache (segments, mission)  │                  │
     │                 │─────────────────────────────────────>│                  │
     │                 │                  │                    │                  │
     │                 │ 14. Broadcast via WebSocket           │                  │
     │                 │─────────────────────────────────────>│                  │
     │                 │                  │                    │                  │
     │ 15. 201 Created │                  │                    │                  │
     │ {mission, path} │                  │                    │                  │
     │<────────────────│                  │                    │                  │
     │                 │                  │                    │                  │
```

### 7.2 Vehicle Movement & Segment Transitions

```
┌───────────────┐     ┌───────────┐     ┌──────────────┐     ┌────────────┐     ┌────────────┐
│   Vehicle     │     │    API    │     │ Progression  │     │  Off-Chain │     │ Blockchain │
│  Simulator    │     │  Gateway  │     │   Service    │     │   Cache    │     │  (Fabric)  │
└───────┬───────┘     └─────┬─────┘     └──────┬───────┘     └──────┬─────┘     └──────┬─────┘
        │                   │                  │                    │                  │
        │ 1. Position Update                   │                    │                  │
        │ {vehicleId, lat, lon, ts, heading}   │                    │                  │
        │──────────────────>│                  │                    │                  │
        │                   │                  │                    │                  │
        │                   │ 2. Forward to progression             │                  │
        │                   │─────────────────>│                    │                  │
        │                   │                  │                    │                  │
        │                   │                  │ 3. Get vehicle's   │                  │
        │                   │                  │    active mission  │                  │
        │                   │                  │───────────────────>│                  │
        │                   │                  │<───────────────────│                  │
        │                   │                  │                    │                  │
        │                   │                  │ 4. Map-match:      │                  │
        │                   │                  │    Find segment    │                  │
        │                   │                  │    containing point│                  │
        │                   │                  │───────────────────>│                  │
        │                   │                  │<───────────────────│                  │
        │                   │                  │                    │                  │
        │                   │                  │ 5. Compare with    │                  │
        │                   │                  │    previous segment│                  │
        │                   │                  │                    │                  │
        │                   │                  │ [IF SEGMENT CHANGED]                  │
        │                   │                  │                    │                  │
        │                   │                  │ 6. EnterSegment(newSegId, missionId)  │
        │                   │                  │───────────────────────────────────────>│
        │                   │                  │                    │                  │
        │                   │                  │ 7. ExitSegment(prevSegId, missionId)  │
        │                   │                  │───────────────────────────────────────>│
        │                   │                  │                    │                  │
        │                   │                  │<───────────────────────────────────────│
        │                   │                  │                    │                  │
        │                   │                  │ 8. Update position cache              │
        │                   │                  │───────────────────>│                  │
        │                   │                  │                    │                  │
        │                   │ 9. Broadcast position update          │                  │
        │                   │<─────────────────│                    │                  │
        │                   │                  │                    │                  │
        │                   │ 10. WS: vehicle:position              │                  │
        │                   │──────────────────────────────────────>│ (to subscribers) │
        │                   │                  │                    │                  │
        │                   │                  │ [IF AT DESTINATION]│                  │
        │                   │                  │                    │                  │
        │                   │                  │ 11. CompleteMission(missionId)        │
        │                   │                  │───────────────────────────────────────>│
        │                   │                  │                    │                  │
```

### 7.3 Conflict Resolution (Preemption)

```
┌──────────────┐     ┌────────────┐     ┌──────────────┐     ┌────────────┐
│ New Mission  │     │ Blockchain │     │  Existing    │     │  Routing   │
│ (Priority 1) │     │ Chaincode  │     │  Mission     │     │  Service   │
│              │     │            │     │ (Priority 3) │     │            │
└──────┬───────┘     └──────┬─────┘     └──────┬───────┘     └──────┬─────┘
       │                    │                  │                    │
       │ 1. ActivateMission │                  │                    │
       │ (path includes     │                  │                    │
       │  segment X)        │                  │                    │
       │───────────────────>│                  │                    │
       │                    │                  │                    │
       │                    │ 2. ReserveSegment(X)                  │
       │                    │    Check existing reservation         │
       │                    │                  │                    │
       │                    │ 3. Conflict detected!                 │
       │                    │    Segment X held by                  │
       │                    │    Mission B (priority=3)             │
       │                    │                  │                    │
       │                    │ 4. ResolveConflict:                   │
       │                    │    Priority 1 < 3                     │
       │                    │    → PREEMPT existing                 │
       │                    │                  │                    │
       │                    │ 5. Release segment X                  │
       │                    │    from Mission B  │                  │
       │                    │─────────────────>│                    │
       │                    │                  │                    │
       │                    │ 6. Log PREEMPTION_TRIGGERED           │
       │                    │                  │                    │
       │                    │ 7. Reserve segment X                  │
       │                    │    for Mission A (new)                │
       │                    │                  │                    │
       │ 8. Reservation     │                  │                    │
       │    confirmed       │                  │                    │
       │<───────────────────│                  │                    │
       │                    │                  │                    │
       │                    │ 9. Emit event:   │                    │
       │                    │    PREEMPTION    │                    │
       │                    │─────────────────>│                    │
       │                    │                  │                    │
       │                    │                  │ 10. Receive event  │
       │                    │                  │     Must re-route! │
       │                    │                  │                    │
       │                    │                  │ 11. Request new path
       │                    │                  │ (excluding X)      │
       │                    │                  │───────────────────>│
       │                    │                  │                    │
       │                    │                  │ 12. Return alt path│
       │                    │                  │<───────────────────│
       │                    │                  │                    │
       │                    │                  │ 13. UpdateMission  │
       │                    │                  │     with new path  │
       │                    │                  │───────────────────>│
       │                    │                  │                    │
```

---

## 8. Technology Stack

### 8.1 Summary Table

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Blockchain** | Hyperledger Fabric | 2.5.x | Distributed ledger |
| **Chaincode** | Go | 1.21+ | Smart contracts |
| **State DB** | CouchDB | 3.x | Rich queries on world state |
| **Ordering** | Raft | - | Consensus |
| **Backend API** | Node.js + Express | 18+ | REST/WebSocket API |
| **Fabric SDK** | fabric-gateway | 1.4+ | Blockchain interaction |
| **Off-chain DB** | PostgreSQL + PostGIS | 15+ | Road graph, spatial queries |
| **Cache** | Redis | 7+ | Fast state, pub/sub |
| **Routing Engine** | pgRouting or NetworkX | - | Path calculation |
| **Frontend** | React | 18+ | UI framework |
| **Mapping** | Leaflet or MapLibre GL | - | Map visualization |
| **Containerization** | Docker + Docker Compose | - | Deployment |
| **Language (Backend)** | TypeScript | 5+ | Type safety |

### 8.2 Fabric Network Configuration

```yaml
# Organizations
Organizations:
  - Name: OrgMedical
    MSPID: MedicalMSP
    Peers: 1
    Users: [admin, dispatcher1]
    
  - Name: OrgFire
    MSPID: FireMSP
    Peers: 1
    Users: [admin, dispatcher1]
    
  - Name: OrgPolice
    MSPID: PoliceMSP
    Peers: 1
    Users: [admin, dispatcher1]
    
  - Name: OrgInfrastructure
    MSPID: InfraMSP
    Peers: 1
    Users: [admin, dispatcher1]

# Orderers (Raft)
Orderers:
  - orderer0.emergency.net
  - orderer1.emergency.net
  - orderer2.emergency.net

# Channel
Channel:
  Name: smartcity-routing
  
# Chaincode
Chaincode:
  Name: routing
  Language: golang
  Version: 1.0
  EndorsementPolicy: "OR('MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer', 'InfraMSP.peer')"
```

---

## 9. Project Structure

```
emergency-routing-system/
│
├── blockchain/                          # Hyperledger Fabric network
│   ├── network/
│   │   ├── docker/
│   │   │   ├── docker-compose-ca.yaml   # Certificate Authorities
│   │   │   ├── docker-compose-net.yaml  # Peers, Orderers, CouchDB
│   │   │   └── docker-compose-cli.yaml  # CLI container
│   │   ├── configtx/
│   │   │   └── configtx.yaml            # Channel configuration
│   │   ├── organizations/
│   │   │   └── cryptogen/
│   │   │       └── crypto-config.yaml   # Crypto material config
│   │   └── scripts/
│   │       ├── network.sh               # Network lifecycle
│   │       ├── createChannel.sh         # Channel creation
│   │       └── deployCC.sh              # Chaincode deployment
│   │
│   └── chaincode/
│       └── routing/
│           ├── go.mod
│           ├── go.sum
│           ├── main.go                  # Entry point
│           ├── contracts/
│           │   ├── vehicle.go
│           │   ├── mission.go
│           │   ├── reservation.go
│           │   ├── conflict.go
│           │   ├── audit.go
│           │   └── map.go
│           ├── models/
│           │   └── models.go
│           └── utils/
│               ├── access.go
│               └── validation.go
│
├── backend/                             # Node.js API server
│   ├── src/
│   │   ├── index.ts                     # Entry point
│   │   ├── config/
│   │   │   ├── fabric.ts                # Fabric connection config
│   │   │   ├── database.ts              # PostgreSQL config
│   │   │   └── redis.ts                 # Redis config
│   │   ├── api/
│   │   │   ├── routes/
│   │   │   │   ├── vehicles.ts
│   │   │   │   ├── missions.ts
│   │   │   │   ├── segments.ts
│   │   │   │   ├── routes.ts
│   │   │   │   ├── audit.ts
│   │   │   │   └── simulation.ts
│   │   │   ├── controllers/
│   │   │   │   └── ...
│   │   │   └── middleware/
│   │   │       ├── auth.ts
│   │   │       └── errorHandler.ts
│   │   ├── services/
│   │   │   ├── fabric/
│   │   │   │   ├── gateway.ts           # Fabric Gateway connection
│   │   │   │   ├── vehicle.service.ts
│   │   │   │   ├── mission.service.ts
│   │   │   │   └── reservation.service.ts
│   │   │   ├── routing/
│   │   │   │   ├── graph.ts             # Road graph operations
│   │   │   │   ├── pathfinder.ts        # Dijkstra/A* implementation
│   │   │   │   └── constraints.ts       # Reservation-aware routing
│   │   │   ├── simulation/
│   │   │   │   ├── vehicleSimulator.ts
│   │   │   │   ├── scenarioRunner.ts
│   │   │   │   └── gpsEmitter.ts
│   │   │   ├── progression/
│   │   │   │   ├── tracker.ts
│   │   │   │   └── mapMatcher.ts
│   │   │   └── realtime/
│   │   │       ├── websocket.ts
│   │   │       └── events.ts
│   │   ├── models/
│   │   │   └── ...
│   │   └── utils/
│   │       └── ...
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── frontend/                            # React application
│   ├── src/
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   ├── components/
│   │   │   ├── Map/
│   │   │   │   ├── MapContainer.tsx
│   │   │   │   ├── VehicleMarker.tsx
│   │   │   │   ├── SegmentLayer.tsx
│   │   │   │   └── RouteOverlay.tsx
│   │   │   ├── Dispatch/
│   │   │   │   ├── DispatchConsole.tsx
│   │   │   │   ├── MissionForm.tsx
│   │   │   │   └── MissionList.tsx
│   │   │   ├── Vehicles/
│   │   │   │   ├── VehicleList.tsx
│   │   │   │   └── VehicleCard.tsx
│   │   │   ├── Audit/
│   │   │   │   └── AuditLog.tsx
│   │   │   └── common/
│   │   │       └── ...
│   │   ├── hooks/
│   │   │   ├── useWebSocket.ts
│   │   │   └── useMissions.ts
│   │   ├── services/
│   │   │   └── api.ts
│   │   ├── store/
│   │   │   └── ...
│   │   └── styles/
│   │       └── ...
│   ├── public/
│   ├── package.json
│   └── Dockerfile
│
├── data/                                # Static data files
│   ├── maps/
│   │   ├── synthetic-grid.geojson       # Simple test map
│   │   └── sample-city.geojson          # Realistic map extract
│   └── scenarios/
│       ├── single-mission.json
│       ├── conflict-resolution.json
│       └── multi-agency.json
│
├── scripts/                             # Utility scripts
│   ├── init-db.sql                      # PostgreSQL schema
│   ├── load-map.py                      # Load GeoJSON to PostGIS
│   ├── generate-crypto.sh               # Generate Fabric crypto
│   └── run-scenario.py                  # Execute test scenario
│
├── docker-compose.yaml                  # Full stack orchestration
├── docker-compose.dev.yaml              # Development overrides
├── .env.example                         # Environment variables template
├── Makefile                             # Common commands
│
└── docs/
    ├── ARCHITECTURE.md                  # This document
    ├── API.md                           # API reference
    ├── SETUP.md                         # Installation guide
    ├── DEMO.md                          # Demo walkthrough
    └── diagrams/
        └── ...
```

---

## 10. Security & Access Control

### 10.1 Authentication & Identity

**Fabric Identity Model**:
- Each organization has its own Certificate Authority (CA)
- Users receive X.509 certificates with embedded attributes
- Certificates include: `orgType`, `role`, `priorityLevel`

**Certificate Attributes**:
```yaml
# Dispatcher certificate
Attributes:
  - name: role
    value: dispatcher
  - name: orgType
    value: medical
  - name: canCreateMission
    value: true

# Vehicle identity certificate  
Attributes:
  - name: role
    value: vehicle
  - name: orgType
    value: fire
  - name: vehicleType
    value: ladder_truck
  - name: priorityLevel
    value: 2
```

### 10.2 Authorization Rules

| Action | Required Role | Additional Constraints |
|--------|--------------|------------------------|
| Register vehicle | dispatcher, admin | Same org only |
| Create mission | dispatcher | Own org vehicles only |
| Activate mission | dispatcher | Own org missions only |
| Enter/Exit segment | system | Valid reservation required |
| View all missions | any authenticated | Own org details, basic info for others |
| View audit logs | admin | Own org by default, cross-org with explicit grant |
| Register map snapshot | infrastructure admin | - |

### 10.3 Endorsement Policies

```go
// Default endorsement: Any single org can endorse
"OR('MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer', 'InfraMSP.peer')"

// Critical operations (conflict resolution): Majority required
"OutOf(2, 'MedicalMSP.peer', 'FireMSP.peer', 'PoliceMSP.peer', 'InfraMSP.peer')"
```

### 10.4 Data Privacy

**Shared Data** (visible to all orgs):
- Segment reservation status (segmentId, status, priority, expiresAt)
- Basic mission info (missionId, orgType, priority, status)
- Audit events (type, timestamp, summary)

**Organization-Private Data** (visible to owning org only):
- Vehicle details (license plate, assigned personnel)
- Mission details (patient info, incident details)
- Internal dispatch notes

**Implementation**: Use Fabric Private Data Collections if needed:
```yaml
Collections:
  - name: MedicalPrivateData
    policy: "OR('MedicalMSP.member')"
    requiredPeerCount: 1
    maxPeerCount: 1
```

---

## 11. Simulation Strategy

### 11.1 Map Options

#### Option A: Synthetic Grid (Recommended for Development)

```
     N1 ──── N2 ──── N3 ──── N4 ──── N5
     │       │       │       │       │
     │       │       │       │       │
     N6 ──── N7 ──── N8 ──── N9 ──── N10
     │       │       │       │       │
     │       │       │       │       │
     N11 ─── N12 ─── N13 ─── N14 ─── N15
     │       │       │       │       │
     │       │       │       │       │
     N16 ─── N17 ─── N18 ─── N19 ─── N20
     │       │       │       │       │
     │       │       │       │       │
     N21 ─── N22 ─── N23 ─── N24 ─── N25

     POIs:
     - Hospital: N1
     - Fire Station: N25
     - Police Station: N13
     - Incident locations: random
```

**Advantages**:
- Predictable for testing
- Easy to visualize conflicts
- Quick to generate

#### Option B: Real Map Extract (For Demo/Presentation)

- Extract small area from OpenStreetMap
- Use tools like `osm2pgsql` or `osmnx`
- ~100-500 nodes, ~200-1000 edges

### 11.2 Vehicle Simulator Behavior

```typescript
interface SimulatorConfig {
  vehicleId: string;
  path: string[];              // Segment IDs to traverse
  speedKmh: number;            // Movement speed
  updateIntervalMs: number;    // GPS emission frequency
  deviationProbability: number; // Chance of random deviation
  delayProbability: number;    // Chance of random delay
}

// Simulation states
enum VehicleSimState {
  IDLE,           // Waiting for mission
  STARTING,       // Preparing to move
  MOVING,         // Traversing segment
  TRANSITIONING,  // Changing segments
  DELAYED,        // Temporary stop
  ARRIVED,        // Reached destination
  DEVIATED        // Off-route (for testing)
}
```

### 11.3 Test Scenarios

#### Scenario 1: Single Mission (Basic)
```json
{
  "name": "single_ambulance",
  "description": "Single ambulance from hospital to incident",
  "vehicles": [
    {"vehicleId": "AMB-001", "orgType": "medical", "priority": 1}
  ],
  "missions": [
    {
      "vehicleId": "AMB-001",
      "origin": "N1",
      "destination": "N19",
      "startDelay": 0
    }
  ]
}
```

#### Scenario 2: Conflict Resolution (Priority Preemption)
```json
{
  "name": "priority_conflict",
  "description": "Ambulance preempts police vehicle",
  "vehicles": [
    {"vehicleId": "AMB-001", "orgType": "medical", "priority": 1},
    {"vehicleId": "POL-001", "orgType": "police", "priority": 3}
  ],
  "missions": [
    {
      "vehicleId": "POL-001",
      "origin": "N21",
      "destination": "N5",
      "startDelay": 0
    },
    {
      "vehicleId": "AMB-001", 
      "origin": "N1",
      "destination": "N25",
      "startDelay": 5000,
      "comment": "Starts 5s later, should preempt POL-001 on shared segments"
    }
  ]
}
```

#### Scenario 3: Multi-Agency Coordination
```json
{
  "name": "multi_agency",
  "description": "Multiple agencies responding to major incident",
  "vehicles": [
    {"vehicleId": "AMB-001", "orgType": "medical", "priority": 1},
    {"vehicleId": "AMB-002", "orgType": "medical", "priority": 1},
    {"vehicleId": "FIRE-001", "orgType": "fire", "priority": 2},
    {"vehicleId": "POL-001", "orgType": "police", "priority": 3}
  ],
  "missions": [
    {"vehicleId": "AMB-001", "origin": "N1", "destination": "N13"},
    {"vehicleId": "AMB-002", "origin": "N5", "destination": "N13"},
    {"vehicleId": "FIRE-001", "origin": "N25", "destination": "N13"},
    {"vehicleId": "POL-001", "origin": "N21", "destination": "N13"}
  ]
}
```

---

## 12. Open Questions

Before implementation, the following decisions need to be finalized:

### 12.1 Map Source
- [ ] **Option A**: Synthetic 5x5 grid (simpler)
- [ ] **Option B**: Real OSM extract (more realistic)
- [ ] **Option C**: Start with synthetic, upgrade to real later

### 12.2 Number of Organizations
- [ ] **Minimal**: 2 orgs (Medical + Police)
- [ ] **Standard**: 4 orgs (Medical, Fire, Police, Infrastructure)

### 12.3 Frontend Priority
- [ ] **Map-first**: Focus on real-time visualization
- [ ] **Console-first**: Focus on dispatch workflow

### 12.4 Chaincode Language
- [ ] **Go**: Better performance, official examples
- [ ] **JavaScript**: Easier for JS-focused team

### 12.5 Simulation Fidelity
- [ ] **Simple**: Discrete segment transitions
- [ ] **Realistic**: Smooth interpolated movement

### 12.6 Priority Conflict Rules
- [ ] Same priority = first-come-first-served
- [ ] Same priority = negotiate (more complex)
- [ ] Define priority tiebreaker: timestamp? mission type?

### 12.7 Segment Reservation TTL
- [ ] Fixed TTL for all reservations (e.g., 5 minutes)
- [ ] Dynamic TTL based on ETA
- [ ] No TTL, manual release only

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Segment** | A single road edge between two nodes (intersections) |
| **Mission** | An emergency dispatch assignment for a vehicle |
| **Reservation** | Exclusive claim on a segment for a specific mission |
| **Preemption** | Higher-priority mission taking over a reserved segment |
| **Fast-path** | Optimistic protocol for quick reservation approval |
| **Map-matching** | Converting GPS coordinates to road network segments |
| **Progression** | Tracking vehicle advancement along its route |
| **TTL** | Time-to-live; automatic expiration of reservations |

---

## Appendix B: References

1. Hyperledger Fabric Documentation: https://hyperledger-fabric.readthedocs.io/
2. Fabric Gateway SDK: https://hyperledger.github.io/fabric-gateway/
3. PostGIS Documentation: https://postgis.net/documentation/
4. Leaflet.js: https://leafletjs.com/
5. OpenStreetMap: https://www.openstreetmap.org/

---

*Document Version: 1.0*  
*Last Updated: December 2024*  
*Authors: [Team Members]*


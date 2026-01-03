package models

// Vehicle represents an emergency vehicle registered in the system
type Vehicle struct {
	DocType       string `json:"docType"`       // "vehicle" - for CouchDB queries
	VehicleID     string `json:"vehicleId"`     // Unique identifier
	OrgType       string `json:"orgType"`       // "medical" or "police"
	VehicleType   string `json:"vehicleType"`   // "ambulance", "patrol_car", etc.
	PriorityLevel int    `json:"priorityLevel"` // 1 (highest) to 5 (lowest)
	Status        string `json:"status"`        // "active", "inactive", "on_mission"
	RegisteredBy  string `json:"registeredBy"`  // MSP identity who registered
	RegisteredAt  int64  `json:"registeredAt"`  // Unix timestamp
}

// Segment represents a road segment reservation state
// NOTE: Map topology (fromNode, toNode, geometry) is stored in PostgreSQL, NOT in blockchain
// The blockchain only stores reservation state for conflict resolution and audit trail
type Segment struct {
	DocType       string `json:"docType"`       // "segment" - for CouchDB queries
	SegmentID     string `json:"segmentId"`     // Unique identifier (e.g., "SEG_H01_I01")
	FromNode      string `json:"fromNode"`      // DEPRECATED: Not used, kept for backward compatibility
	ToNode        string `json:"toNode"`        // DEPRECATED: Not used, kept for backward compatibility
	Status        string `json:"status"`        // "free", "reserved", "occupied"
	ReservedBy    string `json:"reservedBy"`    // VehicleID if reserved (empty string if free)
	MissionID     string `json:"missionId"`     // MissionID if reserved (empty string if free)
	OrgType       string `json:"orgType"`       // Org that reserved (empty string if free)
	PriorityLevel int    `json:"priorityLevel"` // Priority of reservation (0 if free)
	ReservedAt    int64  `json:"reservedAt"`    // When reserved (0 if free)
}

// Mission represents an emergency mission
type Mission struct {
	DocType       string   `json:"docType"`       // "mission" - for CouchDB queries
	MissionID     string   `json:"missionId"`     // Unique identifier
	VehicleID     string   `json:"vehicleId"`     // Assigned vehicle
	OrgType       string   `json:"orgType"`       // Organization type
	PriorityLevel int      `json:"priorityLevel"` // Mission priority
	OriginNode    string   `json:"originNode"`    // Starting node
	DestNode      string   `json:"destNode"`      // Destination node
	Path          []string `json:"path"`          // Reserved segment IDs (empty array if none)
	Status        string   `json:"status"`        // "pending", "active", "completed", "aborted"
	CreatedAt     int64    `json:"createdAt"`     // Creation timestamp
	ActivatedAt   int64    `json:"activatedAt"`   // When activated (0 if not yet)
	CompletedAt   int64    `json:"completedAt"`   // When completed (0 if not yet)
	CreatedBy     string   `json:"createdBy"`     // Who created
}

// Conflict represents a reservation conflict between missions
type Conflict struct {
	DocType    string `json:"docType"`    // "conflict"
	ConflictID string `json:"conflictId"` // Unique identifier
	SegmentID  string `json:"segmentId"`  // Contested segment
	Mission1ID string `json:"mission1Id"` // First mission
	Mission2ID string `json:"mission2Id"` // Second mission
	Priority1  int    `json:"priority1"`  // Priority of mission 1
	Priority2  int    `json:"priority2"`  // Priority of mission 2
	Status     string `json:"status"`     // "pending", "resolved"
	Resolution string `json:"resolution"` // "mission1_wins", "mission2_wins", "both_reroute"
	ResolvedBy string `json:"resolvedBy,omitempty"`
	ResolvedAt int64  `json:"resolvedAt,omitempty"`
	CreatedAt  int64  `json:"createdAt"`
}

// AuditEvent represents an audit log entry
type AuditEvent struct {
	DocType   string                 `json:"docType"`             // "audit"
	EventID   string                 `json:"eventId"`             // Unique identifier
	EventType string                 `json:"eventType"`           // Type of event
	Timestamp int64                  `json:"timestamp"`           // When it occurred
	OrgType   string                 `json:"orgType"`             // Organization
	ActorID   string                 `json:"actorId"`             // Who performed action
	MissionID string                 `json:"missionId,omitempty"` // Related mission
	VehicleID string                 `json:"vehicleId,omitempty"` // Related vehicle
	SegmentID string                 `json:"segmentId,omitempty"` // Related segment
	Details   map[string]interface{} `json:"details,omitempty"`   // Additional details
	TxID      string                 `json:"txId"`                // Transaction ID
}

// Event types constants
const (
	EventVehicleRegistered   = "VEHICLE_REGISTERED"
	EventVehicleUpdated      = "VEHICLE_UPDATED"
	EventSegmentReserved     = "SEGMENT_RESERVED"
	EventSegmentReleased     = "SEGMENT_RELEASED"
	EventSegmentOccupied     = "SEGMENT_OCCUPIED"
	EventMissionCreated      = "MISSION_CREATED"
	EventMissionActivated    = "MISSION_ACTIVATED"
	EventMissionCompleted    = "MISSION_COMPLETED"
	EventMissionAborted      = "MISSION_ABORTED"
	EventConflictDetected    = "CONFLICT_DETECTED"
	EventConflictResolved    = "CONFLICT_RESOLVED"
	EventPreemptionTriggered = "PREEMPTION_TRIGGERED"
	EventMissionRerouted     = "MISSION_REROUTED"
)

// Status constants
const (
	StatusFree     = "free"
	StatusReserved = "reserved"
	StatusOccupied = "occupied"

	StatusActive   = "active"
	StatusInactive = "inactive"
	StatusOnMission = "on_mission"

	MissionPending   = "pending"
	MissionActive    = "active"
	MissionCompleted = "completed"
	MissionAborted   = "aborted"

	ConflictPending  = "pending"
	ConflictResolved = "resolved"
)


package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/emergency-routing/chaincode/routing/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// SegmentContract handles road segment reservations
type SegmentContract struct {
	contractapi.Contract
}

// InitSegments is DEPRECATED - segments are now created lazily when first reserved
// This function is kept for backward compatibility but does nothing
// Map topology is stored in PostgreSQL, not in the blockchain
// The blockchain only stores reservation state (status, reservedBy, missionId, etc.)
func (c *SegmentContract) InitSegments(
	ctx contractapi.TransactionContextInterface,
) error {
	// No-op: segments are created on-demand when reserved
	// Map data (fromNode, toNode, geometry) is stored in PostgreSQL
	// Blockchain only stores reservation state
	return nil
}

// GetSegment retrieves a segment by ID
// Returns nil if segment doesn't exist (for lazy initialization)
func (c *SegmentContract) GetSegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
) (*models.Segment, error) {
	segmentJSON, err := ctx.GetStub().GetState(segmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if segmentJSON == nil {
		// Segment doesn't exist - return nil (caller can create it)
		return nil, nil
	}

	var segment models.Segment
	err = json.Unmarshal(segmentJSON, &segment)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal segment: %v", err)
	}

	return &segment, nil
}

// createFreeSegment creates a new free segment (lazy initialization)
func (c *SegmentContract) createFreeSegment(segmentID string) *models.Segment {
	return &models.Segment{
		DocType:       "segment",
		SegmentID:     segmentID,
		FromNode:      "", // Not stored in blockchain - map topology is in database
		ToNode:        "", // Not stored in blockchain - map topology is in database
		Status:        models.StatusFree,
		ReservedBy:    "",
		MissionID:     "",
		OrgType:       "",
		PriorityLevel: 0,
		ReservedAt:    0,
	}
}

// GetAllSegments retrieves all segments
func (c *SegmentContract) GetAllSegments(
	ctx contractapi.TransactionContextInterface,
) ([]*models.Segment, error) {
	queryString := `{"selector":{"docType":"segment"}}`

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query segments: %v", err)
	}
	defer resultsIterator.Close()

	var segments []*models.Segment
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var segment models.Segment
		err = json.Unmarshal(queryResult.Value, &segment)
		if err != nil {
			return nil, err
		}
		segments = append(segments, &segment)
	}

	return segments, nil
}

// ReserveSegment reserves a segment for a vehicle/mission
// Creates the segment if it doesn't exist (lazy initialization)
// Returns a conflict if the segment is already reserved by same priority
// NOTE: Map topology (fromNode, toNode) is NOT stored in blockchain - only reservation state
func (c *SegmentContract) ReserveSegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
	vehicleID string,
	missionID string,
	priorityLevel int,
) (*models.Conflict, error) {
	// Get segment (or nil if it doesn't exist)
	segment, err := c.GetSegment(ctx, segmentID)
	if err != nil {
		return nil, err
	}
	
	// Lazy initialization: create segment if it doesn't exist
	if segment == nil {
		segment = c.createFreeSegment(segmentID)
	}

	// Get caller org
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()
	orgType := ""
	switch mspID {
	case "MedicalMSP":
		orgType = "medical"
	case "PoliceMSP":
		orgType = "police"
	default:
		return nil, fmt.Errorf("unknown organization: %s", mspID)
	}

	// Check if segment is already reserved
	if segment.Status != models.StatusFree {
		// Check priority
		if priorityLevel < segment.PriorityLevel {
			// Higher priority (lower number) - preempt existing reservation
			// Release the segment from existing reservation
			oldVehicle := segment.ReservedBy
			oldMission := segment.MissionID

			// Reserve for new vehicle
			segment.Status = models.StatusReserved
			segment.ReservedBy = vehicleID
			segment.MissionID = missionID
			segment.OrgType = orgType
			segment.PriorityLevel = priorityLevel
			segment.ReservedAt = time.Now().Unix()

			segmentJSON, _ := json.Marshal(segment)
			ctx.GetStub().PutState(segmentID, segmentJSON)

			// Emit preemption event
			preemptionEvent := map[string]interface{}{
				"type":           models.EventPreemptionTriggered,
				"segmentId":      segmentID,
				"preemptedBy":    vehicleID,
				"preemptedFrom":  oldVehicle,
				"oldMissionId":   oldMission,
				"newMissionId":   missionID,
				"newPriority":    priorityLevel,
			}
			eventJSON, _ := json.Marshal(preemptionEvent)
			ctx.GetStub().SetEvent(models.EventPreemptionTriggered, eventJSON)

			return nil, nil

		} else if priorityLevel == segment.PriorityLevel {
			// Same priority - create conflict for negotiation
			conflict := &models.Conflict{
				DocType:    "conflict",
				ConflictID: fmt.Sprintf("CONFLICT-%s-%d", segmentID, time.Now().Unix()),
				SegmentID:  segmentID,
				Mission1ID: segment.MissionID,
				Mission2ID: missionID,
				Priority1:  segment.PriorityLevel,
				Priority2:  priorityLevel,
				Status:     models.ConflictPending,
				CreatedAt:  time.Now().Unix(),
			}

			// Store conflict
			conflictJSON, _ := json.Marshal(conflict)
			ctx.GetStub().PutState(conflict.ConflictID, conflictJSON)

			// Emit conflict event
			ctx.GetStub().SetEvent(models.EventConflictDetected, conflictJSON)

			return conflict, nil

		} else {
			// Lower priority - deny reservation
			return nil, fmt.Errorf("segment %s is reserved by higher priority vehicle", segmentID)
		}
	}

	// Segment is free - reserve it
	segment.Status = models.StatusReserved
	segment.ReservedBy = vehicleID
	segment.MissionID = missionID
	segment.OrgType = orgType
	segment.PriorityLevel = priorityLevel
	segment.ReservedAt = time.Now().Unix()

	segmentJSON, err := json.Marshal(segment)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal segment: %v", err)
	}

	err = ctx.GetStub().PutState(segmentID, segmentJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventSegmentReserved, segmentJSON)

	return nil, nil
}

// ReleaseSegment releases a segment reservation
func (c *SegmentContract) ReleaseSegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
	vehicleID string,
) error {
	segment, err := c.GetSegment(ctx, segmentID)
	if err != nil {
		return err
	}
	
	// If segment doesn't exist, nothing to release
	if segment == nil {
		return fmt.Errorf("segment %s does not exist (cannot release)", segmentID)
	}

	// Verify the vehicle holds the reservation
	if segment.ReservedBy != vehicleID {
		return fmt.Errorf("segment %s is not reserved by vehicle %s", segmentID, vehicleID)
	}

	// Release segment
	segment.Status = models.StatusFree
	segment.ReservedBy = ""
	segment.MissionID = ""
	segment.OrgType = ""
	segment.PriorityLevel = 0
	segment.ReservedAt = 0

	segmentJSON, err := json.Marshal(segment)
	if err != nil {
		return fmt.Errorf("failed to marshal segment: %v", err)
	}

	err = ctx.GetStub().PutState(segmentID, segmentJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventSegmentReleased, segmentJSON)

	return nil
}

// OccupySegment marks a segment as occupied (vehicle is currently on it)
func (c *SegmentContract) OccupySegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
	vehicleID string,
) error {
	segment, err := c.GetSegment(ctx, segmentID)
	if err != nil {
		return err
	}
	
	// If segment doesn't exist, cannot occupy
	if segment == nil {
		return fmt.Errorf("segment %s does not exist (cannot occupy)", segmentID)
	}

	// Verify the vehicle holds the reservation
	if segment.ReservedBy != vehicleID {
		return fmt.Errorf("segment %s is not reserved by vehicle %s", segmentID, vehicleID)
	}

	// Mark as occupied
	segment.Status = models.StatusOccupied

	segmentJSON, err := json.Marshal(segment)
	if err != nil {
		return fmt.Errorf("failed to marshal segment: %v", err)
	}

	err = ctx.GetStub().PutState(segmentID, segmentJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventSegmentOccupied, segmentJSON)

	return nil
}

// GetSegmentsByStatus retrieves segments with a specific status
func (c *SegmentContract) GetSegmentsByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
) ([]*models.Segment, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"segment","status":"%s"}}`, status)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query segments: %v", err)
	}
	defer resultsIterator.Close()

	var segments []*models.Segment
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var segment models.Segment
		err = json.Unmarshal(queryResult.Value, &segment)
		if err != nil {
			return nil, err
		}
		segments = append(segments, &segment)
	}

	return segments, nil
}

// ResolveConflict resolves a pending conflict
func (c *SegmentContract) ResolveConflict(
	ctx contractapi.TransactionContextInterface,
	conflictID string,
	resolution string, // "mission1_wins", "mission2_wins", "both_reroute"
) error {
	// Get conflict
	conflictJSON, err := ctx.GetStub().GetState(conflictID)
	if err != nil {
		return fmt.Errorf("failed to read conflict: %v", err)
	}
	if conflictJSON == nil {
		return fmt.Errorf("conflict %s does not exist", conflictID)
	}

	var conflict models.Conflict
	err = json.Unmarshal(conflictJSON, &conflict)
	if err != nil {
		return fmt.Errorf("failed to unmarshal conflict: %v", err)
	}

	if conflict.Status != models.ConflictPending {
		return fmt.Errorf("conflict %s is already resolved", conflictID)
	}

	// Get caller identity
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()

	// Update conflict
	conflict.Status = models.ConflictResolved
	conflict.Resolution = resolution
	conflict.ResolvedBy = mspID
	conflict.ResolvedAt = time.Now().Unix()

	conflictJSON, _ = json.Marshal(conflict)
	ctx.GetStub().PutState(conflictID, conflictJSON)

	// Emit event
	ctx.GetStub().SetEvent(models.EventConflictResolved, conflictJSON)

	return nil
}

// GetPendingConflicts retrieves all pending conflicts
func (c *SegmentContract) GetPendingConflicts(
	ctx contractapi.TransactionContextInterface,
) ([]*models.Conflict, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"conflict","status":"%s"}}`, models.ConflictPending)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query conflicts: %v", err)
	}
	defer resultsIterator.Close()

	var conflicts []*models.Conflict
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var conflict models.Conflict
		err = json.Unmarshal(queryResult.Value, &conflict)
		if err != nil {
			return nil, err
		}
		conflicts = append(conflicts, &conflict)
	}

	return conflicts, nil
}


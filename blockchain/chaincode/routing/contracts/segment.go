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

// InitSegments initializes the 5x5 grid segments
// This should be called once when setting up the network
func (c *SegmentContract) InitSegments(
	ctx contractapi.TransactionContextInterface,
) error {
	// Define the 5x5 grid segments
	// Horizontal segments (20 total: 4 per row, 5 rows)
	// Vertical segments (20 total: 5 per column, 4 columns)
	// Helper function to create a free segment with all fields explicitly set
	newFreeSegment := func(id, from, to string) models.Segment {
		return models.Segment{
			DocType:       "segment",
			SegmentID:     id,
			FromNode:      from,
			ToNode:        to,
			Status:        models.StatusFree,
			ReservedBy:    "",
			MissionID:     "",
			OrgType:       "",
			PriorityLevel: 0,
			ReservedAt:    0,
		}
	}

	segments := []models.Segment{
		// Row 1: N1-N2-N3-N4-N5
		newFreeSegment("S1", "N1", "N2"),
		newFreeSegment("S2", "N2", "N3"),
		newFreeSegment("S3", "N3", "N4"),
		newFreeSegment("S4", "N4", "N5"),
		// Row 2: N6-N7-N8-N9-N10
		newFreeSegment("S5", "N6", "N7"),
		newFreeSegment("S6", "N7", "N8"),
		newFreeSegment("S7", "N8", "N9"),
		newFreeSegment("S8", "N9", "N10"),
		// Row 3: N11-N12-N13-N14-N15
		newFreeSegment("S9", "N11", "N12"),
		newFreeSegment("S10", "N12", "N13"),
		newFreeSegment("S11", "N13", "N14"),
		newFreeSegment("S12", "N14", "N15"),
		// Row 4: N16-N17-N18-N19-N20
		newFreeSegment("S13", "N16", "N17"),
		newFreeSegment("S14", "N17", "N18"),
		newFreeSegment("S15", "N18", "N19"),
		newFreeSegment("S16", "N19", "N20"),
		// Row 5: N21-N22-N23-N24-N25
		newFreeSegment("S17", "N21", "N22"),
		newFreeSegment("S18", "N22", "N23"),
		newFreeSegment("S19", "N23", "N24"),
		newFreeSegment("S20", "N24", "N25"),

		// Vertical segments
		// Column 1: N1-N6-N11-N16-N21
		newFreeSegment("S21", "N1", "N6"),
		newFreeSegment("S22", "N6", "N11"),
		newFreeSegment("S23", "N11", "N16"),
		newFreeSegment("S24", "N16", "N21"),
		// Column 2: N2-N7-N12-N17-N22
		newFreeSegment("S25", "N2", "N7"),
		newFreeSegment("S26", "N7", "N12"),
		newFreeSegment("S27", "N12", "N17"),
		newFreeSegment("S28", "N17", "N22"),
		// Column 3: N3-N8-N13-N18-N23
		newFreeSegment("S29", "N3", "N8"),
		newFreeSegment("S30", "N8", "N13"),
		newFreeSegment("S31", "N13", "N18"),
		newFreeSegment("S32", "N18", "N23"),
		// Column 4: N4-N9-N14-N19-N24
		newFreeSegment("S33", "N4", "N9"),
		newFreeSegment("S34", "N9", "N14"),
		newFreeSegment("S35", "N14", "N19"),
		newFreeSegment("S36", "N19", "N24"),
		// Column 5: N5-N10-N15-N20-N25
		newFreeSegment("S37", "N5", "N10"),
		newFreeSegment("S38", "N10", "N15"),
		newFreeSegment("S39", "N15", "N20"),
		newFreeSegment("S40", "N20", "N25"),
	}

	for _, segment := range segments {
		segmentJSON, err := json.Marshal(segment)
		if err != nil {
			return fmt.Errorf("failed to marshal segment %s: %v", segment.SegmentID, err)
		}

		err = ctx.GetStub().PutState(segment.SegmentID, segmentJSON)
		if err != nil {
			return fmt.Errorf("failed to write segment %s: %v", segment.SegmentID, err)
		}
	}

	return nil
}

// GetSegment retrieves a segment by ID
func (c *SegmentContract) GetSegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
) (*models.Segment, error) {
	segmentJSON, err := ctx.GetStub().GetState(segmentID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if segmentJSON == nil {
		return nil, fmt.Errorf("segment %s does not exist", segmentID)
	}

	var segment models.Segment
	err = json.Unmarshal(segmentJSON, &segment)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal segment: %v", err)
	}

	return &segment, nil
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
// Returns a conflict if the segment is already reserved by same priority
func (c *SegmentContract) ReserveSegment(
	ctx contractapi.TransactionContextInterface,
	segmentID string,
	vehicleID string,
	missionID string,
	priorityLevel int,
) (*models.Conflict, error) {
	// Get segment
	segment, err := c.GetSegment(ctx, segmentID)
	if err != nil {
		return nil, err
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


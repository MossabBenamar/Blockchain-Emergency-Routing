package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/emergency-routing/chaincode/routing/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// MissionContract handles emergency mission lifecycle management
type MissionContract struct {
	contractapi.Contract
}

// CreateMission creates a new emergency mission (pending state)
func (c *MissionContract) CreateMission(
	ctx contractapi.TransactionContextInterface,
	missionID string,
	vehicleID string,
	originNode string,
	destNode string,
) error {
	// Validate inputs
	if missionID == "" {
		return fmt.Errorf("mission ID cannot be empty")
	}
	if vehicleID == "" {
		return fmt.Errorf("vehicle ID cannot be empty")
	}
	if originNode == "" || destNode == "" {
		return fmt.Errorf("origin and destination nodes are required")
	}

	// Check if mission already exists
	existingJSON, err := ctx.GetStub().GetState(missionID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existingJSON != nil {
		return fmt.Errorf("mission %s already exists", missionID)
	}

	// Get caller identity
	clientIdentity := ctx.GetClientIdentity()
	mspID, err := clientIdentity.GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Get organization type from MSP
	orgType := ""
	switch mspID {
	case "MedicalMSP":
		orgType = "medical"
	case "PoliceMSP":
		orgType = "police"
	default:
		return fmt.Errorf("unknown organization: %s", mspID)
	}

	// Verify vehicle exists and belongs to the same org
	vehicleJSON, err := ctx.GetStub().GetState(vehicleID)
	if err != nil {
		return fmt.Errorf("failed to read vehicle state: %v", err)
	}
	if vehicleJSON == nil {
		return fmt.Errorf("vehicle %s does not exist", vehicleID)
	}

	var vehicle models.Vehicle
	err = json.Unmarshal(vehicleJSON, &vehicle)
	if err != nil {
		return fmt.Errorf("failed to unmarshal vehicle: %v", err)
	}

	// Check vehicle org matches caller org
	if vehicle.OrgType != orgType {
		return fmt.Errorf("cannot create mission: vehicle %s belongs to %s, not %s", vehicleID, vehicle.OrgType, orgType)
	}

	// Check vehicle is not already on a mission
	if vehicle.Status == models.StatusOnMission {
		return fmt.Errorf("vehicle %s is already on a mission", vehicleID)
	}

	// Create mission object
	mission := models.Mission{
		DocType:       "mission",
		MissionID:     missionID,
		VehicleID:     vehicleID,
		OrgType:       orgType,
		PriorityLevel: vehicle.PriorityLevel,
		OriginNode:    originNode,
		DestNode:      destNode,
		Path:          []string{},
		Status:        models.MissionPending,
		CreatedAt:     time.Now().Unix(),
		CreatedBy:     mspID,
	}

	// Serialize and store
	missionJSON, err := json.Marshal(mission)
	if err != nil {
		return fmt.Errorf("failed to marshal mission: %v", err)
	}

	err = ctx.GetStub().PutState(missionID, missionJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventMissionCreated, missionJSON)

	return nil
}

// ActivateMission activates a pending mission with a calculated path
// This reserves all segments in the path
func (c *MissionContract) ActivateMission(
	ctx contractapi.TransactionContextInterface,
	missionID string,
	pathJSON string, // JSON array of segment IDs
) error {
	// Get mission
	mission, err := c.GetMission(ctx, missionID)
	if err != nil {
		return err
	}

	// Verify mission is pending
	if mission.Status != models.MissionPending {
		return fmt.Errorf("mission %s is not in pending status (current: %s)", missionID, mission.Status)
	}

	// Verify caller org matches mission org
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()
	callerOrg := ""
	switch mspID {
	case "MedicalMSP":
		callerOrg = "medical"
	case "PoliceMSP":
		callerOrg = "police"
	}
	if callerOrg != mission.OrgType {
		return fmt.Errorf("cannot activate mission from different organization")
	}

	// Parse path
	var path []string
	err = json.Unmarshal([]byte(pathJSON), &path)
	if err != nil {
		return fmt.Errorf("failed to parse path JSON: %v", err)
	}

	if len(path) == 0 {
		return fmt.Errorf("path cannot be empty")
	}

	// Reserve all segments in the path
	segmentContract := &SegmentContract{}
	conflicts := []*models.Conflict{}

	for _, segmentID := range path {
		conflict, err := segmentContract.ReserveSegment(
			ctx,
			segmentID,
			mission.VehicleID,
			missionID,
			mission.PriorityLevel,
		)
		if err != nil {
			// Rollback: release already reserved segments
			for _, reservedSeg := range mission.Path {
				segmentContract.ReleaseSegment(ctx, reservedSeg, mission.VehicleID)
			}
			return fmt.Errorf("failed to reserve segment %s: %v", segmentID, err)
		}
		if conflict != nil {
			conflicts = append(conflicts, conflict)
		}
		mission.Path = append(mission.Path, segmentID)
	}

	// Update mission status
	mission.Status = models.MissionActive
	mission.ActivatedAt = time.Now().Unix()
	mission.Path = path

	// Store updated mission
	missionJSON, err := json.Marshal(mission)
	if err != nil {
		return fmt.Errorf("failed to marshal mission: %v", err)
	}

	err = ctx.GetStub().PutState(missionID, missionJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Update vehicle status
	vehicleContract := &VehicleContract{}
	err = vehicleContract.UpdateVehicleStatus(ctx, mission.VehicleID, models.StatusOnMission)
	if err != nil {
		// Non-critical - log but don't fail
		fmt.Printf("Warning: failed to update vehicle status: %v\n", err)
	}

	// Emit event
	activationEvent := map[string]interface{}{
		"mission":   mission,
		"conflicts": conflicts,
	}
	eventJSON, _ := json.Marshal(activationEvent)
	ctx.GetStub().SetEvent(models.EventMissionActivated, eventJSON)

	return nil
}

// CompleteMission marks a mission as completed and releases all segments
func (c *MissionContract) CompleteMission(
	ctx contractapi.TransactionContextInterface,
	missionID string,
) error {
	// Get mission
	mission, err := c.GetMission(ctx, missionID)
	if err != nil {
		return err
	}

	// Verify mission is active
	if mission.Status != models.MissionActive {
		return fmt.Errorf("mission %s is not active (current: %s)", missionID, mission.Status)
	}

	// Verify caller org matches mission org
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()
	callerOrg := ""
	switch mspID {
	case "MedicalMSP":
		callerOrg = "medical"
	case "PoliceMSP":
		callerOrg = "police"
	}
	if callerOrg != mission.OrgType {
		return fmt.Errorf("cannot complete mission from different organization")
	}

	// Release all segments in the path
	segmentContract := &SegmentContract{}
	for _, segmentID := range mission.Path {
		err := segmentContract.ReleaseSegment(ctx, segmentID, mission.VehicleID)
		if err != nil {
			// Log but continue - segment might already be released
			fmt.Printf("Warning: failed to release segment %s: %v\n", segmentID, err)
		}
	}

	// Update mission status
	mission.Status = models.MissionCompleted
	mission.CompletedAt = time.Now().Unix()

	// Store updated mission
	missionJSON, err := json.Marshal(mission)
	if err != nil {
		return fmt.Errorf("failed to marshal mission: %v", err)
	}

	err = ctx.GetStub().PutState(missionID, missionJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Update vehicle status back to active
	vehicleContract := &VehicleContract{}
	err = vehicleContract.UpdateVehicleStatus(ctx, mission.VehicleID, models.StatusActive)
	if err != nil {
		// Non-critical - log but don't fail
		fmt.Printf("Warning: failed to update vehicle status: %v\n", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventMissionCompleted, missionJSON)

	return nil
}

// AbortMission aborts an active or pending mission
func (c *MissionContract) AbortMission(
	ctx contractapi.TransactionContextInterface,
	missionID string,
	reason string,
) error {
	// Get mission
	mission, err := c.GetMission(ctx, missionID)
	if err != nil {
		return err
	}

	// Verify mission can be aborted
	if mission.Status != models.MissionPending && mission.Status != models.MissionActive {
		return fmt.Errorf("mission %s cannot be aborted (current: %s)", missionID, mission.Status)
	}

	// Verify caller org matches mission org
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()
	callerOrg := ""
	switch mspID {
	case "MedicalMSP":
		callerOrg = "medical"
	case "PoliceMSP":
		callerOrg = "police"
	}
	if callerOrg != mission.OrgType {
		return fmt.Errorf("cannot abort mission from different organization")
	}

	// If mission was active, release all segments
	if mission.Status == models.MissionActive {
		segmentContract := &SegmentContract{}
		for _, segmentID := range mission.Path {
			err := segmentContract.ReleaseSegment(ctx, segmentID, mission.VehicleID)
			if err != nil {
				fmt.Printf("Warning: failed to release segment %s: %v\n", segmentID, err)
			}
		}

		// Update vehicle status back to active
		vehicleContract := &VehicleContract{}
		err = vehicleContract.UpdateVehicleStatus(ctx, mission.VehicleID, models.StatusActive)
		if err != nil {
			fmt.Printf("Warning: failed to update vehicle status: %v\n", err)
		}
	}

	// Update mission status
	mission.Status = models.MissionAborted
	mission.CompletedAt = time.Now().Unix()

	// Store updated mission
	missionJSON, err := json.Marshal(mission)
	if err != nil {
		return fmt.Errorf("failed to marshal mission: %v", err)
	}

	err = ctx.GetStub().PutState(missionID, missionJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event with reason
	abortEvent := map[string]interface{}{
		"mission": mission,
		"reason":  reason,
	}
	eventJSON, _ := json.Marshal(abortEvent)
	ctx.GetStub().SetEvent(models.EventMissionAborted, eventJSON)

	return nil
}

// GetMission retrieves a mission by ID
func (c *MissionContract) GetMission(
	ctx contractapi.TransactionContextInterface,
	missionID string,
) (*models.Mission, error) {
	missionJSON, err := ctx.GetStub().GetState(missionID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if missionJSON == nil {
		return nil, fmt.Errorf("mission %s does not exist", missionID)
	}

	var mission models.Mission
	err = json.Unmarshal(missionJSON, &mission)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal mission: %v", err)
	}

	return &mission, nil
}

// GetAllMissions retrieves all missions
func (c *MissionContract) GetAllMissions(
	ctx contractapi.TransactionContextInterface,
) ([]*models.Mission, error) {
	queryString := `{"selector":{"docType":"mission"}}`

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query missions: %v", err)
	}
	defer resultsIterator.Close()

	var missions []*models.Mission
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var mission models.Mission
		err = json.Unmarshal(queryResult.Value, &mission)
		if err != nil {
			return nil, err
		}
		missions = append(missions, &mission)
	}

	return missions, nil
}

// GetActiveMissions retrieves all active missions
func (c *MissionContract) GetActiveMissions(
	ctx contractapi.TransactionContextInterface,
) ([]*models.Mission, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"mission","status":"%s"}}`, models.MissionActive)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query missions: %v", err)
	}
	defer resultsIterator.Close()

	var missions []*models.Mission
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var mission models.Mission
		err = json.Unmarshal(queryResult.Value, &mission)
		if err != nil {
			return nil, err
		}
		missions = append(missions, &mission)
	}

	return missions, nil
}

// GetMissionsByStatus retrieves missions by status
func (c *MissionContract) GetMissionsByStatus(
	ctx contractapi.TransactionContextInterface,
	status string,
) ([]*models.Mission, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"mission","status":"%s"}}`, status)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query missions: %v", err)
	}
	defer resultsIterator.Close()

	var missions []*models.Mission
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var mission models.Mission
		err = json.Unmarshal(queryResult.Value, &mission)
		if err != nil {
			return nil, err
		}
		missions = append(missions, &mission)
	}

	return missions, nil
}

// GetMissionsByOrg retrieves missions for a specific organization
func (c *MissionContract) GetMissionsByOrg(
	ctx contractapi.TransactionContextInterface,
	orgType string,
) ([]*models.Mission, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"mission","orgType":"%s"}}`, orgType)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query missions: %v", err)
	}
	defer resultsIterator.Close()

	var missions []*models.Mission
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var mission models.Mission
		err = json.Unmarshal(queryResult.Value, &mission)
		if err != nil {
			return nil, err
		}
		missions = append(missions, &mission)
	}

	return missions, nil
}

// GetVehicleActiveMission retrieves the active mission for a vehicle (if any)
func (c *MissionContract) GetVehicleActiveMission(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
) (*models.Mission, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"mission","vehicleId":"%s","status":"%s"}}`,
		vehicleID, models.MissionActive)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query missions: %v", err)
	}
	defer resultsIterator.Close()

	if resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var mission models.Mission
		err = json.Unmarshal(queryResult.Value, &mission)
		if err != nil {
			return nil, err
		}
		return &mission, nil
	}

	return nil, nil // No active mission found
}

// UpdateMissionPath updates the path for an active mission (for re-routing)
func (c *MissionContract) UpdateMissionPath(
	ctx contractapi.TransactionContextInterface,
	missionID string,
	newPathJSON string,
) error {
	// Get mission
	mission, err := c.GetMission(ctx, missionID)
	if err != nil {
		return err
	}

	// Verify mission is active
	if mission.Status != models.MissionActive {
		return fmt.Errorf("mission %s is not active (current: %s)", missionID, mission.Status)
	}

	// Verify caller org matches mission org
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()
	callerOrg := ""
	switch mspID {
	case "MedicalMSP":
		callerOrg = "medical"
	case "PoliceMSP":
		callerOrg = "police"
	}
	if callerOrg != mission.OrgType {
		return fmt.Errorf("cannot update mission from different organization")
	}

	// Parse new path
	var newPath []string
	err = json.Unmarshal([]byte(newPathJSON), &newPath)
	if err != nil {
		return fmt.Errorf("failed to parse path JSON: %v", err)
	}

	// Release old segments that are not in new path
	segmentContract := &SegmentContract{}
	oldPathSet := make(map[string]bool)
	for _, seg := range mission.Path {
		oldPathSet[seg] = true
	}
	newPathSet := make(map[string]bool)
	for _, seg := range newPath {
		newPathSet[seg] = true
	}

	// Release segments no longer needed
	for _, seg := range mission.Path {
		if !newPathSet[seg] {
			err := segmentContract.ReleaseSegment(ctx, seg, mission.VehicleID)
			if err != nil {
				fmt.Printf("Warning: failed to release segment %s: %v\n", seg, err)
			}
		}
	}

	// Reserve new segments
	for _, seg := range newPath {
		if !oldPathSet[seg] {
			_, err := segmentContract.ReserveSegment(ctx, seg, mission.VehicleID, missionID, mission.PriorityLevel)
			if err != nil {
				return fmt.Errorf("failed to reserve new segment %s: %v", seg, err)
			}
		}
	}

	// Update mission path
	mission.Path = newPath

	// Store updated mission
	missionJSON, err := json.Marshal(mission)
	if err != nil {
		return fmt.Errorf("failed to marshal mission: %v", err)
	}

	err = ctx.GetStub().PutState(missionID, missionJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit re-route event
	rerouteEvent := map[string]interface{}{
		"type":      "MISSION_REROUTED",
		"missionId": missionID,
		"newPath":   newPath,
	}
	eventJSON, _ := json.Marshal(rerouteEvent)
	ctx.GetStub().SetEvent(models.EventMissionRerouted, eventJSON)

	return nil
}


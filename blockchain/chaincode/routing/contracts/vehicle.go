package contracts

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/emergency-routing/chaincode/routing/models"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

// VehicleContract handles vehicle registration and management
type VehicleContract struct {
	contractapi.Contract
}

// RegisterVehicle creates a new emergency vehicle in the system
func (c *VehicleContract) RegisterVehicle(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
	orgType string,
	vehicleType string,
	priorityLevel int,
) error {
	// Validate inputs
	if vehicleID == "" {
		return fmt.Errorf("vehicle ID cannot be empty")
	}
	if orgType != "medical" && orgType != "police" {
		return fmt.Errorf("invalid org type: must be 'medical' or 'police'")
	}
	if priorityLevel < 1 || priorityLevel > 5 {
		return fmt.Errorf("priority level must be between 1 and 5")
	}

	// Check if vehicle already exists
	existingJSON, err := ctx.GetStub().GetState(vehicleID)
	if err != nil {
		return fmt.Errorf("failed to read state: %v", err)
	}
	if existingJSON != nil {
		return fmt.Errorf("vehicle %s already exists", vehicleID)
	}

	// Get caller identity
	clientIdentity := ctx.GetClientIdentity()
	mspID, err := clientIdentity.GetMSPID()
	if err != nil {
		return fmt.Errorf("failed to get MSP ID: %v", err)
	}

	// Verify caller belongs to the correct organization
	expectedMSP := ""
	switch orgType {
	case "medical":
		expectedMSP = "MedicalMSP"
	case "police":
		expectedMSP = "PoliceMSP"
	}
	if mspID != expectedMSP {
		return fmt.Errorf("access denied: %s cannot register vehicles for %s organization", mspID, orgType)
	}

	// Create vehicle object
	vehicle := models.Vehicle{
		DocType:       "vehicle",
		VehicleID:     vehicleID,
		OrgType:       orgType,
		VehicleType:   vehicleType,
		PriorityLevel: priorityLevel,
		Status:        models.StatusActive,
		RegisteredBy:  mspID,
		RegisteredAt:  time.Now().Unix(),
	}

	// Serialize and store
	vehicleJSON, err := json.Marshal(vehicle)
	if err != nil {
		return fmt.Errorf("failed to marshal vehicle: %v", err)
	}

	err = ctx.GetStub().PutState(vehicleID, vehicleJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventVehicleRegistered, vehicleJSON)

	return nil
}

// GetVehicle retrieves a vehicle by ID
func (c *VehicleContract) GetVehicle(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
) (*models.Vehicle, error) {
	vehicleJSON, err := ctx.GetStub().GetState(vehicleID)
	if err != nil {
		return nil, fmt.Errorf("failed to read state: %v", err)
	}
	if vehicleJSON == nil {
		return nil, fmt.Errorf("vehicle %s does not exist", vehicleID)
	}

	var vehicle models.Vehicle
	err = json.Unmarshal(vehicleJSON, &vehicle)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal vehicle: %v", err)
	}

	return &vehicle, nil
}

// GetAllVehicles retrieves all vehicles in the system
func (c *VehicleContract) GetAllVehicles(
	ctx contractapi.TransactionContextInterface,
) ([]*models.Vehicle, error) {
	// CouchDB query to find all vehicles
	queryString := `{"selector":{"docType":"vehicle"}}`

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicles: %v", err)
	}
	defer resultsIterator.Close()

	var vehicles []*models.Vehicle
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var vehicle models.Vehicle
		err = json.Unmarshal(queryResult.Value, &vehicle)
		if err != nil {
			return nil, err
		}
		vehicles = append(vehicles, &vehicle)
	}

	return vehicles, nil
}

// GetVehiclesByOrg retrieves all vehicles for a specific organization
func (c *VehicleContract) GetVehiclesByOrg(
	ctx contractapi.TransactionContextInterface,
	orgType string,
) ([]*models.Vehicle, error) {
	queryString := fmt.Sprintf(`{"selector":{"docType":"vehicle","orgType":"%s"}}`, orgType)

	resultsIterator, err := ctx.GetStub().GetQueryResult(queryString)
	if err != nil {
		return nil, fmt.Errorf("failed to query vehicles: %v", err)
	}
	defer resultsIterator.Close()

	var vehicles []*models.Vehicle
	for resultsIterator.HasNext() {
		queryResult, err := resultsIterator.Next()
		if err != nil {
			return nil, err
		}

		var vehicle models.Vehicle
		err = json.Unmarshal(queryResult.Value, &vehicle)
		if err != nil {
			return nil, err
		}
		vehicles = append(vehicles, &vehicle)
	}

	return vehicles, nil
}

// UpdateVehicleStatus updates the status of a vehicle
func (c *VehicleContract) UpdateVehicleStatus(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
	status string,
) error {
	// Validate status
	validStatuses := map[string]bool{
		models.StatusActive:    true,
		models.StatusInactive:  true,
		models.StatusOnMission: true,
	}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	// Get existing vehicle
	vehicle, err := c.GetVehicle(ctx, vehicleID)
	if err != nil {
		return err
	}

	// Check authorization - only same org can update
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()

	expectedMSP := ""
	switch vehicle.OrgType {
	case "medical":
		expectedMSP = "MedicalMSP"
	case "police":
		expectedMSP = "PoliceMSP"
	}
	if mspID != expectedMSP {
		return fmt.Errorf("access denied: cannot update vehicle from different organization")
	}

	// Update status
	vehicle.Status = status

	// Serialize and store
	vehicleJSON, err := json.Marshal(vehicle)
	if err != nil {
		return fmt.Errorf("failed to marshal vehicle: %v", err)
	}

	err = ctx.GetStub().PutState(vehicleID, vehicleJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventVehicleUpdated, vehicleJSON)

	return nil
}

// UpdateVehiclePriority updates the priority level of a vehicle
func (c *VehicleContract) UpdateVehiclePriority(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
	priorityLevel int,
) error {
	// Validate priority
	if priorityLevel < 1 || priorityLevel > 5 {
		return fmt.Errorf("priority level must be between 1 and 5")
	}

	// Get existing vehicle
	vehicle, err := c.GetVehicle(ctx, vehicleID)
	if err != nil {
		return err
	}

	// Check authorization - only same org can update
	clientIdentity := ctx.GetClientIdentity()
	mspID, _ := clientIdentity.GetMSPID()

	expectedMSP := ""
	switch vehicle.OrgType {
	case "medical":
		expectedMSP = "MedicalMSP"
	case "police":
		expectedMSP = "PoliceMSP"
	}
	if mspID != expectedMSP {
		return fmt.Errorf("access denied: cannot update vehicle from different organization")
	}

	// Update priority
	vehicle.PriorityLevel = priorityLevel

	// Serialize and store
	vehicleJSON, err := json.Marshal(vehicle)
	if err != nil {
		return fmt.Errorf("failed to marshal vehicle: %v", err)
	}

	err = ctx.GetStub().PutState(vehicleID, vehicleJSON)
	if err != nil {
		return fmt.Errorf("failed to write state: %v", err)
	}

	// Emit event
	ctx.GetStub().SetEvent(models.EventVehicleUpdated, vehicleJSON)

	return nil
}

// VehicleExists checks if a vehicle exists
func (c *VehicleContract) VehicleExists(
	ctx contractapi.TransactionContextInterface,
	vehicleID string,
) (bool, error) {
	vehicleJSON, err := ctx.GetStub().GetState(vehicleID)
	if err != nil {
		return false, fmt.Errorf("failed to read state: %v", err)
	}
	return vehicleJSON != nil, nil
}

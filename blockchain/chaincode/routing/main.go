package main

import (
	"log"

	"github.com/emergency-routing/chaincode/routing/contracts"
	"github.com/hyperledger/fabric-contract-api-go/contractapi"
)

func main() {
	// Create chaincode with all contracts
	routingChaincode, err := contractapi.NewChaincode(
		&contracts.VehicleContract{},
		&contracts.SegmentContract{},
		&contracts.MissionContract{},
	)
	if err != nil {
		log.Panicf("Error creating routing chaincode: %v", err)
	}

	// Start the chaincode
	if err := routingChaincode.Start(); err != nil {
		log.Panicf("Error starting routing chaincode: %v", err)
	}
}


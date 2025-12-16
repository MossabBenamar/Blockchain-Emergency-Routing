# Emergency Routing System - Makefile
# Convenience commands for managing the project

.PHONY: help network-up network-down network-clean deploy-chaincode test-chaincode init-chaincode status logs

# Default target
help:
	@echo "Emergency Routing System - Available Commands"
	@echo ""
	@echo "Network Management:"
	@echo "  make network-up      - Start the Fabric network (generate crypto, start containers, create channel)"
	@echo "  make network-down    - Stop the Fabric network"
	@echo "  make network-clean   - Clean up all generated files and volumes"
	@echo "  make network-restart - Restart the network"
	@echo "  make status          - Show network status"
	@echo ""
	@echo "Chaincode Management:"
	@echo "  make deploy-chaincode - Deploy the routing chaincode"
	@echo "  make init-chaincode   - Initialize chaincode (create segments)"
	@echo "  make test-chaincode   - Test chaincode functions"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs            - Show Docker logs"
	@echo "  make shell           - Open CLI container shell"
	@echo ""

# Network commands
network-up:
	@chmod +x blockchain/network/scripts/*.sh
	@cd blockchain/network/scripts && ./network.sh up

network-down:
	@cd blockchain/network/scripts && ./network.sh down

network-clean:
	@cd blockchain/network/scripts && ./network.sh clean

network-restart:
	@cd blockchain/network/scripts && ./network.sh restart

status:
	@cd blockchain/network/scripts && ./network.sh status

# Chaincode commands
deploy-chaincode:
	@chmod +x blockchain/network/scripts/*.sh
	@cd blockchain/network/scripts && ./deploy-chaincode.sh deploy

init-chaincode:
	@cd blockchain/network/scripts && ./deploy-chaincode.sh init

test-chaincode:
	@cd blockchain/network/scripts && ./deploy-chaincode.sh test

# Utility commands
logs:
	@docker-compose -f blockchain/network/docker/docker-compose-net.yaml logs -f

logs-peer-medical:
	@docker logs -f peer0.medical.emergency.net

logs-peer-police:
	@docker logs -f peer0.police.emergency.net

logs-orderer:
	@docker logs -f orderer.emergency.net

shell:
	@docker exec -it cli bash

# Development helpers
go-mod-tidy:
	@cd blockchain/chaincode/routing && go mod tidy

go-mod-download:
	@cd blockchain/chaincode/routing && go mod download

# Full setup (first time)
setup: network-up deploy-chaincode init-chaincode
	@echo "Setup complete! Network is ready."

# Quick restart with chaincode redeployment
restart-all: network-down network-up deploy-chaincode init-chaincode
	@echo "Full restart complete!"


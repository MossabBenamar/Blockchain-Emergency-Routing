# Emergency Vehicle Routing System - Video Demo Script

## Quick Setup: MSP Credentials Helper

For easier blockchain queries, create these aliases (using the `cli` container):

```bash
# Medical org blockchain query helper (Uses CLI container default)
alias query-medical='docker exec cli peer chaincode query -C emergency-channel -n routing'

# Police org blockchain query helper (Overrides CLI env for Police)
alias query-police='docker exec \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:7051 \
  -e CORE_PEER_LOCALMSPID="PoliceMSP" \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  cli \
  peer chaincode query -C emergency-channel -n routing'
```

**Usage Example:**
```bash
# Query vehicle
query-medical -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-001"]}'

# Query all missions
query-police -c '{"function":"MissionContract:GetAllMissions","Args":[]}'
```

---

## Prerequisites Check

### 1. Verify All Services Running
```bash
# Check Docker containers
docker ps

# Should see:
# - peer0.medical.emergency.net
# - peer0.police.emergency.net  
# - orderer.emergency.net
# - couchdb0, couchdb1
```

### 2. Check Backend Services
```bash
# Medical backend (should be on port 3001)
curl http://localhost:3001/api/health

# Police backend (should be on port 3003)
curl http://localhost:3003/api/health
```

---

## Demo Section 1: Vehicle Registration

### Action: Register a Medical Vehicle via UI
- Open Medical org (http://localhost:5173)
- Click "Vehicle Management"
- Register: AMB-003, Type: Ambulance, Priority: 1

### Verification: Check Blockchain
```bash
# Query vehicle from blockchain using CLI container
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetVehicle","Args":["AMB-003"]}'

# Expected output: JSON with vehicleId, orgType: "medical", priorityLevel: 1
```

### Alternative: Query All Vehicles from Blockchain
```bash
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'
```

---

## Demo Section 2: Mission Creation & Launch

### Action: Create Mission via UI
- Open Medical org
- Click "Mission Control"  
- Select: Vehicle=AMB-001, Origin=Hospital1, Destination=Emergency Point
- Click "Launch Mission"

### Verification: Check Mission in Blockchain
```bash
# Get mission ID from UI
MISSION_ID="MISSION-1767572251944-BEPAIT"  # Replace with actual ID

# Query mission from blockchain using CLI
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c "{\"function\":\"MissionContract:GetMission\",\"Args\":[\"$MISSION_ID\"]}"

# Expected: status: "active", path: ["SEG_...", "SEG_..."], vehicleId: "AMB-001"
```

### Verification: Check Active Missions via API
```bash
# Query all active missions
curl http://localhost:3001/api/missions/active | jq '.data[] | {missionId, vehicleId, status}'
```

### Verification: Check Segment Reservations
```bash
# Get segments from blockchain using CLI
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"SegmentContract:GetAllSegments","Args":[]}'

# Look for segments with status: "reserved", reservedBy: "AMB-001"
```

### Verification: Check CouchDB Segment State
```bash
# Query specific segment
SEG_ID="SEG_ST34_5TH_3RD"  # Use actual segment from mission path

curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/$SEG_ID" | jq

# Should show: status: "reserved", reservedBy, missionId, orgType: "medical"
```

---

## Demo Section 3: Simulation & Vehicle Movement

### Action: Start Simulation
- Click "Vehicle Simulation" panel
- Click "▶️ Start"
- Watch vehicle move on map

### Verification: Check Vehicle Position Updates
```bash
# Monitor backend logs in real-time
# Medical backend console should show:
# - "Broadcasted VEHICLE_POSITION"
# - "Vehicle AMB-001 transitioning: SEG_A -> SEG_B"
```

### Verification: Check Segment State Changes
```bash
# While simulation running, query segment
curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/SEG_ST34_5TH_3RD" | jq

# Watch status change: reserved -> occupied -> free
```

### Verification: Check Simulation Status
```bash
# Query simulation status via API
curl http://localhost:3001/api/simulation/status | jq

# Expected: isRunning: true, vehicleCount: X, speed: 1
```

---

## Demo Section 4: Cross-Organization Priority (Medical vs Police)

### Action: Create Conflicting Missions
1. **Police org:** Launch POL-001 from Police Station to Destination
2. **Medical org:** Launch AMB-001 on overlapping route

### Verification: Check Preemption
```bash
# Query the conflicting segment
SEG_ID="SEG_ST42_7TH_5TH"

# Before preemption (Police reserved)
curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/$SEG_ID" | jq
# Should show: reservedBy: "POL-001", orgType: "police"

# After preemption (Medical takes over)
curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/$SEG_ID" | jq
# Should show: reservedBy: "AMB-001", orgType: "medical"
```

### Verification: Check Police Reroute
```bash
# Query Police mission - should see path changed
POLICE_MISSION_ID="MISSION-..."

# Use CLI container with Police MSP overrides
docker exec \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:7051 \
  -e CORE_PEER_LOCALMSPID="PoliceMSP" \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  cli \
  peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c "{\"function\":\"MissionContract:GetMission\",\"Args\":[\"$POLICE_MISSION_ID\"]}"

# Path should be different (rerouted)
```

### Verification: Check Backend Logs
```bash
# Medical backend logs should show:
# "Mission AMB-... will preempt POL-... on segment SEG_..."

# Police backend logs should show:
# "Blockchain conflict occupying segment..."
# "Rerouting mission..."
```

---

## Demo Section 5: Intra-Organization Sharing (Same Org)

### Action: Create Two Medical Missions
1. Launch AMB-001: Hospital1 → Emergency1
2. Launch AMB-002: Hospital2 → Emergency2 (overlapping route)

### Verification: Check Cooperative Sharing
```bash
# Query shared segment
SEG_ID="SEG_AVE5_34_23"

curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/$SEG_ID" | jq

# Both missions should remain active
curl http://localhost:3001/api/missions/active | jq | grep missionId

# Should see both AMB-001 and AMB-002 missions
```

### Verification: Check Logs for Sharing
```bash
# Medical backend should show:
# "Mission AMB-002 shares segments with same-org mission AMB-001"
# "sharedSegments: X"  (in MISSION_ACTIVATED payload)
```

---

## Demo Section 6: Mission Completion

### Action: Wait for Vehicle to Arrive
- Let simulation run until vehicle reaches destination
- Watch for "Mission Completed" notification

### Verification: Check Mission Status
```bash
MISSION_ID="MISSION-..."

docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c "{\"function\":\"MissionContract:GetMission\",\"Args\":[\"$MISSION_ID\"]}"

# Expected: status: "completed", completedAt: timestamp
```

### Verification: Check Segments Released
```bash
# Query segments that were in the path
# All should now be status: "free"

curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/SEG_ST34_5TH_3RD" | jq

# Should show: status: "free", reservedBy: null
```

---

## Demo Section 7: Audit Trail & Transparency

### Verification: Query All Vehicles (Both Orgs)
```bash
# Medical vehicles (using CLI default)
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'

# Police vehicles (using Police MSP override)
docker exec \
  -e CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp \
  -e CORE_PEER_ADDRESS=peer0.police.emergency.net:7051 \
  -e CORE_PEER_LOCALMSPID="PoliceMSP" \
  -e CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt \
  cli \
  peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"VehicleContract:GetAllVehicles","Args":[]}'

# Both should see ALL vehicles from both orgs (transparency)
```

### Verification: Query All Missions
```bash
# From Medical peer (via CLI)
docker exec cli peer chaincode query \
  -C emergency-channel \
  -n routing \
  -c '{"function":"MissionContract:GetAllMissions","Args":[]}'

# Should see missions from BOTH organizations (shared visibility)
```

### Verification: Check CouchDB Full State
```bash
# Get all documents
curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/_all_docs?include_docs=true" | jq

# Filter by docType
curl -X POST "http://admin:adminpw@localhost:5984/emergency-channel_routing/_find" \
  -H "Content-Type: application/json" \
  -d '{"selector": {"docType": "mission"}}' | jq

# Shows complete mission history (immutable ledger)
```

---

## Quick Demo Commands (Copy-Paste for Video)

### Show Active Missions
```bash
curl http://localhost:3001/api/missions/active | jq '.data[] | {missionId, vehicleId, status}'
```

### Show All Segments Status
```bash
curl http://localhost:3001/api/segments | jq '.data[] | select(.status != "free") | {id: .segmentId, status, reservedBy}'
```

### Show Simulation Status
```bash
curl http://localhost:3001/api/simulation/status | jq '{running: .data.isRunning, vehicles: .data.vehicleCount, speed: .data.speed}'
```

### Show Stored Geometry (NEW Feature)
```bash
# Check if mission has OSRM geometry stored
MISSION_ID="MISSION-..."
curl "http://admin:adminpw@localhost:5984/emergency-channel_routing/$MISSION_ID" | jq '.geometry | length'

# Should show number of geometry points (e.g., 355)
```

### Monitor Real-Time Events
```bash
# In separate terminal, tail backend logs
tail -f /path/to/backend/logs

# Or use docker logs
docker logs -f peer0.medical.emergency.net
```

---

## Troubleshooting Commands

### Reset Blockchain (if needed)
```bash
cd fabric-network
./network.sh down
./network.sh up
```

### Check Chaincode Status
```bash
docker exec peer0.medical.emergency.net peer lifecycle chaincode queryinstalled
```

### Check Channel Info
```bash
docker exec peer0.medical.emergency.net peer channel getinfo -c emergency-channel
```

---

## Video Script Flow Suggestion

1. **Intro (30s):** Show architecture diagram, explain blockchain + routing
2. **Vehicle Registration (1min):** Register vehicle → verify in blockchain
3. **Mission Launch (1min):** Create mission → show blockchain reservations
4. **Simulation (1.5min):** Start simulation → show real-time movement + segment transitions
5. **Priority Conflict (1.5min):** Medical preempts Police → show reroute
6. **Intra-Org Sharing (1min):** Two ambulances share route → verify cooperation
7. **Completion (30s):** Mission completes → segments released
8. **Audit Trail (30s):** Show blockchain query → immutable history
9. **Outro (30s):** Summary of key features

**Total: ~7-8 minutes**

---

## Notes
- Replace `MISSION_ID`, `SEG_ID` with actual IDs from your demo
- Run commands in separate terminal while showing UI
- Use `| jq` for pretty JSON formatting
- Consider split-screen: UI on left, terminal on right

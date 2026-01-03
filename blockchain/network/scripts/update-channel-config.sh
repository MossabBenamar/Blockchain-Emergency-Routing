#!/bin/bash

# Script to manually update channel configuration with MSP definitions
# This resolves the "creator org unknown" error

set -e

echo "================================"
echo "Channel Configuration Update"
echo "================================"

CHANNEL_NAME="emergency-channel"
ORDERER_CA=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/ordererOrganizations/emergency.net/orderers/orderer.emergency.net/msp/tlscacerts/tlsca.emergency.net-cert.pem

# Set environment for Medical org
export CORE_PEER_LOCALMSPID="MedicalMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/peers/peer0.medical.emergency.net/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/medical.emergency.net/users/Admin@medical.emergency.net/msp
export CORE_PEER_ADDRESS=peer0.medical.emergency.net:7051

echo "[1/7] Fetching current channel configuration..."
peer channel fetch config config_block.pb \
    -o orderer.emergency.net:7050 \
    -c ${CHANNEL_NAME} \
    --tls --cafile ${ORDERER_CA}

echo "[2/7] Decoding config block..."
configtxlator proto_decode \
    --input config_block.pb \
    --type common.Block \
    | jq .data.data[0].payload.data.config > config.json

echo "[3/7] Creating modified config with MSP definitions..."
# The config already has MSPs from the genesis block, we just need to ensure
# they're properly recognized. Let's add the NodeOUs configuration explicitly.

jq '.channel_group.groups.Application.groups.MedicalMSP.values.MSP.value.config.organizational_unit_identifiers = [
  {
    "certificate": "cacerts/ca.medical.emergency.net-cert.pem",
    "organizational_unit_identifier": "client"
  },
  {
    "certificate": "cacerts/ca.medical.emergency.net-cert.pem", 
    "organizational_unit_identifier": "peer"
  },
  {
    "certificate": "cacerts/ca.medical.emergency.net-cert.pem",
    "organizational_unit_identifier": "admin"
  }
] |
.channel_group.groups.Application.groups.PoliceMSP.values.MSP.value.config.organizational_unit_identifiers = [
  {
    "certificate": "cacerts/ca.police.emergency.net-cert.pem",
    "organizational_unit_identifier": "client"
  },
  {
    "certificate": "cacerts/ca.police.emergency.net-cert.pem",
    "organizational_unit_identifier": "peer"
  },
  {
    "certificate": "cacerts/ca.police.emergency.net-cert.pem",
    "organizational_unit_identifier": "admin"
  }
]' config.json > modified_config.json

echo "[4/7] Encoding original and modified configs..."
configtxlator proto_encode \
    --input config.json \
    --type common.Config \
    --output config.pb

configtxlator proto_encode \
    --input modified_config.json \
    --type common.Config \
    --output modified_config.pb

echo "[5/7] Computing config update..."
configtxlator compute_update \
    --channel_id ${CHANNEL_NAME} \
    --original config.pb \
    --updated modified_config.pb \
    --output config_update.pb

echo "[6/7] Creating config update envelope..."
configtxlator proto_decode \
    --input config_update.pb \
    --type common.ConfigUpdate \
    | jq . > config_update.json

echo '{"payload":{"header":{"channel_header":{"channel_id":"'${CHANNEL_NAME}'", "type":2}},"data":{"config_update":'$(cat config_update.json)'}}}' \
    | jq . > config_update_in_envelope.json

configtxlator proto_encode \
    --input config_update_in_envelope.json \
    --type common.Envelope \
    --output config_update_in_envelope.pb

echo "[7/7] Signing and submitting channel update..."
# Sign with Medical
peer channel signconfigtx -f config_update_in_envelope.pb

# Switch to Police and sign
export CORE_PEER_LOCALMSPID="PoliceMSP"
export CORE_PEER_TLS_ROOTCERT_FILE=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/peers/peer0.police.emergency.net/tls/ca.crt
export CORE_PEER_MSPCONFIGPATH=/opt/gopath/src/github.com/hyperledger/fabric/peer/organizations/peerOrganizations/police.emergency.net/users/Admin@police.emergency.net/msp
export CORE_PEER_ADDRESS=peer0.police.emergency.net:9051

# Submit the update
peer channel update \
    -f config_update_in_envelope.pb \
    -c ${CHANNEL_NAME} \
    -o orderer.emergency.net:7050 \
    --tls --cafile ${ORDERER_CA}

echo "✅ Channel configuration updated successfully!"
echo "You can now proceed with chaincode deployment."

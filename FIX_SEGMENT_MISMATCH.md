# Fix: Segment ID Mismatch Between Chaincode and Backend

## Problem
The chaincode was initializing segments with IDs from a 5x5 grid (e.g., `S1`, `S2`, `N1`, `N2`), but the backend uses Manhattan segment IDs (e.g., `SEG_H01_I01`, `SEG_I01_I07`). This caused:
- `segment SEG_H01_I01 does not exist` errors
- `ProposalResponsePayloads do not match` endorsement failures

## Solution
Updated the chaincode's `InitSegments` function to create Manhattan segments matching the backend map data.

## Steps to Fix

1. **Rebuild the chaincode Docker image:**
   ```bash
   cd blockchain/chaincode/routing
   docker build -t routing-chaincode:1.0 .
   cd ../../..
   ```

2. **Redeploy the chaincode:**
   ```bash
   ./blockchain/network/scripts/deploy-ccaas.sh
   ```
   OR use the Makefile:
   ```bash
   make deploy-chaincode
   ```

3. **Reinitialize segments:**
   The deployment script should automatically initialize segments. If not, you can manually initialize:
   ```bash
   make init-chaincode
   ```
   OR use the API endpoint:
   ```bash
   curl -X POST http://localhost:3001/api/segments/init
   ```

4. **Verify segments are created:**
   ```bash
   curl http://localhost:3001/api/segments
   ```
   You should see segments with IDs like `SEG_H01_I01`, `SEG_I01_I07`, etc.

## Note
After updating the chaincode, you must rebuild the Docker image and redeploy. The old segments (S1-S40) will be replaced with the new Manhattan segments.

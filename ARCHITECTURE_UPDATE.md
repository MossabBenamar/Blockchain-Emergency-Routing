# Architecture Update: Lazy Segment Initialization

## Summary
Updated the blockchain chaincode to use **lazy initialization** for segments. The blockchain now only stores **reservation state**, not map topology. Map data is stored in PostgreSQL.

## Changes Made

### 1. Lazy Initialization in `ReserveSegment`
- Segments are created on-the-fly when first reserved
- No need to pre-initialize segments in the blockchain
- Map topology (fromNode, toNode) is NOT stored in blockchain

### 2. Updated `GetSegment`
- Returns `nil` if segment doesn't exist (instead of error)
- Allows lazy creation in `ReserveSegment`

### 3. Deprecated `InitSegments`
- Function still exists for backward compatibility but does nothing
- No longer needed - segments are created when first reserved

### 4. Updated Segment Model
- `FromNode` and `ToNode` fields are deprecated (kept for backward compatibility)
- These fields are empty strings - map topology is in PostgreSQL only

## Architecture Benefits

### Separation of Concerns
- **PostgreSQL**: Stores map topology (nodes, segments, geometry, weights)
- **Blockchain**: Stores only reservation state (status, reservedBy, missionId, priority)

### Dynamic Map Updates
- Add/remove segments in PostgreSQL without touching chaincode
- No need to redeploy chaincode when map changes
- Backend calculates routes using PostgreSQL data

### Simplified Deployment
- No initialization step required
- Segments are created automatically when first reserved
- Cleaner, more maintainable codebase

## What the Blockchain Stores

**Stored:**
- `segmentId` (identifier)
- `status` (free/reserved/occupied)
- `reservedBy` (vehicle ID)
- `missionId`
- `orgType` (who reserved it)
- `priorityLevel`
- `reservedAt` (timestamp)

**NOT Stored:**
- `fromNode` / `toNode` (map topology - empty strings)
- Segment geometry
- Segment weights/lengths
- Map connections

## Migration Notes

1. **Rebuild chaincode Docker image:**
   ```bash
   cd blockchain/chaincode/routing
   docker build -t routing-chaincode:1.0 .
   ```

2. **Redeploy chaincode:**
   ```bash
   ./blockchain/network/scripts/deploy-ccaas.sh
   ```

3. **No initialization needed:**
   - `InitSegments` is no longer required
   - Segments will be created automatically when first reserved

4. **Existing segments:**
   - Old segments in blockchain will continue to work
   - New segments will be created lazily
   - No migration needed

## Testing

After redeployment, test by:
1. Creating a mission with a route
2. The segments should be created automatically in the blockchain
3. Verify reservation state is stored correctly
4. Check that map topology remains in PostgreSQL only

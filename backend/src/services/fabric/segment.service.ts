import { getContract, decodeResult, decodeResultOrDefault } from './gateway';
import { Segment, Conflict, ReserveSegmentRequest } from '../../models/types';

const CONTRACT_NAME = 'SegmentContract';

/**
 * Get a segment by ID
 */
export async function getSegment(segmentId: string): Promise<Segment> {
  const contract = await getContract(CONTRACT_NAME);
  
  const result = await contract.evaluateTransaction('GetSegment', segmentId);
  return decodeResult<Segment>(result);
}

/**
 * Get all segments
 */
export async function getAllSegments(): Promise<Segment[]> {
  const contract = await getContract(CONTRACT_NAME);
  
  const result = await contract.evaluateTransaction('GetAllSegments');
  return decodeResultOrDefault<Segment[]>(result, []);
}

/**
 * Get segments by status
 */
export async function getSegmentsByStatus(
  status: 'free' | 'reserved' | 'occupied'
): Promise<Segment[]> {
  const contract = await getContract(CONTRACT_NAME);
  
  const result = await contract.evaluateTransaction('GetSegmentsByStatus', status);
  return decodeResultOrDefault<Segment[]>(result, []);
}

/**
 * Reserve a segment for a vehicle/mission
 * Returns a conflict if one occurs
 */
export async function reserveSegment(
  request: ReserveSegmentRequest
): Promise<Conflict | null> {
  const contract = await getContract(CONTRACT_NAME);
  
  const result = await contract.submitTransaction(
    'ReserveSegment',
    request.segmentId,
    request.vehicleId,
    request.missionId,
    request.priorityLevel.toString()
  );
  
  if (result && result.length > 0) {
    const decoded = Buffer.from(result).toString('utf-8');
    if (decoded && decoded.length > 0 && decoded !== 'null') {
      try {
        const parsed = JSON.parse(decoded);
        if (parsed && parsed.conflictId) {
          return parsed as Conflict;
        }
      } catch {
        // Not a conflict response
      }
    }
  }
  
  return null;
}

/**
 * Release a segment reservation
 */
export async function releaseSegment(
  segmentId: string, 
  vehicleId: string
): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);
  
  await contract.submitTransaction('ReleaseSegment', segmentId, vehicleId);
}

/**
 * Mark a segment as occupied by a vehicle
 */
export async function occupySegment(
  segmentId: string, 
  vehicleId: string
): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);
  
  await contract.submitTransaction('OccupySegment', segmentId, vehicleId);
}

/**
 * Resolve a conflict
 */
export async function resolveConflict(
  conflictId: string,
  resolution: 'mission1_wins' | 'mission2_wins' | 'both_reroute'
): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);
  
  await contract.submitTransaction('ResolveConflict', conflictId, resolution);
}

/**
 * Get all pending conflicts
 */
export async function getPendingConflicts(): Promise<Conflict[]> {
  const contract = await getContract(CONTRACT_NAME);
  
  const result = await contract.evaluateTransaction('GetPendingConflicts');
  return decodeResultOrDefault<Conflict[]>(result, []);
}

/**
 * Initialize segments (should only be called once during setup)
 */
export async function initSegments(): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);
  
  await contract.submitTransaction('InitSegments');
}


/**
 * Mission Service - Fabric chaincode interactions for missions
 */

import { getContract } from './gateway';
import { Mission, CreateMissionRequest, ActivateMissionRequest } from '../../models/types';

const CONTRACT_NAME = 'MissionContract';

/**
 * Create a new mission (pending state)
 */
export async function createMission(request: CreateMissionRequest): Promise<Mission> {
  const contract = await getContract();
  
  // Generate mission ID if not provided
  const missionId = request.missionId || `MISSION-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
  
  console.log(`Creating mission ${missionId} for vehicle ${request.vehicleId}`);
  
  const result = await contract.submitTransaction(
    `${CONTRACT_NAME}:CreateMission`,
    missionId,
    request.vehicleId,
    request.originNode,
    request.destNode
  );

  // Fetch the created mission
  return getMission(missionId);
}

/**
 * Activate a pending mission with a calculated path
 */
export async function activateMission(missionId: string, path: string[]): Promise<Mission> {
  const contract = await getContract();
  
  console.log(`Activating mission ${missionId} with path: ${path.join(' -> ')}`);
  
  // Convert path array to JSON string for chaincode
  const pathJSON = JSON.stringify(path);
  
  await contract.submitTransaction(
    `${CONTRACT_NAME}:ActivateMission`,
    missionId,
    pathJSON
  );

  // Fetch the updated mission
  return getMission(missionId);
}

/**
 * Complete an active mission
 */
export async function completeMission(missionId: string): Promise<Mission> {
  const contract = await getContract();
  
  console.log(`Completing mission ${missionId}`);
  
  await contract.submitTransaction(
    `${CONTRACT_NAME}:CompleteMission`,
    missionId
  );

  // Fetch the updated mission
  return getMission(missionId);
}

/**
 * Abort a mission
 */
export async function abortMission(missionId: string, reason: string = ''): Promise<Mission> {
  const contract = await getContract();
  
  console.log(`Aborting mission ${missionId}: ${reason}`);
  
  await contract.submitTransaction(
    `${CONTRACT_NAME}:AbortMission`,
    missionId,
    reason
  );

  // Fetch the updated mission
  return getMission(missionId);
}

/**
 * Get a single mission by ID
 */
export async function getMission(missionId: string): Promise<Mission> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetMission`,
    missionId
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  return JSON.parse(resultString) as Mission;
}

/**
 * Get all missions
 */
export async function getAllMissions(): Promise<Mission[]> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetAllMissions`
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  const missions = JSON.parse(resultString) as Mission[];
  
  return missions || [];
}

/**
 * Get all active missions
 */
export async function getActiveMissions(): Promise<Mission[]> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetActiveMissions`
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  const missions = JSON.parse(resultString) as Mission[];
  
  return missions || [];
}

/**
 * Get missions by status
 */
export async function getMissionsByStatus(status: string): Promise<Mission[]> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetMissionsByStatus`,
    status
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  const missions = JSON.parse(resultString) as Mission[];
  
  return missions || [];
}

/**
 * Get missions by organization
 */
export async function getMissionsByOrg(orgType: string): Promise<Mission[]> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetMissionsByOrg`,
    orgType
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  const missions = JSON.parse(resultString) as Mission[];
  
  return missions || [];
}

/**
 * Get active mission for a specific vehicle
 */
export async function getVehicleActiveMission(vehicleId: string): Promise<Mission | null> {
  const contract = await getContract();
  
  const resultBytes = await contract.evaluateTransaction(
    `${CONTRACT_NAME}:GetVehicleActiveMission`,
    vehicleId
  );
  
  const resultString = Buffer.from(resultBytes).toString('utf8');
  
  if (!resultString || resultString === 'null' || resultString === '') {
    return null;
  }
  
  return JSON.parse(resultString) as Mission;
}

/**
 * Update mission path (re-routing)
 */
export async function updateMissionPath(missionId: string, newPath: string[]): Promise<Mission> {
  const contract = await getContract();
  
  console.log(`Updating path for mission ${missionId}`);
  
  const pathJSON = JSON.stringify(newPath);
  
  await contract.submitTransaction(
    `${CONTRACT_NAME}:UpdateMissionPath`,
    missionId,
    pathJSON
  );

  // Fetch the updated mission
  return getMission(missionId);
}

export default {
  createMission,
  activateMission,
  completeMission,
  abortMission,
  getMission,
  getAllMissions,
  getActiveMissions,
  getMissionsByStatus,
  getMissionsByOrg,
  getVehicleActiveMission,
  updateMissionPath,
};


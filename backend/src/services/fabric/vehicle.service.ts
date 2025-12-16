import { getContract, decodeResult, decodeResultOrDefault } from './gateway';
import { Vehicle, CreateVehicleRequest } from '../../models/types';

const CONTRACT_NAME = 'VehicleContract';

/**
 * Register a new vehicle in the blockchain
 */
export async function registerVehicle(request: CreateVehicleRequest): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);

  await contract.submitTransaction(
    'RegisterVehicle',
    request.vehicleId,
    request.orgType,
    request.vehicleType,
    request.priorityLevel.toString()
  );
}

/**
 * Get a vehicle by ID
 */
export async function getVehicle(vehicleId: string): Promise<Vehicle> {
  const contract = await getContract(CONTRACT_NAME);

  const result = await contract.evaluateTransaction('GetVehicle', vehicleId);
  return decodeResult<Vehicle>(result);
}

/**
 * Get all vehicles
 */
export async function getAllVehicles(): Promise<Vehicle[]> {
  const contract = await getContract(CONTRACT_NAME);

  const result = await contract.evaluateTransaction('GetAllVehicles');
  return decodeResultOrDefault<Vehicle[]>(result, []);
}

/**
 * Get vehicles by organization type
 */
export async function getVehiclesByOrg(orgType: 'medical' | 'police'): Promise<Vehicle[]> {
  const contract = await getContract(CONTRACT_NAME);

  const result = await contract.evaluateTransaction('GetVehiclesByOrg', orgType);
  return decodeResultOrDefault<Vehicle[]>(result, []);
}

/**
 * Update vehicle status
 */
export async function updateVehicleStatus(
  vehicleId: string,
  status: 'active' | 'inactive' | 'on_mission'
): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);

  await contract.submitTransaction('UpdateVehicleStatus', vehicleId, status);
}

/**
 * Check if a vehicle exists
 */
export async function vehicleExists(vehicleId: string): Promise<boolean> {
  const contract = await getContract(CONTRACT_NAME);

  const result = await contract.evaluateTransaction('VehicleExists', vehicleId);
  const decoded = Buffer.from(result).toString('utf-8');
  return decoded === 'true';
}

/**
 * Update vehicle priority level
 */
export async function updateVehiclePriority(vehicleId: string, priorityLevel: number): Promise<void> {
  const contract = await getContract(CONTRACT_NAME);

  await contract.submitTransaction('UpdateVehiclePriority', vehicleId, priorityLevel.toString());
}


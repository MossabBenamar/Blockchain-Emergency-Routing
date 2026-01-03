// Vehicle Simulation Service - Phase 5
// Discrete segment-by-segment movement simulation for emergency vehicles

import { broadcastMessage } from '../realtime/websocket';
import { emitVehiclePosition } from '../realtime/socketio';
import { completeMission as completeMissionChaincode } from '../fabric/mission.service';
import { occupySegment, releaseSegment } from '../fabric/segment.service';
import * as couchdb from '../couchdb';
import { getManhattanNodes, getManhattanSegments } from '../map/manhattan';
import type { Mission, WsMessage } from '../../models/types';

// Simulation configuration
const DEFAULT_SEGMENT_TRAVEL_TIME_MS = 3000; // 3 seconds per segment
const POSITION_UPDATE_INTERVAL_MS = 500; // Update position every 500ms

// Vehicle simulation state
interface VehicleSimState {
  vehicleId: string;
  missionId: string;
  path: string[];
  currentSegmentIndex: number;
  progress: number; // 0 to 100 (percentage along current segment)
  status: 'idle' | 'moving' | 'paused' | 'arrived' | 'aborted';
  orgType: string;
  priorityLevel: number;
  startedAt: number;
  pausedAt?: number;
}

// Global simulation state
interface SimulationState {
  isRunning: boolean;
  isPaused: boolean;
  vehicles: Map<string, VehicleSimState>;
  speedMultiplier: number;
  updateTimer: NodeJS.Timeout | null;
  segmentTravelTimeMs: number;
}

const simulationState: SimulationState = {
  isRunning: false,
  isPaused: false,
  vehicles: new Map(),
  speedMultiplier: 1.0,
  updateTimer: null,
  segmentTravelTimeMs: DEFAULT_SEGMENT_TRAVEL_TIME_MS,
};

/**
 * Get current simulation status
 */
export function getSimulationStatus() {
  const vehicleStates = Array.from(simulationState.vehicles.values());
  return {
    isRunning: simulationState.isRunning,
    isPaused: simulationState.isPaused,
    speedMultiplier: simulationState.speedMultiplier,
    activeVehicles: vehicleStates.filter(v => v.status === 'moving').length,
    totalVehicles: vehicleStates.length,
    vehicles: vehicleStates.map(v => ({
      vehicleId: v.vehicleId,
      missionId: v.missionId,
      currentSegmentIndex: v.currentSegmentIndex,
      currentSegment: v.path[v.currentSegmentIndex] || null,
      progress: v.progress,
      status: v.status,
      totalSegments: v.path.length,
    })),
  };
}

/**
 * Get all vehicle positions (for API and WebSocket)
 */
export function getVehiclePositions(): Array<{
  vehicleId: string;
  missionId: string;
  currentSegment: string | null;
  previousSegment: string | null;
  nextSegment: string | null;
  progress: number;
  status: string;
  segmentIndex: number;
  totalSegments: number;
  orgType: string;
}> {
  return Array.from(simulationState.vehicles.values()).map(v => ({
    vehicleId: v.vehicleId,
    missionId: v.missionId,
    currentSegment: v.path[v.currentSegmentIndex] || null,
    previousSegment: v.currentSegmentIndex > 0 ? v.path[v.currentSegmentIndex - 1] : null,
    nextSegment: v.currentSegmentIndex < v.path.length - 1 ? v.path[v.currentSegmentIndex + 1] : null,
    progress: v.progress,
    status: v.status,
    segmentIndex: v.currentSegmentIndex,
    totalSegments: v.path.length,
    orgType: v.orgType,
  }));
}

/**
 * Start or resume the simulation
 */
export async function startSimulation(): Promise<void> {
  if (simulationState.isRunning && !simulationState.isPaused) {
    console.log('Simulation already running');
    return;
  }

  console.log('Starting vehicle simulation...');

  // If resuming from pause
  if (simulationState.isPaused) {
    simulationState.isPaused = false;
    // Resume paused vehicles
    simulationState.vehicles.forEach(v => {
      if (v.status === 'paused') {
        v.status = 'moving';
      }
    });
  } else {
    // Fresh start - load active missions
    await loadActiveMissions();
  }

  // Start any idle vehicles (added before simulation started)
  simulationState.vehicles.forEach(v => {
    if (v.status === 'idle') {
      v.status = 'moving';
      console.log(`Started idle vehicle ${v.vehicleId}`);
    }
  });

  simulationState.isRunning = true;

  // Start the update loop
  if (!simulationState.updateTimer) {
    simulationState.updateTimer = setInterval(updateSimulation, POSITION_UPDATE_INTERVAL_MS);
  }

  // Broadcast simulation started event
  broadcastSimulationEvent('SIMULATION_STARTED', {
    status: getSimulationStatus(),
  });

  console.log('Simulation started with', simulationState.vehicles.size, 'vehicles');
}

/**
 * Pause the simulation
 */
export function pauseSimulation(): void {
  if (!simulationState.isRunning) {
    console.log('Simulation is not running');
    return;
  }

  simulationState.isPaused = true;

  // Pause all moving vehicles
  simulationState.vehicles.forEach(v => {
    if (v.status === 'moving') {
      v.status = 'paused';
      v.pausedAt = Date.now();
    }
  });

  // Broadcast simulation paused event
  broadcastSimulationEvent('SIMULATION_PAUSED', {
    status: getSimulationStatus(),
  });

  console.log('Simulation paused');
}

/**
 * Stop the simulation completely
 */
export function stopSimulation(): void {
  if (simulationState.updateTimer) {
    clearInterval(simulationState.updateTimer);
    simulationState.updateTimer = null;
  }

  simulationState.isRunning = false;
  simulationState.isPaused = false;
  simulationState.vehicles.clear();

  // Broadcast simulation stopped event
  broadcastSimulationEvent('SIMULATION_STOPPED', {
    status: getSimulationStatus(),
  });

  console.log('Simulation stopped');
}

/**
 * Set simulation speed
 */
export function setSimulationSpeed(multiplier: number): void {
  simulationState.speedMultiplier = Math.max(0.1, Math.min(5.0, multiplier));
  simulationState.segmentTravelTimeMs = DEFAULT_SEGMENT_TRAVEL_TIME_MS / simulationState.speedMultiplier;

  broadcastSimulationEvent('SIMULATION_SPEED_CHANGED', {
    speedMultiplier: simulationState.speedMultiplier,
    segmentTravelTimeMs: simulationState.segmentTravelTimeMs,
  });

  console.log('Simulation speed set to', simulationState.speedMultiplier + 'x');
}

/**
 * Add a vehicle to the simulation (called when a mission is activated)
 */
export function addVehicleToSimulation(mission: Mission): void {
  if (!mission.path || mission.path.length === 0) {
    console.log('Cannot add vehicle to simulation: no path defined');
    return;
  }

  const vehicleState: VehicleSimState = {
    vehicleId: mission.vehicleId,
    missionId: mission.missionId,
    path: mission.path,
    currentSegmentIndex: 0,
    progress: 0,
    status: simulationState.isRunning && !simulationState.isPaused ? 'moving' : 'idle',
    orgType: mission.orgType,
    priorityLevel: mission.priorityLevel,
    startedAt: Date.now(),
  };

  simulationState.vehicles.set(mission.vehicleId, vehicleState);

  console.log(`Vehicle ${mission.vehicleId} added to simulation with ${mission.path.length} segments, status: ${vehicleState.status}`);

  // Broadcast vehicle added event
  broadcastVehiclePosition(vehicleState);

  // Also broadcast a simulation event so the frontend knows a vehicle was added
  broadcastSimulationEvent('VEHICLE_ADDED', {
    vehicleId: mission.vehicleId,
    missionId: mission.missionId,
    status: vehicleState.status,
    path: mission.path,
  });
}

/**
 * Remove a vehicle from the simulation (called when mission completes or is aborted)
 */
export function removeVehicleFromSimulation(vehicleId: string): void {
  const vehicle = simulationState.vehicles.get(vehicleId);
  if (vehicle) {
    vehicle.status = 'arrived';
    broadcastVehiclePosition(vehicle);
    simulationState.vehicles.delete(vehicleId);
    console.log(`Vehicle ${vehicleId} removed from simulation`);
  }
}

/**
 * Load active missions and add vehicles to simulation
 * Uses CouchDB directly for more reliable reads
 */
async function loadActiveMissions(): Promise<void> {
  try {
    console.log('Loading active missions from CouchDB...');
    const missions = await couchdb.getActiveMissions();

    console.log(`Found ${missions.length} active missions in database`);

    let addedCount = 0;
    missions.forEach(mission => {
      console.log(`Checking mission ${mission.missionId}: status=${mission.status}, path length=${mission.path?.length || 0}`);

      if (mission.status === 'active' && mission.path && mission.path.length > 0) {
        // Don't add if already in simulation
        if (!simulationState.vehicles.has(mission.vehicleId)) {
          addVehicleToSimulation(mission);
          addedCount++;
        } else {
          console.log(`Vehicle ${mission.vehicleId} already in simulation, skipping`);
        }
      }
    });

    console.log(`Added ${addedCount} vehicles to simulation from ${missions.length} active missions`);

    if (addedCount === 0 && missions.length === 0) {
      console.log('No active missions found. Create and activate a mission first!');
    }
  } catch (error) {
    console.error('Error loading active missions:', error);
  }
}

/**
 * Main simulation update loop
 */
async function updateSimulation(): Promise<void> {
  if (!simulationState.isRunning || simulationState.isPaused) {
    return;
  }

  const progressIncrement = (POSITION_UPDATE_INTERVAL_MS / simulationState.segmentTravelTimeMs) * 100;

  // Create array of vehicles to process (to avoid modifying map during iteration)
  const vehiclesToProcess = Array.from(simulationState.vehicles.entries());

  for (const [vehicleId, vehicle] of vehiclesToProcess) {
    if (vehicle.status !== 'moving') {
      continue;
    }

    // Update progress
    vehicle.progress += progressIncrement;

    // Check if reached end of current segment
    if (vehicle.progress >= 100) {
      vehicle.progress = 0;

      const previousSegmentIndex = vehicle.currentSegmentIndex;
      const isLastSegment = previousSegmentIndex >= vehicle.path.length - 1;

      if (isLastSegment) {
        // Reached destination - handle arrival
        await handleArrival(vehicle);
        continue;
      } else {
        // Move to next segment
        vehicle.currentSegmentIndex++;

        // Handle segment transition
        await handleSegmentTransition(vehicle, previousSegmentIndex);
      }
    }

    // Broadcast position update (only if vehicle still exists)
    if (simulationState.vehicles.has(vehicleId)) {
      broadcastVehiclePosition(vehicle);
    }
  }
}

/**
 * Handle segment transition (update blockchain status)
 */
async function handleSegmentTransition(vehicle: VehicleSimState, previousSegmentIndex: number): Promise<void> {
  const previousSegment = vehicle.path[previousSegmentIndex];
  const currentSegment = vehicle.path[vehicle.currentSegmentIndex];

  // Safety check - don't try to transition to undefined segment
  if (!currentSegment) {
    console.log(`Vehicle ${vehicle.vehicleId}: No next segment, should have called handleArrival`);
    return;
  }

  console.log(`Vehicle ${vehicle.vehicleId} transitioning: ${previousSegment} -> ${currentSegment}`);

  // Release previous segment (fire and forget with retry)
  if (previousSegment) {
    releaseSegmentWithRetry(previousSegment, vehicle.vehicleId).catch(err => {
      console.error(`Failed to release segment ${previousSegment}:`, err.message);
    });
  }

  // Occupy current segment (fire and forget with retry)
  occupySegmentWithRetry(currentSegment, vehicle.vehicleId, vehicle.missionId).catch(err => {
    console.error(`Failed to occupy segment ${currentSegment}:`, err.message);
  });

  // Broadcast segment transition event
  broadcastSimulationEvent('SEGMENT_TRANSITION', {
    vehicleId: vehicle.vehicleId,
    missionId: vehicle.missionId,
    fromSegment: previousSegment,
    toSegment: currentSegment,
    segmentIndex: vehicle.currentSegmentIndex,
    totalSegments: vehicle.path.length,
  });
}

/**
 * Occupy segment with retry logic for MVCC conflicts
 * Gracefully handles cases where segment is already occupied or reserved by different vehicle
 */
async function occupySegmentWithRetry(segmentId: string, vehicleId: string, missionId: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await occupySegment(segmentId, vehicleId);
      broadcastSegmentUpdate(segmentId, 'occupied', vehicleId, missionId);
      return;
    } catch (error: any) {
      const errorMsg = error.message || error.details?.[0]?.message || '';

      // Check if segment is already occupied or has issues
      if (errorMsg.includes('already occupied') || errorMsg.includes('not reserved')) {
        console.log(`Segment ${segmentId} occupy issue: ${errorMsg}, continuing`);
        broadcastSegmentUpdate(segmentId, 'occupied', vehicleId, missionId); // Broadcast anyway for UI
        return;
      }

      // MVCC_READ_CONFLICT (code 11) or ABORTED (code 10) - retry
      if ((error.code === 11 || error.code === 10) && attempt < maxRetries) {
        console.log(`Blockchain conflict occupying segment ${segmentId}, retry ${attempt}/${maxRetries}`);
        await sleep(500 * attempt); // Exponential backoff
      } else if (attempt >= maxRetries) {
        // Max retries reached - log and continue (non-critical)
        console.warn(`Could not occupy segment ${segmentId} after ${maxRetries} attempts, continuing simulation`);
        broadcastSegmentUpdate(segmentId, 'occupied', vehicleId, missionId); // Broadcast anyway for UI
        return;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Handle vehicle arrival at destination
 */
async function handleArrival(vehicle: VehicleSimState): Promise<void> {
  // Prevent double arrival handling
  if (vehicle.status === 'arrived') {
    console.log(`Vehicle ${vehicle.vehicleId} already arrived, skipping`);
    return;
  }

  console.log(`Vehicle ${vehicle.vehicleId} arrived at destination`);

  // Mark as arrived immediately to prevent duplicate calls
  vehicle.status = 'arrived';

  // Remove from simulation immediately
  simulationState.vehicles.delete(vehicle.vehicleId);

  // Release the last segment (non-blocking, with retry)
  const lastSegment = vehicle.path[vehicle.path.length - 1];
  if (lastSegment) {
    releaseSegmentWithRetry(lastSegment, vehicle.vehicleId).catch(err => {
      console.error('Failed to release final segment after retries:', err);
    });
  }

  // Complete the mission on blockchain (non-blocking, with retry)
  completeMissionWithRetry(vehicle.missionId).catch(err => {
    console.error('Failed to complete mission after retries:', err);
  });

  // Broadcast arrival event
  broadcastSimulationEvent('VEHICLE_ARRIVED', {
    vehicleId: vehicle.vehicleId,
    missionId: vehicle.missionId,
  });

  // Broadcast mission completed event
  broadcastSimulationEvent('MISSION_COMPLETED', {
    mission: {
      missionId: vehicle.missionId,
      vehicleId: vehicle.vehicleId,
      status: 'completed',
    },
  });
}

/**
 * Release segment with retry logic for MVCC conflicts
 * Gracefully handles cases where segment is already free or not reserved by this vehicle
 */
async function releaseSegmentWithRetry(segmentId: string, vehicleId: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await releaseSegment(segmentId, vehicleId);
      broadcastSegmentUpdate(segmentId, 'free', vehicleId, null);
      return;
    } catch (error: any) {
      const errorMsg = error.message || error.details?.[0]?.message || '';

      // Check if this is a "not reserved by vehicle" error - segment is already free
      if (errorMsg.includes('not reserved by vehicle') || errorMsg.includes('is not reserved')) {
        console.log(`Segment ${segmentId} already free or not reserved by ${vehicleId}, skipping release`);
        broadcastSegmentUpdate(segmentId, 'free', vehicleId, null);
        return;
      }

      // MVCC_READ_CONFLICT (code 11) or ABORTED (code 10) - retry
      if ((error.code === 11 || error.code === 10) && attempt < maxRetries) {
        console.log(`Blockchain conflict releasing segment ${segmentId}, retry ${attempt}/${maxRetries}`);
        await sleep(500 * attempt); // Exponential backoff
      } else if (attempt >= maxRetries) {
        // Max retries reached - log and continue (non-critical)
        console.warn(`Could not release segment ${segmentId} after ${maxRetries} attempts, continuing simulation`);
        broadcastSegmentUpdate(segmentId, 'free', vehicleId, null); // Broadcast anyway for UI
        return;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Complete mission with retry logic for MVCC conflicts
 * Gracefully handles cases where mission is already completed
 */
async function completeMissionWithRetry(missionId: string, maxRetries = 3): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await completeMissionChaincode(missionId);
      console.log(`Mission ${missionId} completed on blockchain`);
      return;
    } catch (error: any) {
      const errorMsg = error.message || error.details?.[0]?.message || '';

      // Check if mission is already completed or not active
      if (errorMsg.includes('not active') || errorMsg.includes('already completed')) {
        console.log(`Mission ${missionId} already completed or not active, skipping`);
        return;
      }

      // MVCC_READ_CONFLICT (code 11) or ABORTED (code 10) - retry
      if ((error.code === 11 || error.code === 10) && attempt < maxRetries) {
        console.log(`Blockchain conflict completing mission ${missionId}, retry ${attempt}/${maxRetries}`);
        await sleep(500 * attempt); // Exponential backoff
      } else if (attempt >= maxRetries) {
        // Max retries reached - log and continue (non-critical for simulation)
        console.warn(`Could not complete mission ${missionId} on blockchain after ${maxRetries} attempts`);
        return;
      } else {
        throw error;
      }
    }
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate lat/lon position from vehicle state
 */
function calculateVehiclePosition(vehicle: VehicleSimState): { lat: number; lon: number } | null {
  const currentSegmentId = vehicle.path[vehicle.currentSegmentIndex];
  if (!currentSegmentId) return null;

  const segments = getManhattanSegments();
  const nodes = getManhattanNodes();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const segment = segments.find(s => s.id === currentSegmentId);
  if (!segment) return null;

  const fromNode = nodeMap.get(segment.from);
  const toNode = nodeMap.get(segment.to);
  if (!fromNode || !toNode) return null;

  // Interpolate position based on progress
  const progress = vehicle.progress / 100;
  const lat = fromNode.lat + (toNode.lat - fromNode.lat) * progress;
  const lon = fromNode.lon + (toNode.lon - fromNode.lon) * progress;

  return { lat, lon };
}

/**
 * Broadcast vehicle position update via WebSocket and Socket.IO
 */
function broadcastVehiclePosition(vehicle: VehicleSimState): void {
  const currentSegmentId = vehicle.path[vehicle.currentSegmentIndex] || null;
  const position = calculateVehiclePosition(vehicle);

  const positionData = {
      vehicleId: vehicle.vehicleId,
      missionId: vehicle.missionId,
    currentSegment: currentSegmentId,
      previousSegment: vehicle.currentSegmentIndex > 0 ? vehicle.path[vehicle.currentSegmentIndex - 1] : null,
      nextSegment: vehicle.currentSegmentIndex < vehicle.path.length - 1 ? vehicle.path[vehicle.currentSegmentIndex + 1] : null,
      progress: Math.round(vehicle.progress),
      segmentIndex: vehicle.currentSegmentIndex,
      totalSegments: vehicle.path.length,
      status: vehicle.status,
      orgType: vehicle.orgType,
    lat: position?.lat,
    lon: position?.lon,
    heading: position ? calculateHeading(vehicle) : undefined,
    speed: 50, // Default emergency vehicle speed in km/h
  };

  // Broadcast via WebSocket (legacy)
  const message: WsMessage = {
    type: 'VEHICLE_POSITION',
    payload: positionData,
    timestamp: Date.now(),
  };
  broadcastMessage(message);

  // Emit via Socket.IO (new)
  if (position) {
    emitVehiclePosition(positionData as any);
  }
}

/**
 * Calculate vehicle heading (direction of travel)
 */
function calculateHeading(vehicle: VehicleSimState): number {
  const currentSegmentId = vehicle.path[vehicle.currentSegmentIndex];
  if (!currentSegmentId) return 0;

  const segments = getManhattanSegments();
  const nodes = getManhattanNodes();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  const segment = segments.find(s => s.id === currentSegmentId);
  if (!segment) return 0;

  const fromNode = nodeMap.get(segment.from);
  const toNode = nodeMap.get(segment.to);
  if (!fromNode || !toNode) return 0;

  // Calculate bearing (heading) in degrees
  const lat1 = fromNode.lat * Math.PI / 180;
  const lat2 = toNode.lat * Math.PI / 180;
  const dLon = (toNode.lon - fromNode.lon) * Math.PI / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360; // Normalize to 0-360
}

/**
 * Broadcast segment status update via WebSocket
 */
function broadcastSegmentUpdate(segmentId: string, status: string, vehicleId: string, missionId: string | null): void {
  const message: WsMessage = {
    type: 'SEGMENT_UPDATED',
    payload: {
      action: status === 'free' ? 'released' : 'occupied',
      segment: {
        segmentId,
        status,
        reservedBy: vehicleId,
        missionId,
      },
    },
    timestamp: Date.now(),
  };

  broadcastMessage(message);
}

/**
 * Broadcast simulation event via WebSocket
 */
function broadcastSimulationEvent(eventType: string, payload: unknown): void {
  const message: WsMessage = {
    type: eventType,
    payload,
    timestamp: Date.now(),
  };

  broadcastMessage(message);
}

/**
 * Manually start simulation for a specific mission (useful for testing)
 * Uses CouchDB for reliable mission reads
 */
export async function simulateMission(missionId: string): Promise<void> {
  try {
    const mission = await couchdb.getMission(missionId);
    if (!mission) {
      throw new Error(`Mission ${missionId} not found`);
    }

    if (mission.status !== 'active') {
      throw new Error(`Mission ${missionId} is not active (status: ${mission.status})`);
    }

    if (!mission.path || mission.path.length === 0) {
      throw new Error(`Mission ${missionId} has no path defined`);
    }

    addVehicleToSimulation(mission);

    // Start simulation if not already running
    if (!simulationState.isRunning) {
      await startSimulation();
    }

    console.log(`Started simulation for mission ${missionId}`);
  } catch (error) {
    console.error(`Error simulating mission ${missionId}:`, error);
    throw error;
  }
}

/**
 * Reload active missions into simulation (can be called to refresh)
 */
export async function reloadMissions(): Promise<void> {
  await loadActiveMissions();

  broadcastSimulationEvent('SIMULATION_RELOADED', {
    status: getSimulationStatus(),
  });
}

/**
 * Handle mission rerouted event - update vehicle path in simulation
 * This is called when a mission is preempted and gets a new path
 */
export function handleMissionRerouted(missionId: string, newPath: string[]): boolean {
  // Find the vehicle with this mission
  let vehicle: VehicleSimState | undefined;

  for (const [vehicleId, v] of simulationState.vehicles.entries()) {
    if (v.missionId === missionId) {
      vehicle = v;
      break;
    }
  }

  if (!vehicle) {
    console.log(`[Simulation] Cannot reroute: no vehicle found for mission ${missionId}`);
    return false;
  }

  console.log(`[Simulation] Rerouting vehicle ${vehicle.vehicleId} for mission ${missionId}`);
  console.log(`  Old path: ${vehicle.path.join(' -> ')}`);
  console.log(`  New path: ${newPath.join(' -> ')}`);

  // Get current segment
  const currentSegment = vehicle.path[vehicle.currentSegmentIndex];

  // Find where the current segment is in the new path
  let newStartIndex = 0;
  if (currentSegment) {
    const indexInNewPath = newPath.indexOf(currentSegment);
    if (indexInNewPath >= 0) {
      // Continue from current segment in new path
      newStartIndex = indexInNewPath;
    } else {
      // Current segment not in new path - start from beginning
      // This can happen if the current segment was preempted
      console.log(`  Current segment ${currentSegment} not in new path, starting from beginning`);
    }
  }

  // Update vehicle's path
  vehicle.path = newPath;
  vehicle.currentSegmentIndex = newStartIndex;
  // Keep progress if we're on the same segment, otherwise reset
  if (newStartIndex === 0 && newPath[0] !== currentSegment) {
    vehicle.progress = 0;
  }

  console.log(`  Vehicle now at segment index ${newStartIndex} (${newPath[newStartIndex]})`);

  // Broadcast the update
  broadcastVehiclePosition(vehicle);
  broadcastSimulationEvent('VEHICLE_REROUTED', {
    vehicleId: vehicle.vehicleId,
    missionId: vehicle.missionId,
    newPath,
    currentSegmentIndex: newStartIndex,
    currentSegment: newPath[newStartIndex],
  });

  return true;
}

/**
 * Update a vehicle's path directly (for external rerouting)
 */
export function updateVehiclePath(vehicleId: string, newPath: string[]): boolean {
  const vehicle = simulationState.vehicles.get(vehicleId);

  if (!vehicle) {
    console.log(`[Simulation] Cannot update path: vehicle ${vehicleId} not in simulation`);
    return false;
  }

  return handleMissionRerouted(vehicle.missionId, newPath);
}

/**
 * Handle mission abort during simulation
 */
export function handleMissionAborted(missionId: string): boolean {
  // Find the vehicle with this mission
  let vehicleToRemove: string | undefined;

  for (const [vehicleId, v] of simulationState.vehicles.entries()) {
    if (v.missionId === missionId) {
      vehicleToRemove = vehicleId;
      v.status = 'aborted';
      break;
    }
  }

  if (!vehicleToRemove) {
    console.log(`[Simulation] Cannot abort: no vehicle found for mission ${missionId}`);
    return false;
  }

  const vehicle = simulationState.vehicles.get(vehicleToRemove)!;

  console.log(`[Simulation] Aborting vehicle ${vehicleToRemove} for mission ${missionId}`);

  // Broadcast abort event
  broadcastSimulationEvent('VEHICLE_ABORTED', {
    vehicleId: vehicleToRemove,
    missionId,
    currentSegment: vehicle.path[vehicle.currentSegmentIndex],
  });

  // Remove from simulation
  simulationState.vehicles.delete(vehicleToRemove);

  return true;
}

export default {
  getSimulationStatus,
  getVehiclePositions,
  startSimulation,
  pauseSimulation,
  stopSimulation,
  setSimulationSpeed,
  addVehicleToSimulation,
  removeVehicleFromSimulation,
  simulateMission,
  reloadMissions,
  handleMissionRerouted,
  updateVehiclePath,
  handleMissionAborted,
};


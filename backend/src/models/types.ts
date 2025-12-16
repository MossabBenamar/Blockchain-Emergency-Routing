// Vehicle types
export interface Vehicle {
  docType: string;
  vehicleId: string;
  orgType: 'medical' | 'police';
  vehicleType: string;
  priorityLevel: number;
  status: 'active' | 'inactive' | 'on_mission';
  registeredBy: string;
  registeredAt: number;
}

export interface CreateVehicleRequest {
  vehicleId: string;
  orgType: 'medical' | 'police';
  vehicleType: string;
  priorityLevel: number;
}

// Mission types
export interface Mission {
  docType: string;
  missionId: string;
  vehicleId: string;
  orgType: 'medical' | 'police';
  priorityLevel: number;
  originNode: string;
  destNode: string;
  path: string[];
  status: 'pending' | 'active' | 'completed' | 'aborted';
  createdAt: number;
  activatedAt?: number;
  completedAt?: number;
  createdBy: string;
}

export interface CreateMissionRequest {
  missionId?: string;  // Auto-generated if not provided
  vehicleId: string;
  originNode: string;
  destNode: string;
}

export interface ActivateMissionRequest {
  missionId: string;
  path: string[];
}

export interface RouteRequest {
  originNode: string;
  destNode: string;
  vehicleId: string;
}

export interface RouteResponse {
  success: boolean;
  path: string[];
  nodePath: string[];
  totalWeight: number;
  estimatedTime: number;
  analysis?: {
    freeSegments: number;
    reservedSegments: number;
    occupiedSegments: number;
    potentialConflicts: Array<{
      segmentId: string;
      currentPriority: number;
      willPreempt: boolean;
    }>;
  };
  error?: string;
}

// Segment types
export interface Segment {
  docType: string;
  segmentId: string;
  fromNode: string;
  toNode: string;
  status: 'free' | 'reserved' | 'occupied';
  reservedBy?: string;
  missionId?: string;
  orgType?: string;
  priorityLevel?: number;
  reservedAt?: number;
}

export interface ReserveSegmentRequest {
  segmentId: string;
  vehicleId: string;
  missionId: string;
  priorityLevel: number;
}

// Conflict types
export interface Conflict {
  docType: string;
  conflictId: string;
  segmentId: string;
  mission1Id: string;
  mission2Id: string;
  priority1: number;
  priority2: number;
  status: 'pending' | 'resolved';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: number;
  createdAt: number;
}

// Map types
export interface MapNode {
  id: string;
  x: number;
  y: number;
  label: string | null;
  type: 'intersection' | 'poi';
  orgType?: string;
}

export interface MapSegment {
  id: string;
  from: string;
  to: string;
  weight: number;
  direction: 'horizontal' | 'vertical';
  bidirectional: boolean;
}

export interface MapData {
  name: string;
  description: string;
  version: string;
  gridSize: {
    rows: number;
    cols: number;
  };
  nodes: MapNode[];
  segments: MapSegment[];
  pointsOfInterest: Array<{
    nodeId: string;
    name: string;
    type: string;
    orgType?: string;
  }>;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// WebSocket message types
export interface WsMessage {
  type: string;
  payload: unknown;
  timestamp: number;
}

export type WsEventType = 
  | 'SEGMENT_UPDATED'
  | 'VEHICLE_UPDATED'
  | 'CONFLICT_DETECTED'
  | 'CONFLICT_RESOLVED'
  | 'VEHICLE_POSITION'
  | 'SEGMENT_TRANSITION'
  | 'VEHICLE_ARRIVED'
  | 'SIMULATION_STARTED'
  | 'SIMULATION_PAUSED'
  | 'SIMULATION_STOPPED'
  | 'SIMULATION_SPEED_CHANGED';

// Simulation types
export interface VehiclePosition {
  vehicleId: string;
  missionId: string;
  currentSegment: string | null;
  previousSegment: string | null;
  nextSegment: string | null;
  progress: number;
  segmentIndex: number;
  totalSegments: number;
  status: 'idle' | 'moving' | 'paused' | 'arrived' | 'aborted';
  orgType: string;
}

export interface SimulationStatus {
  isRunning: boolean;
  isPaused: boolean;
  speedMultiplier: number;
  activeVehicles: number;
  totalVehicles: number;
  vehicles: Array<{
    vehicleId: string;
    missionId: string;
    currentSegmentIndex: number;
    currentSegment: string | null;
    progress: number;
    status: string;
    totalSegments: number;
  }>;
}


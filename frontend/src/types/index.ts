// Types for the Emergency Vehicle Routing System

export interface Node {
  id: string;
  x?: number;  // Grid coordinates (legacy)
  y?: number;  // Grid coordinates (legacy)
  lat?: number; // Latitude (for real maps)
  lon?: number; // Longitude (for real maps)
  label: string | null;
  type: 'poi' | 'intersection';
  orgType?: 'medical' | 'police';
}

export interface Segment {
  id: string;
  from: string;
  to: string;
  weight: number;
  direction?: 'horizontal' | 'vertical'; // Optional for real maps
  bidirectional: boolean;
  status?: 'free' | 'reserved' | 'occupied';
  reservedBy?: {
    vehicleId: string;
    missionId: string;
    orgType: string;
    priorityLevel: number;
  };
  geometry?: Array<[number, number]>; // Array of [lat, lon] coordinates for route geometry
}

export interface Vehicle {
  vehicleId: string;
  orgType: 'medical' | 'police';
  vehicleType: string;
  priorityLevel: number;
  status: 'active' | 'inactive' | 'on_mission' | 'maintenance';
  registeredAt?: number;
}

export interface PointOfInterest {
  nodeId: string;
  name: string;
  type: string;
  orgType?: string;
}

export interface MapData {
  name: string;
  description: string;
  version: string;
  gridSize: {
    rows: number;
    cols: number;
  };
  nodes: Node[];
  segments: Segment[];
  pointsOfInterest: PointOfInterest[];
}

export interface MapState {
  nodes: Node[];
  segments: Segment[];
  segmentStatus: {
    free: number;
    reserved: number;
    occupied: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
}

export type OrgType = 'medical' | 'police';

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
}

// Mission types
export interface Mission {
  missionId: string;
  vehicleId: string;
  orgType: OrgType;
  priorityLevel: number;
  originNode: string;
  destNode: string;
  path: string[];
  geometry?: Array<[number, number]>; // OSRM geometry for route visualization
  status: 'pending' | 'active' | 'completed' | 'aborted';
  createdAt: number;
  activatedAt?: number;
  completedAt?: number;
  createdBy: string;
}
export interface CreateMissionRequest {
  vehicleId: string;
  originNode: string;
  destNode: string;
}

export interface RouteResult {
  path: string[];
  nodePath: string[];
  totalWeight: number;
  estimatedTime: number;
  geometry?: Array<[number, number]>; // Route geometry as [lat, lon] coordinates
  distance?: number; // Distance in meters
  distanceKm?: number; // Distance in kilometers
  duration?: number; // Duration in seconds
  durationMinutes?: number; // Duration in minutes
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
}

// Phase 5: Simulation types
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
  orgType: OrgType;
  lat?: number; // Real-time GPS latitude
  lon?: number; // Real-time GPS longitude
  heading?: number; // Vehicle heading in degrees
  speed?: number; // Speed in km/h
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

export type SimulationState = 'stopped' | 'running' | 'paused';

// History types
export interface HistoryEvent {
  id: string;
  type: 'mission' | 'simulation' | 'segment' | 'system';
  action: string;
  timestamp: number;
  data: {
    missionId?: string;
    vehicleId?: string;
    segmentId?: string;
    orgType?: string;
    fromNode?: string;
    toNode?: string;
    path?: string[];
    status?: string;
    details?: string;
    [key: string]: unknown;
  };
}

export interface MissionHistoryEntry extends Mission {
  duration?: number | null;
  events?: HistoryEvent[];
}

export interface HistoryStats {
  totalEvents: number;
  totalMissions: number;
  completedMissions: number;
  abortedMissions: number;
  activeMissions: number;
  averageDuration: number | null;
  missionsByStatus: {
    pending: number;
    active: number;
    completed: number;
    aborted: number;
  };
  missionsByOrg: {
    medical: number;
    police: number;
  };
  totalMissionsOnChain: number;
  averagePathLength: number;
}


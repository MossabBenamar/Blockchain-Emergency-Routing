/**
 * History Service
 * 
 * Tracks mission events and simulation history in-memory
 * Could be extended to persist to CouchDB or other storage
 */

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

export interface MissionHistoryEntry {
  missionId: string;
  vehicleId: string;
  orgType: string;
  originNode: string;
  destNode: string;
  path: string[];
  status: 'pending' | 'active' | 'completed' | 'aborted';
  createdAt: number;
  activatedAt?: number;
  completedAt?: number;
  duration?: number; // in ms
  events: HistoryEvent[];
}

// In-memory storage for events (circular buffer)
const MAX_EVENTS = 500;
const eventHistory: HistoryEvent[] = [];

// Mission history cache (from blockchain + events)
const missionHistoryCache = new Map<string, MissionHistoryEntry>();

/**
 * Generate unique event ID
 */
function generateEventId(): string {
  return `EVT-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
}

/**
 * Add an event to history
 */
export function addEvent(
  type: HistoryEvent['type'],
  action: string,
  data: HistoryEvent['data']
): HistoryEvent {
  const event: HistoryEvent = {
    id: generateEventId(),
    type,
    action,
    timestamp: Date.now(),
    data,
  };

  // Add to circular buffer
  eventHistory.push(event);
  if (eventHistory.length > MAX_EVENTS) {
    eventHistory.shift();
  }

  // Update mission history cache if mission-related
  if (data.missionId && type === 'mission') {
    updateMissionHistoryCache(event);
  }

  return event;
}

/**
 * Update mission history cache with new event
 */
function updateMissionHistoryCache(event: HistoryEvent): void {
  const { missionId } = event.data;
  if (!missionId) return;

  const existing = missionHistoryCache.get(missionId);
  if (existing) {
    existing.events.push(event);
    
    // Update status based on action
    if (event.action === 'COMPLETED') {
      existing.status = 'completed';
      existing.completedAt = event.timestamp;
      if (existing.activatedAt) {
        existing.duration = event.timestamp - existing.activatedAt;
      }
    } else if (event.action === 'ABORTED') {
      existing.status = 'aborted';
      existing.completedAt = event.timestamp;
      if (existing.activatedAt) {
        existing.duration = event.timestamp - existing.activatedAt;
      }
    } else if (event.action === 'ACTIVATED') {
      existing.status = 'active';
      existing.activatedAt = event.timestamp;
    }
  } else {
    // Create new entry
    missionHistoryCache.set(missionId, {
      missionId,
      vehicleId: event.data.vehicleId || '',
      orgType: event.data.orgType || '',
      originNode: event.data.fromNode || '',
      destNode: event.data.toNode || '',
      path: event.data.path || [],
      status: (event.data.status as any) || 'pending',
      createdAt: event.timestamp,
      events: [event],
    });
  }
}

/**
 * Track mission created event
 */
export function trackMissionCreated(mission: any): void {
  addEvent('mission', 'CREATED', {
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    orgType: mission.orgType,
    fromNode: mission.originNode,
    toNode: mission.destNode,
    status: 'pending',
    details: `Mission created for vehicle ${mission.vehicleId}`,
  });
}

/**
 * Track mission activated event
 */
export function trackMissionActivated(mission: any): void {
  addEvent('mission', 'ACTIVATED', {
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    orgType: mission.orgType,
    fromNode: mission.originNode,
    toNode: mission.destNode,
    path: mission.path,
    status: 'active',
    details: `Mission activated with ${mission.path?.length || 0} segments`,
  });
}

/**
 * Track mission completed event
 */
export function trackMissionCompleted(mission: any): void {
  addEvent('mission', 'COMPLETED', {
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    orgType: mission.orgType,
    status: 'completed',
    details: `Mission completed successfully`,
  });
}

/**
 * Track mission aborted event
 */
export function trackMissionAborted(mission: any, reason?: string): void {
  addEvent('mission', 'ABORTED', {
    missionId: mission.missionId,
    vehicleId: mission.vehicleId,
    orgType: mission.orgType,
    status: 'aborted',
    details: reason || 'Mission aborted',
  });
}

/**
 * Track segment reservation
 */
export function trackSegmentReserved(segmentId: string, vehicleId: string, missionId: string): void {
  addEvent('segment', 'RESERVED', {
    segmentId,
    vehicleId,
    missionId,
    details: `Segment ${segmentId} reserved by ${vehicleId}`,
  });
}

/**
 * Track segment release
 */
export function trackSegmentReleased(segmentId: string, vehicleId: string): void {
  addEvent('segment', 'RELEASED', {
    segmentId,
    vehicleId,
    details: `Segment ${segmentId} released by ${vehicleId}`,
  });
}

/**
 * Track simulation events
 */
export function trackSimulationEvent(action: string, details: string, data?: any): void {
  addEvent('simulation', action, {
    ...data,
    details,
  });
}

/**
 * Track vehicle arrival
 */
export function trackVehicleArrived(vehicleId: string, missionId: string): void {
  addEvent('simulation', 'VEHICLE_ARRIVED', {
    vehicleId,
    missionId,
    details: `Vehicle ${vehicleId} arrived at destination`,
  });
}

/**
 * Get all events (most recent first)
 */
export function getEvents(options?: {
  limit?: number;
  type?: HistoryEvent['type'];
  action?: string;
  missionId?: string;
  vehicleId?: string;
  since?: number;
}): HistoryEvent[] {
  let events = [...eventHistory].reverse();

  if (options?.type) {
    events = events.filter(e => e.type === options.type);
  }
  if (options?.action) {
    events = events.filter(e => e.action === options.action);
  }
  if (options?.missionId) {
    events = events.filter(e => e.data.missionId === options.missionId);
  }
  if (options?.vehicleId) {
    events = events.filter(e => e.data.vehicleId === options.vehicleId);
  }
  if (options?.since) {
    events = events.filter(e => e.timestamp >= options.since);
  }
  if (options?.limit) {
    events = events.slice(0, options.limit);
  }

  return events;
}

/**
 * Get mission history from cache
 */
export function getMissionHistory(): MissionHistoryEntry[] {
  return Array.from(missionHistoryCache.values())
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get mission history for a specific mission
 */
export function getMissionHistoryById(missionId: string): MissionHistoryEntry | null {
  return missionHistoryCache.get(missionId) || null;
}

/**
 * Sync mission from blockchain to history cache
 */
export function syncMissionToHistory(mission: any): void {
  const existing = missionHistoryCache.get(mission.missionId);
  if (!existing) {
    missionHistoryCache.set(mission.missionId, {
      missionId: mission.missionId,
      vehicleId: mission.vehicleId,
      orgType: mission.orgType,
      originNode: mission.originNode,
      destNode: mission.destNode,
      path: mission.path || [],
      status: mission.status,
      createdAt: mission.createdAt,
      activatedAt: mission.activatedAt,
      completedAt: mission.completedAt,
      duration: mission.completedAt && mission.activatedAt 
        ? mission.completedAt - mission.activatedAt 
        : undefined,
      events: [],
    });
  }
}

/**
 * Clear history (for testing)
 */
export function clearHistory(): void {
  eventHistory.length = 0;
  missionHistoryCache.clear();
}

/**
 * Get statistics
 */
export function getHistoryStats(): {
  totalEvents: number;
  totalMissions: number;
  completedMissions: number;
  abortedMissions: number;
  activeMissions: number;
  averageDuration: number | null;
} {
  const missions = Array.from(missionHistoryCache.values());
  const completedMissions = missions.filter(m => m.status === 'completed');
  const abortedMissions = missions.filter(m => m.status === 'aborted');
  const activeMissions = missions.filter(m => m.status === 'active');

  const durationsWithValues = completedMissions
    .filter(m => m.duration !== undefined)
    .map(m => m.duration!);

  const averageDuration = durationsWithValues.length > 0
    ? durationsWithValues.reduce((a, b) => a + b, 0) / durationsWithValues.length
    : null;

  return {
    totalEvents: eventHistory.length,
    totalMissions: missions.length,
    completedMissions: completedMissions.length,
    abortedMissions: abortedMissions.length,
    activeMissions: activeMissions.length,
    averageDuration,
  };
}


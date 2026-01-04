/**
 * Mission API Routes
 * 
 * Handles mission lifecycle operations and routing calculations
 */

import { Router, Request, Response, NextFunction } from 'express';
import { missionService } from '../../services/fabric';
import * as couchdb from '../../services/couchdb';
import routingService from '../../services/routing';
import conflictService from '../../services/conflict';
import { broadcastMessage } from '../../services/realtime/websocket';
import { addVehicleToSimulation, getSimulationStatus, handleMissionRerouted } from '../../services/simulation';
import * as historyService from '../../services/history';
import {
  CreateMissionRequest,
  RouteRequest,
  Mission,
  Segment
} from '../../models/types';

const router = Router();

// Error wrapper for async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

// Retry helper for blockchain operations with MVCC conflicts
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      const errorCode = error.code || (error.cause?.code);

      // Retry on MVCC_READ_CONFLICT (11) or ABORTED (10)
      if ((errorCode === 11 || errorCode === 10) && attempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`${operationName} conflict, retry ${attempt}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

/**
 * GET /api/missions
 * Get all missions (with optional filters)
 * Uses CouchDB directly to bypass chaincode schema validation issues
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { status, org } = req.query;

  let missions: Mission[];

  if (status) {
    missions = await couchdb.getMissionsByStatus(status as string);
  } else if (org) {
    missions = await couchdb.getMissionsByOrg(org as string);
  } else {
    missions = await couchdb.getAllMissions();
  }

  res.json({
    success: true,
    data: missions,
  });
}));

/**
 * GET /api/missions/active
 * Get all active missions
 * Uses CouchDB directly to bypass chaincode schema validation issues
 */
router.get('/active', asyncHandler(async (_req: Request, res: Response) => {
  const missions = await couchdb.getActiveMissions();

  res.json({
    success: true,
    data: missions,
  });
}));

/**
 * GET /api/missions/:missionId
 * Get a single mission by ID
 * Uses CouchDB directly to bypass chaincode schema validation issues
 */
router.get('/:missionId', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;

  const mission = await couchdb.getMission(missionId);

  if (!mission) {
    res.status(404).json({
      success: false,
      error: `Mission ${missionId} not found`,
    });
    return;
  }

  res.json({
    success: true,
    data: mission,
  });
}));

/**
 * POST /api/missions
 * Create a new mission (pending state)
 */
router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const request: CreateMissionRequest = req.body;

  if (!request.vehicleId || !request.originNode || !request.destNode) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: vehicleId, originNode, destNode',
    });
    return;
  }

  const mission = await missionService.createMission(request);

  // Track in history
  historyService.trackMissionCreated(mission);

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_CREATED',
    payload: { mission },
    timestamp: Date.now(),
  });

  res.status(201).json({
    success: true,
    data: mission,
    message: 'Mission created successfully',
  });
}));
/**
 * POST /api/missions/:missionId/activate
 * Activate a pending mission with a path
 * Includes conflict detection and automatic rerouting
 */
router.post('/:missionId/activate', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;
  let { path } = req.body;

  if (!path || !Array.isArray(path) || path.length === 0) {
    res.status(400).json({
      success: false,
      error: 'Path array is required',
    });
    return;
  }

  // Get the pending mission to check its priority
  const pendingMission = await couchdb.getMission(missionId);
  if (!pendingMission) {
    res.status(404).json({
      success: false,
      error: `Mission ${missionId} not found`,
    });
    return;
  }

  // Check for conflicts before activating - get current segment states
  const segments = await couchdb.getAllSegments();
  const segmentMap = new Map<string, Segment>();
  segments.forEach(seg => segmentMap.set(seg.segmentId, seg));

  // Check each segment in the path for conflicts
  const blockedSegments: string[] = [];
  const preemptableSegments: { segmentId: string; missionId: string }[] = [];
  const sharedSegments: { segmentId: string; missionId: string }[] = [];

  for (const segmentId of path) {
    const availability = await conflictService.checkSegmentAvailability(
      segmentId,
      missionId,
      pendingMission.priorityLevel
    );

    if (!availability.available && !availability.requiresPreemption && !availability.requiresSharing) {
      // Segment is blocked by higher or equal priority - need to reroute
      blockedSegments.push(segmentId);
    } else if (availability.requiresPreemption && availability.existingMissionId) {
      // Can preempt - track for later handling
      preemptableSegments.push({
        segmentId,
        missionId: availability.existingMissionId,
      });
    } else if (availability.requiresSharing && availability.existingMissionId) {
      // Same-org sharing - log for tracking
      sharedSegments.push({
        segmentId,
        missionId: availability.existingMissionId,
      });
    }
  }

  // If there are blocked segments, try to find alternative route
  if (blockedSegments.length > 0) {
    console.log(`[ConflictCheck] Mission ${missionId} blocked on segments: ${blockedSegments.join(', ')}`);

    // Try to find alternative route avoiding blocked segments
    const alternativeRoute = await routingService.calculateRoute(
      pendingMission.originNode,
      pendingMission.destNode,
      pendingMission.priorityLevel,
      segmentMap as any,
      blockedSegments
    );

    if (!alternativeRoute.success) {
      // No alternative route - cannot activate
      res.status(409).json({
        success: false,
        error: `Cannot activate mission: segments ${blockedSegments.join(', ')} are blocked by higher priority vehicles and no alternative route exists`,
        blockedSegments,
      });
      return;
    }

    // Use the alternative route
    console.log(`[ConflictCheck] Found alternative route for ${missionId}: ${alternativeRoute.path.join(' -> ')}`);
    path = alternativeRoute.path;

    // Notify about the reroute
    broadcastMessage({
      type: 'MISSION_REROUTED_BEFORE_ACTIVATION',
      payload: {
        missionId,
        originalPath: req.body.path,
        newPath: path,
        reason: `Avoided blocked segments: ${blockedSegments.join(', ')}`,
      },
      timestamp: Date.now(),
    });
  }

  // Handle preemptions if this mission has higher priority
  for (const preemption of preemptableSegments) {
    console.log(`[ConflictCheck] Mission ${missionId} will preempt ${preemption.missionId} on segment ${preemption.segmentId}`);

    // Reroute the preempted mission
    const rerouteResult = await conflictService.rerouteMission(preemption.missionId, [preemption.segmentId]);

    if (rerouteResult.success && rerouteResult.newPath) {
      // Update simulation if vehicle is moving
      handleMissionRerouted(preemption.missionId, rerouteResult.newPath);
    }
  }

  // Now activate the mission with the (possibly updated) path
  const mission = await withRetry(
    () => missionService.activateMission(missionId, path),
    3,
    `Activate mission ${missionId}`
  );

  // Track in history
  historyService.trackMissionActivated(mission);

  // Auto-add to simulation if running
  const simStatus = getSimulationStatus();
  if (simStatus.isRunning) {
    addVehicleToSimulation(mission);
    console.log(`Auto-added vehicle ${mission.vehicleId} to running simulation`);
  }

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_ACTIVATED',
    payload: {
      mission,
      wasRerouted: blockedSegments.length > 0,
      preemptedMissions: preemptableSegments.map(p => p.missionId),
      sharedSegments: sharedSegments.length, // Number of shared segments
    },
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    data: mission,
    message: blockedSegments.length > 0
      ? 'Mission activated with alternative route (original path was blocked)'
      : preemptableSegments.length > 0
        ? `Mission activated (preempted ${preemptableSegments.length} lower priority mission(s))`
        : sharedSegments.length > 0
          ? `Mission activated (sharing ${sharedSegments.length} segment(s) with same-org vehicles)`
          : 'Mission activated successfully',
  });
}));

/**
 * POST /api/missions/:missionId/complete
 * Complete an active mission
 */
router.post('/:missionId/complete', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;

  const mission = await withRetry(
    () => missionService.completeMission(missionId),
    3,
    `Complete mission ${missionId}`
  );

  // Track in history
  historyService.trackMissionCompleted(mission);

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_COMPLETED',
    payload: { mission },
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    data: mission,
    message: 'Mission completed successfully',
  });
}));

/**
 * POST /api/missions/:missionId/abort
 * Abort a mission
 */
router.post('/:missionId/abort', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;
  const { reason } = req.body;

  const mission = await withRetry(
    () => missionService.abortMission(missionId, reason || 'Manual abort'),
    3,
    `Abort mission ${missionId}`
  );

  // Track in history
  historyService.trackMissionAborted(mission, reason);

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_ABORTED',
    payload: { mission, reason },
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    data: mission,
    message: 'Mission aborted',
  });
}));

/**
 * POST /api/missions/:missionId/reroute
 * Update the path for an active mission
 */
router.post('/:missionId/reroute', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;
  const { newPath } = req.body;

  if (!newPath || !Array.isArray(newPath)) {
    res.status(400).json({
      success: false,
      error: 'New path array is required',
    });
    return;
  }

  const mission = await missionService.updateMissionPath(missionId, newPath);

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_REROUTED',
    payload: { mission, newPath },
    timestamp: Date.now(),
  });

  res.json({
    success: true,
    data: mission,
    message: 'Mission rerouted successfully',
  });
}));

/**
 * GET /api/missions/vehicle/:vehicleId
 * Get active mission for a specific vehicle
 * Uses CouchDB directly to bypass chaincode schema validation issues
 */
router.get('/vehicle/:vehicleId', asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId } = req.params;

  // Query CouchDB for active mission with this vehicle
  const activeMissions = await couchdb.getActiveMissions();
  const mission = activeMissions.find(m => m.vehicleId === vehicleId) || null;

  res.json({
    success: true,
    data: mission,
  });
}));

/**
 * POST /api/routes/calculate
 * Calculate optimal route for a mission
 * Supports both node-based and coordinate-based routing
 */
router.post('/routes/calculate', asyncHandler(async (req: Request, res: Response) => {
  const request: RouteRequest = req.body;

  // Check if using coordinate-based routing (new method)
  if (request.originLat !== undefined && request.originLon !== undefined &&
    request.destLat !== undefined && request.destLon !== undefined) {
    // Coordinate-based routing using OSRM
    const osrmService = (await import('../../services/osrm/osrmService')).osrmService;

    const osrmResult = await osrmService.calculateRoute(
      request.originLat,
      request.originLon,
      request.destLat,
      request.destLon,
      { profile: 'driving' }
    );

    if (!osrmResult.success) {
      res.status(400).json({
        success: false,
        error: osrmResult.error || 'Failed to calculate route with OSRM',
      });
      return;
    }

    // Store route in PostgreSQL if available
    try {
      const postgres = await import('../../services/database/postgres');
      const pool = postgres.getPool();
      if (pool) {
        const routeId = `ROUTE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await postgres.storeRoute({
          routeId,
          missionId: request.missionId,
          vehicleId: request.vehicleId,
          originLat: request.originLat,
          originLon: request.originLon,
          destLat: request.destLat,
          destLon: request.destLon,
          geometry: osrmResult.geometry,
          distanceMeters: osrmResult.distance,
          durationSeconds: osrmResult.duration,
        });
      }
    } catch (error) {
      console.warn('Failed to store route in PostgreSQL:', error);
      // Continue without storing
    }

    res.json({
      success: true,
      data: {
        path: [], // No segment path for OSRM routes
        nodePath: [], // No node path for coordinate-based routes
        totalWeight: osrmResult.distanceKm,
        estimatedTime: osrmResult.duration,
        geometry: osrmResult.geometry,
        distance: osrmResult.distance,
        distanceKm: osrmResult.distanceKm,
        duration: osrmResult.duration,
        durationMinutes: osrmResult.durationMinutes,
        analysis: {
          freeSegments: 0,
          reservedSegments: 0,
          occupiedSegments: 0,
          potentialConflicts: [],
        },
      },
    });
    return;
  }

  // Legacy node-based routing (existing method)
  if (!request.originNode || !request.destNode || !request.vehicleId) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: either (originLat, originLon, destLat, destLon) or (originNode, destNode, vehicleId)',
    });
    return;
  }

  // Get vehicle priority
  const vehicle = await couchdb.getVehicle(request.vehicleId);
  if (!vehicle) {
    res.status(404).json({
      success: false,
      error: `Vehicle ${request.vehicleId} not found`,
    });
    return;
  }
  const vehiclePriority = vehicle.priorityLevel;

  // Get current segment statuses from CouchDB (bypasses chaincode schema validation)
  const segments = await couchdb.getAllSegments();
  const segmentMap = new Map<string, Segment>();
  for (const seg of segments) {
    segmentMap.set(seg.segmentId, seg);
  }

  // Calculate route
  let result = await routingService.calculateRoute(
    request.originNode,
    request.destNode,
    vehiclePriority,
    segmentMap as any
  );

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error || 'Failed to calculate route',
    });
    return;
  }

  // SIMULATE ACTIVATION LOGIC: Check for strict conflicts
  // This ensures the Preview matches exactly what will happen when "Launch" is clicked.
  const blockedSegments: string[] = [];
  for (const segmentId of result.path) {
    const segment = segmentMap.get(segmentId);
    if (segment && segment.status !== 'free') {
      const segmentPriority = segment.priorityLevel ?? 5;
      if (vehiclePriority < segmentPriority) {
        // Can preempt - not blocked
      } else {
        // Same or higher priority - Blocked by FCFS or strict priority
        // Launch logic would reject this, so Preview must too.
        blockedSegments.push(segmentId);
      }
    }
  }

  // If the initial "weighted" path hit blocked segments (despite penalties),
  // we must re-calculate with HARD exclusions, just like 'create-and-activate' does.
  if (blockedSegments.length > 0) {
    const alternativeResult = await routingService.calculateRoute(
      request.originNode,
      request.destNode,
      vehiclePriority,
      segmentMap as any,
      blockedSegments // Hard exclude
    );

    if (alternativeResult.success) {
      result = alternativeResult;
    }
    // If no alternative exists, we return the original (blocked) path to let the user see the failure/error eventually,
    // or we could return an error here. For now, showing the blocked path with analysis warnings is acceptable,
    // but typically we want to show the route we *tried* to take.
  }

  if (!result.success) {
    res.status(400).json({
      success: false,
      error: result.error || 'Failed to calculate route',
    });
    return;
  }

  // Analyze the route
  const analysis = routingService.analyzeRoute(result.path, segmentMap as any, vehiclePriority);

  res.json({
    success: true,
    data: {
      path: result.path,
      nodePath: result.nodePath,
      totalWeight: result.totalWeight,
      estimatedTime: result.estimatedTime,
      geometry: result.geometry,
      analysis,
    },
  });
}));

/**
 * POST /api/routes/alternatives
 * Get alternative routes
 */
router.post('/routes/alternatives', asyncHandler(async (req: Request, res: Response) => {
  const { originNode, destNode, vehicleId, primaryPath, numAlternatives } = req.body;

  if (!originNode || !destNode || !vehicleId) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: originNode, destNode, vehicleId',
    });
    return;
  }

  // Get vehicle priority
  const vehicle = await couchdb.getVehicle(vehicleId);
  if (!vehicle) {
    res.status(404).json({
      success: false,
      error: `Vehicle ${vehicleId} not found`,
    });
    return;
  }
  const vehiclePriority = vehicle.priorityLevel;

  // Get current segment statuses from CouchDB (bypasses chaincode schema validation)
  const segments = await couchdb.getAllSegments();
  const segmentMap = new Map<string, Segment>();
  for (const seg of segments) {
    segmentMap.set(seg.segmentId, seg);
  }

  // If no primary path provided, calculate it first
  let primary = primaryPath;
  if (!primary) {
    const primaryResult = await routingService.calculateRoute(
      originNode,
      destNode,
      vehiclePriority,
      segmentMap as any
    );
    primary = primaryResult.path;
  }

  // Find alternatives
  const alternatives = await routingService.findAlternativeRoutes(
    originNode,
    destNode,
    vehiclePriority,
    segmentMap as any,
    primary,
    numAlternatives || 3
  );

  res.json({
    success: true,
    data: {
      primary: primary,
      alternatives: alternatives.map(alt => ({
        path: alt.path,
        nodePath: alt.nodePath,
        totalWeight: alt.totalWeight,
        estimatedTime: alt.estimatedTime,
      })),
    },
  });
}));

/**
 * POST /api/missions/create-and-activate
 * Convenience endpoint: Create mission, calculate route, and activate in one call
 * Includes conflict detection and automatic rerouting
 */
router.post('/create-and-activate', asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId, originNode, destNode } = req.body;

  if (!vehicleId || !originNode || !destNode) {
    res.status(400).json({
      success: false,
      error: 'Missing required fields: vehicleId, originNode, destNode',
    });
    return;
  }

  // 1. Get vehicle priority
  const vehicle = await couchdb.getVehicle(vehicleId);
  if (!vehicle) {
    res.status(404).json({
      success: false,
      error: `Vehicle ${vehicleId} not found`,
    });
    return;
  }
  const vehiclePriority = vehicle.priorityLevel;

  // 2. Get current segment statuses from CouchDB (bypasses chaincode schema validation)
  const segments = await couchdb.getAllSegments();
  const segmentMap = new Map<string, Segment>();
  for (const seg of segments) {
    segmentMap.set(seg.segmentId, seg);
  }

  // 3. Calculate optimal route
  let routeResult = await routingService.calculateRoute(
    originNode,
    destNode,
    vehiclePriority,
    segmentMap as any
  );

  if (!routeResult.success) {
    res.status(400).json({
      success: false,
      error: routeResult.error || 'Failed to calculate route',
    });
    return;
  }

  // 4. Check for conflicts before creating mission
  const blockedSegments: string[] = [];
  const preemptableSegments: { segmentId: string; missionId: string }[] = [];
  const sharedSegments: { segmentId: string; missionId: string }[] = [];

  for (const segmentId of routeResult.path) {
    const segment = segmentMap.get(segmentId);
    if (segment && segment.status !== 'free') {
      const segmentPriority = segment.priorityLevel ?? 5;
      const segmentOrg = segment.orgType;
      const vehicleOrg = vehicle.orgType;

      // SAME ORG = COOPERATIVE SHARING
      if (segmentOrg && vehicleOrg && segmentOrg === vehicleOrg) {
        if (segment.missionId) {
          sharedSegments.push({
            segmentId,
            missionId: segment.missionId,
          });
        }
      } else if (vehiclePriority < segmentPriority) {
        // CROSS-ORG: Can preempt
        if (segment.missionId) {
          preemptableSegments.push({
            segmentId,
            missionId: segment.missionId,
          });
        }
      } else {
        // CROSS-ORG: Blocked by higher or equal priority
        blockedSegments.push(segmentId);
      }
    }
  }

  // If blocked, find alternative route
  let wasRerouted = false;
  if (blockedSegments.length > 0) {
    console.log(`[ConflictCheck] New mission for ${vehicleId} blocked on: ${blockedSegments.join(', ')}`);

    const alternativeRoute = await routingService.calculateRoute(
      originNode,
      destNode,
      vehiclePriority,
      segmentMap as any,
      blockedSegments
    );

    if (!alternativeRoute.success) {
      res.status(409).json({
        success: false,
        error: `Cannot create mission: segments ${blockedSegments.join(', ')} are blocked and no alternative route exists`,
        blockedSegments,
      });
      return;
    }

    routeResult = alternativeRoute;
    wasRerouted = true;
    console.log(`[ConflictCheck] Found alternative route: ${routeResult.path.join(' -> ')}`);
  }

  // 5. Create mission
  const mission = await missionService.createMission({
    vehicleId,
    originNode,
    destNode,
  });

  // 6. Handle preemptions if any
  for (const preemption of preemptableSegments) {
    console.log(`[ConflictCheck] Mission ${mission.missionId} will preempt ${preemption.missionId} on segment ${preemption.segmentId}`);

    const rerouteResult = await conflictService.rerouteMission(preemption.missionId, [preemption.segmentId]);

    if (rerouteResult.success && rerouteResult.newPath) {
      handleMissionRerouted(preemption.missionId, rerouteResult.newPath);
    }
  }

  // 7. Activate mission with calculated path
  const activatedMission = await missionService.activateMission(mission.missionId, routeResult.path);

  // Track in history
  historyService.trackMissionCreated(mission);
  historyService.trackMissionActivated(activatedMission);

  // Analyze the route
  const analysis = routingService.analyzeRoute(routeResult.path, segmentMap as any, vehiclePriority);

  // Auto-add to simulation if running
  const simStatus = getSimulationStatus();
  if (simStatus.isRunning) {
    addVehicleToSimulation(activatedMission);
    console.log(`Auto-added vehicle ${activatedMission.vehicleId} to running simulation`);
  }

  // Broadcast to WebSocket clients
  broadcastMessage({
    type: 'MISSION_CREATED_AND_ACTIVATED',
    payload: {
      mission: activatedMission,
      route: {
        path: routeResult.path,
        nodePath: routeResult.nodePath,
        estimatedTime: routeResult.estimatedTime,
      },
      wasRerouted,
      preemptedMissions: preemptableSegments.map(p => p.missionId),
      sharedSegments: sharedSegments.length,
    },
    timestamp: Date.now(),
  });

  res.status(201).json({
    success: true,
    data: {
      mission: activatedMission,
      route: {
        path: routeResult.path,
        nodePath: routeResult.nodePath,
        totalWeight: routeResult.totalWeight,
        estimatedTime: routeResult.estimatedTime,
        analysis,
      },
    },
    message: wasRerouted
      ? 'Mission created with alternative route (original path was blocked)'
      : preemptableSegments.length > 0
        ? `Mission created and activated (preempted ${preemptableSegments.length} mission(s))`
        : sharedSegments.length > 0
          ? `Mission created and activated (sharing ${sharedSegments.length} segment(s) with same-org vehicles)`
          : 'Mission created and activated successfully',
  });
}));

export default router;


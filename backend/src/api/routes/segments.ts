import { Router, Request, Response } from 'express';
import * as segmentService from '../../services/fabric/segment.service';
import * as couchdb from '../../services/couchdb';
import conflictService from '../../services/conflict';
import { ReserveSegmentRequest, ApiResponse, Segment, Conflict } from '../../models/types';
import { broadcastMessage } from '../../services/realtime/websocket';

const router = Router();

/**
 * GET /api/segments
 * Get all segments or filter by status
 * Uses direct CouchDB query for read operations (bypasses chaincode schema validation)
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;

    let segments: Segment[];

    if (status === 'free' || status === 'reserved' || status === 'occupied') {
      segments = await couchdb.getSegmentsByStatus(status as string);
    } else {
      segments = await couchdb.getAllSegments();
    }

    const response: ApiResponse<Segment[]> = {
      success: true,
      data: segments,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting segments:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get segments',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/segments/:id
 * Get a specific segment by ID
 * Uses direct CouchDB query for read operations
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Skip special routes
    if (id === 'conflicts' || id === 'init') {
      return res.status(400).json({ success: false, error: 'Invalid segment ID' });
    }

    const segment = await couchdb.getSegment(id);

    if (!segment) {
      return res.status(404).json({
        success: false,
        error: `Segment ${id} not found`,
      });
    }

    const response: ApiResponse<Segment> = {
      success: true,
      data: segment,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting segment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get segment',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/segments/reserve
 * Reserve a segment for a vehicle/mission
 */
router.post('/reserve', async (req: Request, res: Response) => {
  try {
    const request: ReserveSegmentRequest = req.body;

    // Validate request
    if (!request.segmentId || !request.vehicleId || !request.missionId) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: segmentId, vehicleId, missionId',
      });
    }

    if (!request.priorityLevel || request.priorityLevel < 1 || request.priorityLevel > 5) {
      return res.status(400).json({
        success: false,
        error: 'priorityLevel must be between 1 and 5',
      });
    }

    const conflict = await segmentService.reserveSegment(request);

    // Get updated segment via CouchDB (avoids chaincode schema validation issues)
    await new Promise(resolve => setTimeout(resolve, 100));
    const segment = await couchdb.getSegment(request.segmentId);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'SEGMENT_UPDATED',
      payload: { action: 'reserved', segment },
      timestamp: Date.now(),
    });

    if (conflict) {
      // Conflict occurred - segment reserved by same priority
      broadcastMessage({
        type: 'CONFLICT_DETECTED',
        payload: conflict,
        timestamp: Date.now(),
      });

      const response: ApiResponse<{ segment: Segment | null; conflict: Conflict }> = {
        success: true,
        data: { segment, conflict },
        message: 'Conflict detected - requires resolution',
      };
      return res.status(409).json(response);
    }

    const response: ApiResponse<Segment | null> = {
      success: true,
      data: segment,
      message: `Segment ${request.segmentId} reserved successfully`,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('Error reserving segment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reserve segment',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/segments/:id/release
 * Release a segment reservation
 */
router.post('/:id/release', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'vehicleId is required',
      });
    }

    await segmentService.releaseSegment(id, vehicleId);

    // Get updated segment via CouchDB (avoids chaincode schema validation issues)
    // Wait a moment for CouchDB to sync
    await new Promise(resolve => setTimeout(resolve, 100));
    const segment = await couchdb.getSegment(id);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'SEGMENT_UPDATED',
      payload: { action: 'released', segment },
      timestamp: Date.now(),
    });

    const response: ApiResponse<Segment | null> = {
      success: true,
      data: segment,
      message: `Segment ${id} released successfully`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error releasing segment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to release segment',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/segments/:id/occupy
 * Mark a segment as occupied by a vehicle
 */
router.post('/:id/occupy', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { vehicleId } = req.body;

    if (!vehicleId) {
      return res.status(400).json({
        success: false,
        error: 'vehicleId is required',
      });
    }

    await segmentService.occupySegment(id, vehicleId);

    // Get updated segment via CouchDB (avoids chaincode schema validation issues)
    await new Promise(resolve => setTimeout(resolve, 100));
    const segment = await couchdb.getSegment(id);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'SEGMENT_UPDATED',
      payload: { action: 'occupied', segment },
      timestamp: Date.now(),
    });

    const response: ApiResponse<Segment | null> = {
      success: true,
      data: segment,
      message: `Segment ${id} now occupied`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error occupying segment:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to occupy segment',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/segments/conflicts/pending
 * Get all pending conflicts
 */
router.get('/conflicts/pending', async (req: Request, res: Response) => {
  try {
    const conflicts = await segmentService.getPendingConflicts();

    const response: ApiResponse<Conflict[]> = {
      success: true,
      data: conflicts,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting pending conflicts:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pending conflicts',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/segments/conflicts/:id/resolve
 * Resolve a conflict
 */
router.post('/conflicts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution } = req.body;

    const validResolutions = ['mission1_wins', 'mission2_wins', 'both_reroute'];
    if (!resolution || !validResolutions.includes(resolution)) {
      return res.status(400).json({
        success: false,
        error: `Invalid resolution. Must be one of: ${validResolutions.join(', ')}`,
      });
    }

    await segmentService.resolveConflict(id, resolution);

    // Broadcast resolution via WebSocket
    broadcastMessage({
      type: 'CONFLICT_RESOLVED',
      payload: { conflictId: id, resolution },
      timestamp: Date.now(),
    });

    const response: ApiResponse<{ conflictId: string; resolution: string }> = {
      success: true,
      data: { conflictId: id, resolution },
      message: `Conflict ${id} resolved with ${resolution}`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error resolving conflict:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resolve conflict',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/segments/conflicts/history
 * Get conflict resolution history
 */
router.get('/conflicts/history', async (req: Request, res: Response) => {
  try {
    const history = conflictService.getConflictHistory();

    const response: ApiResponse<typeof history> = {
      success: true,
      data: history,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting conflict history:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get conflict history',
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/segments/init
 * Initialize segments (admin only - should be called once)
 */
router.post('/init', async (req: Request, res: Response) => {
  try {
    await segmentService.initSegments();

    const response: ApiResponse<null> = {
      success: true,
      message: 'Segments initialized successfully',
    };

    res.json(response);
  } catch (error) {
    console.error('Error initializing segments:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to initialize segments',
    };
    res.status(500).json(response);
  }
});

export default router;


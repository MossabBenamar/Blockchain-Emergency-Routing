import { Router, Request, Response } from 'express';
import * as vehicleService from '../../services/fabric/vehicle.service';
import { CreateVehicleRequest, ApiResponse, Vehicle } from '../../models/types';
import { broadcastMessage } from '../../services/realtime/websocket';

const router = Router();

/**
 * GET /api/vehicles
 * Get all vehicles or filter by organization
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { org } = req.query;

    let vehicles: Vehicle[];

    if (org === 'medical' || org === 'police') {
      vehicles = await vehicleService.getVehiclesByOrg(org);
    } else {
      vehicles = await vehicleService.getAllVehicles();
    }

    const response: ApiResponse<Vehicle[]> = {
      success: true,
      data: vehicles,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting vehicles:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get vehicles',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/vehicles/:id
 * Get a specific vehicle by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const vehicle = await vehicleService.getVehicle(id);

    const response: ApiResponse<Vehicle> = {
      success: true,
      data: vehicle,
    };

    res.json(response);
  } catch (error) {
    console.error('Error getting vehicle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get vehicle';

    // Check if it's a "not found" error
    if (errorMessage.includes('does not exist')) {
      const response: ApiResponse<null> = {
        success: false,
        error: `Vehicle ${req.params.id} not found`,
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: false,
      error: errorMessage,
    };
    res.status(500).json(response);
  }
});

/**
 * POST /api/vehicles
 * Register a new vehicle
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const request: CreateVehicleRequest = req.body;

    // Validate request
    if (!request.vehicleId || !request.orgType || !request.vehicleType) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: vehicleId, orgType, vehicleType',
      });
    }

    if (request.orgType !== 'medical' && request.orgType !== 'police') {
      return res.status(400).json({
        success: false,
        error: 'orgType must be "medical" or "police"',
      });
    }

    if (!request.priorityLevel || request.priorityLevel < 1 || request.priorityLevel > 5) {
      return res.status(400).json({
        success: false,
        error: 'priorityLevel must be between 1 and 5',
      });
    }

    await vehicleService.registerVehicle(request);

    // Get the created vehicle to return
    const vehicle = await vehicleService.getVehicle(request.vehicleId);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'VEHICLE_UPDATED',
      payload: { action: 'created', vehicle },
      timestamp: Date.now(),
    });

    const response: ApiResponse<Vehicle> = {
      success: true,
      data: vehicle,
      message: `Vehicle ${request.vehicleId} registered successfully`,
    };

    res.status(201).json(response);
  } catch (error) {
    console.error('Error registering vehicle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to register vehicle';

    // Check for duplicate
    if (errorMessage.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: errorMessage,
      });
    }

    const response: ApiResponse<null> = {
      success: false,
      error: errorMessage,
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/vehicles/:id/status
 * Update vehicle status
 */
router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Validate status
    const validStatuses = ['active', 'inactive', 'on_mission'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    await vehicleService.updateVehicleStatus(id, status);

    // Get updated vehicle
    const vehicle = await vehicleService.getVehicle(id);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'VEHICLE_UPDATED',
      payload: { action: 'status_changed', vehicle },
      timestamp: Date.now(),
    });

    const response: ApiResponse<Vehicle> = {
      success: true,
      data: vehicle,
      message: `Vehicle ${id} status updated to ${status}`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating vehicle status:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update vehicle status',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/vehicles/:id/exists
 * Check if a vehicle exists
 */
router.get('/:id/exists', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const exists = await vehicleService.vehicleExists(id);

    const response: ApiResponse<{ exists: boolean }> = {
      success: true,
      data: { exists },
    };

    res.json(response);
  } catch (error) {
    console.error('Error checking vehicle existence:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check vehicle existence',
    };
    res.status(500).json(response);
  }
});

/**
 * PUT /api/vehicles/:id/priority
 * Update vehicle priority level
 */
router.put('/:id/priority', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { priorityLevel } = req.body;

    // Validate priority
    if (!priorityLevel || priorityLevel < 1 || priorityLevel > 5) {
      return res.status(400).json({
        success: false,
        error: 'priorityLevel must be between 1 and 5',
      });
    }

    await vehicleService.updateVehiclePriority(id, priorityLevel);

    // Get updated vehicle
    const vehicle = await vehicleService.getVehicle(id);

    // Broadcast update via WebSocket
    broadcastMessage({
      type: 'VEHICLE_UPDATED',
      payload: { action: 'priority_changed', vehicle },
      timestamp: Date.now(),
    });

    const response: ApiResponse<Vehicle> = {
      success: true,
      data: vehicle,
      message: `Vehicle ${id} priority updated to ${priorityLevel}`,
    };

    res.json(response);
  } catch (error) {
    console.error('Error updating vehicle priority:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update vehicle priority',
    };
    res.status(500).json(response);
  }
});

export default router;


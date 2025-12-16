// Simulation API Routes - Phase 5
// Control vehicle simulation for emergency routing

import { Router, Request, Response, NextFunction } from 'express';
import {
  getSimulationStatus,
  getVehiclePositions,
  startSimulation,
  pauseSimulation,
  stopSimulation,
  setSimulationSpeed,
  simulateMission,
  reloadMissions,
} from '../../services/simulation';

const router = Router();

/**
 * GET /api/simulation/status
 * Get current simulation status
 */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = getSimulationStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    console.error('Error getting simulation status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/simulation/positions
 * Get all vehicle positions
 */
router.get('/positions', (req: Request, res: Response) => {
  try {
    const positions = getVehiclePositions();
    res.json({
      success: true,
      data: positions,
    });
  } catch (error) {
    console.error('Error getting vehicle positions:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/start
 * Start or resume the simulation
 */
router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await startSimulation();
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: 'Simulation started',
      data: status,
    });
  } catch (error) {
    console.error('Error starting simulation:', error);
    next(error);
  }
});

/**
 * POST /api/simulation/pause
 * Pause the simulation
 */
router.post('/pause', (req: Request, res: Response) => {
  try {
    pauseSimulation();
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: 'Simulation paused',
      data: status,
    });
  } catch (error) {
    console.error('Error pausing simulation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/stop
 * Stop the simulation completely
 */
router.post('/stop', (req: Request, res: Response) => {
  try {
    stopSimulation();
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: 'Simulation stopped',
      data: status,
    });
  } catch (error) {
    console.error('Error stopping simulation:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/speed
 * Set simulation speed multiplier
 * Body: { speed: number } (0.1 to 5.0)
 */
router.post('/speed', (req: Request, res: Response) => {
  try {
    const { speed } = req.body;
    
    if (typeof speed !== 'number' || speed < 0.1 || speed > 5.0) {
      return res.status(400).json({
        success: false,
        error: 'Speed must be a number between 0.1 and 5.0',
      });
    }

    setSimulationSpeed(speed);
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: `Simulation speed set to ${speed}x`,
      data: status,
    });
  } catch (error) {
    console.error('Error setting simulation speed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/simulation/mission/:missionId
 * Start simulation for a specific mission
 */
router.post('/mission/:missionId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { missionId } = req.params;
    await simulateMission(missionId);
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: `Started simulation for mission ${missionId}`,
      data: status,
    });
  } catch (error) {
    console.error('Error simulating mission:', error);
    next(error);
  }
});

/**
 * POST /api/simulation/reload
 * Reload active missions into simulation
 */
router.post('/reload', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await reloadMissions();
    const status = getSimulationStatus();
    res.json({
      success: true,
      message: 'Missions reloaded',
      data: status,
    });
  } catch (error) {
    console.error('Error reloading missions:', error);
    next(error);
  }
});

export default router;


/**
 * History API Routes
 * 
 * Provides access to mission history and event logs
 */

import { Router, Request, Response, NextFunction } from 'express';
import * as historyService from '../../services/history';
import * as couchdb from '../../services/couchdb';

const router = Router();

// Error wrapper for async handlers
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

/**
 * GET /api/history/events
 * Get event history with optional filters
 */
router.get('/events', asyncHandler(async (req: Request, res: Response) => {
  const { 
    limit, 
    type, 
    action, 
    missionId, 
    vehicleId,
    since 
  } = req.query;

  const events = historyService.getEvents({
    limit: limit ? parseInt(limit as string, 10) : 100,
    type: type as any,
    action: action as string,
    missionId: missionId as string,
    vehicleId: vehicleId as string,
    since: since ? parseInt(since as string, 10) : undefined,
  });

  res.json({
    success: true,
    data: events,
  });
}));

/**
 * GET /api/history/missions
 * Get all missions (both active and historical) from blockchain
 */
router.get('/missions', asyncHandler(async (req: Request, res: Response) => {
  const { status, org, limit } = req.query;

  // Get all missions from CouchDB (blockchain state)
  let missions = await couchdb.getAllMissions();

  // Filter by status if provided
  if (status) {
    missions = missions.filter(m => m.status === status);
  }

  // Filter by org if provided
  if (org) {
    missions = missions.filter(m => m.orgType === org);
  }

  // Sort by createdAt descending (most recent first)
  missions.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  // Sync to history cache
  missions.forEach(m => historyService.syncMissionToHistory(m));

  // Apply limit
  if (limit) {
    missions = missions.slice(0, parseInt(limit as string, 10));
  }

  // Add duration for completed missions
  const enrichedMissions = missions.map((m: any) => ({
    ...m,
    duration: m.completedAt && m.activatedAt ? m.completedAt - m.activatedAt : null,
  }));

  res.json({
    success: true,
    data: enrichedMissions,
  });
}));

/**
 * GET /api/history/missions/:missionId
 * Get detailed history for a specific mission
 */
router.get('/missions/:missionId', asyncHandler(async (req: Request, res: Response) => {
  const { missionId } = req.params;

  // Get mission from blockchain
  const mission = await couchdb.getMission(missionId);
  
  if (!mission) {
    res.status(404).json({
      success: false,
      error: `Mission ${missionId} not found`,
    });
    return;
  }

  // Get events for this mission
  const events = historyService.getEvents({ missionId });

  // Get from history cache for additional data
  const historyEntry = historyService.getMissionHistoryById(missionId);

  res.json({
    success: true,
    data: {
      mission: {
        ...mission,
        duration: mission.completedAt && mission.activatedAt 
          ? mission.completedAt - mission.activatedAt 
          : null,
      },
      events,
      timeline: historyEntry?.events || events,
    },
  });
}));

/**
 * GET /api/history/stats
 * Get summary statistics
 */
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  // Get all missions from blockchain to sync
  const missions = await couchdb.getAllMissions();
  missions.forEach(m => historyService.syncMissionToHistory(m));

  // Get stats
  const stats = historyService.getHistoryStats();

  // Calculate additional stats from blockchain data
  const missionsByStatus = {
    pending: missions.filter((m: any) => m.status === 'pending').length,
    active: missions.filter((m: any) => m.status === 'active').length,
    completed: missions.filter((m: any) => m.status === 'completed').length,
    aborted: missions.filter((m: any) => m.status === 'aborted').length,
  };

  const missionsByOrg = {
    medical: missions.filter((m: any) => m.orgType === 'medical').length,
    police: missions.filter((m: any) => m.orgType === 'police').length,
  };

  // Calculate average path length
  const pathLengths = missions
    .filter((m: any) => m.path && m.path.length > 0)
    .map((m: any) => m.path.length);
  const avgPathLength = pathLengths.length > 0
    ? pathLengths.reduce((a: number, b: number) => a + b, 0) / pathLengths.length
    : 0;

  res.json({
    success: true,
    data: {
      ...stats,
      missionsByStatus,
      missionsByOrg,
      totalMissionsOnChain: missions.length,
      averagePathLength: Math.round(avgPathLength * 10) / 10,
    },
  });
}));

/**
 * GET /api/history/vehicles/:vehicleId
 * Get mission history for a specific vehicle
 */
router.get('/vehicles/:vehicleId', asyncHandler(async (req: Request, res: Response) => {
  const { vehicleId } = req.params;
  const { limit } = req.query;

  // Get all missions for this vehicle from blockchain
  const allMissions = await couchdb.getAllMissions();
  let vehicleMissions = allMissions.filter((m: any) => m.vehicleId === vehicleId);

  // Sort by createdAt descending
  vehicleMissions.sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  // Apply limit
  if (limit) {
    vehicleMissions = vehicleMissions.slice(0, parseInt(limit as string, 10));
  }

  // Get events for this vehicle
  const events = historyService.getEvents({ 
    vehicleId, 
    limit: 50 
  });

  // Add duration and enrich
  const enrichedMissions = vehicleMissions.map((m: any) => ({
    ...m,
    duration: m.completedAt && m.activatedAt ? m.completedAt - m.activatedAt : null,
  }));

  // Calculate vehicle stats
  const completed = vehicleMissions.filter((m: any) => m.status === 'completed');
  const aborted = vehicleMissions.filter((m: any) => m.status === 'aborted');
  const durations = completed
    .filter((m: any) => m.completedAt && m.activatedAt)
    .map((m: any) => m.completedAt - m.activatedAt);
  const avgDuration = durations.length > 0
    ? durations.reduce((a: number, b: number) => a + b, 0) / durations.length
    : null;

  res.json({
    success: true,
    data: {
      vehicleId,
      missions: enrichedMissions,
      events,
      stats: {
        totalMissions: vehicleMissions.length,
        completedMissions: completed.length,
        abortedMissions: aborted.length,
        successRate: vehicleMissions.length > 0 
          ? Math.round((completed.length / vehicleMissions.length) * 100) 
          : 0,
        averageDuration: avgDuration,
      },
    },
  });
}));

/**
 * GET /api/history/recent
 * Get recent activity summary
 */
router.get('/recent', asyncHandler(async (req: Request, res: Response) => {
  const { hours } = req.query;
  const hoursAgo = parseInt(hours as string, 10) || 24;
  const since = Date.now() - (hoursAgo * 60 * 60 * 1000);

  // Get recent events
  const events = historyService.getEvents({ since, limit: 100 });

  // Get recent missions from blockchain
  const allMissions = await couchdb.getAllMissions();
  const recentMissions = allMissions
    .filter((m: any) => (m.createdAt || 0) >= since)
    .sort((a: any, b: any) => (b.createdAt || 0) - (a.createdAt || 0));

  res.json({
    success: true,
    data: {
      periodHours: hoursAgo,
      since,
      events,
      missions: recentMissions,
      summary: {
        totalEvents: events.length,
        totalMissions: recentMissions.length,
        newMissions: recentMissions.filter((m: any) => 
          (m.createdAt || 0) >= since
        ).length,
        completedMissions: recentMissions.filter((m: any) => 
          m.status === 'completed' && (m.completedAt || 0) >= since
        ).length,
      },
    },
  });
}));

export default router;


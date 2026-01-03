import { Router, Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as couchdb from '../../services/couchdb';
import { ApiResponse, MapData, Segment } from '../../models/types';
import {
  getManhattanNodes,
  getManhattanSegments,
  getManhattanBounds,
  getManhattanCenter,
  getManhattanZoom,
} from '../../services/map/manhattan';

const router = Router();

// Cache the map data
let mapDataCache: MapData | null = null;

/**
 * Load Manhattan map data
 */
function loadMapData(): MapData {
  if (mapDataCache) {
    return mapDataCache;
  }
  
  const nodes = getManhattanNodes();
  const segments = getManhattanSegments();
  const bounds = getManhattanBounds();
  const center = getManhattanCenter();
  const zoom = getManhattanZoom();
  
  // Convert to MapNode format
  const mapNodes = nodes.map(node => ({
    id: node.id,
    lat: node.lat,
    lon: node.lon,
    label: node.label,
    type: node.type,
    orgType: node.orgType,
  }));
  
  // Convert to MapSegment format
  const mapSegments = segments.map(segment => ({
    id: segment.id,
    from: segment.from,
    to: segment.to,
    weight: segment.weight,
    bidirectional: segment.bidirectional,
    geometry: segment.geometry,
  }));
  
  // Extract POIs
  const pointsOfInterest = nodes
    .filter(node => node.type === 'poi')
    .map(node => ({
      nodeId: node.id,
      name: node.label || node.id,
      type: node.type,
      orgType: node.orgType,
    }));
  
  mapDataCache = {
    name: 'Manhattan Emergency Routing Map',
    description: 'Real-time emergency vehicle routing system for Manhattan',
    version: '2.0.0',
    nodes: mapNodes,
    segments: mapSegments,
    pointsOfInterest,
    bounds,
    center,
    zoom,
  };
  
  return mapDataCache;
}

/**
 * GET /api/map
 * Get the complete map data with static information
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const mapData = loadMapData();
    
    const response: ApiResponse<MapData> = {
      success: true,
      data: mapData,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting map data:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load map data',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/map/nodes
 * Get all map nodes
 */
router.get('/nodes', async (req: Request, res: Response) => {
  try {
    const mapData = loadMapData();
    
    const response: ApiResponse<typeof mapData.nodes> = {
      success: true,
      data: mapData.nodes,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting map nodes:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load map nodes',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/map/state
 * Get the current state of the map (segments with blockchain status)
 */
router.get('/state', async (req: Request, res: Response) => {
  try {
    const mapData = loadMapData();
    const segments = await couchdb.getAllSegments();
    
    // Merge static map data with dynamic blockchain state
    const segmentStatusMap = new Map<string, Segment>();
    for (const segment of segments) {
      segmentStatusMap.set(segment.segmentId, segment);
    }
    
    // Combine map segments with their blockchain status
    const segmentsWithState = mapData.segments.map(mapSegment => {
      const blockchainSegment = segmentStatusMap.get(mapSegment.id);
      return {
        ...mapSegment,
        status: blockchainSegment?.status || 'free',
        reservedBy: blockchainSegment?.reservedBy || null,
        missionId: blockchainSegment?.missionId || null,
        orgType: blockchainSegment?.orgType || null,
        priorityLevel: blockchainSegment?.priorityLevel || null,
      };
    });
    
    const response: ApiResponse<{
      nodes: typeof mapData.nodes;
      segments: typeof segmentsWithState;
      pointsOfInterest: typeof mapData.pointsOfInterest;
      gridSize: typeof mapData.gridSize;
    }> = {
      success: true,
      data: {
        nodes: mapData.nodes,
        segments: segmentsWithState,
        pointsOfInterest: mapData.pointsOfInterest,
        gridSize: mapData.gridSize,
      },
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting map state:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load map state',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/map/pois
 * Get points of interest
 */
router.get('/pois', async (req: Request, res: Response) => {
  try {
    const mapData = loadMapData();
    
    const response: ApiResponse<typeof mapData.pointsOfInterest> = {
      success: true,
      data: mapData.pointsOfInterest,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting POIs:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load POIs',
    };
    res.status(500).json(response);
  }
});

/**
 * GET /api/map/statistics
 * Get map statistics (counts, status breakdown)
 */
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const mapData = loadMapData();
    const segments = await couchdb.getAllSegments();
    
    // Count segments by status
    const statusCounts = {
      free: 0,
      reserved: 0,
      occupied: 0,
    };
    
    for (const segment of segments) {
      if (segment.status === 'free') statusCounts.free++;
      else if (segment.status === 'reserved') statusCounts.reserved++;
      else if (segment.status === 'occupied') statusCounts.occupied++;
    }
    
    const statistics = {
      totalNodes: mapData.nodes.length,
      totalSegments: mapData.segments.length,
      pointsOfInterest: mapData.pointsOfInterest.length,
      gridSize: mapData.gridSize,
      segmentStatus: statusCounts,
      utilizationRate: ((statusCounts.reserved + statusCounts.occupied) / segments.length * 100).toFixed(2) + '%',
    };
    
    const response: ApiResponse<typeof statistics> = {
      success: true,
      data: statistics,
    };
    
    res.json(response);
  } catch (error) {
    console.error('Error getting map statistics:', error);
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load map statistics',
    };
    res.status(500).json(response);
  }
});

export default router;


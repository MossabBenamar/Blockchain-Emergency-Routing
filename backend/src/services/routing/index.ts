/**
 * Routing Service - Dijkstra's Algorithm for Emergency Vehicle Routing
 * 
 * This service calculates optimal paths considering:
 * - Current segment reservations
 * - Vehicle priority levels
 * - Blocked/occupied segments
 */

import { Segment as BlockchainSegment } from '../../models/types';
import { getManhattanNodes, getManhattanSegments } from '../map/manhattan';
import { osrmService } from '../osrm/osrmService';

// Graph data structures
interface Node {
  id: string;
  x?: number;
  y?: number;
  lat?: number;
  lon?: number;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  weight: number;
  bidirectional: boolean;
  geometry?: Array<[number, number]>;
}

interface Graph {
  nodes: Map<string, Node>;
  adjacency: Map<string, Map<string, { edgeId: string; weight: number }>>;
}

interface RouteResult {
  success: boolean;
  path: string[];         // Array of segment IDs
  nodePath: string[];     // Array of node IDs
  totalWeight: number;
  estimatedTime: number;  // In seconds
  geometry?: Array<[number, number]>; // Route geometry
  error?: string;
}

// Load Manhattan map data
function getMapNodes(): Node[] {
  const manhattanNodes = getManhattanNodes();
  return manhattanNodes.map(node => ({
    id: node.id,
    lat: node.lat,
    lon: node.lon,
  }));
}

function getMapEdges(): Edge[] {
  return getManhattanSegments();
}

// Build graph from map data
function buildGraph(): Graph {
  const graph: Graph = {
    nodes: new Map(),
    adjacency: new Map(),
  };

  const MAP_NODES = getMapNodes();
  const MAP_EDGES = getMapEdges();

  // Add nodes
  for (const node of MAP_NODES) {
    graph.nodes.set(node.id, node);
    graph.adjacency.set(node.id, new Map());
  }

  // Add edges
  for (const edge of MAP_EDGES) {
    // Add forward direction
    const fromAdj = graph.adjacency.get(edge.from);
    if (fromAdj) {
      fromAdj.set(edge.to, { edgeId: edge.id, weight: edge.weight });
    }

    // Add reverse direction if bidirectional
    if (edge.bidirectional) {
      const toAdj = graph.adjacency.get(edge.to);
      if (toAdj) {
        toAdj.set(edge.from, { edgeId: edge.id, weight: edge.weight });
      }
    }
  }

  return graph;
}

// Priority Queue implementation using a min-heap
class PriorityQueue<T> {
  private items: { item: T; priority: number }[] = [];

  enqueue(item: T, priority: number): void {
    this.items.push({ item, priority });
    this.bubbleUp(this.items.length - 1);
  }

  dequeue(): T | undefined {
    if (this.items.length === 0) return undefined;
    
    const result = this.items[0].item;
    const last = this.items.pop();
    
    if (this.items.length > 0 && last) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    
    return result;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  private bubbleUp(index: number): void {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.items[parentIndex].priority <= this.items[index].priority) break;
      [this.items[parentIndex], this.items[index]] = [this.items[index], this.items[parentIndex]];
      index = parentIndex;
    }
  }

  private bubbleDown(index: number): void {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.items.length && this.items[leftChild].priority < this.items[smallest].priority) {
        smallest = leftChild;
      }
      if (rightChild < this.items.length && this.items[rightChild].priority < this.items[smallest].priority) {
        smallest = rightChild;
      }

      if (smallest === index) break;
      [this.items[index], this.items[smallest]] = [this.items[smallest], this.items[index]];
      index = smallest;
    }
  }
}

// Calculate edge weight based on segment status and vehicle priority
function calculateEdgeWeight(
  baseWeight: number,
  segmentStatus: BlockchainSegment | undefined,
  vehiclePriority: number
): number {
  if (!segmentStatus) return baseWeight;

  const status = segmentStatus.status;

  // Free segment - base weight
  if (status === 'free') {
    return baseWeight;
  }

  // Occupied segment - very high penalty (almost blocked)
  if (status === 'occupied') {
    return baseWeight * 100;
  }

  // Reserved segment - penalty based on priority comparison
  if (status === 'reserved' && segmentStatus.priorityLevel !== undefined) {
    const reservedPriority = segmentStatus.priorityLevel;

    if (vehiclePriority < reservedPriority) {
      // Our vehicle has higher priority - can preempt, small penalty
      return baseWeight * 2;
    } else if (vehiclePriority === reservedPriority) {
      // Same priority - moderate penalty (might cause conflict)
      return baseWeight * 5;
    } else {
      // Lower priority - high penalty (will be denied)
      return baseWeight * 20;
    }
  }

  return baseWeight;
}

// Get segment connecting two nodes
function getSegmentBetweenNodes(fromNode: string, toNode: string): string | undefined {
  const MAP_EDGES = getMapEdges();
  for (const edge of MAP_EDGES) {
    if ((edge.from === fromNode && edge.to === toNode) ||
        (edge.bidirectional && edge.from === toNode && edge.to === fromNode)) {
      return edge.id;
    }
  }
  return undefined;
}

/**
 * Find the optimal route using Dijkstra's algorithm
 * 
 * @param originNode Starting node ID
 * @param destNode Destination node ID
 * @param vehiclePriority Priority level of the vehicle (1-5, lower is higher priority)
 * @param segmentStatuses Current status of all segments from blockchain
 * @param excludeSegments Optional array of segment IDs to exclude (blocked)
 * @returns RouteResult with path and metadata
 */
export async function calculateRoute(
  originNode: string,
  destNode: string,
  vehiclePriority: number,
  segmentStatuses: Map<string, BlockchainSegment>,
  excludeSegments: string[] = []
): Promise<RouteResult> {
  const graph = buildGraph();

  // Validate nodes exist
  if (!graph.nodes.has(originNode)) {
    return { success: false, path: [], nodePath: [], totalWeight: 0, estimatedTime: 0, error: `Origin node ${originNode} not found` };
  }
  if (!graph.nodes.has(destNode)) {
    return { success: false, path: [], nodePath: [], totalWeight: 0, estimatedTime: 0, error: `Destination node ${destNode} not found` };
  }

  // Same node - no path needed
  if (originNode === destNode) {
    return { success: true, path: [], nodePath: [originNode], totalWeight: 0, estimatedTime: 0 };
  }

  // Dijkstra's algorithm
  const distances = new Map<string, number>();
  const previous = new Map<string, string | null>();
  const visited = new Set<string>(); // Track visited nodes to prevent infinite loops
  const pq = new PriorityQueue<string>();

  // Initialize distances
  for (const nodeId of graph.nodes.keys()) {
    distances.set(nodeId, nodeId === originNode ? 0 : Infinity);
    previous.set(nodeId, null);
  }

  pq.enqueue(originNode, 0);

  // Set to track excluded segments
  const excludeSet = new Set(excludeSegments);

  while (!pq.isEmpty()) {
    const current = pq.dequeue()!;
    
    // Skip if already visited (processed)
    if (visited.has(current)) continue;
    visited.add(current);

    // Found destination
    if (current === destNode) break;

    const currentDist = distances.get(current)!;

    // Explore neighbors
    const neighbors = graph.adjacency.get(current);
    if (!neighbors) continue;

    for (const [neighbor, edgeInfo] of neighbors) {
      // Skip visited nodes
      if (visited.has(neighbor)) continue;
      
      // Skip excluded segments
      if (excludeSet.has(edgeInfo.edgeId)) continue;

      // Get segment status from blockchain
      const segmentStatus = segmentStatuses.get(edgeInfo.edgeId);

      // Calculate weighted edge cost
      const edgeWeight = calculateEdgeWeight(edgeInfo.weight, segmentStatus, vehiclePriority);

      const newDist = currentDist + edgeWeight;

      if (newDist < (distances.get(neighbor) || Infinity)) {
        distances.set(neighbor, newDist);
        previous.set(neighbor, current);
        pq.enqueue(neighbor, newDist);
      }
    }
  }

  // Check if path was found
  if (previous.get(destNode) === null && destNode !== originNode) {
    return { success: false, path: [], nodePath: [], totalWeight: 0, estimatedTime: 0, error: 'No path found to destination' };
  }

  // Reconstruct path
  const nodePath: string[] = [];
  let current: string | null = destNode;
  while (current !== null) {
    nodePath.unshift(current);
    current = previous.get(current) || null;
  }

  // Convert node path to segment path
  const segmentPath: string[] = [];
  for (let i = 0; i < nodePath.length - 1; i++) {
    const segment = getSegmentBetweenNodes(nodePath[i], nodePath[i + 1]);
    if (segment) {
      segmentPath.push(segment);
    }
  }

  const totalWeight = distances.get(destNode) || 0;
  // Convert weight (km) to time (seconds) - assuming average speed of 50 km/h for emergency vehicles
  const estimatedTime = (totalWeight / 50) * 3600; // Convert hours to seconds

  // Build route geometry using OSRM for actual road-following routes
  let geometry: Array<[number, number]> | undefined;
  const MAP_NODES = getMapNodes();
  const nodeMap = new Map(MAP_NODES.map(n => [n.id, n]));

  // Collect coordinates for all nodes in the path
  const waypoints: Array<[number, number]> = [];
  for (const nodeId of nodePath) {
    const node = nodeMap.get(nodeId);
    if (node?.lat !== undefined && node?.lon !== undefined) {
      waypoints.push([node.lat, node.lon]);
    }
  }

  // Use OSRM to get actual road-following geometry if we have at least 2 waypoints
  if (waypoints.length >= 2) {
    try {
      const osrmResult = await osrmService.calculateRouteWithWaypoints(waypoints, { profile: 'driving' });
      if (osrmResult.success && osrmResult.geometry.length > 0) {
        geometry = osrmResult.geometry;
      }
    } catch (error) {
      console.warn('OSRM route calculation failed, falling back to segment geometry:', error);
    }
  }

  // Fallback to segment geometry if OSRM failed or is unavailable
  if (!geometry || geometry.length === 0) {
    const fallbackGeometry: Array<[number, number]> = [];
    const MAP_EDGES = getMapEdges();

    for (const segmentId of segmentPath) {
      const segment = MAP_EDGES.find(e => e.id === segmentId);
      if (segment) {
        if (segment.geometry && segment.geometry.length > 0) {
          fallbackGeometry.push(...segment.geometry);
        } else {
          const fromNode = nodeMap.get(segment.from);
          const toNode = nodeMap.get(segment.to);
          if (fromNode?.lat !== undefined && fromNode?.lon !== undefined) {
            fallbackGeometry.push([fromNode.lat, fromNode.lon]);
          }
          if (toNode?.lat !== undefined && toNode?.lon !== undefined) {
            fallbackGeometry.push([toNode.lat, toNode.lon]);
          }
        }
      }
    }

    geometry = fallbackGeometry.filter((point, index) => {
      if (index === 0) return true;
      const prev = fallbackGeometry[index - 1];
      return point[0] !== prev[0] || point[1] !== prev[1];
    });
  }

  return {
    success: true,
    path: segmentPath,
    nodePath,
    totalWeight,
    estimatedTime: Math.round(estimatedTime),
    geometry: geometry && geometry.length > 0 ? geometry : undefined,
  };
}

/**
 * Find alternative routes (for when primary route has conflicts)
 * 
 * @param originNode Starting node ID
 * @param destNode Destination node ID
 * @param vehiclePriority Priority level of the vehicle
 * @param segmentStatuses Current status of all segments
 * @param primaryPath Primary path to find alternatives to
 * @param numAlternatives Number of alternative routes to find
 * @returns Array of RouteResults
 */
export async function findAlternativeRoutes(
  originNode: string,
  destNode: string,
  vehiclePriority: number,
  segmentStatuses: Map<string, BlockchainSegment>,
  primaryPath: string[],
  numAlternatives: number = 3
): Promise<RouteResult[]> {
  const alternatives: RouteResult[] = [];

  // Find alternatives by excluding segments from primary path one by one
  for (let i = 0; i < primaryPath.length && alternatives.length < numAlternatives; i++) {
    // Exclude one segment from the primary path
    const excludeSegments = [primaryPath[i]];
    
    const altRoute = await calculateRoute(originNode, destNode, vehiclePriority, segmentStatuses, excludeSegments);
    
    // Only add if it's a valid, different route
    if (altRoute.success && altRoute.path.join(',') !== primaryPath.join(',')) {
      // Check if this alternative is already in the list
      const isDuplicate = alternatives.some(alt => alt.path.join(',') === altRoute.path.join(','));
      if (!isDuplicate) {
        alternatives.push(altRoute);
      }
    }
  }

  return alternatives;
}

/**
 * Get route statistics and conflict information
 */
export function analyzeRoute(
  path: string[],
  segmentStatuses: Map<string, BlockchainSegment>,
  vehiclePriority: number
): {
  freeSegments: number;
  reservedSegments: number;
  occupiedSegments: number;
  potentialConflicts: Array<{
    segmentId: string;
    currentPriority: number;
    willPreempt: boolean;
  }>;
} {
  let freeSegments = 0;
  let reservedSegments = 0;
  let occupiedSegments = 0;
  const potentialConflicts: Array<{ segmentId: string; currentPriority: number; willPreempt: boolean }> = [];

  for (const segmentId of path) {
    const status = segmentStatuses.get(segmentId);
    
    if (!status || status.status === 'free') {
      freeSegments++;
    } else if (status.status === 'occupied') {
      occupiedSegments++;
    } else if (status.status === 'reserved') {
      reservedSegments++;
      if (status.priorityLevel !== undefined) {
        potentialConflicts.push({
          segmentId,
          currentPriority: status.priorityLevel,
          willPreempt: vehiclePriority < status.priorityLevel,
        });
      }
    }
  }

  return {
    freeSegments,
    reservedSegments,
    occupiedSegments,
    potentialConflicts,
  };
}

export default {
  calculateRoute,
  findAlternativeRoutes,
  analyzeRoute,
};


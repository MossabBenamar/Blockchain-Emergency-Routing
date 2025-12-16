/**
 * Routing Service - Dijkstra's Algorithm for Emergency Vehicle Routing
 * 
 * This service calculates optimal paths considering:
 * - Current segment reservations
 * - Vehicle priority levels
 * - Blocked/occupied segments
 */

import { Segment as BlockchainSegment } from '../../models/types';

// Graph data structures
interface Node {
  id: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  from: string;
  to: string;
  weight: number;
  bidirectional: boolean;
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
  estimatedTime: number;  // In seconds (assuming 1 weight = 30 seconds)
  error?: string;
}

// 5x5 Grid Map Data (hardcoded for now, could be loaded from file)
const MAP_NODES: Node[] = [
  { id: 'N1', x: 0, y: 0 }, { id: 'N2', x: 1, y: 0 }, { id: 'N3', x: 2, y: 0 }, { id: 'N4', x: 3, y: 0 }, { id: 'N5', x: 4, y: 0 },
  { id: 'N6', x: 0, y: 1 }, { id: 'N7', x: 1, y: 1 }, { id: 'N8', x: 2, y: 1 }, { id: 'N9', x: 3, y: 1 }, { id: 'N10', x: 4, y: 1 },
  { id: 'N11', x: 0, y: 2 }, { id: 'N12', x: 1, y: 2 }, { id: 'N13', x: 2, y: 2 }, { id: 'N14', x: 3, y: 2 }, { id: 'N15', x: 4, y: 2 },
  { id: 'N16', x: 0, y: 3 }, { id: 'N17', x: 1, y: 3 }, { id: 'N18', x: 2, y: 3 }, { id: 'N19', x: 3, y: 3 }, { id: 'N20', x: 4, y: 3 },
  { id: 'N21', x: 0, y: 4 }, { id: 'N22', x: 1, y: 4 }, { id: 'N23', x: 2, y: 4 }, { id: 'N24', x: 3, y: 4 }, { id: 'N25', x: 4, y: 4 },
];

const MAP_EDGES: Edge[] = [
  // Horizontal segments (Row 1 to Row 5)
  { id: 'S1', from: 'N1', to: 'N2', weight: 1, bidirectional: true },
  { id: 'S2', from: 'N2', to: 'N3', weight: 1, bidirectional: true },
  { id: 'S3', from: 'N3', to: 'N4', weight: 1, bidirectional: true },
  { id: 'S4', from: 'N4', to: 'N5', weight: 1, bidirectional: true },
  { id: 'S5', from: 'N6', to: 'N7', weight: 1, bidirectional: true },
  { id: 'S6', from: 'N7', to: 'N8', weight: 1, bidirectional: true },
  { id: 'S7', from: 'N8', to: 'N9', weight: 1, bidirectional: true },
  { id: 'S8', from: 'N9', to: 'N10', weight: 1, bidirectional: true },
  { id: 'S9', from: 'N11', to: 'N12', weight: 1, bidirectional: true },
  { id: 'S10', from: 'N12', to: 'N13', weight: 1, bidirectional: true },
  { id: 'S11', from: 'N13', to: 'N14', weight: 1, bidirectional: true },
  { id: 'S12', from: 'N14', to: 'N15', weight: 1, bidirectional: true },
  { id: 'S13', from: 'N16', to: 'N17', weight: 1, bidirectional: true },
  { id: 'S14', from: 'N17', to: 'N18', weight: 1, bidirectional: true },
  { id: 'S15', from: 'N18', to: 'N19', weight: 1, bidirectional: true },
  { id: 'S16', from: 'N19', to: 'N20', weight: 1, bidirectional: true },
  { id: 'S17', from: 'N21', to: 'N22', weight: 1, bidirectional: true },
  { id: 'S18', from: 'N22', to: 'N23', weight: 1, bidirectional: true },
  { id: 'S19', from: 'N23', to: 'N24', weight: 1, bidirectional: true },
  { id: 'S20', from: 'N24', to: 'N25', weight: 1, bidirectional: true },
  // Vertical segments (Column 1 to Column 5)
  { id: 'S21', from: 'N1', to: 'N6', weight: 1, bidirectional: true },
  { id: 'S22', from: 'N6', to: 'N11', weight: 1, bidirectional: true },
  { id: 'S23', from: 'N11', to: 'N16', weight: 1, bidirectional: true },
  { id: 'S24', from: 'N16', to: 'N21', weight: 1, bidirectional: true },
  { id: 'S25', from: 'N2', to: 'N7', weight: 1, bidirectional: true },
  { id: 'S26', from: 'N7', to: 'N12', weight: 1, bidirectional: true },
  { id: 'S27', from: 'N12', to: 'N17', weight: 1, bidirectional: true },
  { id: 'S28', from: 'N17', to: 'N22', weight: 1, bidirectional: true },
  { id: 'S29', from: 'N3', to: 'N8', weight: 1, bidirectional: true },
  { id: 'S30', from: 'N8', to: 'N13', weight: 1, bidirectional: true },
  { id: 'S31', from: 'N13', to: 'N18', weight: 1, bidirectional: true },
  { id: 'S32', from: 'N18', to: 'N23', weight: 1, bidirectional: true },
  { id: 'S33', from: 'N4', to: 'N9', weight: 1, bidirectional: true },
  { id: 'S34', from: 'N9', to: 'N14', weight: 1, bidirectional: true },
  { id: 'S35', from: 'N14', to: 'N19', weight: 1, bidirectional: true },
  { id: 'S36', from: 'N19', to: 'N24', weight: 1, bidirectional: true },
  { id: 'S37', from: 'N5', to: 'N10', weight: 1, bidirectional: true },
  { id: 'S38', from: 'N10', to: 'N15', weight: 1, bidirectional: true },
  { id: 'S39', from: 'N15', to: 'N20', weight: 1, bidirectional: true },
  { id: 'S40', from: 'N20', to: 'N25', weight: 1, bidirectional: true },
];

// Build graph from map data
function buildGraph(): Graph {
  const graph: Graph = {
    nodes: new Map(),
    adjacency: new Map(),
  };

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
export function calculateRoute(
  originNode: string,
  destNode: string,
  vehiclePriority: number,
  segmentStatuses: Map<string, BlockchainSegment>,
  excludeSegments: string[] = []
): RouteResult {
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
  // Assuming each weight unit = 30 seconds travel time
  const estimatedTime = totalWeight * 30;

  return {
    success: true,
    path: segmentPath,
    nodePath,
    totalWeight,
    estimatedTime,
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
export function findAlternativeRoutes(
  originNode: string,
  destNode: string,
  vehiclePriority: number,
  segmentStatuses: Map<string, BlockchainSegment>,
  primaryPath: string[],
  numAlternatives: number = 3
): RouteResult[] {
  const alternatives: RouteResult[] = [];

  // Find alternatives by excluding segments from primary path one by one
  for (let i = 0; i < primaryPath.length && alternatives.length < numAlternatives; i++) {
    // Exclude one segment from the primary path
    const excludeSegments = [primaryPath[i]];
    
    const altRoute = calculateRoute(originNode, destNode, vehiclePriority, segmentStatuses, excludeSegments);
    
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


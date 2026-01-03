// Manhattan Map Data Service
// Provides real coordinates for Manhattan area with POIs and road network

export interface ManhattanNode {
  id: string;
  lat: number;
  lon: number;
  label: string | null;
  type: 'poi' | 'intersection';
  orgType?: 'medical' | 'police' | 'fire';
}

export interface ManhattanSegment {
  id: string;
  from: string;
  to: string;
  weight: number;
  bidirectional: boolean;
  geometry?: Array<[number, number]>; // Route geometry
}

// Manhattan POIs - Real locations
const MANHATTAN_POIS: ManhattanNode[] = [
  // Hospitals (Medical)
  {
    id: 'HOSPITAL_01',
    lat: 40.7614,
    lon: -73.9776,
    label: 'NYU Langone Health',
    type: 'poi',
    orgType: 'medical',
  },
  {
    id: 'HOSPITAL_02',
    lat: 40.7589,
    lon: -73.9851,
    label: 'Mount Sinai Hospital',
    type: 'poi',
    orgType: 'medical',
  },
  {
    id: 'HOSPITAL_03',
    lat: 40.7128,
    lon: -74.0060,
    label: 'NYC Health + Hospitals',
    type: 'poi',
    orgType: 'medical',
  },
  
  // Police Stations
  {
    id: 'POLICE_01',
    lat: 40.7505,
    lon: -73.9934,
    label: 'NYPD Midtown South',
    type: 'poi',
    orgType: 'police',
  },
  {
    id: 'POLICE_02',
    lat: 40.7282,
    lon: -73.9942,
    label: 'NYPD 6th Precinct',
    type: 'poi',
    orgType: 'police',
  },
  {
    id: 'POLICE_03',
    lat: 40.7614,
    lon: -73.9776,
    label: 'NYPD 19th Precinct',
    type: 'poi',
    orgType: 'police',
  },
  
  // Fire Stations
  {
    id: 'FIRE_01',
    lat: 40.7489,
    lon: -73.9680,
    label: 'FDNY Engine 8',
    type: 'poi',
    orgType: 'fire',
  },
  {
    id: 'FIRE_02',
    lat: 40.7282,
    lon: -73.9942,
    label: 'FDNY Engine 24',
    type: 'poi',
    orgType: 'fire',
  },
  {
    id: 'FIRE_03',
    lat: 40.7614,
    lon: -73.9776,
    label: 'FDNY Ladder 4',
    type: 'poi',
    orgType: 'fire',
  },
];

// Manhattan Intersection Nodes (key intersections in Midtown/Downtown)
const MANHATTAN_INTERSECTIONS: ManhattanNode[] = [
  // Major intersections
  { id: 'INT_01', lat: 40.7589, lon: -73.9851, label: null, type: 'intersection' },
  { id: 'INT_02', lat: 40.7614, lon: -73.9776, label: null, type: 'intersection' },
  { id: 'INT_03', lat: 40.7505, lon: -73.9934, label: null, type: 'intersection' },
  { id: 'INT_04', lat: 40.7489, lon: -73.9680, label: null, type: 'intersection' },
  { id: 'INT_05', lat: 40.7282, lon: -73.9942, label: null, type: 'intersection' },
  { id: 'INT_06', lat: 40.7128, lon: -74.0060, label: null, type: 'intersection' },
  { id: 'INT_07', lat: 40.7550, lon: -73.9870, label: null, type: 'intersection' },
  { id: 'INT_08', lat: 40.7520, lon: -73.9780, label: null, type: 'intersection' },
  { id: 'INT_09', lat: 40.7450, lon: -73.9900, label: null, type: 'intersection' },
  { id: 'INT_10', lat: 40.7350, lon: -73.9980, label: null, type: 'intersection' },
  { id: 'INT_11', lat: 40.7650, lon: -73.9800, label: null, type: 'intersection' },
  { id: 'INT_12', lat: 40.7400, lon: -73.9750, label: null, type: 'intersection' },
];

// Manhattan Road Segments (connecting POIs and intersections)
const MANHATTAN_SEGMENTS: ManhattanSegment[] = [
  // Connections from Hospitals
  { id: 'SEG_H01_I01', from: 'HOSPITAL_01', to: 'INT_01', weight: 2.5, bidirectional: true },
  { id: 'SEG_H02_I02', from: 'HOSPITAL_02', to: 'INT_02', weight: 2.0, bidirectional: true },
  { id: 'SEG_H03_I06', from: 'HOSPITAL_03', to: 'INT_06', weight: 3.0, bidirectional: true },
  
  // Connections from Police Stations
  { id: 'SEG_P01_I03', from: 'POLICE_01', to: 'INT_03', weight: 1.5, bidirectional: true },
  { id: 'SEG_P02_I05', from: 'POLICE_02', to: 'INT_05', weight: 2.0, bidirectional: true },
  { id: 'SEG_P03_I11', from: 'POLICE_03', to: 'INT_11', weight: 1.8, bidirectional: true },
  
  // Connections from Fire Stations
  { id: 'SEG_F01_I04', from: 'FIRE_01', to: 'INT_04', weight: 1.5, bidirectional: true },
  { id: 'SEG_F02_I05', from: 'FIRE_02', to: 'INT_05', weight: 2.2, bidirectional: true },
  { id: 'SEG_F03_I11', from: 'FIRE_03', to: 'INT_11', weight: 1.7, bidirectional: true },
  
  // Intersection network (creating a connected graph)
  { id: 'SEG_I01_I02', from: 'INT_01', to: 'INT_02', weight: 3.5, bidirectional: true },
  { id: 'SEG_I01_I07', from: 'INT_01', to: 'INT_07', weight: 2.8, bidirectional: true },
  { id: 'SEG_I02_I08', from: 'INT_02', to: 'INT_08', weight: 3.2, bidirectional: true },
  { id: 'SEG_I02_I11', from: 'INT_02', to: 'INT_11', weight: 2.5, bidirectional: true },
  { id: 'SEG_I03_I07', from: 'INT_03', to: 'INT_07', weight: 2.0, bidirectional: true },
  { id: 'SEG_I03_I09', from: 'INT_03', to: 'INT_09', weight: 2.5, bidirectional: true },
  { id: 'SEG_I04_I08', from: 'INT_04', to: 'INT_08', weight: 2.8, bidirectional: true },
  { id: 'SEG_I04_I12', from: 'INT_04', to: 'INT_12', weight: 3.0, bidirectional: true },
  { id: 'SEG_I05_I09', from: 'INT_05', to: 'INT_09', weight: 2.2, bidirectional: true },
  { id: 'SEG_I05_I10', from: 'INT_05', to: 'INT_10', weight: 2.8, bidirectional: true },
  { id: 'SEG_I06_I10', from: 'INT_06', to: 'INT_10', weight: 3.5, bidirectional: true },
  { id: 'SEG_I07_I08', from: 'INT_07', to: 'INT_08', weight: 2.5, bidirectional: true },
  { id: 'SEG_I08_I12', from: 'INT_08', to: 'INT_12', weight: 2.8, bidirectional: true },
  { id: 'SEG_I09_I10', from: 'INT_09', to: 'INT_10', weight: 2.5, bidirectional: true },
  { id: 'SEG_I09_I12', from: 'INT_09', to: 'INT_12', weight: 3.2, bidirectional: true },
  { id: 'SEG_I10_I06', from: 'INT_10', to: 'INT_06', weight: 3.0, bidirectional: true },
  { id: 'SEG_I11_I12', from: 'INT_11', to: 'INT_12', weight: 2.8, bidirectional: true },
];

// Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

// Generate route geometry for a segment (straight line interpolation)
function generateSegmentGeometry(from: ManhattanNode, to: ManhattanNode, points: number = 5): Array<[number, number]> {
  const geometry: Array<[number, number]> = [];
  for (let i = 0; i <= points; i++) {
    const t = i / points;
    const lat = from.lat + (to.lat - from.lat) * t;
    const lon = from.lon + (to.lon - from.lon) * t;
    geometry.push([lat, lon]);
  }
  return geometry;
}

// Get all Manhattan nodes
export function getManhattanNodes(): ManhattanNode[] {
  return [...MANHATTAN_POIS, ...MANHATTAN_INTERSECTIONS];
}

// Get all Manhattan segments with geometry
export function getManhattanSegments(): ManhattanSegment[] {
  const nodes = getManhattanNodes();
  const nodeMap = new Map<string, ManhattanNode>();
  nodes.forEach(node => nodeMap.set(node.id, node));

  return MANHATTAN_SEGMENTS.map(segment => {
    const fromNode = nodeMap.get(segment.from);
    const toNode = nodeMap.get(segment.to);
    
    if (!fromNode || !toNode) {
      return segment;
    }

    // Calculate actual distance and update weight
    const distance = calculateDistance(fromNode.lat, fromNode.lon, toNode.lat, toNode.lon);
    const weight = distance; // Weight in km

    // Generate geometry
    const geometry = generateSegmentGeometry(fromNode, toNode);

    return {
      ...segment,
      weight,
      geometry,
    };
  });
}

// Get Manhattan map bounds
export function getManhattanBounds(): { north: number; south: number; east: number; west: number } {
  const nodes = getManhattanNodes();
  const lats = nodes.map(n => n.lat);
  const lons = nodes.map(n => n.lon);
  
  return {
    north: Math.max(...lats),
    south: Math.min(...lats),
    east: Math.max(...lons),
    west: Math.min(...lons),
  };
}

// Get center point for map
export function getManhattanCenter(): [number, number] {
  const bounds = getManhattanBounds();
  return [
    (bounds.north + bounds.south) / 2,
    (bounds.east + bounds.west) / 2,
  ];
}

// Get default zoom level
export function getManhattanZoom(): number {
  return 13;
}

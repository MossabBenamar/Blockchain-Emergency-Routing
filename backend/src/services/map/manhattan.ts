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
// --- COMPREHENSIVE REAL-WORLD MANHATTAN GRID ---
// Coverage: Lower Manhattan (Canal St) to Central Park South (59th St)
// Avenues: 3rd, 5th, 7th (becomes Varick), 8th
// Streets: Canal, Houston, 14th, 23rd, 34th, 42nd, 57th, 59th

const MANHATTAN_INTERSECTIONS: ManhattanNode[] = [
  // --- Avenues @ 59th St (Central Park South) ---
  { id: 'INT_8TH_59', lat: 40.7681, lon: -73.9816, label: 'Columbus Circle (8th & 59th)', type: 'intersection' },
  { id: 'INT_7TH_59', lat: 40.7663, lon: -73.9784, label: '7th Ave & 59th St', type: 'intersection' },
  { id: 'INT_6TH_59', lat: 40.7654, lon: -73.9768, label: '6th Ave & 59th St', type: 'intersection' },
  { id: 'INT_5TH_59', lat: 40.7645, lon: -73.9744, label: 'Grand Army Plaza (5th & 59th)', type: 'intersection' },
  { id: 'INT_3RD_59', lat: 40.7625, lon: -73.9678, label: '3rd Ave & 59th St', type: 'intersection' },

  // --- Avenues @ 57th St ---
  { id: 'INT_8TH_57', lat: 40.7665, lon: -73.9825, label: '8th Ave & 57th St', type: 'intersection' },
  { id: 'INT_7TH_57', lat: 40.7652, lon: -73.9803, label: '7th Ave & 57th St', type: 'intersection' },
  { id: 'INT_5TH_57', lat: 40.7625, lon: -73.9740, label: '5th Ave & 57th St', type: 'intersection' }, // Ty Cobb
  { id: 'INT_3RD_57', lat: 40.7605, lon: -73.9680, label: '3rd Ave & 57th St', type: 'intersection' },

  // --- Avenues @ 42nd St ---
  { id: 'INT_8TH_42', lat: 40.7570, lon: -73.9900, label: 'Port Authority (8th & 42nd)', type: 'intersection' },
  { id: 'INT_7TH_42', lat: 40.7562, lon: -73.9868, label: 'Times Square (7th & 42nd)', type: 'intersection' },
  { id: 'INT_5TH_42', lat: 40.7535, lon: -73.9808, label: 'Bryant Park (5th & 42nd)', type: 'intersection' },
  { id: 'INT_3RD_42', lat: 40.7503, lon: -73.9748, label: 'Chrysler Bldg (3rd & 42nd)', type: 'intersection' },

  // --- Avenues @ 34th St ---
  { id: 'INT_8TH_34', lat: 40.7525, lon: -73.9935, label: 'Penn Station (8th & 34th)', type: 'intersection' },
  { id: 'INT_7TH_34', lat: 40.7512, lon: -73.9904, label: 'Macy\'s (7th & 34th)', type: 'intersection' },
  { id: 'INT_5TH_34', lat: 40.7484, lon: -73.9840, label: 'Empire State (5th & 34th)', type: 'intersection' },
  { id: 'INT_3RD_34', lat: 40.7450, lon: -73.9785, label: '3rd Ave & 34th St', type: 'intersection' },

  // --- Avenues @ 23rd St ---
  { id: 'INT_8TH_23', lat: 40.7452, lon: -73.9980, label: '8th Ave & 23rd St', type: 'intersection' },
  { id: 'INT_7TH_23', lat: 40.7440, lon: -73.9958, label: '7th Ave & 23rd St', type: 'intersection' },
  { id: 'INT_5TH_23', lat: 40.7410, lon: -73.9890, label: 'Flatiron (5th & 23rd)', type: 'intersection' },
  { id: 'INT_3RD_23', lat: 40.7388, lon: -73.9828, label: '3rd Ave & 23rd St', type: 'intersection' },

  // --- Avenues @ 14th St ---
  { id: 'INT_8TH_14', lat: 40.7402, lon: -74.0018, label: '8th Ave & 14th St', type: 'intersection' },
  { id: 'INT_7TH_14', lat: 40.7385, lon: -73.9992, label: '7th Ave & 14th St', type: 'intersection' },
  { id: 'INT_5TH_14', lat: 40.7358, lon: -73.9922, label: 'Union Square (5th & 14th)', type: 'intersection' },
  { id: 'INT_3RD_14', lat: 40.7335, lon: -73.9870, label: '3rd Ave & 14th St', type: 'intersection' },

  // --- Houston St (Downtown Boundary) ---
  { id: 'INT_VARICK_HOUSTON', lat: 40.7280, lon: -74.0050, label: 'Varick & Houston', type: 'intersection' }, // 7th becomes Varick roughly
  { id: 'INT_BWAY_HOUSTON', lat: 40.7255, lon: -73.9982, label: 'Broadway & Houston', type: 'intersection' },
  { id: 'INT_2ND_HOUSTON', lat: 40.7228, lon: -73.9895, label: '2nd Ave & Houston', type: 'intersection' },

  // --- Canal St (Lower Manhattan) ---
  { id: 'INT_VARICK_CANAL', lat: 40.7230, lon: -74.0060, label: 'Varick & Canal', type: 'intersection' },
  { id: 'INT_BWAY_CANAL', lat: 40.7195, lon: -74.0015, label: 'Broadway & Canal', type: 'intersection' },
  { id: 'INT_CHRYSTIE_CANAL', lat: 40.7165, lon: -73.9940, label: 'Manhattan Bridge Entrance', type: 'intersection' },
];

const MANHATTAN_SEGMENTS: ManhattanSegment[] = [
  // --- NORTH-SOUTH AVENUES ---

  // 8th Avenue Line (Uptown/North Only)
  // Reversed 'from'/'to' to match traffic flow: 14 -> 23 -> 34 -> 42 -> 57 -> 59
  { id: 'SEG_AVE8_14_23', from: 'INT_8TH_14', to: 'INT_8TH_23', weight: 0, bidirectional: false },
  { id: 'SEG_AVE8_23_34', from: 'INT_8TH_23', to: 'INT_8TH_34', weight: 0, bidirectional: false },
  { id: 'SEG_AVE8_34_42', from: 'INT_8TH_34', to: 'INT_8TH_42', weight: 0, bidirectional: false },
  { id: 'SEG_AVE8_42_57', from: 'INT_8TH_42', to: 'INT_8TH_57', weight: 0, bidirectional: false },
  { id: 'SEG_AVE8_57_59', from: 'INT_8TH_57', to: 'INT_8TH_59', weight: 0, bidirectional: false },

  // 7th Avenue / Varick Line (Downtown/South Only)
  // Flow: 59 -> 57 -> 42 -> 34 -> 23 -> 14 -> Houston -> Canal
  { id: 'SEG_AVE7_59_57', from: 'INT_7TH_59', to: 'INT_7TH_57', weight: 0, bidirectional: false },
  { id: 'SEG_AVE7_57_42', from: 'INT_7TH_57', to: 'INT_7TH_42', weight: 0, bidirectional: false },
  { id: 'SEG_AVE7_42_34', from: 'INT_7TH_42', to: 'INT_7TH_34', weight: 0, bidirectional: false },
  { id: 'SEG_AVE7_34_23', from: 'INT_7TH_34', to: 'INT_7TH_23', weight: 0, bidirectional: false },
  { id: 'SEG_AVE7_23_14', from: 'INT_7TH_23', to: 'INT_7TH_14', weight: 0, bidirectional: false },
  { id: 'SEG_AVE7_14_HOU', from: 'INT_7TH_14', to: 'INT_VARICK_HOUSTON', weight: 0, bidirectional: false }, // 7th merges to Varick
  { id: 'SEG_VARICK_HOU_CAN', from: 'INT_VARICK_HOUSTON', to: 'INT_VARICK_CANAL', weight: 0, bidirectional: false },

  // 5th Avenue / Broadway (Downtown/South Only)
  // Flow: 59 -> 57 -> 42 -> 34 -> 23 -> 14 -> Houston -> Canal
  { id: 'SEG_AVE5_59_57', from: 'INT_5TH_59', to: 'INT_5TH_57', weight: 0, bidirectional: false },
  { id: 'SEG_AVE5_57_42', from: 'INT_5TH_57', to: 'INT_5TH_42', weight: 0, bidirectional: false },
  { id: 'SEG_AVE5_42_34', from: 'INT_5TH_42', to: 'INT_5TH_34', weight: 0, bidirectional: false },
  { id: 'SEG_AVE5_34_23', from: 'INT_5TH_34', to: 'INT_5TH_23', weight: 0, bidirectional: false },
  { id: 'SEG_AVE5_23_14', from: 'INT_5TH_23', to: 'INT_5TH_14', weight: 0, bidirectional: false },
  { id: 'SEG_AVE5_14_HOU', from: 'INT_5TH_14', to: 'INT_BWAY_HOUSTON', weight: 0, bidirectional: false },
  { id: 'SEG_BWAY_HOU_CAN', from: 'INT_BWAY_HOUSTON', to: 'INT_BWAY_CANAL', weight: 0, bidirectional: false },

  // 3rd Avenue Line (Uptown/North Only)
  // Reversed 'from'/'to' to match traffic flow: 14 -> 23 -> 34 -> 42 -> 57 -> 59
  { id: 'SEG_AVE3_14_23', from: 'INT_3RD_14', to: 'INT_3RD_23', weight: 0, bidirectional: false },
  { id: 'SEG_AVE3_23_34', from: 'INT_3RD_23', to: 'INT_3RD_34', weight: 0, bidirectional: false },
  { id: 'SEG_AVE3_34_42', from: 'INT_3RD_34', to: 'INT_3RD_42', weight: 0, bidirectional: false },
  { id: 'SEG_AVE3_42_57', from: 'INT_3RD_42', to: 'INT_3RD_57', weight: 0, bidirectional: false },
  { id: 'SEG_AVE3_57_59', from: 'INT_3RD_57', to: 'INT_3RD_59', weight: 0, bidirectional: false },

  // Lower 3rd Ave extension (merge from 2nd/Houston typically goes North)
  { id: 'SEG_2ND_HOU_14', from: 'INT_2ND_HOUSTON', to: 'INT_3RD_14', weight: 0, bidirectional: false },
  { id: 'SEG_CHRYSTIE_CAN_HOU', from: 'INT_CHRYSTIE_CANAL', to: 'INT_2ND_HOUSTON', weight: 0, bidirectional: false },

  // --- EAST-WEST STREETS ---

  // 59th St (Central Park S)
  { id: 'SEG_ST59_8TH_7TH', from: 'INT_8TH_59', to: 'INT_7TH_59', weight: 0, bidirectional: true },
  { id: 'SEG_ST59_7TH_6TH', from: 'INT_7TH_59', to: 'INT_6TH_59', weight: 0, bidirectional: true },
  { id: 'SEG_ST59_6TH_5TH', from: 'INT_6TH_59', to: 'INT_5TH_59', weight: 0, bidirectional: true },
  { id: 'SEG_ST59_5TH_3RD', from: 'INT_5TH_59', to: 'INT_3RD_59', weight: 0, bidirectional: true },

  // 57th St
  { id: 'SEG_ST57_8TH_7TH', from: 'INT_8TH_57', to: 'INT_7TH_57', weight: 0, bidirectional: true },
  { id: 'SEG_ST57_7TH_5TH', from: 'INT_7TH_57', to: 'INT_5TH_57', weight: 0, bidirectional: true },
  { id: 'SEG_ST57_5TH_3RD', from: 'INT_5TH_57', to: 'INT_3RD_57', weight: 0, bidirectional: true },

  // 42nd St
  { id: 'SEG_ST42_8TH_7TH', from: 'INT_8TH_42', to: 'INT_7TH_42', weight: 0, bidirectional: true },
  { id: 'SEG_ST42_7TH_5TH', from: 'INT_7TH_42', to: 'INT_5TH_42', weight: 0, bidirectional: true },
  { id: 'SEG_ST42_5TH_3RD', from: 'INT_5TH_42', to: 'INT_3RD_42', weight: 0, bidirectional: true },

  // 34th St
  { id: 'SEG_ST34_8TH_7TH', from: 'INT_8TH_34', to: 'INT_7TH_34', weight: 0, bidirectional: true },
  { id: 'SEG_ST34_7TH_5TH', from: 'INT_7TH_34', to: 'INT_5TH_34', weight: 0, bidirectional: true },
  { id: 'SEG_ST34_5TH_3RD', from: 'INT_5TH_34', to: 'INT_3RD_34', weight: 0, bidirectional: true },

  // 23rd St
  { id: 'SEG_ST23_8TH_7TH', from: 'INT_8TH_23', to: 'INT_7TH_23', weight: 0, bidirectional: true },
  { id: 'SEG_ST23_7TH_5TH', from: 'INT_7TH_23', to: 'INT_5TH_23', weight: 0, bidirectional: true },
  { id: 'SEG_ST23_5TH_3RD', from: 'INT_5TH_23', to: 'INT_3RD_23', weight: 0, bidirectional: true },

  // 14th St
  { id: 'SEG_ST14_8TH_7TH', from: 'INT_8TH_14', to: 'INT_7TH_14', weight: 0, bidirectional: true },
  { id: 'SEG_ST14_7TH_5TH', from: 'INT_7TH_14', to: 'INT_5TH_14', weight: 0, bidirectional: true },
  { id: 'SEG_ST14_5TH_3RD', from: 'INT_5TH_14', to: 'INT_3RD_14', weight: 0, bidirectional: true },

  // Houston St
  { id: 'SEG_HOU_VARICK_BWAY', from: 'INT_VARICK_HOUSTON', to: 'INT_BWAY_HOUSTON', weight: 0, bidirectional: true },
  { id: 'SEG_HOU_BWAY_2ND', from: 'INT_BWAY_HOUSTON', to: 'INT_2ND_HOUSTON', weight: 0, bidirectional: true },

  // Canal St
  { id: 'SEG_CAN_VARICK_BWAY', from: 'INT_VARICK_CANAL', to: 'INT_BWAY_CANAL', weight: 0, bidirectional: true },
  { id: 'SEG_CAN_BWAY_CHRYSTIE', from: 'INT_BWAY_CANAL', to: 'INT_CHRYSTIE_CANAL', weight: 0, bidirectional: true },

  // --- Map POIs to Grid ---
  // Hospitals
  { id: 'SEG_HOSP1_LINK', from: 'HOSPITAL_01', to: 'INT_3RD_34', weight: 0, bidirectional: true }, // NYU Langone (34th/3rd) -> Connect to 34th
  { id: 'SEG_HOSP2_LINK', from: 'HOSPITAL_02', to: 'INT_8TH_59', weight: 0, bidirectional: true }, // Mt Sinai West (59th/10th) -> Connect to 8th/59th
  { id: 'SEG_HOSP3_LINK', from: 'HOSPITAL_03', to: 'INT_VARICK_CANAL', weight: 0, bidirectional: true }, // Downtown

  // Police
  { id: 'SEG_POL1_LINK', from: 'POLICE_01', to: 'INT_8TH_34', weight: 0, bidirectional: true }, // Midtown South (35th/9th) -> Connect to 8th/34th
  { id: 'SEG_POL2_LINK', from: 'POLICE_02', to: 'INT_VARICK_HOUSTON', weight: 0, bidirectional: true }, // 6th Pct
  { id: 'SEG_POL3_LINK', from: 'POLICE_03', to: 'INT_3RD_59', weight: 0, bidirectional: true }, // 19th Pct (67th/3rd) -> Connect to 3rd/59th (closest entry)

  // Fire
  { id: 'SEG_FIRE1_LINK', from: 'FIRE_01', to: 'INT_3RD_42', weight: 0, bidirectional: true }, // FDNY Eng 8 (51st/3rd) -> Connect to 3rd/42nd (or add 57th?) -> 3rd/57th is better
  { id: 'SEG_FIRE2_LINK', from: 'FIRE_02', to: 'INT_VARICK_HOUSTON', weight: 0, bidirectional: true },
  { id: 'SEG_FIRE3_LINK', from: 'FIRE_03', to: 'INT_8TH_59', weight: 0, bidirectional: true }, // FDNY Lad 4 (48th/8th) -> 8th/42nd or 57th? Let's use 42nd actually.

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

// Generate route geometry for a segment (Manhattan/L-shape interpolation)
function generateSegmentGeometry(from: ManhattanNode, to: ManhattanNode, points: number = 5): Array<[number, number]> {
  // Manhattan geometry: Go horizontal (change lon) then vertical (change lat)
  // or vertical then horizontal, depending on what looks better or is shorter.
  // For simplicity, we'll do a simple L-shape:
  // 1. Start point
  // 2. Intermediate point (Corner): same Lat as From, same Lon as To (or vice-versa)
  // 3. End point

  // Try to determine "street" alignment. 
  // Most Manhattan streets are N-S or E-W.

  // L-Shape: From -> Corner -> To
  // Corner: (from.lat, to.lon) or (to.lat, from.lon)

  // We'll generate a few points along the L-shape for smoother rendering if needed, 
  // but for a polyline, just the corner is enough.

  const geometry: Array<[number, number]> = [];

  // Start
  geometry.push([from.lat, from.lon]);

  // Determine if we should go Lat first or Lon first
  // This is heuristic. In Manhattan:
  // Avenues are roughly N-S (change lat)
  // Streets are roughly E-W (change lon)

  // Let's stick to valid grid lines.
  // Corner point
  geometry.push([from.lat, to.lon]);

  // End
  geometry.push([to.lat, to.lon]);

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

    // ADJUSTMENT: Apply a slight "discount" to Crosstown Streets (0.9 multiplier).
    // This biases the A* algorithm to prefer taking the "Long Crosstown" leg first (West then North)
    // rather than "North then West" (which is mathematically shorter on the globe due to converging longitude lines).
    // This creates routes that feel more "natural" to users who expect to turn early.
    const isCrosstown = segment.id.startsWith('SEG_ST') || segment.id.startsWith('SEG_HOU') || segment.id.startsWith('SEG_CAN');
    const weight = isCrosstown ? distance * 0.9 : distance;

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

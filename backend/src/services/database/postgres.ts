// PostgreSQL + PostGIS Database Service
// Handles map data storage and spatial queries

import { Pool, PoolClient } from 'pg';

export interface PostgresConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

let pool: Pool | null = null;

/**
 * Initialize PostgreSQL connection pool
 */
export function initPostgres(config?: PostgresConfig): Pool {
  if (pool) {
    return pool;
  }

  const dbConfig = config || {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'emergency_routing',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };

  pool = new Pool({
    ...dbConfig,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected PostgreSQL pool error:', err);
  });

  console.log('PostgreSQL connection pool initialized');
  return pool;
}

/**
 * Get database connection pool
 */
export function getPool(): Pool | null {
  return pool;
}

/**
 * Execute a query
 */
export async function query(text: string, params?: any[]): Promise<any> {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initPostgres() first.');
  }
  return pool.query(text, params);
}

/**
 * Get a client from the pool for transactions
 */
export async function getClient(): Promise<PoolClient> {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initPostgres() first.');
  }
  return pool.connect();
}

/**
 * Initialize PostGIS extension and create tables
 */
export async function initSchema(): Promise<void> {
  if (!pool) {
    throw new Error('PostgreSQL pool not initialized. Call initPostgres() first.');
  }

  try {
    // Enable PostGIS extension
    await pool.query('CREATE EXTENSION IF NOT EXISTS postgis;');
    console.log('PostGIS extension enabled');

    // Create nodes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS nodes (
        node_id VARCHAR(50) PRIMARY KEY,
        lat DOUBLE PRECISION NOT NULL,
        lon DOUBLE PRECISION NOT NULL,
        geom GEOMETRY(Point, 4326),
        node_type VARCHAR(20),
        label VARCHAR(255),
        org_type VARCHAR(20),
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create segments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS segments (
        segment_id VARCHAR(50) PRIMARY KEY,
        from_node VARCHAR(50) REFERENCES nodes(node_id),
        to_node VARCHAR(50) REFERENCES nodes(node_id),
        length_meters DOUBLE PRECISION,
        weight DOUBLE PRECISION,
        geom GEOMETRY(LineString, 4326),
        bidirectional BOOLEAN DEFAULT true,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Create routes table (for storing calculated routes)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS routes (
        route_id VARCHAR(50) PRIMARY KEY,
        mission_id VARCHAR(50),
        vehicle_id VARCHAR(50),
        origin_lat DOUBLE PRECISION NOT NULL,
        origin_lon DOUBLE PRECISION NOT NULL,
        dest_lat DOUBLE PRECISION NOT NULL,
        dest_lon DOUBLE PRECISION NOT NULL,
        route_geometry GEOMETRY(LineString, 4326) NOT NULL,
        distance_meters DOUBLE PRECISION,
        duration_seconds INTEGER,
        calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        metadata JSONB
      );
    `);

    // Create spatial indexes
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_nodes_geom ON nodes USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_segments_geom ON segments USING GIST(geom);
      CREATE INDEX IF NOT EXISTS idx_routes_geometry ON routes USING GIST(route_geometry);
    `);

    console.log('PostgreSQL schema initialized');
  } catch (error) {
    console.error('Error initializing PostgreSQL schema:', error);
    throw error;
  }
}

/**
 * Insert or update a node
 */
export async function upsertNode(node: {
  nodeId: string;
  lat: number;
  lon: number;
  nodeType?: string;
  label?: string;
  orgType?: string;
  metadata?: any;
}): Promise<void> {
  const queryText = `
    INSERT INTO nodes (node_id, lat, lon, geom, node_type, label, org_type, metadata)
    VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($3, $2), 4326), $4, $5, $6, $7)
    ON CONFLICT (node_id) 
    DO UPDATE SET
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      geom = EXCLUDED.geom,
      node_type = EXCLUDED.node_type,
      label = EXCLUDED.label,
      org_type = EXCLUDED.org_type,
      metadata = EXCLUDED.metadata;
  `;

  await query(queryText, [
    node.nodeId,
    node.lat,
    node.lon,
    node.nodeType || null,
    node.label || null,
    node.orgType || null,
    node.metadata ? JSON.stringify(node.metadata) : null,
  ]);
}

/**
 * Insert or update a segment
 */
export async function upsertSegment(segment: {
  segmentId: string;
  fromNode: string;
  toNode: string;
  geometry?: Array<[number, number]>; // [lat, lon] pairs
  lengthMeters?: number;
  weight?: number;
  bidirectional?: boolean;
  metadata?: any;
}): Promise<void> {
  let geomValue = null;
  if (segment.geometry && segment.geometry.length > 0) {
    // Convert [lat, lon] to PostGIS LineString
    const coords = segment.geometry.map(([lat, lon]) => `${lon} ${lat}`).join(',');
    geomValue = `ST_SetSRID(ST_GeomFromText('LINESTRING(${coords})'), 4326)`;
  } else {
    // Get coordinates from nodes
    const fromNode = await query('SELECT lat, lon FROM nodes WHERE node_id = $1', [segment.fromNode]);
    const toNode = await query('SELECT lat, lon FROM nodes WHERE node_id = $1', [segment.toNode]);
    
    if (fromNode.rows.length > 0 && toNode.rows.length > 0) {
      const from = fromNode.rows[0];
      const to = toNode.rows[0];
      geomValue = `ST_SetSRID(ST_MakeLine(
        ST_MakePoint(${from.lon}, ${from.lat}),
        ST_MakePoint(${to.lon}, ${to.lat})
      ), 4326)`;
    }
  }

  const queryText = `
    INSERT INTO segments (segment_id, from_node, to_node, geom, length_meters, weight, bidirectional, metadata)
    VALUES ($1, $2, $3, ${geomValue || 'NULL'}, $4, $5, $6, $7)
    ON CONFLICT (segment_id)
    DO UPDATE SET
      from_node = EXCLUDED.from_node,
      to_node = EXCLUDED.to_node,
      geom = EXCLUDED.geom,
      length_meters = EXCLUDED.length_meters,
      weight = EXCLUDED.weight,
      bidirectional = EXCLUDED.bidirectional,
      metadata = EXCLUDED.metadata;
  `;

  await query(queryText, [
    segment.segmentId,
    segment.fromNode,
    segment.toNode,
    segment.lengthMeters || null,
    segment.weight || null,
    segment.bidirectional !== false,
    segment.metadata ? JSON.stringify(segment.metadata) : null,
  ]);
}

/**
 * Store a calculated route
 */
export async function storeRoute(route: {
  routeId: string;
  missionId?: string;
  vehicleId?: string;
  originLat: number;
  originLon: number;
  destLat: number;
  destLon: number;
  geometry: Array<[number, number]>; // [lat, lon] pairs
  distanceMeters: number;
  durationSeconds: number;
  metadata?: any;
}): Promise<void> {
  const coords = route.geometry.map(([lat, lon]) => `${lon} ${lat}`).join(',');
  const geomValue = `ST_SetSRID(ST_GeomFromText('LINESTRING(${coords})'), 4326)`;

  const queryText = `
    INSERT INTO routes (route_id, mission_id, vehicle_id, origin_lat, origin_lon, dest_lat, dest_lon, route_geometry, distance_meters, duration_seconds, metadata)
    VALUES ($1, $2, $3, $4, $5, $6, $7, ${geomValue}, $8, $9, $10)
    ON CONFLICT (route_id)
    DO UPDATE SET
      route_geometry = EXCLUDED.route_geometry,
      distance_meters = EXCLUDED.distance_meters,
      duration_seconds = EXCLUDED.duration_seconds,
      metadata = EXCLUDED.metadata;
  `;

  await query(queryText, [
    route.routeId,
    route.missionId || null,
    route.vehicleId || null,
    route.originLat,
    route.originLon,
    route.destLat,
    route.destLon,
    route.distanceMeters,
    route.durationSeconds,
    route.metadata ? JSON.stringify(route.metadata) : null,
  ]);
}

/**
 * Find nearest node to a point
 */
export async function findNearestNode(lat: number, lon: number, maxDistanceMeters: number = 1000): Promise<{
  nodeId: string;
  lat: number;
  lon: number;
  distance: number;
} | null> {
  const queryText = `
    SELECT 
      node_id,
      lat,
      lon,
      ST_Distance(
        geom,
        ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
      ) as distance
    FROM nodes
    WHERE ST_DWithin(
      geom::geography,
      ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
      $3
    )
    ORDER BY distance
    LIMIT 1;
  `;

  const result = await query(queryText, [lat, lon, maxDistanceMeters]);
  
  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    nodeId: row.node_id,
    lat: parseFloat(row.lat),
    lon: parseFloat(row.lon),
    distance: parseFloat(row.distance),
  };
}

/**
 * Close database connection pool
 */
export async function closePostgres(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL connection pool closed');
  }
}

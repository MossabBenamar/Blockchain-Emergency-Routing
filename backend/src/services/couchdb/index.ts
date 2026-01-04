import { Segment, Vehicle, Mission } from '../../models/types';

// CouchDB connection settings
const COUCHDB_HOST = process.env.COUCHDB_HOST || 'localhost';
const COUCHDB_PORT = process.env.COUCHDB_PORT || '5984';
const COUCHDB_USER = process.env.COUCHDB_USER || 'admin';
const COUCHDB_PASSWORD = process.env.COUCHDB_PASSWORD || 'adminpw';
const DATABASE_NAME = 'emergency-channel_routing';

const COUCHDB_URL = `http://${COUCHDB_HOST}:${COUCHDB_PORT}`;
const AUTH_HEADER = 'Basic ' + Buffer.from(`${COUCHDB_USER}:${COUCHDB_PASSWORD}`).toString('base64');

/**
 * Query CouchDB directly for faster read operations
 * This bypasses chaincode schema validation issues
 */

interface CouchDBDoc<T> extends Record<string, unknown> {
  _id: string;
  _rev: string;
  '~version'?: string;
}

/**
 * Create headers with authentication
 */
function getHeaders(contentType?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Authorization': AUTH_HEADER,
  };
  if (contentType) {
    headers['Content-Type'] = contentType;
  }
  return headers;
}

/**
 * Fetch a single document by ID
 */
export async function getDocument<T>(docId: string): Promise<T | null> {
  try {
    const response = await fetch(`${COUCHDB_URL}/${DATABASE_NAME}/${encodeURIComponent(docId)}`, {
      headers: getHeaders(),
    });
    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`CouchDB error: ${response.status}`);
    }
    const doc = await response.json() as CouchDBDoc<T> & T;
    return doc;
  } catch (error) {
    console.error(`Error fetching document ${docId}:`, error);
    return null;
  }
}

/**
 * Update an existing document
 */
export async function updateDocument<T extends Record<string, any>>(docId: string, updates: Partial<T>): Promise<boolean> {
  try {
    // First, get the current document to get its _rev
    const currentDoc = await getDocument<T>(docId);
    if (!currentDoc) {
      console.error(`Document ${docId} not found for update`);
      return false;
    }

    // Merge updates with current document
    const updatedDoc = { ...currentDoc, ...updates };

    // Update the document
    const response = await fetch(`${COUCHDB_URL}/${DATABASE_NAME}/${encodeURIComponent(docId)}`, {
      method: 'PUT',
      headers: getHeaders('application/json'),
      body: JSON.stringify(updatedDoc),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`Failed to update document ${docId}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error updating document ${docId}:`, error);
    return false;
  }
}

/**
 * Query documents by selector (Mango query)
 */
export async function queryDocuments<T>(selector: Record<string, unknown>): Promise<T[]> {
  try {
    const response = await fetch(`${COUCHDB_URL}/${DATABASE_NAME}/_find`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        selector,
        limit: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`CouchDB query error: ${response.status} - ${errorText}`);
    }

    const result = await response.json() as { docs: Array<CouchDBDoc<T> & T> };

    // Remove CouchDB metadata from each document
    return result.docs.map(doc => {
      const { _id, _rev, '~version': version, ...data } = doc;
      return data as T;
    });
  } catch (error) {
    console.error('Error querying CouchDB:', error);
    throw error;
  }
}

/**
 * Get all segments directly from CouchDB
 */
export async function getAllSegments(): Promise<Segment[]> {
  return queryDocuments<Segment>({ docType: 'segment' });
}

/**
 * Get a single segment by ID
 */
export async function getSegment(segmentId: string): Promise<Segment | null> {
  return getDocument<Segment>(segmentId);
}

/**
 * Get segments by status
 */
export async function getSegmentsByStatus(status: string): Promise<Segment[]> {
  return queryDocuments<Segment>({ docType: 'segment', status });
}

/**
 * Get all vehicles directly from CouchDB
 */
export async function getAllVehicles(): Promise<Vehicle[]> {
  return queryDocuments<Vehicle>({ docType: 'vehicle' });
}

/**
 * Get a single vehicle by ID
 */
export async function getVehicle(vehicleId: string): Promise<Vehicle | null> {
  return getDocument<Vehicle>(vehicleId);
}

/**
 * Get vehicles by organization
 */
export async function getVehiclesByOrg(orgType: string): Promise<Vehicle[]> {
  return queryDocuments<Vehicle>({ docType: 'vehicle', orgType });
}

/**
 * Get all missions directly from CouchDB
 */
export async function getAllMissions(): Promise<Mission[]> {
  return queryDocuments<Mission>({ docType: 'mission' });
}

/**
 * Get a single mission by ID
 */
export async function getMission(missionId: string): Promise<Mission | null> {
  return getDocument<Mission>(missionId);
}

/**
 * Get missions by status
 */
export async function getMissionsByStatus(status: string): Promise<Mission[]> {
  return queryDocuments<Mission>({ docType: 'mission', status });
}

/**
 * Get active missions
 */
export async function getActiveMissions(): Promise<Mission[]> {
  return queryDocuments<Mission>({ docType: 'mission', status: 'active' });
}

/**
 * Get missions by organization
 */
export async function getMissionsByOrg(orgType: string): Promise<Mission[]> {
  return queryDocuments<Mission>({ docType: 'mission', orgType });
}


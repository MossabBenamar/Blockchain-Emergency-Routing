// OSRM Routing Service
// Provides route calculation using OSRM (Open Source Routing Machine)

import axios from 'axios';

export interface OSRMRouteRequest {
  coordinates: Array<[number, number]>; // [lon, lat] pairs
  profile?: 'driving' | 'walking' | 'cycling';
  alternatives?: number;
  steps?: boolean;
  geometries?: 'geojson' | 'polyline' | 'polyline6';
  overview?: 'full' | 'simplified' | 'false';
}

export interface OSRMRouteResponse {
  code: string;
  routes: Array<{
    distance: number; // meters
    duration: number; // seconds
    geometry: {
      coordinates: Array<[number, number]>; // [lon, lat] pairs
      type: string;
    };
    legs: Array<{
      distance: number;
      duration: number;
      steps: any[];
    }>;
  }>;
  waypoints: Array<{
    location: [number, number];
    name: string;
  }>;
}

export interface RouteCalculationResult {
  success: boolean;
  geometry: Array<[number, number]>; // [lat, lon] pairs for Leaflet
  distance: number; // meters
  duration: number; // seconds
  distanceKm: number;
  durationMinutes: number;
  error?: string;
}

class OSRMService {
  private baseUrl: string;
  private enabled: boolean;

  constructor(baseUrl?: string) {
    // Default to public OSRM demo server, or use environment variable
    this.baseUrl = baseUrl || process.env.OSRM_URL || 'http://router.project-osrm.org';
    this.enabled = process.env.USE_OSRM !== 'false';
  }

  /**
   * Calculate route between two points using OSRM
   */
  async calculateRoute(
    startLat: number,
    startLon: number,
    endLat: number,
    endLon: number,
    options?: {
      profile?: 'driving' | 'walking' | 'cycling';
      alternatives?: number;
    }
  ): Promise<RouteCalculationResult> {
    if (!this.enabled) {
      return {
        success: false,
        geometry: [],
        distance: 0,
        duration: 0,
        distanceKm: 0,
        durationMinutes: 0,
        error: 'OSRM service is disabled',
      };
    }

    try {
      // OSRM expects coordinates as [lon, lat]
      const coordinates: Array<[number, number]> = [
        [startLon, startLat],
        [endLon, endLat],
      ];

      const profile = options?.profile || 'driving';
      const url = `${this.baseUrl}/route/v1/${profile}/${coordinates.map(c => `${c[0]},${c[1]}`).join(';')}`;

      const params: any = {
        overview: 'full',
        geometries: 'geojson',
        steps: false,
      };

      if (options?.alternatives) {
        params.alternatives = options.alternatives;
      }

      const response = await axios.get<OSRMRouteResponse>(url, { params, timeout: 10000 });

      if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
        return {
          success: false,
          geometry: [],
          distance: 0,
          duration: 0,
          distanceKm: 0,
          durationMinutes: 0,
          error: `OSRM returned code: ${response.data.code}`,
        };
      }

      const route = response.data.routes[0];
      
      // Convert geometry from [lon, lat] to [lat, lon] for Leaflet
      const geometry: Array<[number, number]> = route.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );

      return {
        success: true,
        geometry,
        distance: route.distance,
        duration: route.duration,
        distanceKm: route.distance / 1000,
        durationMinutes: Math.round(route.duration / 60),
      };
    } catch (error: any) {
      console.error('OSRM route calculation error:', error);
      return {
        success: false,
        geometry: [],
        distance: 0,
        duration: 0,
        distanceKm: 0,
        durationMinutes: 0,
        error: error.message || 'Failed to calculate route with OSRM',
      };
    }
  }

  /**
   * Calculate route with multiple waypoints
   */
  async calculateRouteWithWaypoints(
    waypoints: Array<[number, number]>, // [lat, lon] pairs
    options?: {
      profile?: 'driving' | 'walking' | 'cycling';
    }
  ): Promise<RouteCalculationResult> {
    if (waypoints.length < 2) {
      return {
        success: false,
        geometry: [],
        distance: 0,
        duration: 0,
        distanceKm: 0,
        durationMinutes: 0,
        error: 'At least 2 waypoints required',
      };
    }

    try {
      // Convert to [lon, lat] for OSRM
      const coordinates: Array<[number, number]> = waypoints.map(([lat, lon]) => [lon, lat]);
      const profile = options?.profile || 'driving';
      const url = `${this.baseUrl}/route/v1/${profile}/${coordinates.map(c => `${c[0]},${c[1]}`).join(';')}`;

      const response = await axios.get<OSRMRouteResponse>(url, {
        params: {
          overview: 'full',
          geometries: 'geojson',
          steps: false,
        },
        timeout: 15000,
      });

      if (response.data.code !== 'Ok' || !response.data.routes || response.data.routes.length === 0) {
        return {
          success: false,
          geometry: [],
          distance: 0,
          duration: 0,
          distanceKm: 0,
          durationMinutes: 0,
          error: `OSRM returned code: ${response.data.code}`,
        };
      }

      const route = response.data.routes[0];
      const geometry: Array<[number, number]> = route.geometry.coordinates.map(
        ([lon, lat]) => [lat, lon]
      );

      return {
        success: true,
        geometry,
        distance: route.distance,
        duration: route.duration,
        distanceKm: route.distance / 1000,
        durationMinutes: Math.round(route.duration / 60),
      };
    } catch (error: any) {
      console.error('OSRM route calculation error:', error);
      return {
        success: false,
        geometry: [],
        distance: 0,
        duration: 0,
        distanceKm: 0,
        durationMinutes: 0,
        error: error.message || 'Failed to calculate route with OSRM',
      };
    }
  }

  /**
   * Check if OSRM service is available
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await axios.get(`${this.baseUrl}/route/v1/driving/-73.9851,40.7589;-73.9776,40.7614`, {
        params: { overview: 'false' },
        timeout: 5000,
      });
      return response.status === 200;
    } catch {
      return false;
    }
  }
}

export const osrmService = new OSRMService();
export default osrmService;

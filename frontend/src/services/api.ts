// API Service for Emergency Vehicle Routing System

import type { ApiResponse, Vehicle, Segment, MapData, MapState, Mission, RouteResult, CreateMissionRequest, SimulationStatus, VehiclePosition, HistoryEvent, MissionHistoryEntry, HistoryStats } from '../types';

// API URLs for each organization
const API_URLS = {
  medical: 'http://localhost:3001/api',
  police: 'http://localhost:3003/api',
};

class ApiService {
  private currentOrg: 'medical' | 'police' = 'medical';

  setOrganization(org: 'medical' | 'police') {
    this.currentOrg = org;
  }

  private get baseUrl(): string {
    return API_URLS[this.currentOrg];
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; blockchain: string }>> {
    return this.request('/health'.replace('/api', ''));
  }

  // Vehicle endpoints
  async getVehicles(org?: string): Promise<ApiResponse<Vehicle[]>> {
    const query = org ? `?org=${org}` : '';
    return this.request(`/vehicles${query}`);
  }

  async getVehicle(vehicleId: string): Promise<ApiResponse<Vehicle>> {
    return this.request(`/vehicles/${vehicleId}`);
  }

  async registerVehicle(vehicle: {
    vehicleId: string;
    orgType: string;
    vehicleType: string;
    priorityLevel: number;
  }): Promise<ApiResponse<Vehicle>> {
    return this.request('/vehicles', {
      method: 'POST',
      body: JSON.stringify(vehicle),
    });
  }

  async updateVehicleStatus(
    vehicleId: string,
    status: string
  ): Promise<ApiResponse<Vehicle>> {
    return this.request(`/vehicles/${vehicleId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // Segment endpoints
  async getSegments(status?: string): Promise<ApiResponse<Segment[]>> {
    const query = status ? `?status=${status}` : '';
    return this.request(`/segments${query}`);
  }

  async getSegment(segmentId: string): Promise<ApiResponse<Segment>> {
    return this.request(`/segments/${segmentId}`);
  }

  async reserveSegment(data: {
    segmentId: string;
    vehicleId: string;
    missionId: string;
    priorityLevel: number;
  }): Promise<ApiResponse<Segment>> {
    return this.request('/segments/reserve', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async releaseSegment(
    segmentId: string,
    vehicleId: string
  ): Promise<ApiResponse<Segment>> {
    return this.request(`/segments/${segmentId}/release`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    });
  }

  async occupySegment(
    segmentId: string,
    vehicleId: string
  ): Promise<ApiResponse<Segment>> {
    return this.request(`/segments/${segmentId}/occupy`, {
      method: 'POST',
      body: JSON.stringify({ vehicleId }),
    });
  }

  // Map endpoints
  async getMapData(): Promise<ApiResponse<MapData>> {
    return this.request('/map');
  }

  async getMapState(): Promise<ApiResponse<MapState>> {
    return this.request('/map/state');
  }

  async getMapStatistics(): Promise<ApiResponse<{
    totalNodes: number;
    totalSegments: number;
    pointsOfInterest: number;
    segmentStatus: {
      free: number;
      reserved: number;
      occupied: number;
    };
    utilizationRate: string;
  }>> {
    return this.request('/map/statistics');
  }

  // Conflict endpoints
  async getPendingConflicts(): Promise<ApiResponse<any[]>> {
    return this.request('/segments/conflicts/pending');
  }

  async resolveConflict(
    conflictId: string,
    resolution: 'mission1_wins' | 'mission2_wins' | 'both_reroute'
  ): Promise<ApiResponse<any>> {
    return this.request(`/segments/conflicts/${conflictId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolution }),
    });
  }

  async getConflictHistory(): Promise<ApiResponse<any[]>> {
    return this.request('/segments/conflicts/history');
  }

  // Mission endpoints
  async getMissions(filters?: { status?: string; org?: string }): Promise<ApiResponse<Mission[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.org) params.append('org', filters.org);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/missions${query}`);
  }

  async getActiveMissions(): Promise<ApiResponse<Mission[]>> {
    return this.request('/missions/active');
  }

  async getMission(missionId: string): Promise<ApiResponse<Mission>> {
    return this.request(`/missions/${missionId}`);
  }

  async createMission(data: CreateMissionRequest): Promise<ApiResponse<Mission>> {
    return this.request('/missions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async activateMission(missionId: string, path: string[]): Promise<ApiResponse<Mission>> {
    return this.request(`/missions/${missionId}/activate`, {
      method: 'POST',
      body: JSON.stringify({ path }),
    });
  }

  async completeMission(missionId: string): Promise<ApiResponse<Mission>> {
    return this.request(`/missions/${missionId}/complete`, {
      method: 'POST',
    });
  }

  async abortMission(missionId: string, reason?: string): Promise<ApiResponse<Mission>> {
    return this.request(`/missions/${missionId}/abort`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getVehicleActiveMission(vehicleId: string): Promise<ApiResponse<Mission | null>> {
    return this.request(`/missions/vehicle/${vehicleId}`);
  }

  // Routing endpoints
  async calculateRoute(data: {
    originNode?: string;
    destNode?: string;
    vehicleId?: string;
    originLat?: number;
    originLon?: number;
    destLat?: number;
    destLon?: number;
    missionId?: string;
  }): Promise<ApiResponse<RouteResult>> {
    return this.request('/missions/routes/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAlternativeRoutes(data: {
    originNode: string;
    destNode: string;
    vehicleId: string;
    primaryPath?: string[];
    numAlternatives?: number;
  }): Promise<ApiResponse<{ primary: string[]; alternatives: RouteResult[] }>> {
    return this.request('/missions/routes/alternatives', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Convenience: Create and activate mission in one call
  async createAndActivateMission(data: CreateMissionRequest): Promise<ApiResponse<{
    mission: Mission;
    route: RouteResult;
  }>> {
    return this.request('/missions/create-and-activate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // =====================
  // Simulation endpoints
  // =====================

  async getSimulationStatus(): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/status');
  }

  async getVehiclePositions(): Promise<ApiResponse<VehiclePosition[]>> {
    return this.request('/simulation/positions');
  }

  async startSimulation(): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/start', {
      method: 'POST',
    });
  }

  async pauseSimulation(): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/pause', {
      method: 'POST',
    });
  }

  async stopSimulation(): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/stop', {
      method: 'POST',
    });
  }

  async setSimulationSpeed(speed: number): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/speed', {
      method: 'POST',
      body: JSON.stringify({ speed }),
    });
  }

  async simulateMission(missionId: string): Promise<ApiResponse<SimulationStatus>> {
    return this.request(`/simulation/mission/${missionId}`, {
      method: 'POST',
    });
  }

  async reloadSimulationMissions(): Promise<ApiResponse<SimulationStatus>> {
    return this.request('/simulation/reload', {
      method: 'POST',
    });
  }

  // =====================
  // History endpoints
  // =====================

  async getHistoryEvents(filters?: {
    limit?: number;
    type?: 'mission' | 'simulation' | 'segment' | 'system';
    action?: string;
    missionId?: string;
    vehicleId?: string;
    since?: number;
  }): Promise<ApiResponse<HistoryEvent[]>> {
    const params = new URLSearchParams();
    if (filters?.limit) params.append('limit', filters.limit.toString());
    if (filters?.type) params.append('type', filters.type);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.missionId) params.append('missionId', filters.missionId);
    if (filters?.vehicleId) params.append('vehicleId', filters.vehicleId);
    if (filters?.since) params.append('since', filters.since.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/history/events${query}`);
  }

  async getMissionHistory(filters?: {
    status?: string;
    org?: string;
    limit?: number;
  }): Promise<ApiResponse<MissionHistoryEntry[]>> {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.org) params.append('org', filters.org);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/history/missions${query}`);
  }

  async getMissionHistoryDetail(missionId: string): Promise<ApiResponse<{
    mission: MissionHistoryEntry;
    events: HistoryEvent[];
    timeline: HistoryEvent[];
  }>> {
    return this.request(`/history/missions/${missionId}`);
  }

  async getHistoryStats(): Promise<ApiResponse<HistoryStats>> {
    return this.request('/history/stats');
  }

  async getVehicleHistory(vehicleId: string, limit?: number): Promise<ApiResponse<{
    vehicleId: string;
    missions: MissionHistoryEntry[];
    events: HistoryEvent[];
    stats: {
      totalMissions: number;
      completedMissions: number;
      abortedMissions: number;
      successRate: number;
      averageDuration: number | null;
    };
  }>> {
    const query = limit ? `?limit=${limit}` : '';
    return this.request(`/history/vehicles/${vehicleId}${query}`);
  }

  async getRecentActivity(hours?: number): Promise<ApiResponse<{
    periodHours: number;
    since: number;
    events: HistoryEvent[];
    missions: Mission[];
    summary: {
      totalEvents: number;
      totalMissions: number;
      newMissions: number;
      completedMissions: number;
    };
  }>> {
    const query = hours ? `?hours=${hours}` : '';
    return this.request(`/history/recent${query}`);
  }
}

export const api = new ApiService();
export default api;


// Emergency Vehicle Routing System - Main App Component

import { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header/Header';
import { LeafletMap } from './components/Map/LeafletMap';
import { Sidebar } from './components/Sidebar/Sidebar';
import { MissionPanel } from './components/Mission/MissionPanel';
import { SimulationControls } from './components/Simulation/SimulationControls';
import { MissionHistory } from './components/History/MissionHistory';
import { ConflictAlert } from './components/Conflict/ConflictAlert';
import { useWebSocket, useWebSocketEvent } from './hooks/useWebSocket';
import { useSocketIO, useVehiclePositions } from './hooks/useSocketIO';
import api from './services/api';
import wsService from './services/websocket';
import socketIOService from './services/socketio';
import type { Node, Segment, Vehicle, OrgType, Mission, VehiclePosition, SimulationStatus } from './types';
import { VehicleManagementPanel } from './components/VehicleManagement/VehicleManagementPanel';
import './App.css';

// Demo data for when backend is not available
const DEMO_NODES: Node[] = [
  { id: 'N1', x: 0, y: 0, label: 'Hospital', type: 'poi', orgType: 'medical' },
  { id: 'N2', x: 1, y: 0, label: null, type: 'intersection' },
  { id: 'N3', x: 2, y: 0, label: null, type: 'intersection' },
  { id: 'N4', x: 3, y: 0, label: null, type: 'intersection' },
  { id: 'N5', x: 4, y: 0, label: null, type: 'intersection' },
  { id: 'N6', x: 0, y: 1, label: null, type: 'intersection' },
  { id: 'N7', x: 1, y: 1, label: null, type: 'intersection' },
  { id: 'N8', x: 2, y: 1, label: null, type: 'intersection' },
  { id: 'N9', x: 3, y: 1, label: null, type: 'intersection' },
  { id: 'N10', x: 4, y: 1, label: null, type: 'intersection' },
  { id: 'N11', x: 0, y: 2, label: null, type: 'intersection' },
  { id: 'N12', x: 1, y: 2, label: null, type: 'intersection' },
  { id: 'N13', x: 2, y: 2, label: 'Central Hub', type: 'poi' },
  { id: 'N14', x: 3, y: 2, label: null, type: 'intersection' },
  { id: 'N15', x: 4, y: 2, label: null, type: 'intersection' },
  { id: 'N16', x: 0, y: 3, label: null, type: 'intersection' },
  { id: 'N17', x: 1, y: 3, label: null, type: 'intersection' },
  { id: 'N18', x: 2, y: 3, label: null, type: 'intersection' },
  { id: 'N19', x: 3, y: 3, label: null, type: 'intersection' },
  { id: 'N20', x: 4, y: 3, label: null, type: 'intersection' },
  { id: 'N21', x: 0, y: 4, label: null, type: 'intersection' },
  { id: 'N22', x: 1, y: 4, label: null, type: 'intersection' },
  { id: 'N23', x: 2, y: 4, label: null, type: 'intersection' },
  { id: 'N24', x: 3, y: 4, label: null, type: 'intersection' },
  { id: 'N25', x: 4, y: 4, label: 'Police Station', type: 'poi', orgType: 'police' },
];

const DEMO_SEGMENTS: Segment[] = [
  // Horizontal segments
  { id: 'S1', from: 'N1', to: 'N2', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S2', from: 'N2', to: 'N3', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S3', from: 'N3', to: 'N4', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S4', from: 'N4', to: 'N5', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S5', from: 'N6', to: 'N7', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S6', from: 'N7', to: 'N8', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S7', from: 'N8', to: 'N9', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S8', from: 'N9', to: 'N10', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S9', from: 'N11', to: 'N12', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S10', from: 'N12', to: 'N13', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S11', from: 'N13', to: 'N14', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S12', from: 'N14', to: 'N15', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S13', from: 'N16', to: 'N17', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S14', from: 'N17', to: 'N18', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S15', from: 'N18', to: 'N19', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S16', from: 'N19', to: 'N20', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S17', from: 'N21', to: 'N22', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S18', from: 'N22', to: 'N23', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S19', from: 'N23', to: 'N24', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  { id: 'S20', from: 'N24', to: 'N25', weight: 1, direction: 'horizontal', bidirectional: true, status: 'free' },
  // Vertical segments
  { id: 'S21', from: 'N1', to: 'N6', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S22', from: 'N6', to: 'N11', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S23', from: 'N11', to: 'N16', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S24', from: 'N16', to: 'N21', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S25', from: 'N2', to: 'N7', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S26', from: 'N7', to: 'N12', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S27', from: 'N12', to: 'N17', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S28', from: 'N17', to: 'N22', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S29', from: 'N3', to: 'N8', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S30', from: 'N8', to: 'N13', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S31', from: 'N13', to: 'N18', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S32', from: 'N18', to: 'N23', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S33', from: 'N4', to: 'N9', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S34', from: 'N9', to: 'N14', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S35', from: 'N14', to: 'N19', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S36', from: 'N19', to: 'N24', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S37', from: 'N5', to: 'N10', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S38', from: 'N10', to: 'N15', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S39', from: 'N15', to: 'N20', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
  { id: 'S40', from: 'N20', to: 'N25', weight: 1, direction: 'vertical', bidirectional: true, status: 'free' },
];

const DEMO_VEHICLES: Vehicle[] = [
  { vehicleId: 'AMB-001', orgType: 'medical', vehicleType: 'ambulance', priorityLevel: 1, status: 'active' },
  { vehicleId: 'AMB-002', orgType: 'medical', vehicleType: 'ambulance', priorityLevel: 1, status: 'active' },
  { vehicleId: 'POL-001', orgType: 'police', vehicleType: 'patrol', priorityLevel: 2, status: 'active' },
  { vehicleId: 'POL-002', orgType: 'police', vehicleType: 'patrol', priorityLevel: 2, status: 'active' },
];

function App() {
  // State - initialize with demo data
  const [currentOrg, setCurrentOrg] = useState<OrgType>('medical');
  const [nodes, setNodes] = useState<Node[]>(DEMO_NODES);
  const [segments, setSegments] = useState<Segment[]>(DEMO_SEGMENTS);
  const [vehicles, setVehicles] = useState<Vehicle[]>(DEMO_VEHICLES);
  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [blockchainStatus, setBlockchainStatus] = useState<'connected' | 'disconnected' | 'unknown'>('unknown');
  const [error, setError] = useState<string | null>(null);

  // Mission state
  const [activeMissions, setActiveMissions] = useState<Mission[]>([]);
  const [highlightedRoute, setHighlightedRoute] = useState<string[]>([]);
  const [routeGeometry, setRouteGeometry] = useState<Array<[number, number]>>([]);
  const [showMissionPanel, setShowMissionPanel] = useState(false);

  // Vehicle Management state
  const [showVehiclePanel, setShowVehiclePanel] = useState(false);

  // Simulation state (Phase 5)
  const [simulationStatus, setSimulationStatus] = useState<SimulationStatus | null>(null);
  const [vehiclePositions, setVehiclePositions] = useState<VehiclePosition[]>([]);
  const [showSimulationPanel, setShowSimulationPanel] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // WebSocket connection
  const { isConnected } = useWebSocket();

  // Socket.IO connection for real-time vehicle tracking
  const { isConnected: _isSocketIOConnected } = useSocketIO();
  const socketIOPositions = useVehiclePositions();

  // Merge Socket.IO positions with existing vehicle positions
  useEffect(() => {
    if (socketIOPositions.length > 0) {
      setVehiclePositions(socketIOPositions);
    }
  }, [socketIOPositions]);

  // Update Socket.IO organization when org changes
  useEffect(() => {
    socketIOService.setOrganization(currentOrg);
  }, [currentOrg]);

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch map data (nodes and static segments with geometry)
      const mapResponse = await api.getMapData();
      if (mapResponse.success) {
        // Use Manhattan data from backend
        setNodes(mapResponse.data.nodes);

        // Get static segment geometry from map data
        const mapSegments = mapResponse.data.segments || [];

        // Fetch live segment status from blockchain
        const segmentsResponse = await api.getSegments();

        if (segmentsResponse.success) {
          // Create a map of segment status by ID
          const statusMap = new Map<string, any>();
          segmentsResponse.data.forEach((seg: any) => {
            // API returns segmentId, fromNode, toNode - normalize to id, from, to
            const id = seg.segmentId || seg.id;

            // Build reservedBy object from flat API data
            // API returns: reservedBy (string), orgType, priorityLevel, missionId
            const reservedBy = seg.status === 'reserved' ? {
              vehicleId: seg.reservedBy || seg.vehicleId,
              orgType: seg.orgType,
              priorityLevel: seg.priorityLevel,
              missionId: seg.missionId,
            } : undefined;

            statusMap.set(id, {
              status: seg.status || 'free',
              reservedBy,
            });
          });

          // Merge geometry with status
          const mergedSegments: Segment[] = mapSegments.map((seg: any) => ({
            id: seg.id,
            from: seg.from,
            to: seg.to,
            weight: seg.weight,
            direction: seg.direction,
            bidirectional: seg.bidirectional,
            status: statusMap.get(seg.id)?.status || 'free',
            reservedBy: statusMap.get(seg.id)?.reservedBy,
          }));

          setSegments(mergedSegments);
        } else {
          // If no status API, just use map segments with default status
          setSegments(mapSegments.map((seg: any) => ({
            ...seg,
            status: 'free',
          })));
        }
      }

      // Fetch vehicles
      const vehiclesResponse = await api.getVehicles();
      if (vehiclesResponse.success) {
        // Normalize vehicle data (API might return different property names)
        const normalizedVehicles = vehiclesResponse.data.map((v: any) => ({
          vehicleId: v.vehicleId,
          orgType: v.orgType,
          vehicleType: v.vehicleType,
          priorityLevel: v.priorityLevel,
          status: v.status || 'active',
        }));
        setVehicles(normalizedVehicles);
      }

      // Fetch active missions
      try {
        const missionsResponse = await api.getActiveMissions();
        if (missionsResponse.success) {
          setActiveMissions(missionsResponse.data || []);
        }
      } catch (err) {
        console.log('Missions endpoint not available yet');
      }

      // Fetch simulation status
      try {
        const simResponse = await api.getSimulationStatus();
        if (simResponse.success) {
          setSimulationStatus(simResponse.data);
        }
        const posResponse = await api.getVehiclePositions();
        if (posResponse.success) {
          setVehiclePositions(posResponse.data || []);
        }
      } catch (err) {
        console.log('Simulation endpoint not available yet');
      }

      setBlockchainStatus('connected');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
      setBlockchainStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle WebSocket events for segment updates
  useWebSocketEvent('SEGMENT_UPDATED', (message) => {
    const updatedSegment = message.payload.segment;
    if (updatedSegment) {
      setSegments(prev => prev.map(s =>
        s.id === updatedSegment.segmentId ? { ...s, ...updatedSegment } : s
      ));
    }
  });

  // Handle WebSocket events for vehicle updates
  useWebSocketEvent('VEHICLE_UPDATED', (message) => {
    const updatedVehicle = message.payload.vehicle;
    if (updatedVehicle) {
      setVehicles(prev => {
        const exists = prev.find(v => v.vehicleId === updatedVehicle.vehicleId);
        if (exists) {
          return prev.map(v =>
            v.vehicleId === updatedVehicle.vehicleId ? { ...v, ...updatedVehicle } : v
          );
        }
        return [...prev, updatedVehicle];
      });
    }
  });

  // Handle WebSocket events for mission updates
  useWebSocketEvent('MISSION_CREATED', (message) => {
    const mission = message.payload.mission;
    if (mission) {
      setActiveMissions(prev => [...prev, mission]);
    }
  });

  useWebSocketEvent('MISSION_ACTIVATED', (message) => {
    const mission = message.payload.mission;
    if (mission) {
      setActiveMissions(prev =>
        prev.map(m => m.missionId === mission.missionId ? mission : m)
      );
      // Refresh segments to show reservations
      fetchData();
    }
  });

  useWebSocketEvent('MISSION_COMPLETED', (message) => {
    const mission = message.payload.mission;
    if (mission) {
      setActiveMissions(prev => prev.filter(m => m.missionId !== mission.missionId));
      // Refresh segments to show released segments
      fetchData();
    }
  });

  useWebSocketEvent('MISSION_ABORTED', (message) => {
    const mission = message.payload.mission;
    if (mission) {
      setActiveMissions(prev => prev.filter(m => m.missionId !== mission.missionId));
      fetchData();
    }
  });

  useWebSocketEvent('MISSION_CREATED_AND_ACTIVATED', (message) => {
    const mission = message.payload.mission;
    if (mission) {
      setActiveMissions(prev => [...prev, mission]);
      fetchData();
    }
  });

  // Phase 5: Simulation WebSocket events
  useWebSocketEvent('VEHICLE_POSITION', (message) => {
    const position = message.payload as VehiclePosition;
    if (position) {
      setVehiclePositions(prev => {
        const existing = prev.findIndex(p => p.vehicleId === position.vehicleId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = position;
          return updated;
        }
        return [...prev, position];
      });
    }
  });

  useWebSocketEvent('SIMULATION_STARTED', (message) => {
    if (message.payload?.status) {
      setSimulationStatus(message.payload.status as SimulationStatus);
    }
  });

  useWebSocketEvent('SIMULATION_PAUSED', (message) => {
    if (message.payload?.status) {
      setSimulationStatus(message.payload.status as SimulationStatus);
    }
  });

  useWebSocketEvent('SIMULATION_STOPPED', (message) => {
    if (message.payload?.status) {
      setSimulationStatus(message.payload.status as SimulationStatus);
      setVehiclePositions([]);
    }
  });

  useWebSocketEvent('SIMULATION_SPEED_CHANGED', (message) => {
    if (message.payload?.speedMultiplier !== undefined) {
      setSimulationStatus(prev => prev ? {
        ...prev,
        speedMultiplier: message.payload.speedMultiplier,
      } : null);
    }
  });

  useWebSocketEvent('VEHICLE_ARRIVED', (message) => {
    const { vehicleId } = message.payload;
    if (vehicleId) {
      setVehiclePositions(prev => prev.filter(p => p.vehicleId !== vehicleId));
    }
  });

  useWebSocketEvent('SEGMENT_TRANSITION', () => {
    // Optionally refresh segments when vehicle transitions
    // fetchData(); // Commented out to avoid too many refreshes
  });

  // Handle organization change
  const handleOrgChange = useCallback((org: OrgType) => {
    setCurrentOrg(org);
    setSelectedSegmentId(null);
    setHighlightedRoute([]);

    // Switch API and WebSocket to the new organization's backend
    api.setOrganization(org);
    wsService.setOrganization(org);

    // Refresh data from the new backend
    fetchData();
  }, [fetchData]);

  // Mission callbacks
  const handleMissionCreated = useCallback((mission: Mission) => {
    setActiveMissions(prev => {
      // Check if mission already exists
      const exists = prev.find(m => m.missionId === mission.missionId);
      if (exists) {
        return prev.map(m => m.missionId === mission.missionId ? mission : m);
      }
      return [...prev, mission];
    });
    // Refresh segments to show new reservations
    fetchData();
  }, [fetchData]);

  const handleMissionCompleted = useCallback((mission: Mission) => {
    setActiveMissions(prev => prev.filter(m => m.missionId !== mission.missionId));
    setHighlightedRoute([]);
    // Refresh segments to show released segments
    fetchData();
  }, [fetchData]);

  const handleRouteCalculated = useCallback((path: string[], routeResult?: any) => {
    setHighlightedRoute(path);
    // Use geometry from route result if available, otherwise calculate from segments
    if (routeResult?.geometry && routeResult.geometry.length > 0) {
      setRouteGeometry(routeResult.geometry);
    } else {
      // Fallback: Calculate route geometry from segments
      const geometry: Array<[number, number]> = [];
      path.forEach((segmentId) => {
        const segment = segments.find(s => s.id === segmentId);
        if (segment) {
          // Use segment geometry if available
          if (segment.geometry && segment.geometry.length > 0) {
            geometry.push(...segment.geometry);
          } else {
            // Fallback to node coordinates
            const fromNode = nodes.find(n => n.id === segment.from);
            const toNode = nodes.find(n => n.id === segment.to);
            if (fromNode?.lat !== undefined && fromNode?.lon !== undefined) {
              geometry.push([fromNode.lat, fromNode.lon]);
            }
            if (toNode?.lat !== undefined && toNode?.lon !== undefined &&
              !geometry.some(([lat, lon]) => lat === toNode.lat && lon === toNode.lon)) {
              geometry.push([toNode.lat, toNode.lon]);
            }
          }
        }
      });
      setRouteGeometry(geometry);
    }
  }, [segments, nodes]);

  const handleClearRoute = useCallback(() => {
    setHighlightedRoute([]);
    setRouteGeometry([]);
  }, []);

  // Phase 5: Simulation handlers
  const handleStartSimulation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.startSimulation();
      if (response.success && response.data) {
        setSimulationStatus(response.data);
      }
    } catch (err) {
      console.error('Error starting simulation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start simulation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePauseSimulation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.pauseSimulation();
      if (response.success && response.data) {
        setSimulationStatus(response.data);
      }
    } catch (err) {
      console.error('Error pausing simulation:', err);
      setError(err instanceof Error ? err.message : 'Failed to pause simulation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleStopSimulation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.stopSimulation();
      if (response.success && response.data) {
        setSimulationStatus(response.data);
        setVehiclePositions([]);
      }
    } catch (err) {
      console.error('Error stopping simulation:', err);
      setError(err instanceof Error ? err.message : 'Failed to stop simulation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSimulationSpeedChange = useCallback(async (speed: number) => {
    try {
      const response = await api.setSimulationSpeed(speed);
      if (response.success && response.data) {
        setSimulationStatus(response.data);
      }
    } catch (err) {
      console.error('Error setting simulation speed:', err);
      setError(err instanceof Error ? err.message : 'Failed to set simulation speed');
    }
  }, []);

  const handleReloadSimulation = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await api.reloadSimulationMissions();
      if (response.success && response.data) {
        setSimulationStatus(response.data);
      }
    } catch (err) {
      console.error('Error reloading simulation:', err);
      setError(err instanceof Error ? err.message : 'Failed to reload simulation');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle segment selection
  const handleSegmentClick = useCallback((segmentId: string) => {
    console.log('Segment clicked:', segmentId);
    setSelectedSegmentId(prev => {
      const newValue = prev === segmentId ? null : segmentId;
      console.log('Selected segment changed to:', newValue);
      return newValue;
    });
  }, []);

  // Handle segment reservation
  const handleReserveSegment = useCallback(async (segmentId: string, vehicleId: string) => {
    setIsLoading(true);
    try {
      const missionId = `MISSION-${Date.now()}`;
      const vehicle = vehicles.find(v => v.vehicleId === vehicleId);

      await api.reserveSegment({
        segmentId,
        vehicleId,
        missionId,
        priorityLevel: vehicle?.priorityLevel || 1,
      });

      // Refresh segments after reservation
      const response = await api.getSegments();
      if (response.success) {
        setSegments(response.data);
      }
    } catch (err) {
      console.error('Error reserving segment:', err);
      setError(err instanceof Error ? err.message : 'Failed to reserve segment');
    } finally {
      setIsLoading(false);
    }
  }, [vehicles]);

  // Handle segment release
  const handleReleaseSegment = useCallback(async (segmentId: string) => {
    setIsLoading(true);
    try {
      const segment = segments.find(s => s.id === segmentId);
      if (segment?.reservedBy?.vehicleId) {
        await api.releaseSegment(segmentId, segment.reservedBy.vehicleId);
      }

      // Refresh segments after release
      const response = await api.getSegments();
      if (response.success) {
        setSegments(response.data);
      }
    } catch (err) {
      console.error('Error releasing segment:', err);
      setError(err instanceof Error ? err.message : 'Failed to release segment');
    } finally {
      setIsLoading(false);
    }
  }, [segments]);

  // Get selected segment object
  const selectedSegment = segments.find(s => s.id === selectedSegmentId) || null;

  return (
    <div className="app">
      <Header
        currentOrg={currentOrg}
        onOrgChange={handleOrgChange}
        isConnected={isConnected}
        blockchainStatus={blockchainStatus}
      />

      {/* Conflict notifications overlay */}
      <ConflictAlert />

      <div className="app-content">
        <main className="main-content">
          {error && (
            <div className="error-banner">
              <span>⚠️ {error}</span>
              <button onClick={() => setError(null)}>×</button>
            </div>
          )}

          <div className="map-wrapper">
            <LeafletMap
              nodes={nodes}
              segments={segments}
              vehicles={vehicles}
              selectedSegment={selectedSegmentId}
              onSegmentClick={handleSegmentClick}
              onMapClick={(lat, lon) => {
                // Map click handling can be added later if needed
                console.log('Map clicked:', lat, lon);
              }}
              currentOrg={currentOrg}
              highlightedRoute={highlightedRoute}
              activeMissions={activeMissions}
              vehiclePositions={vehiclePositions}
              routeGeometry={routeGeometry.length > 0 ? routeGeometry : undefined}
              center={nodes.length > 0 && nodes[0].lat !== undefined ?
                [nodes[0].lat, nodes[0].lon!] : [40.7589, -73.9851]}
              zoom={13}
            />
          </div>

          <div className="map-info">
            <div className="info-card">
              <span className="info-label">Current Organization</span>
              <span className={`info-value org-${currentOrg}`}>
                {currentOrg === 'medical' ? '🏥 Medical Services' : '🚔 Police Department'}
              </span>
            </div>
            <div className="info-card">
              <span className="info-label">Active Missions</span>
              <span className="info-value">
                {activeMissions.filter(m => m.orgType === currentOrg).length} active
              </span>
            </div>
            <div className="info-card clickable" onClick={() => {
              setShowMissionPanel(!showMissionPanel);
              if (!showMissionPanel) {
                setShowVehiclePanel(false);
                setShowHistoryPanel(false);
              }
            }}>
              <span className="info-label">Mission Control</span>
              <span className="info-value mission-toggle">
                {showMissionPanel ? '📋 Hide Panel' : '🎯 Open Panel'}
              </span>
            </div>
            <div className="info-card clickable" onClick={() => {
              setShowVehiclePanel(!showVehiclePanel);
              if (!showVehiclePanel) {
                setShowMissionPanel(false);
                setShowHistoryPanel(false);
              }
            }}>
              <span className="info-label">Vehicle Management</span>
              <span className="info-value vehicle-toggle">
                {showVehiclePanel ? '🚗 Hide' : '🚗 Manage Fleet'}
              </span>
            </div>
            <div className="info-card clickable" onClick={() => {
              setShowSimulationPanel(!showSimulationPanel);
              if (!showSimulationPanel) setShowHistoryPanel(false);
            }}>
              <span className="info-label">Simulation</span>
              <span className={`info-value sim-toggle ${simulationStatus?.isRunning ? 'running' : ''}`}>
                {simulationStatus?.isRunning
                  ? simulationStatus.isPaused
                    ? '⏸️ Paused'
                    : '▶️ Running'
                  : '⏹️ Stopped'}
              </span>
            </div>
            <div className="info-card clickable" onClick={() => {
              setShowHistoryPanel(!showHistoryPanel);
              if (!showHistoryPanel) {
                setShowSimulationPanel(false);
                setShowMissionPanel(false);
              }
            }}>
              <span className="info-label">History</span>
              <span className="info-value history-toggle">
                {showHistoryPanel ? '📜 Hide' : '📜 View'}
              </span>
            </div>
          </div>
        </main>

        {showHistoryPanel ? (
          <aside className="history-sidebar">
            <MissionHistory
              currentOrg={currentOrg}
              onMissionSelect={(missionId) => {
                const mission = activeMissions.find(m => m.missionId === missionId);
                if (mission?.path) {
                  setHighlightedRoute(mission.path);
                }
              }}
            />
          </aside>
        ) : showVehiclePanel ? (
          <aside className="vehicle-sidebar">
            <VehicleManagementPanel
              currentOrg={currentOrg}
              vehicles={vehicles}
              onVehicleUpdate={fetchData}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </aside>
        ) : showSimulationPanel ? (
          <aside className="simulation-sidebar">
            <SimulationControls
              status={simulationStatus}
              vehiclePositions={vehiclePositions}
              onStart={handleStartSimulation}
              onPause={handlePauseSimulation}
              onStop={handleStopSimulation}
              onSpeedChange={handleSimulationSpeedChange}
              onReload={handleReloadSimulation}
              isLoading={isLoading}
              currentOrg={currentOrg}
            />
          </aside>
        ) : showMissionPanel ? (
          <aside className="mission-sidebar">
            <MissionPanel
              nodes={nodes}
              vehicles={vehicles}
              currentOrg={currentOrg}
              activeMissions={activeMissions}
              vehiclePositions={vehiclePositions}
              onMissionCreated={handleMissionCreated}
              onMissionCompleted={handleMissionCompleted}
              onRouteCalculated={handleRouteCalculated}
              onClearRoute={handleClearRoute}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
            />
          </aside>
        ) : (
          <Sidebar
            selectedSegment={selectedSegment}
            segments={segments}
            vehicles={vehicles}
            currentOrg={currentOrg}
            onReserveSegment={handleReserveSegment}
            onReleaseSegment={handleReleaseSegment}
            onRefresh={fetchData}
            isLoading={isLoading}
          />
        )}
      </div>
    </div>
  );
}

export default App;

/**
 * MissionPanel Component
 * 
 * Handles mission creation, route visualization, and mission lifecycle management
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Node, Vehicle, Mission, RouteResult, OrgType } from '../../types';
import './MissionPanel.css';

interface MissionPanelProps {
  nodes: Node[];
  vehicles: Vehicle[];
  currentOrg: OrgType;
  activeMissions: Mission[];
  onMissionCreated: (mission: Mission) => void;
  onMissionCompleted: (mission: Mission) => void;
  onRouteCalculated: (path: string[]) => void;
  onClearRoute: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function MissionPanel({
  nodes,
  vehicles,
  currentOrg,
  activeMissions,
  onMissionCreated,
  onMissionCompleted,
  onRouteCalculated,
  onClearRoute,
  isLoading,
  setIsLoading,
}: MissionPanelProps) {
  // Form state
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');
  const [originNode, setOriginNode] = useState<string>('');
  const [destNode, setDestNode] = useState<string>('');
  
  // Route preview state
  const [routePreview, setRoutePreview] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filter vehicles by current organization
  const orgVehicles = vehicles.filter(v => v.orgType === currentOrg && v.status === 'active');

  // Points of interest for quick selection
  const poiNodes = nodes.filter(n => n.type === 'poi');

  // Clear route preview when inputs change significantly
  useEffect(() => {
    if (routePreview && (originNode !== routePreview.nodePath[0] || destNode !== routePreview.nodePath[routePreview.nodePath.length - 1])) {
      setRoutePreview(null);
      onClearRoute();
    }
  }, [originNode, destNode]);

  // Calculate route preview
  const handleCalculateRoute = useCallback(async () => {
    if (!selectedVehicle || !originNode || !destNode) {
      setError('Please select vehicle, origin, and destination');
      return;
    }

    if (originNode === destNode) {
      setError('Origin and destination must be different');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.calculateRoute({
        vehicleId: selectedVehicle,
        originNode,
        destNode,
      });

      if (response.success && response.data) {
        setRoutePreview(response.data);
        onRouteCalculated(response.data.path);
      } else {
        setError(response.error || 'Failed to calculate route');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate route');
    } finally {
      setIsLoading(false);
    }
  }, [selectedVehicle, originNode, destNode, setIsLoading, onRouteCalculated]);

  // Create and activate mission
  const handleCreateMission = useCallback(async () => {
    if (!routePreview || !selectedVehicle || !originNode || !destNode) {
      setError('Please calculate route first');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Create mission
      const createResponse = await api.createMission({
        vehicleId: selectedVehicle,
        originNode,
        destNode,
      });

      if (!createResponse.success || !createResponse.data) {
        setError(createResponse.error || 'Failed to create mission');
        return;
      }

      const mission = createResponse.data;

      // Activate mission with calculated path
      const activateResponse = await api.activateMission(mission.missionId, routePreview.path);

      if (activateResponse.success && activateResponse.data) {
        onMissionCreated(activateResponse.data);
        // Reset form
        setSelectedVehicle('');
        setOriginNode('');
        setDestNode('');
        setRoutePreview(null);
        onClearRoute();
      } else {
        setError(activateResponse.error || 'Failed to activate mission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setIsLoading(false);
    }
  }, [routePreview, selectedVehicle, originNode, destNode, setIsLoading, onMissionCreated, onClearRoute]);

  // Quick create: Calculate route and create mission in one step
  const handleQuickCreate = useCallback(async () => {
    if (!selectedVehicle || !originNode || !destNode) {
      setError('Please select vehicle, origin, and destination');
      return;
    }

    if (originNode === destNode) {
      setError('Origin and destination must be different');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.createAndActivateMission({
        vehicleId: selectedVehicle,
        originNode,
        destNode,
      });

      if (response.success && response.data) {
        onMissionCreated(response.data.mission);
        onRouteCalculated(response.data.route.path);
        // Reset form after short delay to show the route
        setTimeout(() => {
          setSelectedVehicle('');
          setOriginNode('');
          setDestNode('');
          setRoutePreview(null);
        }, 2000);
      } else {
        setError(response.error || 'Failed to create mission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create mission');
    } finally {
      setIsLoading(false);
    }
  }, [selectedVehicle, originNode, destNode, setIsLoading, onMissionCreated, onRouteCalculated]);

  // Complete a mission
  const handleCompleteMission = useCallback(async (missionId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await api.completeMission(missionId);
      
      if (response.success && response.data) {
        onMissionCompleted(response.data);
      } else {
        setError(response.error || 'Failed to complete mission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete mission');
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, onMissionCompleted]);

  // Abort a mission
  const handleAbortMission = useCallback(async (missionId: string) => {
    if (!confirm('Are you sure you want to abort this mission?')) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.abortMission(missionId, 'Manual abort by dispatcher');
      
      if (response.success && response.data) {
        onMissionCompleted(response.data);
      } else {
        setError(response.error || 'Failed to abort mission');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to abort mission');
    } finally {
      setIsLoading(false);
    }
  }, [setIsLoading, onMissionCompleted]);

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  // Get node label
  const getNodeLabel = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    return node?.label || nodeId;
  };

  return (
    <div className="mission-panel">
      <div className="panel-header">
        <h3>🎯 Mission Control</h3>
        <span className={`org-badge ${currentOrg}`}>
          {currentOrg === 'medical' ? '🏥' : '🚔'} {currentOrg}
        </span>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Create Mission Form */}
      <div className="create-mission-section">
        <h4>Create New Mission</h4>
        
        <div className="form-group">
          <label>Vehicle</label>
          <select 
            value={selectedVehicle} 
            onChange={(e) => setSelectedVehicle(e.target.value)}
            disabled={isLoading}
          >
            <option value="">Select vehicle...</option>
            {orgVehicles.map(v => (
              <option key={v.vehicleId} value={v.vehicleId}>
                {v.vehicleId} - {v.vehicleType} (P{v.priorityLevel})
              </option>
            ))}
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Origin</label>
            <select 
              value={originNode} 
              onChange={(e) => setOriginNode(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select origin...</option>
              <optgroup label="Points of Interest">
                {poiNodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Nodes">
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.id} {n.label ? `(${n.label})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div className="form-group">
            <label>Destination</label>
            <select 
              value={destNode} 
              onChange={(e) => setDestNode(e.target.value)}
              disabled={isLoading}
            >
              <option value="">Select destination...</option>
              <optgroup label="Points of Interest">
                {poiNodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.label || n.id}
                  </option>
                ))}
              </optgroup>
              <optgroup label="All Nodes">
                {nodes.map(n => (
                  <option key={n.id} value={n.id}>
                    {n.id} {n.label ? `(${n.label})` : ''}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="button-row">
          <button 
            className="btn btn-secondary"
            onClick={handleCalculateRoute}
            disabled={isLoading || !selectedVehicle || !originNode || !destNode}
          >
            📍 Preview Route
          </button>
          <button 
            className="btn btn-primary"
            onClick={handleQuickCreate}
            disabled={isLoading || !selectedVehicle || !originNode || !destNode}
          >
            🚀 Quick Launch
          </button>
        </div>
      </div>

      {/* Route Preview */}
      {routePreview && (
        <div className="route-preview">
          <h4>Route Preview</h4>
          
          <div className="route-stats">
            <div className="stat">
              <span className="stat-label">Path Length</span>
              <span className="stat-value">{routePreview.path.length} segments</span>
            </div>
            <div className="stat">
              <span className="stat-label">Est. Time</span>
              <span className="stat-value">{formatTime(routePreview.estimatedTime)}</span>
            </div>
          </div>

          <div className="route-path">
            <span className="path-label">Route:</span>
            <div className="path-nodes">
              {routePreview.nodePath.map((nodeId, idx) => (
                <span key={nodeId} className="path-node">
                  {idx > 0 && <span className="path-arrow">→</span>}
                  <span className={nodes.find(n => n.id === nodeId)?.type === 'poi' ? 'poi-node' : ''}>
                    {getNodeLabel(nodeId)}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {routePreview.analysis && (
            <div className="route-analysis">
              <div className={`analysis-item ${routePreview.analysis.freeSegments > 0 ? 'free' : ''}`}>
                <span className="dot free"></span>
                {routePreview.analysis.freeSegments} free
              </div>
              <div className={`analysis-item ${routePreview.analysis.reservedSegments > 0 ? 'reserved' : ''}`}>
                <span className="dot reserved"></span>
                {routePreview.analysis.reservedSegments} reserved
              </div>
              {routePreview.analysis.potentialConflicts.length > 0 && (
                <div className="analysis-item conflicts">
                  ⚠️ {routePreview.analysis.potentialConflicts.length} potential conflicts
                </div>
              )}
            </div>
          )}

          <button 
            className="btn btn-success btn-full"
            onClick={handleCreateMission}
            disabled={isLoading}
          >
            ✓ Confirm & Launch Mission
          </button>
        </div>
      )}

      {/* Active Missions */}
      <div className="active-missions-section">
        <h4>Active Missions ({activeMissions.filter(m => m.orgType === currentOrg).length})</h4>
        
        {activeMissions.filter(m => m.orgType === currentOrg).length === 0 ? (
          <div className="no-missions">
            <span>No active missions</span>
          </div>
        ) : (
          <div className="missions-list">
            {activeMissions
              .filter(m => m.orgType === currentOrg)
              .map(mission => (
                <div key={mission.missionId} className="mission-card">
                  <div className="mission-header">
                    <span className="mission-id">{mission.missionId}</span>
                    <span className={`mission-status ${mission.status}`}>
                      {mission.status}
                    </span>
                  </div>
                  
                  <div className="mission-info">
                    <div className="info-row">
                      <span className="info-label">Vehicle:</span>
                      <span className="info-value">{mission.vehicleId}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Route:</span>
                      <span className="info-value">
                        {getNodeLabel(mission.originNode)} → {getNodeLabel(mission.destNode)}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">Path:</span>
                      <span className="info-value path-count">
                        {mission.path?.length || 0} segments
                      </span>
                    </div>
                  </div>

                  <div className="mission-actions">
                    <button 
                      className="btn btn-sm btn-success"
                      onClick={() => handleCompleteMission(mission.missionId)}
                      disabled={isLoading}
                    >
                      ✓ Complete
                    </button>
                    <button 
                      className="btn btn-sm btn-danger"
                      onClick={() => handleAbortMission(mission.missionId)}
                      disabled={isLoading}
                    >
                      ✕ Abort
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default MissionPanel;


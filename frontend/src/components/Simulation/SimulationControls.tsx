// SimulationControls Component - Phase 5
// Controls for vehicle movement simulation

import React from 'react';
import type { SimulationStatus, VehiclePosition, OrgType } from '../../types';
import './SimulationControls.css';

interface SimulationControlsProps {
  status: SimulationStatus | null;
  vehiclePositions: VehiclePosition[];
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onSpeedChange: (speed: number) => void;
  onReload: () => void;
  isLoading: boolean;
  currentOrg: OrgType;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  status,
  vehiclePositions,
  onStart,
  onPause,
  onStop,
  onSpeedChange,
  onReload,
  isLoading,
  currentOrg,
}) => {
  const isRunning = status?.isRunning ?? false;
  const isPaused = status?.isPaused ?? false;
  const speed = status?.speedMultiplier ?? 1.0;

  // Filter positions for current org
  const orgPositions = vehiclePositions.filter(v => v.orgType === currentOrg);
  const movingCount = orgPositions.filter(v => v.status === 'moving').length;

  const getStatusLabel = () => {
    if (!isRunning) return 'Stopped';
    if (isPaused) return 'Paused';
    return 'Running';
  };

  const getStatusIcon = () => {
    if (!isRunning) return '⏹️';
    if (isPaused) return '⏸️';
    return '▶️';
  };

  const getStatusClass = () => {
    if (!isRunning) return 'status-stopped';
    if (isPaused) return 'status-paused';
    return 'status-running';
  };

  return (
    <div className="simulation-controls">
      <div className="controls-header">
        <h3>🚗 Vehicle Simulation</h3>
        <span className={`status-badge ${getStatusClass()}`}>
          {getStatusIcon()} {getStatusLabel()}
        </span>
      </div>

      <div className="controls-stats">
        <div className="stat-item">
          <span className="stat-label">Active Vehicles</span>
          <span className="stat-value">{movingCount}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total in Sim</span>
          <span className="stat-value">{status?.totalVehicles ?? 0}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Speed</span>
          <span className="stat-value">{speed.toFixed(1)}x</span>
        </div>
      </div>

      <div className="controls-buttons">
        {!isRunning ? (
          <button
            className="control-btn start-btn"
            onClick={onStart}
            disabled={isLoading}
          >
            ▶️ Start
          </button>
        ) : isPaused ? (
          <button
            className="control-btn resume-btn"
            onClick={onStart}
            disabled={isLoading}
          >
            ▶️ Resume
          </button>
        ) : (
          <button
            className="control-btn pause-btn"
            onClick={onPause}
            disabled={isLoading}
          >
            ⏸️ Pause
          </button>
        )}

        <button
          className="control-btn stop-btn"
          onClick={onStop}
          disabled={!isRunning || isLoading}
        >
          ⏹️ Stop
        </button>

        <button
          className="control-btn reload-btn"
          onClick={onReload}
          disabled={isLoading}
          title="Reload active missions into simulation"
        >
          🔄
        </button>
      </div>

      <div className="speed-controls">
        <span className="speed-label">Simulation Speed</span>
        <div className="speed-buttons">
          {[0.5, 1, 2, 3].map(s => (
            <button
              key={s}
              className={`speed-btn ${speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
              disabled={isLoading}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>

      {vehiclePositions.length > 0 && (
        <div className="vehicle-list">
          <h4>🚐 Vehicles in Simulation</h4>
          <div className="vehicles-scroll">
            {vehiclePositions.map(pos => (
              <div 
                key={pos.vehicleId} 
                className={`vehicle-item ${pos.orgType === currentOrg ? 'current-org' : 'other-org'} ${pos.status}`}
              >
                <div className="vehicle-header">
                  <span className={`vehicle-id org-${pos.orgType}`}>
                    {pos.vehicleId}
                  </span>
                  <span className={`vehicle-status status-${pos.status}`}>
                    {pos.status === 'moving' ? '🚗' : pos.status === 'paused' ? '⏸️' : pos.status === 'arrived' ? '🏁' : '⏹️'}
                  </span>
                </div>
                <div className="vehicle-progress-info">
                  <span className="segment-info">
                    {pos.currentSegment ? (
                      <>Segment {pos.currentSegment} ({pos.segmentIndex + 1}/{pos.totalSegments})</>
                    ) : (
                      'Waiting...'
                    )}
                  </span>
                  {pos.status === 'moving' && (
                    <div className="progress-bar-container">
                      <div 
                        className={`progress-bar org-${pos.orgType}`}
                        style={{ width: `${pos.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vehiclePositions.length === 0 && (
        <div className="no-vehicles">
          <span>No vehicles in simulation</span>
          <small>
            {isRunning 
              ? 'Create and activate a mission, or click 🔄 to reload' 
              : 'Start simulation after activating a mission'}
          </small>
        </div>
      )}
    </div>
  );
};

export default SimulationControls;


// Sidebar Component - Controls and Status

import React, { useState } from 'react';
import type { Segment, Vehicle } from '../../types';
import { 
  Activity, 
  Truck, 
  MapPin, 
  Lock, 
  Unlock, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import './Sidebar.css';

interface SidebarProps {
  selectedSegment: Segment | null;
  segments: Segment[];
  vehicles: Vehicle[];
  currentOrg: 'medical' | 'police';
  onReserveSegment: (segmentId: string, vehicleId: string) => void;
  onReleaseSegment: (segmentId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  selectedSegment,
  segments,
  vehicles,
  currentOrg,
  onReserveSegment,
  onReleaseSegment,
  onRefresh,
  isLoading,
}) => {
  const [selectedVehicle, setSelectedVehicle] = useState<string>('');

  // Calculate segment stats
  const segmentStats = {
    free: segments.filter(s => s.status === 'free').length,
    reserved: segments.filter(s => s.status === 'reserved').length,
    occupied: segments.filter(s => s.status === 'occupied').length,
    total: segments.length,
  };

  // Filter vehicles by current org
  const orgVehicles = vehicles.filter(v => v.orgType === currentOrg && v.status === 'active');

  // Check if current org can modify segment
  const canModifySegment = selectedSegment && (
    selectedSegment.status === 'free' ||
    selectedSegment.reservedBy?.orgType === currentOrg
  );

  const handleReserve = () => {
    if (selectedSegment && selectedVehicle) {
      onReserveSegment(selectedSegment.id, selectedVehicle);
    }
  };

  const handleRelease = () => {
    if (selectedSegment) {
      onReleaseSegment(selectedSegment.id);
    }
  };

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <h2>Control Panel</h2>
        <button 
          className="refresh-btn" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? 'spinning' : ''} size={18} />
        </button>
      </div>

      {/* Segment Statistics */}
      <div className="sidebar-section">
        <h3><Activity size={16} /> Segment Status</h3>
        <div className="stats-grid">
          <div className="stat-card free">
            <div className="stat-value">{segmentStats.free}</div>
            <div className="stat-label">Free</div>
          </div>
          <div className="stat-card reserved">
            <div className="stat-value">{segmentStats.reserved}</div>
            <div className="stat-label">Reserved</div>
          </div>
          <div className="stat-card occupied">
            <div className="stat-value">{segmentStats.occupied}</div>
            <div className="stat-label">Occupied</div>
          </div>
          <div className="stat-card total">
            <div className="stat-value">{segmentStats.total}</div>
            <div className="stat-label">Total</div>
          </div>
        </div>
        <div className="progress-bar">
          <div 
            className="progress free" 
            style={{ width: `${(segmentStats.free / segmentStats.total) * 100}%` }}
          />
          <div 
            className="progress reserved" 
            style={{ width: `${(segmentStats.reserved / segmentStats.total) * 100}%` }}
          />
          <div 
            className="progress occupied" 
            style={{ width: `${(segmentStats.occupied / segmentStats.total) * 100}%` }}
          />
        </div>
      </div>

      {/* Selected Segment */}
      <div className="sidebar-section">
        <h3><MapPin size={16} /> Selected Segment</h3>
        {selectedSegment ? (
          <div className="segment-details">
            <div className="segment-id">{selectedSegment.id}</div>
            <div className="segment-info">
              <span className="info-label">Route:</span>
              <span className="info-value">{selectedSegment.from} → {selectedSegment.to}</span>
            </div>
            <div className="segment-info">
              <span className="info-label">Status:</span>
              <span className={`status-badge ${selectedSegment.status}`}>
                {selectedSegment.status === 'free' && <CheckCircle size={12} />}
                {selectedSegment.status === 'reserved' && <Lock size={12} />}
                {selectedSegment.status === 'occupied' && <AlertTriangle size={12} />}
                {selectedSegment.status}
              </span>
            </div>
            {selectedSegment.reservedBy && (
              <>
                <div className="segment-info">
                  <span className="info-label">Reserved by:</span>
                  <span className="info-value">{selectedSegment.reservedBy.vehicleId}</span>
                </div>
                <div className="segment-info">
                  <span className="info-label">Organization:</span>
                  <span className={`org-badge ${selectedSegment.reservedBy.orgType}`}>
                    {selectedSegment.reservedBy.orgType}
                  </span>
                </div>
                <div className="segment-info">
                  <span className="info-label">Priority:</span>
                  <span className="info-value">Level {selectedSegment.reservedBy.priorityLevel}</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <MapPin size={24} />
            <span>Click a segment to view details</span>
          </div>
        )}
      </div>

      {/* Segment Actions */}
      {selectedSegment && (
        <div className="sidebar-section">
          <h3><Lock size={16} /> Actions</h3>
          
          {selectedSegment.status === 'free' && (
            <div className="action-form">
              <label htmlFor="vehicle-select">Select Vehicle:</label>
              <select 
                id="vehicle-select"
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="vehicle-select"
              >
                <option value="">-- Select Vehicle --</option>
                {orgVehicles.map(v => (
                  <option key={v.vehicleId} value={v.vehicleId}>
                    {v.vehicleId} ({v.vehicleType})
                  </option>
                ))}
              </select>
              <button 
                className="action-btn reserve"
                onClick={handleReserve}
                disabled={!selectedVehicle || isLoading}
              >
                <Lock size={16} />
                Reserve Segment
              </button>
            </div>
          )}

          {selectedSegment.status === 'reserved' && canModifySegment && (
            <button 
              className="action-btn release"
              onClick={handleRelease}
              disabled={isLoading}
            >
              <Unlock size={16} />
              Release Segment
            </button>
          )}

          {selectedSegment.status === 'reserved' && !canModifySegment && (
            <div className="warning-message">
              <AlertTriangle size={16} />
              <span>This segment is reserved by {selectedSegment.reservedBy?.orgType}</span>
            </div>
          )}

          {selectedSegment.status === 'occupied' && (
            <div className="warning-message">
              <XCircle size={16} />
              <span>This segment is currently occupied</span>
            </div>
          )}
        </div>
      )}

      {/* Vehicles */}
      <div className="sidebar-section">
        <h3><Truck size={16} /> Your Vehicles</h3>
        {orgVehicles.length > 0 ? (
          <div className="vehicle-list">
            {orgVehicles.map(vehicle => (
              <div key={vehicle.vehicleId} className={`vehicle-item ${vehicle.orgType}`}>
                <div className="vehicle-icon">
                  <Truck size={18} />
                </div>
                <div className="vehicle-details">
                  <div className="vehicle-name">{vehicle.vehicleId}</div>
                  <div className="vehicle-type">{vehicle.vehicleType}</div>
                </div>
                <div className={`vehicle-status ${vehicle.status}`}>
                  {vehicle.status}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <Truck size={24} />
            <span>No active vehicles</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="sidebar-section legend">
        <h3>Legend</h3>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-color free"></span>
            <span>Free</span>
          </div>
          <div className="legend-item">
            <span className="legend-color reserved-medical"></span>
            <span>Reserved (Medical)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color reserved-police"></span>
            <span>Reserved (Police)</span>
          </div>
          <div className="legend-item">
            <span className="legend-color occupied"></span>
            <span>Occupied</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;


import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import type { Vehicle, OrgType } from '../../types';
import './VehicleManagementPanel.css';

interface VehicleManagementPanelProps {
    currentOrg: OrgType;
    vehicles: Vehicle[];
    onVehicleUpdate: () => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

const VEHICLE_TYPES = {
    medical: ['ambulance', 'paramedic_unit', 'air_ambulance', 'mobile_clinic'],
    police: ['patrol_car', 'motorcycle', 'suv', 'tactical_vehicle', 'k9_unit']
};

const VEHICLE_STATUSES = ['active', 'inactive', 'on_mission'] as const;

export function VehicleManagementPanel({
    currentOrg,
    vehicles,
    onVehicleUpdate,
    isLoading,
    setIsLoading,
}: VehicleManagementPanelProps) {
    // Form state for new vehicle registration
    const [newVehicleId, setNewVehicleId] = useState('');
    const [newVehicleType, setNewVehicleType] = useState('');
    const [newPriorityLevel, setNewPriorityLevel] = useState(currentOrg === 'medical' ? 1 : 2);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Filter vehicles by current organization
    const orgVehicles = vehicles.filter(v => v.orgType === currentOrg);

    // Auto-clear messages after 5 seconds
    useEffect(() => {
        if (error || successMessage) {
            const timer = setTimeout(() => {
                setError(null);
                setSuccessMessage(null);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [error, successMessage]);

    // Handle vehicle registration
    const handleRegisterVehicle = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();

        if (!newVehicleId || !newVehicleType) {
            setError('Please fill in all fields');
            return;
        }

        setIsLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const response = await api.registerVehicle({
                vehicleId: newVehicleId.toUpperCase(),
                orgType: currentOrg,
                vehicleType: newVehicleType,
                priorityLevel: newPriorityLevel,
            });

            if (response.success) {
                setSuccessMessage(`✓ Vehicle ${newVehicleId} registered successfully!`);
                setNewVehicleId('');
                setNewVehicleType('');
                setNewPriorityLevel(currentOrg === 'medical' ? 1 : 2);
                onVehicleUpdate();
            } else {
                setError(response.error || 'Failed to register vehicle');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to register vehicle');
        } finally {
            setIsLoading(false);
        }
    }, [newVehicleId, newVehicleType, newPriorityLevel, currentOrg, setIsLoading, onVehicleUpdate]);

    // Handle status update
    const handleUpdateStatus = useCallback(async (vehicleId: string, newStatus: string) => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.updateVehicleStatus(vehicleId, newStatus);

            if (response.success) {
                setSuccessMessage(`✓ Vehicle ${vehicleId} status updated to ${newStatus}`);
                onVehicleUpdate();
            } else {
                setError(response.error || 'Failed to update vehicle status');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update vehicle status');
        } finally {
            setIsLoading(false);
        }
    }, [setIsLoading, onVehicleUpdate]);

    // Get status badge color
    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'active':
                return 'status-active';
            case 'on_mission':
                return 'status-mission';
            case 'inactive':
                return 'status-inactive';
            default:
                return 'status-unknown';
        }
    };

    return (
        <div className="vehicle-management-panel">
            <div className="panel-header">
                <h3>🚗 Vehicle Management</h3>
                <span className={`org-badge ${currentOrg}`}>
                    {currentOrg === 'medical' ? '🏥' : '🚔'} {currentOrg}
                </span>
            </div>

            {/* Error/Success Messages */}
            {error && (
                <div className="alert alert-error">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)}>×</button>
                </div>
            )}

            {successMessage && (
                <div className="alert alert-success">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage(null)}>×</button>
                </div>
            )}

            {/* Vehicle Registration Form */}
            <div className="registration-section">
                <h4>Register New Vehicle</h4>
                <form onSubmit={handleRegisterVehicle}>
                    <div className="form-group">
                        <label>Vehicle ID</label>
                        <input
                            type="text"
                            value={newVehicleId}
                            onChange={(e) => setNewVehicleId(e.target.value)}
                            placeholder={currentOrg === 'medical' ? 'AMB-XXX' : 'POL-XXX'}
                            disabled={isLoading}
                            className="vehicle-id-input"
                        />
                        <small className="form-hint">
                            Format: {currentOrg === 'medical' ? 'AMB-001, AMB-002, etc.' : 'POL-001, POL-002, etc.'}
                        </small>
                    </div>

                    <div className="form-group">
                        <label>Vehicle Type</label>
                        <select
                            value={newVehicleType}
                            onChange={(e) => setNewVehicleType(e.target.value)}
                            disabled={isLoading}
                        >
                            <option value="">Select type...</option>
                            {VEHICLE_TYPES[currentOrg].map(type => (
                                <option key={type} value={type}>
                                    {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Priority Level</label>
                        <select
                            value={newPriorityLevel}
                            onChange={(e) => setNewPriorityLevel(Number(e.target.value))}
                            disabled={isLoading}
                        >
                            {[1, 2, 3, 4, 5].map(level => (
                                <option key={level} value={level}>
                                    Priority {level} {level === 1 ? '(Highest)' : level === 5 ? '(Lowest)' : ''}
                                </option>
                            ))}
                        </select>
                        <small className="form-hint">
                            Lower number = Higher priority. Medical typically uses 1, Police uses 2.
                        </small>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary btn-full"
                        disabled={isLoading || !newVehicleId || !newVehicleType}
                    >
                        {isLoading ? '⏳ Registering...' : '✓ Register Vehicle'}
                    </button>
                </form>
            </div>

            {/* Active Fleet */}
            <div className="fleet-section">
                <h4>Active Fleet ({orgVehicles.length} vehicles)</h4>

                {orgVehicles.length === 0 ? (
                    <div className="no-vehicles">
                        <span>No vehicles registered yet</span>
                        <small>Register your first vehicle above</small>
                    </div>
                ) : (
                    <div className="vehicles-table">
                        <table>
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Type</th>
                                    <th>Priority</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {orgVehicles.map(vehicle => (
                                    <tr key={vehicle.vehicleId}>
                                        <td className="vehicle-id">
                                            <strong>{vehicle.vehicleId}</strong>
                                        </td>
                                        <td className="vehicle-type">
                                            {vehicle.vehicleType.replace(/_/g, ' ')}
                                        </td>
                                        <td className="vehicle-priority">
                                            <span className={`priority-badge priority-${vehicle.priorityLevel}`}>
                                                P{vehicle.priorityLevel}
                                            </span>
                                        </td>
                                        <td className="vehicle-status">
                                            <span className={`status-badge ${getStatusColor(vehicle.status)}`}>
                                                {vehicle.status.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td className="vehicle-actions">
                                            <select
                                                value={vehicle.status}
                                                onChange={(e) => handleUpdateStatus(vehicle.vehicleId, e.target.value)}
                                                disabled={isLoading}
                                                className="status-select"
                                            >
                                                {VEHICLE_STATUSES.map(status => (
                                                    <option key={status} value={status}>
                                                        {status.replace(/_/g, ' ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Blockchain Info */}
            <div className="blockchain-info">
                <small>
                    🔗 All vehicle operations are recorded on the Hyperledger Fabric blockchain
                </small>
            </div>
        </div>
    );
}

export default VehicleManagementPanel;

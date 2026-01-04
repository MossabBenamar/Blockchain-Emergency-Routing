// Route Planning Panel Component
// Allows users to calculate routes by selecting start and end points on the map

import { useState, useCallback } from 'react';
import api from '../../services/api';
import type { RouteResult } from '../../types';
import './RoutePlanningPanel.css';

interface RoutePlanningPanelProps {
  onRouteCalculated: (route: RouteResult) => void;
  onClearRoute: () => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  onStartPointSelect: (lat: number, lon: number) => void;
  onEndPointSelect: (lat: number, lon: number) => void;
  startPoint: [number, number] | null;
  endPoint: [number, number] | null;
}

export function RoutePlanningPanel({
  onRouteCalculated,
  onClearRoute,
  isLoading,
  setIsLoading,
  onStartPointSelect,
  onEndPointSelect,
  startPoint,
  endPoint,
}: RoutePlanningPanelProps) {
  const [error, setError] = useState<string | null>(null);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);

  // Calculate route from coordinates
  const handleCalculateRoute = useCallback(async () => {
    if (!startPoint || !endPoint) {
      setError('Please select both start and end points on the map');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.calculateRoute({
        originLat: startPoint[0],
        originLon: startPoint[1],
        destLat: endPoint[0],
        destLon: endPoint[1],
      });

      if (response.success && response.data) {
        setRouteResult(response.data);
        onRouteCalculated(response.data);
      } else {
        setError(response.error || 'Failed to calculate route');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to calculate route');
    } finally {
      setIsLoading(false);
    }
  }, [startPoint, endPoint, setIsLoading, onRouteCalculated]);

  const handleClear = useCallback(() => {
    setRouteResult(null);
    setError(null);
    onStartPointSelect(0, 0);
    onEndPointSelect(0, 0);
    onClearRoute();
  }, [onClearRoute, onStartPointSelect, onEndPointSelect]);

  return (
    <div className="route-planning-panel">
      <div className="panel-header">
        <h3>Route Planning</h3>
        <p className="panel-subtitle">Click on the map to set start and end points</p>
      </div>

      <div className="panel-content">
        {/* Start Point Selection */}
        <div className="point-selection">
          <label className="point-label">
            <span className="point-indicator start-indicator"></span>
            Start Point
          </label>
          {startPoint ? (
            <div className="point-coordinates">
              <span className="coordinate-value">
                {startPoint[0].toFixed(6)}, {startPoint[1].toFixed(6)}
              </span>
              <button
                className="btn-clear-point"
                onClick={() => onStartPointSelect(0, 0)}
                title="Clear start point"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="point-placeholder">
              Click on map to set start point
            </div>
          )}
        </div>

        {/* End Point Selection */}
        <div className="point-selection">
          <label className="point-label">
            <span className="point-indicator end-indicator"></span>
            End Point
          </label>
          {endPoint ? (
            <div className="point-coordinates">
              <span className="coordinate-value">
                {endPoint[0].toFixed(6)}, {endPoint[1].toFixed(6)}
              </span>
              <button
                className="btn-clear-point"
                onClick={() => onEndPointSelect(0, 0)}
                title="Clear end point"
              >
                ×
              </button>
            </div>
          ) : (
            <div className="point-placeholder">
              Click on map to set end point
            </div>
          )}
        </div>

        {/* Route Calculation Button */}
        <button
          className="btn-calculate-route"
          onClick={handleCalculateRoute}
          disabled={!startPoint || !endPoint || isLoading}
        >
          {isLoading ? 'Calculating...' : 'Calculate Route'}
        </button>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {/* Route Result Display */}
        {routeResult && (
          <div className="route-result">
            <div className="result-header">Route Information</div>
            <div className="result-details">
              <div className="result-item">
                <span className="result-label">Distance:</span>
                <span className="result-value">
                  {routeResult.distanceKm ? `${routeResult.distanceKm.toFixed(2)} km` :
                    routeResult.totalWeight ? `${routeResult.totalWeight.toFixed(2)} km` : 'N/A'}
                </span>
              </div>
              <div className="result-item">
                <span className="result-label">Duration:</span>
                <span className="result-value">
                  {routeResult.durationMinutes ? `${routeResult.durationMinutes} min` :
                    routeResult.estimatedTime ? `${Math.round(routeResult.estimatedTime / 60)} min` : 'N/A'}
                </span>
              </div>
            </div>
            <button
              className="btn-clear-route"
              onClick={handleClear}
            >
              Clear Route
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default RoutePlanningPanel;

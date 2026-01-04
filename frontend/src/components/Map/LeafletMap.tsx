// LeafletMap Component - Real Interactive Map with OSM Tiles

import React, { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Node, Segment, Vehicle, Mission, VehiclePosition } from '../../types';
import './LeafletMap.css';

// Fix for default marker icons in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import iconRetina from 'leaflet/dist/images/marker-icon-2x.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconRetinaUrl: iconRetina,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface LeafletMapProps {
  nodes: Node[];
  segments: Segment[];
  vehicles: Vehicle[];
  selectedSegment: string | null;
  onSegmentClick?: (segmentId: string) => void;
  onMapClick?: (lat: number, lon: number) => void; // New: handle map clicks for route planning
  currentOrg: 'medical' | 'police';
  highlightedRoute?: string[];  // Segment IDs to highlight as route preview
  activeMissions?: Mission[];   // Active missions to show routes for
  vehiclePositions?: VehiclePosition[]; // Real-time vehicle positions
  routeGeometry?: Array<[number, number]>; // Route geometry for display
  startPoint?: [number, number] | null; // Start point marker [lat, lon]
  endPoint?: [number, number] | null; // End point marker [lat, lon]
  center?: [number, number]; // Map center [lat, lon]
  zoom?: number; // Initial zoom level
  routePlanningMode?: boolean; // Enable route planning mode (click to set points)
}

// Component to handle map clicks
function MapClickHandler({ onMapClick }: { onMapClick?: (lat: number, lon: number) => void }) {
  useMapEvents({
    click: (e) => {
      if (onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

// Component to handle map bounds updates
function MapBoundsUpdater({
  nodes,
  vehiclePositions
}: {
  nodes: Node[];
  vehiclePositions?: VehiclePosition[]
}) {
  const map = useMap();

  useEffect(() => {
    const validNodes = nodes.filter(n => n.lat !== undefined && n.lon !== undefined);
    const validPositions = vehiclePositions?.filter(vp => vp.lat !== undefined && vp.lon !== undefined) || [];

    if (validNodes.length === 0 && validPositions.length === 0) {
      // Default to Manhattan if no coordinates
      map.setView([40.7128, -74.0060], 13);
      return;
    }

    const allPoints: [number, number][] = [
      ...validNodes.map(n => [n.lat!, n.lon!] as [number, number]),
      ...validPositions.map(vp => [vp.lat!, vp.lon!] as [number, number])
    ];

    if (allPoints.length > 0) {
      const bounds = L.latLngBounds(allPoints);
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [nodes, vehiclePositions, map]);

  return null;
}

export const LeafletMap: React.FC<LeafletMapProps> = ({
  nodes,
  segments,
  vehicles,
  selectedSegment,
  onSegmentClick,
  onMapClick,
  highlightedRoute = [],
  activeMissions = [],
  vehiclePositions = [],
  routeGeometry,
  startPoint,
  endPoint,
  center = [40.7128, -74.0060], // Default: Manhattan
  zoom = 13,
  routePlanningMode = false,
}) => {
  // Create node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Get POI nodes (hospitals, police stations, etc.)
  const poiNodes = useMemo(() => {
    return nodes.filter(node => node.type === 'poi' && node.lat !== undefined && node.lon !== undefined);
  }, [nodes]);

  // Get segments with valid coordinates - only show reserved/occupied segments
  const validSegments = useMemo(() => {
    return segments.filter(seg => {
      // Only show reserved or occupied segments
      if (seg.status !== 'reserved' && seg.status !== 'occupied') {
        return false;
      }
      const fromNode = nodeMap.get(seg.from);
      const toNode = nodeMap.get(seg.to);
      return fromNode?.lat !== undefined && fromNode?.lon !== undefined &&
        toNode?.lat !== undefined && toNode?.lon !== undefined;
    });
  }, [segments, nodeMap]);

  // Get segment color based on status - dark red for reserved/occupied segments
  const getSegmentColor = (segment: Segment): string => {
    if (selectedSegment === segment.id) {
      return '#00d4ff'; // Cyan for selected
    }

    if (highlightedRoute.includes(segment.id)) {
      return '#ffd43b'; // Gold for route preview
    }

    // Dark red for reserved/occupied segments
    if (segment.status === 'reserved' || segment.status === 'occupied') {
      return '#8b0000'; // Dark red
    }

    return '#8b0000'; // Default to dark red (shouldn't happen as we filter)
  };

  // Get segment weight (stroke width)
  const getSegmentWeight = (segment: Segment): number => {
    if (selectedSegment === segment.id) return 6;
    if (highlightedRoute.includes(segment.id)) return 5;
    return 5; // Thicker line for reserved/occupied segments
  };

  // Get segment opacity
  const getSegmentOpacity = (segment: Segment): number => {
    if (selectedSegment === segment.id) return 1.0;
    if (highlightedRoute.includes(segment.id)) return 0.9;
    return 0.9; // High opacity for reserved/occupied segments
  };

  // Create custom vehicle icon
  const createVehicleIcon = (orgType: 'medical' | 'police', isMoving: boolean) => {
    const color = orgType === 'medical' ? '#ff6b6b' : '#4dabf7';
    const size = isMoving ? 20 : 16;

    return L.divIcon({
      className: 'vehicle-marker',
      html: `
        <div style="
          width: ${size}px;
          height: ${size}px;
          background-color: ${color};
          border: 3px solid white;
          border-radius: 50%;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          animation: ${isMoving ? 'pulse 2s infinite' : 'none'};
        "></div>
      `,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  // Get active vehicles with positions
  const activeVehicles = useMemo(() => {
    return vehiclePositions
      .filter(vp => vp.lat !== undefined && vp.lon !== undefined &&
        (vp.status === 'moving' || vp.status === 'paused' || vp.status === 'idle'))
      .map(vp => {
        const vehicle = vehicles.find(v => v.vehicleId === vp.vehicleId);
        return {
          ...vp,
          vehicle,
        };
      });
  }, [vehiclePositions, vehicles]);

  // Get static vehicles (at home base)
  const staticVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const hasPosition = vehiclePositions.some(vp => vp.vehicleId === v.vehicleId);
      return v.status === 'active' && !hasPosition;
    });
  }, [vehicles, vehiclePositions]);

  // Use stored geometry from missions (calculated during activation with OSRM)
  const [missionGeometries, setMissionGeometries] = useState<Map<string, Array<[number, number]>>>(new Map());

  useEffect(() => {
    const geometries = new Map<string, Array<[number, number]>>();

    for (const mission of activeMissions) {
      if (mission.status !== 'active') continue;

      // Use stored geometry if available
      if (mission.geometry && mission.geometry.length > 0) {
        geometries.set(mission.missionId, mission.geometry);
      }
    }

    setMissionGeometries(geometries);
  }, [activeMissions]);

  return (
    <div className="leaflet-map-container">
      <MapContainer
        center={center}
        zoom={zoom}
        style={{ height: '100%', width: '100%' }}
        zoomControl={true}
        scrollWheelZoom={true}
      >
        {/* Map click handler for route planning */}
        {routePlanningMode && (
          <MapClickHandler onMapClick={onMapClick} />
        )}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater nodes={nodes} vehiclePositions={vehiclePositions} />

        {/* Map click handler for route planning */}
        {routePlanningMode && onMapClick && (
          <MapClickHandler onMapClick={onMapClick} />
        )}

        {/* Render route geometry if provided */}
        {routeGeometry && routeGeometry.length > 1 && (
          <Polyline
            positions={routeGeometry}
            pathOptions={{
              color: '#ffd43b',
              weight: 6,
              opacity: 0.9,
              dashArray: '10, 5',
            }}
          />
        )}

        {/* Start point marker */}
        {startPoint && (
          <Marker
            position={startPoint}
            icon={L.divIcon({
              className: 'route-marker start-marker',
              html: '<div style="width: 24px; height: 24px; background-color: #51cf66; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>Start Point</Popup>
          </Marker>
        )}

        {/* End point marker */}
        {endPoint && (
          <Marker
            position={endPoint}
            icon={L.divIcon({
              className: 'route-marker end-marker',
              html: '<div style="width: 24px; height: 24px; background-color: #ff6b6b; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
              iconSize: [24, 24],
              iconAnchor: [12, 12],
            })}
          >
            <Popup>End Point</Popup>
          </Marker>
        )}

        {/* Render active mission routes with OSRM geometry */}
        {activeMissions
          .filter(m => m.status === 'active' && missionGeometries.has(m.missionId))
          .map(mission => {
            const geometry = missionGeometries.get(mission.missionId);
            if (!geometry || geometry.length < 2) return null;

            const isMedical = mission.orgType === 'medical';
            const routeColor = isMedical ? '#e63946' : '#0077b6'; // Red for Medical, Blue for Police

            return (
              <React.Fragment key={`mission-${mission.missionId}`}>
                {/* Glow effect for mission route */}
                <Polyline
                  positions={geometry}
                  pathOptions={{
                    color: routeColor,
                    weight: 13,
                    opacity: 0.3,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
                {/* Main mission route line */}
                <Polyline
                  positions={geometry}
                  pathOptions={{
                    color: routeColor,
                    weight: 6,
                    opacity: 1.0,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </React.Fragment>
            );
          })}

        {/* Render segments */}
        {validSegments.map((segment) => {
          const fromNode = nodeMap.get(segment.from);
          const toNode = nodeMap.get(segment.to);

          if (!fromNode || !toNode ||
            fromNode.lat === undefined || fromNode.lon === undefined ||
            toNode.lat === undefined || toNode.lon === undefined) {
            return null;
          }

          // FIX: Don't render reserved segments if they belong to a mission we are already drawing
          // This prevents the "double red line" issue (one OSRM line, one segment line)
          const missionId = segment.reservedBy?.missionId;
          if (segment.status === 'reserved' && missionId && activeMissions.some(m => m.missionId === missionId)) {
            // Check if we are actually rendering this mission (have geometry)
            if (missionGeometries.has(missionId)) {
              return null;
            }
          }

          const positions: [number, number][] = [
            [fromNode.lat, fromNode.lon],
            [toNode.lat, toNode.lon]
          ];

          // Use geometry if available, otherwise use straight line
          const segmentPositions = segment.geometry && segment.geometry.length > 0
            ? segment.geometry
            : positions;

          const color = getSegmentColor(segment);
          const weight = getSegmentWeight(segment);
          const opacity = getSegmentOpacity(segment);

          return (
            <React.Fragment key={segment.id}>
              {/* Glow effect - render a larger, semi-transparent line behind */}
              <Polyline
                positions={segmentPositions}
                pathOptions={{
                  color: '#8b0000',
                  weight: weight + 8,
                  opacity: 0.3,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
              />
              {/* Main segment line */}
              <Polyline
                positions={segmentPositions}
                pathOptions={{
                  color,
                  weight,
                  opacity,
                  lineCap: 'round',
                  lineJoin: 'round',
                }}
                eventHandlers={{
                  click: () => {
                    if (onSegmentClick) {
                      onSegmentClick(segment.id);
                    }
                  },
                }}
              />
            </React.Fragment>
          );
        })}

        {/* Render POI markers */}
        {poiNodes.map((node) => {
          if (node.lat === undefined || node.lon === undefined) return null;

          const color = node.orgType === 'medical' ? '#ff6b6b' :
            node.orgType === 'police' ? '#4dabf7' : '#ffd43b';

          return (
            <CircleMarker
              key={node.id}
              center={[node.lat, node.lon]}
              radius={12}
              pathOptions={{
                fillColor: color,
                fillOpacity: 0.8,
                color: '#fff',
                weight: 3,
              }}
            >
              <Popup>
                <div className="poi-popup">
                  <strong>{node.label || node.id}</strong>
                  <br />
                  <span className="poi-type">{node.type}</span>
                  {node.orgType && (
                    <>
                      <br />
                      <span className="poi-org">{node.orgType}</span>
                    </>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* Render active vehicles with real-time positions */}
        {activeVehicles.map((vp) => {
          if (vp.lat === undefined || vp.lon === undefined) return null;

          const isMoving = vp.status === 'moving';
          const icon = createVehicleIcon(vp.orgType, isMoving);
          const vehicle = vp.vehicle;

          return (
            <Marker
              key={vp.vehicleId}
              position={[vp.lat, vp.lon]}
              icon={icon}
            >
              <Popup>
                <div className="vehicle-popup">
                  <strong>{vp.vehicleId}</strong>
                  <br />
                  <span>Status: {vp.status}</span>
                  {vehicle && (
                    <>
                      <br />
                      <span>Type: {vehicle.vehicleType}</span>
                      <br />
                      <span>Org: {vp.orgType}</span>
                    </>
                  )}
                  {vp.speed !== undefined && (
                    <>
                      <br />
                      <span>Speed: {vp.speed.toFixed(1)} km/h</span>
                    </>
                  )}
                  {vp.currentSegment && (
                    <>
                      <br />
                      <span>Segment: {vp.currentSegment}</span>
                      <br />
                      <span>Progress: {vp.progress.toFixed(0)}%</span>
                    </>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}

        {/* Render static vehicles at home bases */}
        {staticVehicles.map((vehicle) => {
          // Find home base node for this organization
          const homeBase = poiNodes.find(
            node => node.orgType === vehicle.orgType && node.type === 'poi'
          );

          if (!homeBase || homeBase.lat === undefined || homeBase.lon === undefined) {
            return null;
          }

          const icon = createVehicleIcon(vehicle.orgType, false);

          return (
            <Marker
              key={vehicle.vehicleId}
              position={[homeBase.lat, homeBase.lon]}
              icon={icon}
            >
              <Popup>
                <div className="vehicle-popup">
                  <strong>{vehicle.vehicleId}</strong>
                  <br />
                  <span>Status: {vehicle.status}</span>
                  <br />
                  <span>Type: {vehicle.vehicleType}</span>
                  <br />
                  <span>Org: {vehicle.orgType}</span>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LeafletMap;

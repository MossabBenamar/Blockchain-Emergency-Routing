// GridMap Component - 5x5 Grid Visualization

import { useMemo } from 'react';
import type { Node, Segment, Vehicle, Mission, VehiclePosition } from '../../types';
import './GridMap.css';

interface GridMapProps {
  nodes: Node[];
  segments: Segment[];
  vehicles: Vehicle[];
  selectedSegment: string | null;
  onSegmentClick: (segmentId: string) => void;
  currentOrg: 'medical' | 'police';
  highlightedRoute?: string[];  // Segment IDs to highlight as route preview
  activeMissions?: Mission[];   // Active missions to show routes for
  vehiclePositions?: VehiclePosition[]; // Real-time vehicle positions for simulation
}

const CELL_SIZE = 100;
const NODE_RADIUS = 14;
const SEGMENT_WIDTH = 8;
const PADDING = 60;

export const GridMap: React.FC<GridMapProps> = ({
  nodes,
  segments,
  vehicles,
  selectedSegment,
  onSegmentClick,
  highlightedRoute = [],
  activeMissions = [],
  vehiclePositions = [],
}) => {
  // Create node lookup map
  const nodeMap = useMemo(() => {
    const map = new Map<string, Node>();
    nodes.forEach((node) => map.set(node.id, node));
    return map;
  }, [nodes]);

  // Calculate SVG dimensions
  const gridSize = useMemo(() => {
    let maxX = 0, maxY = 0;
    nodes.forEach((node) => {
      maxX = Math.max(maxX, node.x || 0);
      maxY = Math.max(maxY, node.y || 0);
    });
    return { cols: maxX + 1, rows: maxY + 1 };
  }, [nodes]);

  const svgWidth = gridSize.cols * CELL_SIZE + PADDING * 2;
  const svgHeight = gridSize.rows * CELL_SIZE + PADDING * 2;

  // Get coordinates for a node
  const getNodeCoords = (nodeId: string) => {
    const node = nodeMap.get(nodeId);
    if (!node) return { x: 0, y: 0 };
    return {
      x: (node.x || 0) * CELL_SIZE + PADDING,
      y: (node.y || 0) * CELL_SIZE + PADDING,
    };
  };

  // Check if segment is part of highlighted route
  const isInHighlightedRoute = (segmentId: string) => highlightedRoute.includes(segmentId);

  // Check if segment is part of an active mission route
  const getActiveMissionForSegment = (segmentId: string): Mission | undefined => {
    return activeMissions.find(m => m.path?.includes(segmentId));
  };

  // Get segment color based on status - dark red for reserved/occupied segments
  const getSegmentColor = (segment: Segment) => {
    // Selected segment has highest priority
    if (selectedSegment === segment.id) {
      return '#00d4ff';
    }

    // Highlighted route preview (golden color for route planning)
    if (isInHighlightedRoute(segment.id)) {
      return '#ffd43b';
    }

    // Dark red for reserved/occupied segments
    return '#8b0000';
  };

  // Get segment stroke dash array for different states
  const getSegmentDashArray = (segment: Segment): string | undefined => {
    if (isInHighlightedRoute(segment.id)) {
      return '12 6'; // Dashed line for route preview
    }
    return undefined;
  };

  // Get node color based on type
  const getNodeColor = (node: Node) => {
    if (node.type === 'poi') {
      if (node.orgType === 'medical') return '#ff6b6b';
      if (node.orgType === 'police') return '#4dabf7';
      return '#ffd43b';
    }
    return '#868e96';
  };

  // Create segment lookup map for vehicle position calculation
  const segmentMap = useMemo(() => {
    const map = new Map<string, Segment>();
    segments.forEach(seg => map.set(seg.id, seg));
    return map;
  }, [segments]);

  // Calculate animated vehicle position along a segment
  const getVehiclePosition = (position: VehiclePosition) => {
    if (!position.currentSegment) return null;

    const segment = segmentMap.get(position.currentSegment);
    if (!segment) return null;

    const fromNode = nodeMap.get(segment.from);
    const toNode = nodeMap.get(segment.to);
    if (!fromNode || !toNode) return null;

    const fromCoords = getNodeCoords(segment.from);
    const toCoords = getNodeCoords(segment.to);

    // Interpolate position based on progress (0-100)
    const progress = position.progress / 100;
    const x = fromCoords.x + (toCoords.x - fromCoords.x) * progress;
    const y = fromCoords.y + (toCoords.y - fromCoords.y) * progress;

    return { x, y };
  };

  return (
    <div className="grid-map-container">
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="grid-map-svg"
      >
        {/* Background grid pattern */}
        <defs>
          <pattern
            id="grid-pattern"
            width={CELL_SIZE}
            height={CELL_SIZE}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${CELL_SIZE} 0 L 0 0 0 ${CELL_SIZE}`}
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="1"
            />
          </pattern>

          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid background */}
        <rect
          x={PADDING - 20}
          y={PADDING - 20}
          width={gridSize.cols * CELL_SIZE + 40}
          height={gridSize.rows * CELL_SIZE + 40}
          fill="url(#grid-pattern)"
          rx={8}
        />

        {/* Render segments - only reserved/occupied segments */}
        <g className="segments-layer">
          {segments.filter(seg => seg.status === 'reserved' || seg.status === 'occupied').map((segment) => {
            const fromCoords = getNodeCoords(segment.from);
            const toCoords = getNodeCoords(segment.to);
            const color = getSegmentColor(segment);
            const isSelected = selectedSegment === segment.id;
            const isHighlighted = isInHighlightedRoute(segment.id);
            const activeMission = getActiveMissionForSegment(segment.id);
            const width = isSelected ? SEGMENT_WIDTH + 4 : isHighlighted ? SEGMENT_WIDTH + 2 : SEGMENT_WIDTH;
            const dashArray = getSegmentDashArray(segment);

            return (
              <g
                key={segment.id}
                className={`segment-group ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''} ${activeMission ? 'active-route' : ''}`}
                onClick={() => onSegmentClick(segment.id)}
                style={{ cursor: 'pointer' }}
              >
                {/* Invisible wide hit area for easier clicking */}
                <line
                  x1={fromCoords.x}
                  y1={fromCoords.y}
                  x2={toCoords.x}
                  y2={toCoords.y}
                  stroke="transparent"
                  strokeWidth={30}
                  strokeLinecap="round"
                />

                {/* Glow effect for reserved/occupied segments - dark red glow */}
                <line
                  x1={fromCoords.x}
                  y1={fromCoords.y}
                  x2={toCoords.x}
                  y2={toCoords.y}
                  stroke="#8b0000"
                  strokeWidth={width + 10}
                  strokeLinecap="round"
                  opacity={isHighlighted ? 0.5 : 0.3}
                  className={`segment-glow ${isHighlighted ? 'route-glow' : ''}`}
                  filter="url(#glow)"
                />

                {/* Main segment line */}
                <line
                  x1={fromCoords.x}
                  y1={fromCoords.y}
                  x2={toCoords.x}
                  y2={toCoords.y}
                  stroke={color}
                  strokeWidth={width}
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                  className={`segment-line ${isHighlighted ? 'route-preview' : ''}`}
                />

                {/* Segment ID label */}
                <text
                  x={(fromCoords.x + toCoords.x) / 2}
                  y={(fromCoords.y + toCoords.y) / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="segment-label"
                  fill="#fff"
                  fontSize="10"
                  fontWeight="600"
                >
                  {segment.id}
                </text>

                {/* Route order indicator for highlighted routes */}
                {isHighlighted && (
                  <circle
                    cx={(fromCoords.x + toCoords.x) / 2}
                    cy={(fromCoords.y + toCoords.y) / 2 - 15}
                    r={10}
                    fill="#ffd43b"
                    stroke="#1a1a2e"
                    strokeWidth={2}
                    className="route-order-badge"
                  />
                )}
                {isHighlighted && (
                  <text
                    x={(fromCoords.x + toCoords.x) / 2}
                    y={(fromCoords.y + toCoords.y) / 2 - 15}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#1a1a2e"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {highlightedRoute.indexOf(segment.id) + 1}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Render nodes */}
        <g className="nodes-layer">
          {nodes.map((node) => {
            const coords = getNodeCoords(node.id);
            const color = getNodeColor(node);
            const isPOI = node.type === 'poi';

            return (
              <g key={node.id} className="node-group">
                {/* Node glow for POIs */}
                {isPOI && (
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={NODE_RADIUS + 8}
                    fill={color}
                    opacity={0.3}
                    className="node-glow"
                  />
                )}

                {/* Node circle */}
                <circle
                  cx={coords.x}
                  cy={coords.y}
                  r={isPOI ? NODE_RADIUS + 4 : NODE_RADIUS}
                  fill={color}
                  stroke="#1a1a2e"
                  strokeWidth={3}
                  className={`node ${isPOI ? 'poi' : 'intersection'}`}
                />

                {/* Node ID */}
                <text
                  x={coords.x}
                  y={coords.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={isPOI ? "11" : "10"}
                  fontWeight="600"
                >
                  {node.id.replace('N', '')}
                </text>

                {/* POI label */}
                {isPOI && node.label && (
                  <text
                    x={coords.x}
                    y={coords.y + NODE_RADIUS + 18}
                    textAnchor="middle"
                    fill="#e0e0e0"
                    fontSize="11"
                    fontWeight="500"
                    className="node-label"
                  >
                    {node.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>

        {/* Render static vehicle markers at home bases (non-simulating) */}
        <g className="vehicles-layer-static">
          {vehicles
            .filter(v => v.status === 'active' && !vehiclePositions.find(vp => vp.vehicleId === v.vehicleId))
            .map((vehicle, index) => {
              const homeNode = vehicle.orgType === 'medical' ? 'N1' : 'N25';
              const node = nodeMap.get(homeNode);
              if (!node) return null;

              const coords = getNodeCoords(homeNode);
              const offset = index * 25;
              const vehicleColor = vehicle.orgType === 'medical' ? '#ff6b6b' : '#4dabf7';

              return (
                <g key={vehicle.vehicleId} className="vehicle-marker static">
                  <rect
                    x={coords.x - 20 + offset}
                    y={coords.y - 50}
                    width={40}
                    height={18}
                    rx={4}
                    fill={vehicleColor}
                    stroke="#1a1a2e"
                    strokeWidth={2}
                    opacity={0.7}
                  />
                  <text
                    x={coords.x + offset}
                    y={coords.y - 41}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="#fff"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    {vehicle.vehicleId}
                  </text>
                </g>
              );
            })}
        </g>

        {/* Render animated vehicle markers (simulating vehicles) */}
        <g className="vehicles-layer-animated">
          {vehiclePositions
            .filter(vp => vp.status === 'moving' || vp.status === 'paused' || vp.status === 'idle')
            .map((position) => {
              const coords = getVehiclePosition(position);
              if (!coords) return null;

              const vehicleColor = position.orgType === 'medical' ? '#ff6b6b' : '#4dabf7';
              const isMoving = position.status === 'moving';

              return (
                <g key={position.vehicleId} className={`vehicle-marker animated ${isMoving ? 'moving' : 'paused'}`}>
                  {/* Animated trail effect */}
                  {isMoving && position.previousSegment && (
                    <circle
                      cx={coords.x}
                      cy={coords.y}
                      r={25}
                      fill={vehicleColor}
                      opacity={0.15}
                      className="vehicle-trail"
                    />
                  )}

                  {/* Vehicle glow */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={18}
                    fill={vehicleColor}
                    opacity={isMoving ? 0.4 : 0.2}
                    className="vehicle-glow"
                  />

                  {/* Vehicle body (circular for better animation) */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={14}
                    fill={vehicleColor}
                    stroke="#fff"
                    strokeWidth={2}
                    className="vehicle-body"
                  />

                  {/* Direction indicator */}
                  <circle
                    cx={coords.x}
                    cy={coords.y}
                    r={5}
                    fill="#fff"
                    opacity={0.9}
                  />

                  {/* Vehicle ID label */}
                  <g transform={`translate(${coords.x}, ${coords.y - 25})`}>
                    <rect
                      x={-25}
                      y={-9}
                      width={50}
                      height={18}
                      rx={4}
                      fill="rgba(0,0,0,0.8)"
                      stroke={vehicleColor}
                      strokeWidth={1}
                    />
                    <text
                      x={0}
                      y={1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#fff"
                      fontSize="8"
                      fontWeight="bold"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {position.vehicleId}
                    </text>
                  </g>

                  {/* Progress indicator */}
                  <g transform={`translate(${coords.x}, ${coords.y + 22})`}>
                    <rect
                      x={-18}
                      y={-6}
                      width={36}
                      height={12}
                      rx={3}
                      fill="rgba(0,0,0,0.7)"
                    />
                    <text
                      x={0}
                      y={1}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill="#adb5bd"
                      fontSize="7"
                      fontFamily="'JetBrains Mono', monospace"
                    >
                      {position.segmentIndex + 1}/{position.totalSegments}
                    </text>
                  </g>
                </g>
              );
            })}
        </g>
      </svg>
    </div>
  );
};

export default GridMap;

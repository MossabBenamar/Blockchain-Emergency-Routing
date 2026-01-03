// Socket.IO Service for Real-time Vehicle Tracking

import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import type { VehiclePosition } from '../../models/types';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server
 */
export function initSocketIO(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // In production, specify frontend URL
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  console.log('Socket.IO server initialized');

  io.on('connection', (socket: Socket) => {
    console.log(`Socket.IO client connected: ${socket.id}`);

    // Send welcome message
    socket.emit('connected', {
      message: 'Connected to Emergency Routing System',
      timestamp: Date.now(),
    });

    // Handle client disconnect
    socket.on('disconnect', () => {
      console.log(`Socket.IO client disconnected: ${socket.id}`);
    });

    // Handle ping
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: Date.now() });
    });

    // Handle subscription requests
    socket.on('subscribe', (data: { events: string[] }) => {
      console.log(`Client ${socket.id} subscribed to:`, data.events);
      data.events.forEach((event) => {
        socket.join(event);
      });
    });

    // Handle unsubscribe
    socket.on('unsubscribe', (data: { events: string[] }) => {
      console.log(`Client ${socket.id} unsubscribed from:`, data.events);
      data.events.forEach((event) => {
        socket.leave(event);
      });
    });
  });

  return io;
}

/**
 * Emit vehicle position update
 */
export function emitVehiclePosition(position: VehiclePosition): void {
  if (!io) {
    console.warn('Socket.IO server not initialized');
    return;
  }

  io.emit('vehicle:position', position);
  io.to('vehicles').emit('vehicle:position', position);
}

/**
 * Emit segment update
 */
export function emitSegmentUpdate(segment: any): void {
  if (!io) {
    console.warn('Socket.IO server not initialized');
    return;
  }

  io.emit('segment:updated', segment);
  io.to('segments').emit('segment:updated', segment);
}

/**
 * Emit mission update
 */
export function emitMissionUpdate(mission: any, eventType: string): void {
  if (!io) {
    console.warn('Socket.IO server not initialized');
    return;
  }

  io.emit(`mission:${eventType}`, mission);
  io.to('missions').emit(`mission:${eventType}`, mission);
}

/**
 * Emit simulation update
 */
export function emitSimulationUpdate(data: any, eventType: string): void {
  if (!io) {
    console.warn('Socket.IO server not initialized');
    return;
  }

  io.emit(`simulation:${eventType}`, data);
  io.to('simulation').emit(`simulation:${eventType}`, data);
}

/**
 * Get Socket.IO server instance
 */
export function getSocketIO(): SocketIOServer | null {
  return io;
}

/**
 * Close Socket.IO server
 */
export function closeSocketIO(): Promise<void> {
  return new Promise((resolve) => {
    if (io) {
      io.close(() => {
        console.log('Socket.IO server closed');
        io = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}

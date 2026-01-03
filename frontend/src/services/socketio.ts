// Socket.IO Service for Real-time Updates
// This service provides Socket.IO integration for real-time vehicle tracking

import { io, Socket } from 'socket.io-client';
import type { VehiclePosition } from '../types';

// Socket.IO URLs for each organization
const SOCKET_URLS = {
  medical: 'http://localhost:3001',
  police: 'http://localhost:3003',
};

class SocketIOService {
  private socket: Socket | null = null;
  private url: string;
  private currentOrg: 'medical' | 'police' = 'medical';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;

  constructor(url?: string) {
    this.url = url || SOCKET_URLS.medical;
  }

  setOrganization(org: 'medical' | 'police') {
    if (this.currentOrg !== org) {
      this.currentOrg = org;
      this.url = SOCKET_URLS[org];
      // Reconnect to the new organization's Socket.IO server
      if (this.socket) {
        this.disconnect();
        this.connect();
      }
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;

      try {
        this.socket = io(this.url, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: this.maxReconnectAttempts,
          reconnectionDelay: 1000,
          reconnectionDelayMax: 5000,
        });

        this.socket.on('connect', () => {
          console.log('Socket.IO connected');
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket.IO disconnected:', reason);
          this.isConnecting = false;
          if (reason === 'io server disconnect') {
            // Server disconnected, try to reconnect
            this.socket?.connect();
          }
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket.IO connection error:', error);
          this.isConnecting = false;
          this.reconnectAttempts++;
          if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            reject(error);
          }
        });

        this.socket.on('reconnect', (attemptNumber) => {
          console.log(`Socket.IO reconnected after ${attemptNumber} attempts`);
          this.reconnectAttempts = 0;
        });

        this.socket.on('reconnect_attempt', (attemptNumber) => {
          console.log(`Socket.IO reconnect attempt ${attemptNumber}`);
        });

        this.socket.on('reconnect_failed', () => {
          console.error('Socket.IO reconnection failed');
          reject(new Error('Failed to reconnect'));
        });
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  // Subscribe to vehicle position updates
  onVehiclePosition(callback: (position: VehiclePosition) => void): () => void {
    if (!this.socket) {
      console.warn('Socket.IO not connected');
      return () => {};
    }

    this.socket.on('vehicle:position', callback);

    // Return unsubscribe function
    return () => {
      this.socket?.off('vehicle:position', callback);
    };
  }

  // Subscribe to segment updates
  onSegmentUpdate(callback: (data: any) => void): () => void {
    if (!this.socket) {
      console.warn('Socket.IO not connected');
      return () => {};
    }

    this.socket.on('segment:updated', callback);

    return () => {
      this.socket?.off('segment:updated', callback);
    };
  }

  // Subscribe to mission updates
  onMissionUpdate(callback: (data: any) => void): () => void {
    if (!this.socket) {
      console.warn('Socket.IO not connected');
      return () => {};
    }

    this.socket.on('mission:created', callback);
    this.socket.on('mission:activated', callback);
    this.socket.on('mission:completed', callback);
    this.socket.on('mission:aborted', callback);

    return () => {
      this.socket?.off('mission:created', callback);
      this.socket?.off('mission:activated', callback);
      this.socket?.off('mission:completed', callback);
      this.socket?.off('mission:aborted', callback);
    };
  }

  // Subscribe to simulation updates
  onSimulationUpdate(callback: (data: any) => void): () => void {
    if (!this.socket) {
      console.warn('Socket.IO not connected');
      return () => {};
    }

    this.socket.on('simulation:started', callback);
    this.socket.on('simulation:paused', callback);
    this.socket.on('simulation:stopped', callback);
    this.socket.on('simulation:speed_changed', callback);

    return () => {
      this.socket?.off('simulation:started', callback);
      this.socket?.off('simulation:paused', callback);
      this.socket?.off('simulation:stopped', callback);
      this.socket?.off('simulation:speed_changed', callback);
    };
  }

  // Emit events
  emit(event: string, data: any) {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
    } else {
      console.warn('Socket.IO not connected, cannot emit event');
    }
  }

  // Subscribe to any event
  on(event: string, callback: (data: any) => void): () => void {
    if (!this.socket) {
      console.warn('Socket.IO not connected');
      return () => {};
    }

    this.socket.on(event, callback);

    return () => {
      this.socket?.off(event, callback);
    };
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  get isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketIOService = new SocketIOService();
export default socketIOService;

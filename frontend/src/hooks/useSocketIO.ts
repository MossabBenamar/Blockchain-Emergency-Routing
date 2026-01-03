// Custom hook for Socket.IO connectivity

import { useEffect, useState, useCallback } from 'react';
import socketIOService from '../services/socketio';
import type { VehiclePosition } from '../types';

export function useSocketIO() {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await socketIOService.connect();
        setIsConnected(true);
        setError(null);
      } catch (e) {
        setError('Failed to connect to Socket.IO server');
        setIsConnected(false);
      }
    };

    connect();

    // Listen for connection events
    const unsubscribeConnect = socketIOService.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    const unsubscribeDisconnect = socketIOService.on('disconnect', () => {
      setIsConnected(false);
    });

    return () => {
      unsubscribeConnect();
      unsubscribeDisconnect();
      socketIOService.disconnect();
    };
  }, []);

  return { isConnected, error };
}

export function useVehiclePositions() {
  const [positions, setPositions] = useState<VehiclePosition[]>([]);

  useEffect(() => {
    const unsubscribe = socketIOService.onVehiclePosition((position: VehiclePosition) => {
      setPositions(prev => {
        const existing = prev.findIndex(p => p.vehicleId === position.vehicleId);
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = position;
          return updated;
        }
        return [...prev, position];
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return positions;
}

export function useSocketIOEvent(
  event: string,
  callback: (data: any) => void
) {
  useEffect(() => {
    const unsubscribe = socketIOService.on(event, callback);

    return () => {
      unsubscribe();
    };
  }, [event, callback]);
}

export default useSocketIO;

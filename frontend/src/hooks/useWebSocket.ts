// Custom hook for WebSocket connectivity

import { useEffect, useState, useCallback, useRef } from 'react';
import wsService from '../services/websocket';
import type { WebSocketMessage } from '../types';

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const connect = async () => {
      try {
        await wsService.connect();
        setIsConnected(true);
        setError(null);
      } catch (e) {
        setError('Failed to connect to WebSocket');
        setIsConnected(false);
      }
    };

    connect();

    // Subscribe to all messages
    const unsubscribe = wsService.subscribe('*', (message) => {
      setLastMessage(message);
      
      if (message.type === 'CONNECTED') {
        setIsConnected(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const send = useCallback((type: string, payload: any) => {
    wsService.send(type, payload);
  }, []);

  return { isConnected, lastMessage, error, send };
}

export function useWebSocketEvent(
  eventType: string,
  callback: (message: WebSocketMessage) => void
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const unsubscribe = wsService.subscribe(eventType, (message) => {
      callbackRef.current(message);
    });

    return () => {
      unsubscribe();
    };
  }, [eventType]);
}

export default useWebSocket;


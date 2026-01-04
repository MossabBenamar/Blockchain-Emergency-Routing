// WebSocket Service for Real-time Updates

import type { WebSocketMessage } from '../types';

type MessageHandler = (message: WebSocketMessage) => void;

// WebSocket URLs for each organization
const WS_URLS = {
  medical: 'ws://localhost:3002',  // Medical backend WebSocket port
  police: 'ws://localhost:3004',   // Police backend WebSocket port
};

class WebSocketService {
  private ws: WebSocket | null = null;
  private url: string;
  private currentOrg: 'medical' | 'police' = 'medical';
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;
  private isConnecting = false;

  constructor(url: string = 'ws://localhost:3002') {
    this.url = url;
  }

  setOrganization(org: 'medical' | 'police') {
    console.log(`[WebSocket] Switching from ${this.currentOrg} to ${org}`);
    if (this.currentOrg !== org) {
      this.currentOrg = org;
      this.url = WS_URLS[org];
      console.log(`[WebSocket] New URL: ${this.url}`);
      // Reconnect to the new organization's WebSocket
      if (this.ws) {
        console.log('[WebSocket] Disconnecting from old org...');
        this.disconnect(false); // Don't clear handlers when switching orgs!
        console.log('[WebSocket] Connecting to new org...');
        this.connect().catch(err => console.error('[WebSocket] Connection failed:', err));
      }
    }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log(`[WebSocket] Connected to ${this.url} (${this.currentOrg} org)`);
          this.reconnectAttempts = 0;
          this.isConnecting = false;
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          this.attemptReconnect();
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, this.reconnectDelay * this.reconnectAttempts);
  }

  private handleMessage(message: WebSocketMessage) {
    // Notify all handlers for this message type
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => handler(message));
    }

    // Also notify wildcard handlers
    const wildcardHandlers = this.handlers.get('*');
    if (wildcardHandlers) {
      wildcardHandlers.forEach((handler) => handler(message));
    }
  }

  subscribe(type: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  send(type: string, payload: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }

  ping() {
    this.send('PING', {});
  }

  disconnect(clearHandlers: boolean = true) {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    // Only clear handlers on full disconnect, not when switching orgs
    if (clearHandlers) {
      this.handlers.clear();
    }
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

export const wsService = new WebSocketService();
export default wsService;


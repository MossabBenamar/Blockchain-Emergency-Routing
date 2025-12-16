import { WebSocketServer, WebSocket } from 'ws';
import { WsMessage } from '../../models/types';

let wss: WebSocketServer | null = null;
const clients: Set<WebSocket> = new Set();

/**
 * Initialize the WebSocket server
 */
export function initWebSocket(port: number): WebSocketServer {
  wss = new WebSocketServer({ port });
  
  console.log(`WebSocket server started on port ${port}`);
  
  wss.on('connection', (ws: WebSocket) => {
    console.log('New WebSocket client connected');
    clients.add(ws);
    
    // Send welcome message
    const welcomeMessage: WsMessage = {
      type: 'CONNECTED',
      payload: { 
        message: 'Connected to Emergency Routing System',
        timestamp: Date.now(),
      },
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(welcomeMessage));
    
    // Handle incoming messages
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        handleClientMessage(ws, message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    // Handle client disconnect
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });
  
  return wss;
}

/**
 * Handle incoming messages from clients
 */
function handleClientMessage(ws: WebSocket, message: { type: string; payload?: unknown }) {
  switch (message.type) {
    case 'PING':
      // Respond to ping
      ws.send(JSON.stringify({
        type: 'PONG',
        payload: { timestamp: Date.now() },
        timestamp: Date.now(),
      }));
      break;
      
    case 'SUBSCRIBE':
      // Client wants to subscribe to specific events
      console.log('Client subscribed to:', message.payload);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

/**
 * Broadcast a message to all connected clients
 */
export function broadcastMessage(message: WsMessage): void {
  if (!wss) {
    console.warn('WebSocket server not initialized');
    return;
  }
  
  const messageStr = JSON.stringify(message);
  
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(messageStr);
    }
  });
  
  console.log(`Broadcasted ${message.type} to ${clients.size} clients`);
}

/**
 * Send a message to a specific client
 */
export function sendToClient(ws: WebSocket, message: WsMessage): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

/**
 * Get the number of connected clients
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Close the WebSocket server
 */
export function closeWebSocket(): Promise<void> {
  return new Promise((resolve) => {
    if (wss) {
      // Close all client connections
      clients.forEach((client) => {
        client.close();
      });
      clients.clear();
      
      // Close the server
      wss.close(() => {
        console.log('WebSocket server closed');
        wss = null;
        resolve();
      });
    } else {
      resolve();
    }
  });
}


import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { config } from './config';
import { connectGateway, disconnectGateway, isConnected } from './services/fabric/gateway';
import { initWebSocket, closeWebSocket, getClientCount } from './services/realtime/websocket';
import { initSocketIO, closeSocketIO } from './services/realtime/socketio';
import { initPostgres, initSchema, closePostgres } from './services/database/postgres';
import { errorHandler, notFoundHandler } from './api/middleware/errorHandler';

// Import routes
import vehicleRoutes from './api/routes/vehicles';
import segmentRoutes from './api/routes/segments';
import mapRoutes from './api/routes/map';
import missionRoutes from './api/routes/missions';
import simulationRoutes from './api/routes/simulation';
import historyRoutes from './api/routes/history';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      blockchain: isConnected() ? 'connected' : 'disconnected',
      websocketClients: getClientCount(),
      timestamp: new Date().toISOString(),
    },
  });
});

// API Info endpoint
app.get('/api', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Emergency Vehicle Routing API',
      version: '1.0.0',
      endpoints: {
        vehicles: '/api/vehicles',
        segments: '/api/segments',
        map: '/api/map',
        health: '/health',
      },
      organization: config.orgType,
      channel: config.channelName,
    },
  });
});

// API Routes
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/segments', segmentRoutes);
app.use('/api/map', mapRoutes);
app.use('/api/missions', missionRoutes);
app.use('/api/simulation', simulationRoutes);
app.use('/api/history', historyRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down gracefully...');
  
  try {
    await closeSocketIO();
    await closeWebSocket();
    await closePostgres();
    await disconnectGateway();
    console.log('Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
async function start() {
  try {
    console.log('Starting Emergency Vehicle Routing API...');
    console.log(`Environment: ${config.nodeEnv}`);
    console.log(`Organization: ${config.orgType}`);
    
    // Initialize PostgreSQL + PostGIS (optional)
    if (process.env.DB_HOST) {
      try {
        console.log('Initializing PostgreSQL + PostGIS...');
        initPostgres();
        await initSchema();
        console.log('PostgreSQL + PostGIS initialized');
      } catch (error) {
        console.warn('PostgreSQL initialization failed, continuing without database:', error);
      }
    } else {
      console.log('PostgreSQL not configured (DB_HOST not set), skipping database initialization');
    }

    // Connect to Fabric Gateway
    console.log('Connecting to Hyperledger Fabric...');
    await connectGateway(config.orgType as 'medical' | 'police');
    console.log('Connected to Fabric Gateway');
    
    // Start WebSocket server
    initWebSocket(config.wsPort);
    
    // Initialize Socket.IO
    initSocketIO(httpServer);
    
    // Start HTTP server
    httpServer.listen(config.port, () => {
      console.log(`\n========================================`);
      console.log(`  Emergency Vehicle Routing API`);
      console.log(`========================================`);
      console.log(`  HTTP Server:     http://localhost:${config.port}`);
      console.log(`  WebSocket:       ws://localhost:${config.wsPort}`);
      console.log(`  Socket.IO:       http://localhost:${config.port}`);
      console.log(`  Organization:    ${config.orgType}`);
      console.log(`  Channel:         ${config.channelName}`);
      console.log(`  Chaincode:       ${config.chaincodeName}`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();


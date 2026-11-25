import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { config } from './config.js';
import { connectDB } from './db.js';
import { registerLocationHandlers } from './sockets/locationHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: false // Disabled for Leaflet tile images and local dev
}));

app.use(cors({
  origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));

app.use(express.json());

// Basic API Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Group Ride Tracker API is running',
    timestamp: new Date().toISOString()
  });
});

// Production: serve built frontend from client/dist
if (config.nodeEnv === 'production') {
  const clientDistPath = path.join(__dirname, '../client/dist');
  app.use(express.static(clientDistPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Socket.IO configuration
const io = new SocketIOServer(server, {
  cors: {
    origin: [config.clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173', '*'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Register socket handlers
registerLocationHandlers(io);

// Start server listening, then initiate DB connection
server.listen(config.port, () => {
  console.log(`[Server] Group Ride Tracker running on http://localhost:${config.port}`);
  console.log(`[Server] Environment: ${config.nodeEnv}`);
});

connectDB();

export { app, server, io };

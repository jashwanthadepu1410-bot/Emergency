import http from 'node:http';
import express from 'express';
import cors from 'cors';
import { CONFIG } from './config.js';
import { getDb } from './db/database.js';
import { initSocket } from './socket.js';
import { startJunctionWatcher } from './services/junctionWatcher.js';

import authRoutes from './routes/authRoutes.js';
import ambulanceRoutes from './routes/ambulanceRoutes.js';
import hospitalRoutes from './routes/hospitalRoutes.js';
import junctionRoutes from './routes/junctionRoutes.js';
import emergencyRoutes from './routes/emergencyRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  // console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    system: 'Emergency X Core Server',
    tagline: 'Because Every Second Matters',
    version: CONFIG.VERSION,
    timestamp: new Date().toISOString()
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/ambulances', ambulanceRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/junctions', junctionRoutes);
app.use('/api/emergencies', emergencyRoutes);
app.use('/api/admin', adminRoutes);

// Centralized 404 handler
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start database, watcher, and server
try {
  getDb(); // Initialize SQLite DB & seed demo data
  startJunctionWatcher(); // Start background watcher for junction timeouts

  server.listen(CONFIG.PORT, () => {
    console.log(`=======================================================`);
    console.log(`  EMERGENCY X — "Because Every Second Matters"`);
    console.log(`  Backend Server is running on http://localhost:${CONFIG.PORT}`);
    console.log(`  WebSocket Server active on ws://localhost:${CONFIG.PORT}`);
    console.log(`=======================================================`);
  });
} catch (err) {
  console.error('Fatal startup error:', err);
  process.exit(1);
}

export { app, server };

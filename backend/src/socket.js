import { Server } from 'socket.io';

let ioInstance = null;

export function initSocket(httpServer) {
  ioInstance = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE'],
      credentials: true
    }
  });

  ioInstance.on('connection', (socket) => {
    // console.log(`[Socket] Client connected: ${socket.id}`);

    // Join room for specific role
    socket.on('join_role', ({ role, subId }) => {
      if (role) {
        socket.join(`role:${role}`);
        if (subId) {
          socket.join(`role:${role}:${subId}`);
        }
        // console.log(`[Socket] ${socket.id} joined role:${role} ${subId ? `subId:${subId}` : ''}`);
      }
    });

    // Join specific emergency room
    socket.on('join_emergency', (emergencyId) => {
      if (emergencyId) {
        socket.join(`emergency:${emergencyId}`);
        // console.log(`[Socket] ${socket.id} joined emergency:${emergencyId}`);
      }
    });

    // Leave emergency room
    socket.on('leave_emergency', (emergencyId) => {
      if (emergencyId) {
        socket.leave(`emergency:${emergencyId}`);
      }
    });

    socket.on('disconnect', () => {
      // console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

export function getIO() {
  return ioInstance;
}

export function broadcastToEmergency(emergencyId, event, data) {
  if (ioInstance && emergencyId) {
    ioInstance.to(`emergency:${emergencyId}`).emit(event, data);
    // Also mirror to admin room for full visibility
    ioInstance.to('role:admin').emit(event, data);
  }
}

export function broadcastToRole(role, event, data) {
  if (ioInstance && role) {
    ioInstance.to(`role:${role}`).emit(event, data);
    ioInstance.to('role:admin').emit(event, data);
  }
}

export function broadcastAll(event, data) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}

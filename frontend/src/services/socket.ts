import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true
    });

    socket.on('connect', () => {
      // console.log('[Socket] Connected to Emergency X real-time grid:', socket?.id);
    });

    socket.on('disconnect', (reason) => {
      // console.log('[Socket] Disconnected:', reason);
    });
  }
  return socket;
}

export function joinEmergencyRoom(emergencyId: string) {
  const s = getSocket();
  if (emergencyId) {
    s.emit('join_emergency', emergencyId);
  }
}

export function leaveEmergencyRoom(emergencyId: string) {
  const s = getSocket();
  if (emergencyId) {
    s.emit('leave_emergency', emergencyId);
  }
}

export function joinRoleRoom(role: string, subId?: string) {
  const s = getSocket();
  if (role) {
    s.emit('join_role', { role, subId });
  }
}

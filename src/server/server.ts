import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';
import { FireWeaponPayload, PlayerInputPayload } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const roomManager = new RoomManager(io);

// Helper to get LAN IPv4
function getLocalIpAddress(): string {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const netList = interfaces[name];
    if (!netList) continue;
    for (const net of netList) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return 'localhost';
}

const localIp = getLocalIpAddress();

// Provide network info endpoint for QR code generator
app.get('/api/network-info', (_req, res) => {
  res.json({
    ip: localIp,
    port: PORT,
    devPort: 5173
  });
});

// Serve client build if available
const clientDistPath = path.resolve(__dirname, '../../dist/client');
app.use(express.static(clientDistPath));

// Fallback to index.html for SPA routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      // In dev mode before build, serve a lightweight redirect/status
      res.send(`
        <!DOCTYPE html>
        <html>
          <head><title>Rivals BBS Server</title></head>
          <body style="font-family: sans-serif; background: #111; color: #fff; text-align: center; padding: 50px;">
            <h1>⚡ Rivals BBS Backend Server Running</h1>
            <p>API & Socket.IO active on port ${PORT}</p>
            <p>For development with Vite, open <a href="http://${localIp}:5173" style="color: #00d2ff;">http://${localIp}:5173</a></p>
          </body>
        </html>
      `);
    }
  });
});

// Socket.IO handling
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('create_room', (data, callback) => {
    try {
      const { playerName, mode, fragLimit, mapName } = data || {};
      const { roomId, session } = roomManager.createRoom(
        socket,
        playerName,
        mode,
        fragLimit,
        mapName
      );
      console.log(`[RoomManager] Room created: ${roomId} by ${playerName || 'Anonymous'}`);
      if (callback) {
        callback({
          success: true,
          roomId,
          roomState: session.roomState,
          playerId: socket.id
        });
      }
      session.broadcastRoomState();
    } catch (err: any) {
      console.error('[Socket] create_room error:', err);
      if (callback) callback({ success: false, error: err?.message || 'Failed to create room' });
    }
  });

  socket.on('join_room', (data, callback) => {
    try {
      const { roomId, playerName } = data || {};
      if (!roomId) {
        if (callback) callback({ success: false, error: 'Room ID required' });
        return;
      }

      const result = roomManager.joinRoom(socket, roomId, playerName);
      if (result.success && result.session) {
        console.log(`[RoomManager] Player ${playerName || socket.id} joined room ${roomId}`);
        if (callback) {
          callback({
            success: true,
            roomId: result.session.roomId,
            roomState: result.session.roomState,
            playerId: socket.id
          });
        }
      } else {
        if (callback) callback({ success: false, error: result.error });
      }
    } catch (err: any) {
      console.error('[Socket] join_room error:', err);
      if (callback) callback({ success: false, error: err?.message || 'Failed to join room' });
    }
  });

  socket.on('start_countdown', () => {
    const session = roomManager.getSessionBySocketId(socket.id);
    if (session && session.roomState.hostId === socket.id) {
      session.startCountdown();
    }
  });

  socket.on('player_input', (input: PlayerInputPayload) => {
    const session = roomManager.getSessionBySocketId(socket.id);
    if (session) {
      session.handlePlayerInput(socket.id, input);
    }
  });

  socket.on('switch_weapon', (data: { weaponIndex: number }) => {
    const session = roomManager.getSessionBySocketId(socket.id);
    if (session) {
      session.handleWeaponSwitch(socket.id, data.weaponIndex);
    }
  });

  socket.on('fire_weapon', (payload: FireWeaponPayload) => {
    const session = roomManager.getSessionBySocketId(socket.id);
    if (session) {
      session.handleFireWeapon(socket.id, payload);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==============================================`);
  console.log(`🎮 Rivals BBS Server running on:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Network: http://${localIp}:${PORT}`);
  console.log(`==============================================\n`);
});

process.on('SIGINT', () => {
  server.close(() => {
    console.log('Server terminated cleanly.');
    process.exit(0);
  });
});

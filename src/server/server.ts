import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { RoomManager } from './RoomManager.js';
import { UserManager } from './auth/UserManager.js';
import { ActivatePowerupPayload, FireWeaponPayload, PlayerInputPayload } from '../shared/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = parseInt(process.env.PORT || '3000', 10);
const roomManager = new RoomManager(io);
const userManager = new UserManager();

// Helper to extract bearer token
function getAuthToken(req: express.Request): string | null {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const parts = auth.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1];
  }
  return null;
}

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

// Auth Endpoints
app.post('/api/auth/register', (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !password) {
    res.status(400).json({ error: 'BBS Email (@bbs.ac.th) and password are required.' });
    return;
  }
  const result = userManager.register(String(email), String(username || ''), String(password));
  if (!result.success) {
    res.status(400).json({ error: result.error });
    return;
  }
  res.json(result);
});

app.post('/api/auth/login', (req, res) => {
  const { email, username, identifier, password } = req.body || {};
  const id = identifier || email || username;
  if (!id || !password) {
    res.status(400).json({ error: 'Email/username and password are required.' });
    return;
  }
  const result = userManager.login(String(id), String(password));
  if (!result.success) {
    res.status(401).json({ error: result.error });
    return;
  }
  res.json(result);
});

app.get('/api/auth/me', (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized. No token provided.' });
    return;
  }
  const user = userManager.getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session token.' });
    return;
  }
  res.json({ user });
});

app.post('/api/stats/grammar', (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const user = userManager.getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token.' });
    return;
  }

  const { questionsAnswered = 2, correctCount = 2, ammoAwarded = 60, currentStreak = 0 } = req.body || {};
  const updated = userManager.recordGrammarStat(
    user.id,
    Number(questionsAnswered),
    Number(correctCount),
    Number(ammoAwarded),
    Number(currentStreak)
  );
  res.json({ success: true, user: updated });
});

app.post('/api/stats/match', (req, res) => {
  const token = getAuthToken(req);
  if (!token) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }
  const user = userManager.getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid token.' });
    return;
  }

  const { won = false, kills = 0, deaths = 0, mode = '1v1', mapName = 'Cartoon City', score = 0 } = req.body || {};
  const updated = userManager.recordDetailedMatchResult(
    user.id,
    Boolean(won),
    Number(kills),
    Number(deaths),
    String(mode),
    String(mapName),
    Number(score)
  );
  res.json({ success: true, user: updated });
});

// Provide public open rooms list for lobby browser
app.get('/api/rooms', (_req, res) => {
  res.json({ rooms: roomManager.getOpenRoomsList() });
});

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
          <head><title>Airsoft BBS Server</title></head>
          <body style="font-family: sans-serif; background: #111; color: #fff; text-align: center; padding: 50px;">
            <h1>🎯 Airsoft BBS Backend Server Running</h1>
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

  // Send current open public rooms to newly connected client
  socket.emit('open_rooms_update', roomManager.getOpenRoomsList());

  socket.on('request_rooms', () => {
    socket.emit('open_rooms_update', roomManager.getOpenRoomsList());
  });

  socket.on('create_room', (data, callback) => {
    try {
      const { playerName, mode, fragLimit, mapName, outfitIndex, customization } = data || {};
      const { roomId, session } = roomManager.createRoom(
        socket,
        playerName,
        mode,
        fragLimit,
        mapName,
        outfitIndex,
        customization
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
      const { roomId, playerName, outfitIndex, customization } = data || {};
      if (!roomId) {
        if (callback) callback({ success: false, error: 'Room ID required' });
        return;
      }

      const result = roomManager.joinRoom(socket, roomId, playerName, outfitIndex, customization);
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

  socket.on('activate_powerup', (payload: ActivatePowerupPayload) => {
    const session = roomManager.getSessionBySocketId(socket.id);
    if (session) {
      session.handleActivatePowerup(socket.id, payload);
    }
  });

  socket.on('leave_room', () => {
    roomManager.leaveRoom(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
    roomManager.handleDisconnect(socket);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==============================================`);
  console.log(`🎯 Airsoft BBS Server running on:`);
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

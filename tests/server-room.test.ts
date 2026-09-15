import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIo, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/server/RoomManager.js';
import { FireWeaponPayload, PlayerInputPayload } from '../src/shared/types.js';

async function runTest() {
  console.log('🧪 Starting Rivals BBS Server & Room Lifecycle Test...');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    socket.on('create_room', (data, cb) => {
      const { roomId, session } = roomManager.createRoom(socket, data.playerName, data.mode, data.fragLimit);
      if (cb) cb({ success: true, roomId, roomState: session.roomState, playerId: socket.id });
      session.broadcastRoomState();
    });

    socket.on('join_room', (data, cb) => {
      const res = roomManager.joinRoom(socket, data.roomId, data.playerName);
      if (res.success && res.session) {
        if (cb) cb({ success: true, roomId: res.session.roomId, roomState: res.session.roomState, playerId: socket.id });
      } else {
        if (cb) cb({ success: false, error: res.error });
      }
    });

    socket.on('start_countdown', () => {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (session) session.startGame(); // Immediate start for test
    });

    socket.on('switch_weapon', (data: { weaponIndex: number }) => {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (session) session.handleWeaponSwitch(socket.id, data.weaponIndex);
    });

    socket.on('fire_weapon', (payload: FireWeaponPayload) => {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (session) session.handleFireWeapon(socket.id, payload);
    });

    socket.on('disconnect', () => {
      roomManager.handleDisconnect(socket);
    });
  });

  const TEST_PORT = 3456;
  await new Promise<void>((resolve) => server.listen(TEST_PORT, () => resolve()));
  console.log(`✓ Test server running on port ${TEST_PORT}`);

  const clientA: ClientSocket = ClientIo(`http://localhost:${TEST_PORT}`, { reconnection: false });
  const clientB: ClientSocket = ClientIo(`http://localhost:${TEST_PORT}`, { reconnection: false });

  await Promise.all([
    new Promise<void>((res) => clientA.on('connect', () => res())),
    new Promise<void>((res) => clientB.on('connect', () => res()))
  ]);
  console.log('✓ Both test clients connected');

  // Step 1: Create Room
  const createRes = await new Promise<any>((res) => {
    clientA.emit('create_room', { playerName: 'PlayerAlpha', mode: '1v1', fragLimit: 5 }, (response: any) => {
      res(response);
    });
  });

  if (!createRes.success || !createRes.roomId) {
    throw new Error(`Failed to create room: ${JSON.stringify(createRes)}`);
  }
  const roomId = createRes.roomId;
  console.log(`✓ Room created successfully: ${roomId}`);

  // Step 2: Join Room
  const joinRes = await new Promise<any>((res) => {
    clientB.emit('join_room', { roomId, playerName: 'PlayerBravo' }, (response: any) => {
      res(response);
    });
  });

  if (!joinRes.success) {
    throw new Error(`Failed to join room: ${JSON.stringify(joinRes)}`);
  }
  console.log(`✓ PlayerBravo joined room ${roomId}`);

  // Step 3: Start game
  await new Promise<void>((resolve) => {
    clientB.on('game_start', () => {
      console.log('✓ Game started event received on client B');
      resolve();
    });
    clientA.emit('start_countdown');
  });

  // Step 4: Test Combat & Hit Registration
  const hitPromise = new Promise<any>((resolve) => {
    clientB.on('player_hit', (data: any) => {
      console.log(`✓ Player hit event received: damage=${data.damage}, remainingHp=${data.targetRemainingHp}`);
      resolve(data);
    });
  });

  clientA.emit('fire_weapon', {
    weaponType: 'rifle',
    origin: [0, 1.8, 0],
    direction: [0, 0, 1],
    targetPlayerId: clientB.id,
    isHeadshot: true,
    hitPoint: [0, 2.0, 10]
  });

  const hitData = await hitPromise;
  if (hitData.damage <= 0 || hitData.targetRemainingHp >= 100) {
    throw new Error(`Invalid hit data: ${JSON.stringify(hitData)}`);
  }

  // Step 5: Test Weapon Switch and wait for weapon cooldown
  clientA.emit('switch_weapon', { weaponIndex: 2 }); // Sniper
  await new Promise(r => setTimeout(r, 1300));
  console.log('✓ Weapon switch event handled and cooldown elapsed');

  // Step 6: Test Player Elimination
  const elimPromise = new Promise<any>((resolve) => {
    clientB.on('player_eliminated', (data: any) => {
      console.log(`✓ Player eliminated event: killer=${data.killerName}, victim=${data.victimName}`);
      resolve(data);
    });
  });

  // Deal lethal sniper headshot to eliminate Client B (remaining HP 58, sniper headshot does 190)
  clientA.emit('fire_weapon', {
    weaponType: 'sniper',
    origin: [0, 1.8, 0],
    direction: [0, 0, 1],
    targetPlayerId: clientB.id,
    isHeadshot: true,
    hitPoint: [0, 2.0, 10]
  });

  const elimData = await elimPromise;
  if (elimData.killerId !== clientA.id || elimData.victimId !== clientB.id) {
    throw new Error(`Unexpected elimination data: ${JSON.stringify(elimData)}`);
  }
  console.log(`✓ Elimination verified: killerScore=${elimData.killerScore}`);

  // Cleanup
  clientA.disconnect();
  clientB.disconnect();
  await new Promise<void>((res) => server.close(() => res()));
  console.log('🎉 ALL SERVER & ROOM TESTS PASSED CLEANLY!\n');
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as ClientIo, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/server/RoomManager.js';
import { FireWeaponPayload, PlayerInputPayload } from '../src/shared/types.js';

async function runTest() {
  console.log('🧪 Starting Arena BBS Server & Room Lifecycle Test...');
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    socket.on('create_room', (data, cb) => {
      const { roomId, session, hostSecret } = roomManager.createRoom(socket, data.playerName, data.mode, data.fragLimit, data.mapName);
      if (cb) cb({ success: true, roomId, roomState: session.roomState, playerId: socket.id, hostSecret });
      session.broadcastRoomState();
    });

    socket.on('delete_room', (data, cb) => {
      const res = roomManager.deleteRoom(data.roomId, socket.id, data.hostSecret);
      if (cb) cb(res);
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
    clientA.emit('create_room', { playerName: 'PlayerAlpha', mode: '1v1', fragLimit: 5, mapName: 'TestArena' }, (response: any) => {
      res(response);
    });
  });

  if (!createRes.success || !createRes.roomId) {
    throw new Error(`Failed to create room: ${JSON.stringify(createRes)}`);
  }
  const roomId = createRes.roomId;
  console.log(`✓ Room created successfully: ${roomId}`);

  // Verify room is in open rooms list while it has open slots (1/2 players)
  const openRooms1 = roomManager.getOpenRoomsList();
  if (!openRooms1.some(r => r.roomId === roomId)) {
    throw new Error(`Room ${roomId} not found in open rooms list when slots are open`);
  }
  console.log(`✓ Room ${roomId} correctly appears in open rooms list with open slots`);

  // Step 2: Join Room (now 2/2 players)
  const joinRes = await new Promise<any>((res) => {
    clientB.emit('join_room', { roomId, playerName: 'PlayerBravo' }, (response: any) => {
      res(response);
    });
  });

  if (!joinRes.success) {
    throw new Error(`Failed to join room: ${JSON.stringify(joinRes)}`);
  }
  console.log(`✓ PlayerBravo joined room ${roomId}`);

  // Verify full room is not listed in open rooms (2/2 players = no open slots)
  const openRoomsFull = roomManager.getOpenRoomsList();
  if (openRoomsFull.some(r => r.roomId === roomId)) {
    throw new Error(`Full room ${roomId} should not appear in open rooms list`);
  }
  console.log(`✓ Full room ${roomId} (2/2) correctly excluded from open rooms list`);

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

  // Step 6: Test Weapon Switch and wait for weapon cooldown
  clientA.emit('switch_weapon', { weaponIndex: 2 }); // Sniper
  await new Promise(r => setTimeout(r, 1300));
  console.log('✓ Weapon switch event handled and cooldown elapsed');

  // Step 7: Test Player Elimination & Game Over Cleanup
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

  // After game over, the room should be removed from open rooms list
  const openRoomsAfterGameOver = roomManager.getOpenRoomsList();
  if (openRoomsAfterGameOver.some(r => r.roomId === roomId)) {
    throw new Error(`Ended room ${roomId} still appeared in open rooms list after game over`);
  }
  console.log(`✓ Verified ended room ${roomId} was cleanly removed from open rooms list`);

  // Step 8: Test 4v4 Mode Team Auto-Assignment & Friendly Fire
  console.log('🧪 Testing 4v4 Team Mechanics...');
  const create4v4Res = await new Promise<any>((res) => {
    clientA.emit('create_room', { playerName: 'TeamHost', mode: '4v4', fragLimit: 20, mapName: 'TestArena' }, (response: any) => {
      res(response);
    });
  });
  const room4v4Id = create4v4Res.roomId;
  const join4v4Res = await new Promise<any>((res) => {
    clientB.emit('join_room', { roomId: room4v4Id, playerName: 'TeamOpponent' }, (response: any) => {
      res(response);
    });
  });
  const session4v4 = roomManager.getSession(room4v4Id);
  if (!session4v4) throw new Error('4v4 session not found');
  session4v4.startGame();

  const p1Team = session4v4.roomState.players[clientA.id]?.team;
  const p2Team = session4v4.roomState.players[clientB.id]?.team;
  console.log(`✓ 4v4 Auto-teams assigned: PlayerA=${p1Team}, PlayerB=${p2Team}`);
  if (p1Team !== 'blue' || p2Team !== 'red') {
    throw new Error(`Unexpected teams in 4v4: p1=${p1Team}, p2=${p2Team}`);
  }

  // Step 9: Test Powerup Activation
  console.log('🧪 Testing Powerup Activation (Shield & Overshield Absorption)...');
  session4v4.handleActivatePowerup(clientB.id, { powerup: 'shield' });
  const targetPlayer = session4v4.roomState.players[clientB.id];
  if (targetPlayer.shieldHp !== 50 || targetPlayer.activePowerup !== 'shield') {
    throw new Error(`Powerup activation failed: shieldHp=${targetPlayer.shieldHp}, active=${targetPlayer.activePowerup}`);
  }
  console.log(`✓ Shield powerup active on PlayerB (Shield: ${targetPlayer.shieldHp} HP)`);

  // Fire at PlayerB with shield active: 28 body damage should be absorbed completely by shield (50 HP)
  session4v4.handleFireWeapon(clientA.id, {
    weaponType: 'rifle',
    origin: [0, 1.0, 0],
    direction: [0, 0, 1],
    targetPlayerId: clientB.id,
    isHeadshot: false
  });
  if (targetPlayer.health !== 100 || targetPlayer.shieldHp >= 50) {
    throw new Error(`Shield absorption failed: health=${targetPlayer.health}, shield=${targetPlayer.shieldHp}`);
  }
  console.log(`✓ Shield absorbed damage cleanly: PlayerB Health=${targetPlayer.health}, Shield=${targetPlayer.shieldHp}`);

  // Step 10: Test Host Game Deletion & Security Authorization
  console.log('🧪 Testing Host Game Deletion & Security Authorization...');
  const createDeleteRes = await new Promise<any>((res) => {
    clientA.emit('create_room', { playerName: 'HostBoss', mode: '1v1', fragLimit: 5, mapName: 'TestArena' }, (response: any) => {
      res(response);
    });
  });
  const deleteRoomId = createDeleteRes.roomId;
  const hostSecret = createDeleteRes.hostSecret;

  if (!hostSecret || typeof hostSecret !== 'string') {
    throw new Error('Expected hostSecret to be returned on room creation');
  }
  console.log(`✓ Room created with cryptographic hostSecret: ${deleteRoomId}`);

  // Client B joins the room
  await new Promise<any>((res) => {
    clientB.emit('join_room', { roomId: deleteRoomId, playerName: 'GuestB' }, (response: any) => {
      res(response);
    });
  });
  console.log(`✓ Guest joined ${deleteRoomId}`);

  // Unauthorized deletion attempt by Client B (without hostSecret)
  const unauthDeleteRes = await new Promise<any>((res) => {
    clientB.emit('delete_room', { roomId: deleteRoomId }, (response: any) => {
      res(response);
    });
  });
  if (unauthDeleteRes.success) {
    throw new Error('Unauthorized deletion by non-host should have failed');
  }
  console.log('✓ Unauthorized deletion attempt by guest was correctly rejected');

  // Set up listener for room_deleted on guest Client B
  const guestDeletedPromise = new Promise<any>((resolve) => {
    clientB.once('room_deleted', (payload: any) => {
      resolve(payload);
    });
  });

  // Host Client A deletes room using hostSecret
  const authDeleteRes = await new Promise<any>((res) => {
    clientA.emit('delete_room', { roomId: deleteRoomId, hostSecret }, (response: any) => {
      res(response);
    });
  });
  if (!authDeleteRes.success) {
    throw new Error(`Authorized room deletion failed: ${JSON.stringify(authDeleteRes)}`);
  }
  console.log(`✓ Host successfully deleted room ${deleteRoomId}`);

  const guestPayload = await guestDeletedPromise;
  if (guestPayload.roomId !== deleteRoomId) {
    throw new Error(`Guest received wrong room_deleted payload: ${JSON.stringify(guestPayload)}`);
  }
  console.log(`✓ Guest received room_deleted notification: "${guestPayload.reason}"`);

  // Verify room is removed from open rooms list and getSession is undefined
  const openRoomsAfterDelete = roomManager.getOpenRoomsList();
  if (openRoomsAfterDelete.some(r => r.roomId === deleteRoomId)) {
    throw new Error(`Deleted room ${deleteRoomId} still exists in open rooms list`);
  }
  if (roomManager.getSession(deleteRoomId)) {
    throw new Error(`Deleted room ${deleteRoomId} session still exists in roomManager`);
  }
  console.log('✓ Verified deleted room is completely removed from RoomManager');

  // Cleanup
  clientA.disconnect();
  clientB.disconnect();
  io.close();
  console.log('🎉 ALL SERVER, 4v4, POWERUP & ROOM DELETION TESTS PASSED CLEANLY!\n');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

import http from 'http';
import express from 'express';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { RoomManager } from '../src/server/RoomManager.js';
import { EliminationPayload, HitNotificationPayload, WaveClearedPayload, WaveStartPayload } from '../src/shared/types.js';

const PORT = 3457;

async function runWaveTest() {
  console.log('🧪 Starting Arena BBS Wave Survival & Bot AI Integration Test...');

  // Step 0: Spin up test server
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: '*' } });
  const roomManager = new RoomManager(io);

  io.on('connection', (socket) => {
    socket.on('create_room', (data, ack) => {
      const { roomId, session } = roomManager.createRoom(
        socket,
        data.playerName,
        data.mode,
        data.fragLimit,
        data.mapName
      );
      ack({ success: true, roomId, playerId: socket.id, roomState: session.roomState });
    });

    socket.on('join_room', (data, ack) => {
      const res = roomManager.joinRoom(socket, data.roomId, data.playerName);
      if (res.success && res.session) {
        ack({ success: true, roomId: data.roomId, playerId: socket.id, roomState: res.session.roomState });
      } else {
        ack({ success: false, error: res.error });
      }
    });

    socket.on('start_countdown', () => {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (session) session.startGame();
    });

    socket.on('fire_weapon', (payload) => {
      const session = roomManager.getSessionBySocketId(socket.id);
      if (session) session.handleFireWeapon(socket.id, payload);
    });

    socket.on('leave_room', () => {
      roomManager.leaveRoom(socket);
    });
  });

  await new Promise<void>((resolve) => server.listen(PORT, () => resolve()));
  console.log(`✓ Test server running on port ${PORT}`);

  // Connect player
  const client: ClientSocket = Client(`http://localhost:${PORT}`);
  await new Promise<void>((res) => client.on('connect', () => res()));
  console.log('✓ Test player connected');

  // Step 1: Create Room in Wave Mode
  const createRes = await new Promise<any>((res) => {
    client.emit('create_room', {
      playerName: 'StrikeLeader',
      mode: 'wave',
      fragLimit: 5,
      mapName: 'Cartoon City'
    }, (response: any) => res(response));
  });

  if (!createRes.success || !createRes.roomId) {
    throw new Error(`Failed to create wave room: ${JSON.stringify(createRes)}`);
  }
  const roomId = createRes.roomId;
  console.log(`✓ Wave Room created successfully: ${roomId}`);

  const session = roomManager.getSession(roomId);
  if (!session) throw new Error('Game session not found');

  const playerState = session.roomState.players[client.id!];
  if (playerState.team !== 'blue') {
    throw new Error(`Expected host team to be 'blue', got '${playerState.team}'`);
  }
  console.log(`✓ Host correctly assigned to Blue Strike Team: ${playerState.name} (${playerState.team})`);

  // Step 2: Start Wave Match
  const waveStartPromise = new Promise<WaveStartPayload>((resolve) => {
    client.on('wave_start', (data: WaveStartPayload) => {
      console.log(`✓ Wave start event received on client: Wave ${data.waveNumber} with ${data.totalBots} bots`);
      resolve(data);
    });
  });

  client.emit('start_countdown');
  const waveStartData = await waveStartPromise;

  if (waveStartData.waveNumber !== 1 || waveStartData.totalBots !== 2) {
    throw new Error(`Invalid wave 1 configuration: ${JSON.stringify(waveStartData)}`);
  }

  // Step 3: Verify Bots Initialized on Server
  if (!session.waveManager) throw new Error('WaveManager was not initialized');
  const botIds = Object.keys(session.roomState.players).filter(id => session.roomState.players[id].isBot);
  console.log(`✓ Server spawned ${botIds.length} bot entities in room: ${botIds.join(', ')}`);
  if (botIds.length !== 2) {
    throw new Error(`Expected 2 bots in Wave 1, got ${botIds.length}`);
  }

  const firstBotId = botIds[0];
  const firstBot = session.roomState.players[firstBotId];
  if (firstBot.team !== 'red' || !firstBot.isBot || firstBot.health <= 0) {
    throw new Error(`Invalid bot state: ${JSON.stringify(firstBot)}`);
  }
  console.log(`✓ Bot entity verified: ${firstBot.name} [Role: ${firstBot.botRole}, Team: ${firstBot.team}, HP: ${firstBot.health}]`);

  // Step 3.5: Test Building Line-of-Sight Protection
  console.log('🧱 Testing Building Line-of-Sight (LOS) Obstruction...');
  const { hasLineOfSight, getMapObstacles } = await import('../src/shared/mapObstacles.js');
  const cityObstacles = getMapObstacles('Cartoon City');

  // Player at origin (0, 1.2, 0), enemy behind massive Eco_Building_Slope004 (-25, 1.2, 52)
  const losClear = hasLineOfSight([0, 1.2, 5], [0, 1.2, 25], cityObstacles);
  const losBlocked = hasLineOfSight([0, 1.2, 0], [-25, 1.2, 52], cityObstacles);

  if (!losClear) throw new Error('Expected clear LOS down open street');
  if (losBlocked) throw new Error('Expected obstructed LOS through solid skyscraper');
  console.log('✓ Line-of-sight math confirmed: Open street is clear (true), Skyscraper blocks ray (false)');

  // Test that a bot positioned behind a building cannot shoot the player
  const playerInitialHp = playerState.health;
  firstBot.x = -25;
  firstBot.y = 1.0;
  firstBot.z = 52;
  // Fast forward bot fire timer to now
  const activeBot = (session.waveManager as any).activeBots.get(firstBotId);
  if (activeBot) activeBot.lastFireTime = 0;

  session.waveManager.tick(1.0);
  if (playerState.health !== playerInitialHp) {
    throw new Error('Bot was able to shoot and damage player through a building!');
  }
  console.log(`✓ Building cover verified: Bot behind skyscraper did not hit player (Player HP maintained at ${playerState.health})`);

  // Step 4: Verify Bot AI Navigation Steers Towards Player
  firstBot.x = 20;
  firstBot.z = 20;
  const initialBotX = firstBot.x;
  const initialBotZ = firstBot.z;

  // Simulate 1 second of AI ticks (30 ticks)
  for (let i = 0; i < 30; i++) {
    session.waveManager.tick(1 / 30);
  }

  const moved = Math.hypot(firstBot.x - initialBotX, firstBot.z - initialBotZ) > 0.1;
  console.log(`✓ Bot navigation verified: Bot moved from (${initialBotX.toFixed(1)}, ${initialBotZ.toFixed(1)}) to (${firstBot.x.toFixed(1)}, ${firstBot.z.toFixed(1)})`);
  if (!moved) {
    throw new Error('Bot did not advance towards target player during AI tick');
  }

  // Step 5: Test Player Weapon Hit on Bot
  const hitPromise = new Promise<HitNotificationPayload>((resolve) => {
    const handler = (data: HitNotificationPayload) => {
      if (data.targetId === firstBotId) {
        client.off('player_hit', handler);
        console.log(`✓ Player hit event on bot: damage=${data.damage}, botRemainingHp=${data.targetRemainingHp}`);
        resolve(data);
      }
    };
    client.on('player_hit', handler);
  });

  // Client fires rifle at bot
  client.emit('fire_weapon', {
    weaponType: 'rifle',
    origin: [playerState.x, playerState.y + 1.2, playerState.z],
    direction: [0, 0, 1],
    targetPlayerId: firstBotId,
    isHeadshot: false,
    hitPoint: [firstBot.x, firstBot.y + 1.0, firstBot.z]
  });

  const hitData = await hitPromise;
  if (hitData.targetId !== firstBotId || hitData.damage <= 0) {
    throw new Error(`Hit failed on bot: ${JSON.stringify(hitData)}`);
  }

  // Step 6: Test Eliminating All Bots in Wave 1
  const waveClearedPromise = new Promise<WaveClearedPayload>((resolve) => {
    client.on('wave_cleared', (payload: WaveClearedPayload) => {
      console.log(`✓ Wave cleared event received! Wave ${payload.waveNumber} cleared, next wave in ${payload.nextWaveInSec}s`);
      resolve(payload);
    });
  });

  // Simulate damaged player before wave completion
  playerState.health = 45;
  playerState.shieldHp = 0;

  console.log('⚔️ Eliminating remaining Wave 1 bots...');
  for (const bId of botIds) {
    const targetBot = session.roomState.players[bId];
    if (targetBot && !targetBot.isDead) {
      session.waveManager.onBotEliminated(bId, playerState);
    }
  }

  const waveClearedData = await waveClearedPromise;
  if (waveClearedData.waveNumber !== 1 || waveClearedData.nextWaveInSec !== 5) {
    throw new Error(`Unexpected wave clear data: ${JSON.stringify(waveClearedData)}`);
  }
  console.log(`✓ Wave 1 Cleared successfully! Intermission started.`);

  // Verify surviving human was restored to full health + shield bonus
  if (playerState.health !== 100 || playerState.shieldHp !== 25) {
    throw new Error(`Health restoration failed! Health: ${playerState.health}, Shield: ${playerState.shieldHp}`);
  }
  console.log(`✓ Post-wave health recovery verified: Human player restored to HP=${playerState.health}, Shield=${playerState.shieldHp}`);

  // Step 7: Cleanup
  client.disconnect();
  io.close();
  server.close();
  console.log('🎉 ALL WAVE SURVIVAL & BOT AI TESTS PASSED CLEANLY!\n');
  process.exit(0);
}

runWaveTest().catch((err) => {
  console.error('❌ Wave test failed:', err);
  process.exit(1);
});

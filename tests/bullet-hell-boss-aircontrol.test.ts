import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MOVEMENT, BOT_ARCHETYPES, getWaveConfig } from '../src/shared/constants.js';
import { WaveManager, ActiveBot } from '../src/server/ai/WaveManager.js';
import { RoomNetworkState, PlayerNetworkState, BotProjectilePayload, ProjectileImpactPayload, BossStatePayload } from '../src/shared/types.js';
import { GeometricBossModel } from '../src/client/engine/GeometricBossModel.js';
import { ProjectileManager } from '../src/client/engine/ProjectileManager.js';
import { FXManager } from '../src/client/engine/FXManager.js';

describe('Air Control & Momentum Steering Physics', () => {
  it('should accelerate horizontal velocity in mid-air up to AIR_MAX_SPEED', () => {
    // Initial airborne state after jumping or stepping off ledge
    const playerVel = new THREE.Vector3(0, 8.0, 0);
    const moveDir = new THREE.Vector3(1, 0, 0); // User pressing Right
    const dt = 0.05;

    for (let step = 0; step < 10; step++) {
      const currentHorizSpeed = Math.hypot(playerVel.x, playerVel.z);
      const targetSpeed = MOVEMENT.AIR_MAX_SPEED;
      const desiredX = moveDir.x * targetSpeed;
      const desiredZ = moveDir.z * targetSpeed;

      if (currentHorizSpeed <= targetSpeed) {
        const steerRate = MOVEMENT.AIR_ACCEL * dt;
        playerVel.x = THREE.MathUtils.damp(playerVel.x, desiredX, steerRate, dt);
        playerVel.z = THREE.MathUtils.damp(playerVel.z, desiredZ, steerRate, dt);
      }
    }

    assert.ok(playerVel.x > 1.0, `Player should gain significant horizontal speed in air, got: ${playerVel.x}`);
    assert.ok(Math.hypot(playerVel.x, playerVel.z) <= MOVEMENT.AIR_MAX_SPEED + 0.1, 'Speed should respect AIR_MAX_SPEED cap');
  });

  it('should redirect vertical jump pad momentum horizontally to prevent getting trapped', () => {
    // Player on vertical jump pad: high vertical velocity, zero horizontal velocity
    const playerVel = new THREE.Vector3(0, 14.0, 0);
    const initialPos = new THREE.Vector3(0, 2.0, 0);
    const moveDir = new THREE.Vector3(0, 0, 1); // Player pushes Forward away from pad
    const dt = 0.033;

    // Simulate 15 frames of airborne steering
    for (let i = 0; i < 15; i++) {
      const currentHorizSpeed = Math.hypot(playerVel.x, playerVel.z);
      const targetSpeed = MOVEMENT.AIR_MAX_SPEED;
      const desiredX = moveDir.x * targetSpeed;
      const desiredZ = moveDir.z * targetSpeed;

      const steerRate = MOVEMENT.AIR_ACCEL * dt;
      playerVel.x = THREE.MathUtils.damp(playerVel.x, desiredX, steerRate, dt);
      playerVel.z = THREE.MathUtils.damp(playerVel.z, desiredZ, steerRate, dt);

      initialPos.x += playerVel.x * dt;
      initialPos.z += playerVel.z * dt;
    }

    assert.ok(playerVel.z > 2.0, `Player must steer away from pad, got vz: ${playerVel.z}`);
    assert.ok(initialPos.z > 0.4, `Player position must displace horizontally off the jump pad, got z: ${initialPos.z}`);
  });

  it('should steer high-speed horizontal launch vectors smoothly while applying air drag', () => {
    // Player launched at 25m/s (e.g. diagonal jump pad or slide-jump boost)
    const playerVel = new THREE.Vector3(25, 5, 0);
    const desiredX = 0;
    const desiredZ = MOVEMENT.AIR_MAX_SPEED; // Player steers 90 degrees toward +Z
    const dt = 0.033;

    const currentHorizSpeed = Math.hypot(playerVel.x, playerVel.z);
    assert.ok(currentHorizSpeed > MOVEMENT.AIR_MAX_SPEED);

    const steerAngle = Math.atan2(desiredZ, desiredX);
    const currentAngle = Math.atan2(playerVel.z, playerVel.x);
    let angleDiff = steerAngle - currentAngle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const maxAngleChange = 4.5 * dt;
    const newAngle = currentAngle + Math.max(-maxAngleChange, Math.min(maxAngleChange, angleDiff));
    const retainedSpeed = currentHorizSpeed * MOVEMENT.AIR_DRAG;
    playerVel.x = Math.cos(newAngle) * retainedSpeed;
    playerVel.z = Math.sin(newAngle) * retainedSpeed;

    assert.ok(playerVel.z > 0, `Velocity should steer into +Z direction, got: ${playerVel.z}`);
    assert.ok(Math.hypot(playerVel.x, playerVel.z) < 25, 'Air drag should gently dampen extreme speed');
  });
});

describe('Server-Authoritative Projectile Simulation & Dodging', () => {
  function createMockRoomState(): RoomNetworkState {
    return {
      roomId: 'TEST_ROOM',
      hostId: 'p_human_1',
      mode: 'wave',
      fragLimit: 10,
      mapName: 'Neon Warehouse',
      status: 'playing',
      countdown: 0,
      players: {
        p_human_1: {
          id: 'p_human_1',
          name: 'Player 1',
          color: '#00d2ff',
          team: 'blue',
          isHost: true,
          isBot: false,
          x: 0,
          y: 0,
          z: 10,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          pitch: 0,
          health: 100,
          maxHealth: 100,
          shieldHp: 0,
          activePowerup: null,
          powerupExpiresAt: 0,
          currentWeapon: 'rifle',
          currentWeaponIndex: 0,
          isSliding: false,
          isJumping: false,
          isDead: false,
          score: 0,
          kills: 0,
          deaths: 0
        }
      }
    };
  }

  function createMockIo(events: Array<{ event: string; data: any }>) {
    return {
      to: (_room: string) => ({
        emit: (event: string, data: any) => {
          events.push({ event, data });
        }
      })
    } as any;
  }

  it('should spawn physical 3D projectiles instead of hitscan dice rolls', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = createMockIo(events);
    const roomState = createMockRoomState();
    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});

    wm.startWave(1);
    const botIds = Object.keys(roomState.players).filter((k) => roomState.players[k].isBot);
    assert.ok(botIds.length > 0, 'Wave 1 should spawn bots');

    const bot = roomState.players[botIds[0]];
    const active = (wm as any).activeBots.get(bot.id) as ActiveBot;
    assert.ok(active, 'Active bot entry must exist');

    // Force bot to discharge projectiles towards player
    const target = roomState.players.p_human_1;
    (wm as any).fireBotProjectiles(active, target, [0, 0, 1]);

    const spawnEvents = events.filter((e) => e.event === 'bot_projectile_spawn');
    assert.ok(spawnEvents.length > 0, 'Server must emit bot_projectile_spawn');
    const projData = spawnEvents[0].data as BotProjectilePayload;
    assert.equal(projData.botId, bot.id);
    assert.ok(projData.vz > 0, `Projectile should have forward velocity towards +Z, got vz=${projData.vz}`);
    assert.ok(projData.radius > 0, 'Projectile must have physical radius');

    wm.dispose();
  });

  it('should allow player to slide under high projectiles', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = createMockIo(events);
    const roomState = createMockRoomState();
    const human = roomState.players.p_human_1;
    human.x = 0;
    human.y = 0;
    human.z = 10;
    human.isSliding = true; // Slide height is 0.70m

    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});
    wm.startWave(1);

    const botId = Object.keys(roomState.players).find((k) => roomState.players[k].isBot)!;
    const bot = roomState.players[botId];

    // Spawn projectile aiming at y = 0.95m (between slide height 0.70m and standing height 1.28m)
    (wm as any).spawnProjectile(bot, [0, 0.95, 9.0], [0, 0, 1], 20, 0.15, 20, '#ffaa00', 'shard', 2.0);

    // Tick projectile forward into human z position
    (wm as any).tickProjectiles(0.06, [human]);

    assert.equal(human.health, 100, 'Sliding player must dodge high projectile (HP remains 100)');
    wm.dispose();
  });

  it('should register damage when projectile collides with player cylinder', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = createMockIo(events);
    const roomState = createMockRoomState();
    const human = roomState.players.p_human_1;
    human.x = 0;
    human.y = 0;
    human.z = 10;
    human.isSliding = false; // Standing height 1.28m

    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});
    wm.startWave(1);

    const botId = Object.keys(roomState.players).find((k) => roomState.players[k].isBot)!;
    const bot = roomState.players[botId];

    // Spawn direct chest-height projectile at z=9.8m towards z=10.0m
    (wm as any).spawnProjectile(bot, [0, 0.8, 9.5], [0, 0, 1], 20, 0.2, 25, '#00ffcc', 'plasma', 2.0);

    // Tick forward so projectile intersects player
    (wm as any).tickProjectiles(0.04, [human]);

    assert.ok(human.health < 100, `Player should take damage from physical projectile collision, got hp: ${human.health}`);
    const impactEvent = events.find((e) => e.event === 'bot_projectile_impact');
    assert.ok(impactEvent, 'Server must emit bot_projectile_impact on player hit');
    assert.equal(impactEvent.data.hitPlayerId, human.id);

    wm.dispose();
  });

  it('should eliminate projectile when hitting map obstacles', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = createMockIo(events);
    const roomState = createMockRoomState();

    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});
    wm.startWave(1);

    const botId = Object.keys(roomState.players).find((k) => roomState.players[k].isBot)!;
    const bot = roomState.players[botId];

    // Spawn projectile heading into map obstacle (e.g. wall/crate)
    const obs = (wm as any).mapObstacles[0];
    assert.ok(obs, 'Obstacles should exist on Neon Warehouse');

    const obsCenterX = (obs.min[0] + obs.max[0]) / 2;
    const obsCenterY = (obs.min[1] + obs.max[1]) / 2;
    const obsCenterZ = (obs.min[2] + obs.max[2]) / 2;

    (wm as any).spawnProjectile(bot, [obsCenterX, obsCenterY, obsCenterZ - 1.0], [0, 0, 1], 25, 0.2, 20, '#ffaa00', 'shard');
    assert.equal((wm as any).activeProjectiles.size, 1);

    // Tick projectile directly into obstacle
    (wm as any).tickProjectiles(0.08, []);

    assert.equal((wm as any).activeProjectiles.size, 0, 'Projectile should be consumed on obstacle collision');
    const impactEvent = events.find((e) => e.event === 'bot_projectile_impact');
    assert.ok(impactEvent, 'Must emit bot_projectile_impact on wall hit');

    wm.dispose();
  });
});

describe('Bot AI Variants & Inter-Level Geometric Boss', () => {
  function createMockRoomState(): RoomNetworkState {
    return {
      roomId: 'TEST_ROOM_BOSS',
      hostId: 'p_human_1',
      mode: 'wave',
      fragLimit: 10,
      mapName: 'Neon Warehouse',
      status: 'playing',
      countdown: 0,
      players: {
        p_human_1: {
          id: 'p_human_1',
          name: 'Player 1',
          color: '#00d2ff',
          team: 'blue',
          isHost: true,
          isBot: false,
          x: 0,
          y: 0,
          z: 15,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          pitch: 0,
          health: 100,
          maxHealth: 100,
          shieldHp: 0,
          activePowerup: null,
          powerupExpiresAt: 0,
          currentWeapon: 'rifle',
          currentWeaponIndex: 0,
          isSliding: false,
          isJumping: false,
          isDead: false,
          score: 0,
          kills: 0,
          deaths: 0
        }
      }
    };
  }

  it('should configure geometric bosses between levels on Waves 3, 6, and 10', () => {
    const wave3 = getWaveConfig(3);
    assert.ok(wave3.bots.some((b) => b.role === 'boss'), 'Wave 3 must contain a boss');

    const wave6 = getWaveConfig(6);
    assert.ok(wave6.bots.some((b) => b.role === 'boss'), 'Wave 6 must contain a boss');

    const wave10 = getWaveConfig(10);
    assert.ok(wave10.bots.some((b) => b.role === 'boss'), 'Wave 10 must contain apex boss');
  });

  it('should initialize boss name, health, and shield for Wave 3 Prism Construct', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = {
      to: () => ({
        emit: (event: string, data: any) => events.push({ event, data })
      })
    } as any;
    const roomState = createMockRoomState();
    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});

    wm.startWave(3);
    const boss = Object.values(roomState.players).find((p) => p.botRole === 'boss');
    assert.ok(boss, 'Wave 3 must spawn boss bot');
    assert.equal(boss.name, '💠 PRISM CONSTRUCT');
    assert.equal(boss.health, 260);
    assert.equal(boss.shieldHp, 60);

    wm.dispose();
  });

  it('should execute 360-degree Nova Ring and spiral bullet hell patterns for Boss', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = {
      to: () => ({
        emit: (event: string, data: any) => events.push({ event, data })
      })
    } as any;
    const roomState = createMockRoomState();
    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});

    wm.startWave(3);
    const boss = Object.values(roomState.players).find((p) => p.botRole === 'boss')!;
    const active = (wm as any).activeBots.get(boss.id) as ActiveBot;

    // Pattern 1: Nova Ring (16 projectiles in 360 circle)
    active.bossPhase = 1;
    (wm as any).fireBotProjectiles(active, roomState.players.p_human_1, [0, 0, 1]);

    const ringProjectiles = Array.from((wm as any).activeProjectiles.values()).filter(
      (p: any) => p.pattern === 'ring'
    );
    assert.equal(ringProjectiles.length, 16, 'Nova ring must spawn exactly 16 radial projectiles');

    // Pattern 2: Twin Spiral Stream
    active.bossPhase = 2;
    (wm as any).fireBotProjectiles(active, roomState.players.p_human_1, [0, 0, 1]);
    assert.equal(active.bossSpiralShotsRemaining, 12, 'Twin spiral must queue 12 spiral steps');

    // Step spiral forward
    (wm as any).tick(0.1);
    const spiralProjectiles = Array.from((wm as any).activeProjectiles.values()).filter(
      (p: any) => p.pattern === 'spiral'
    );
    assert.ok(spiralProjectiles.length >= 2, 'Spiral pattern must spawn opposing pairs of projectiles');

    wm.dispose();
  });

  it('should broadcast boss_state payload with phase, health, and shield', () => {
    const events: Array<{ event: string; data: any }> = [];
    const io = {
      to: () => ({
        emit: (event: string, data: any) => events.push({ event, data })
      })
    } as any;
    const roomState = createMockRoomState();
    const wm = new WaveManager(io, roomState, 'Neon Warehouse', () => {});

    wm.startWave(3);
    (wm as any).tick(0.1);

    const bossEvent = events.find((e) => e.event === 'boss_state');
    assert.ok(bossEvent, 'Must broadcast boss_state to sync top HUD banner');
    const data = bossEvent.data as BossStatePayload;
    assert.equal(data.name, '💠 PRISM CONSTRUCT');
    assert.equal(data.health, 260);
    assert.equal(data.shield, 60);
    assert.ok(data.phase >= 1, 'Boss phase must be >= 1');

    wm.dispose();
  });

  it('should verify GeometricBossModel procedural geometry, colliders, and headshots', () => {
    const scene = new THREE.Scene();
    const bossModel = new GeometricBossModel(scene, 'boss_1', '💠 PRISM CONSTRUCT');

    assert.ok(bossModel.root, 'Boss model root must exist');
    assert.ok(bossModel.targetableColliders.length >= 2, 'Boss model must register core and hull colliders');

    const coreCol = bossModel.targetableColliders.find((c) => c.userData.part === 'core');
    assert.ok(coreCol, 'Must have apex core collider');
    assert.equal(coreCol?.userData.isHeadshot, true, 'Core hit must register as headshot');

    const hullCol = bossModel.targetableColliders.find((c) => c.userData.part === 'hull');
    assert.ok(hullCol, 'Must have hull collider');
    assert.equal(hullCol?.userData.isHeadshot, false, 'Hull hit must register as body shot');

    // Test animation update
    bossModel.update(0.033, false, false, false, 0.2);

    // Test destruction into polyhedral shards
    bossModel.shatterIntoBricks();
    assert.equal(bossModel.isDead, true);

    bossModel.dispose();
  });
});

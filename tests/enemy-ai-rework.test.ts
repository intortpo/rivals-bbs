import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WaveManager } from '../src/server/ai/WaveManager.js';
import { GameSession } from '../src/server/GameSession.js';
import { RoomNetworkState, PlayerNetworkState, WorldSnapshot } from '../src/shared/types.js';
import { PCGeometricBossModel } from '../src/client/engine/playcanvas/PCGeometricBossModel.js';

function createMockRoomState(mapName: string = 'Facility', mode: 'wave' | '1v1' | 'ffa' = 'wave'): RoomNetworkState {
  return {
    roomId: 'TEST_ENEMY_ROOM',
    hostId: 'human_host',
    mode,
    fragLimit: 10,
    mapName,
    status: 'playing',
    countdown: 0,
    players: {
      human_host: {
        id: 'human_host',
        name: 'Operator',
        color: '#00d2ff',
        team: mode === 'wave' ? 'blue' : 'none',
        isHost: true,
        x: 0,
        y: 0,
        z: 0,
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

describe('Enemy AI Ground Clamping & Facility Map Integrity', () => {
  it('should not teleport ground bots to container roof (y=3m) or pillar top (y=10m) on Facility', () => {
    const roomState = createMockRoomState('Facility');
    const mockIo: any = {
      to: () => ({ emit: () => {} })
    };

    const waveMgr = new WaveManager(mockIo, roomState, 'Facility', () => {});
    waveMgr.start();

    // Verify bots spawned
    const activeBots = (waveMgr as any).activeBots;
    assert.ok(activeBots.size > 0, 'WaveManager should spawn bots for Wave 1');

    // Place a bot on the ground next to ContainerWestNorth (min: [-18, 0, -8], max: [-12, 3, -5])
    const botEntry = Array.from(activeBots.values())[0] as any;
    const bot = botEntry.bot;
    bot.x = -15.0; // Inside X footprint of container
    bot.z = -6.5;  // Inside Z footprint of container
    bot.y = 0.0;   // Ground floor

    // Execute AI tick
    waveMgr.tick(0.033);

    // Bot standing on ground should NOT be elevated to 3.0m container roof
    assert.equal(bot.y, 0.0, `Ground bot near container must remain at y=0.0, but got y=${bot.y}`);
  });

  it('should clamp bot movement to Facility perimeter containment boundaries (±30.5m)', () => {
    const roomState = createMockRoomState('Facility');
    const mockIo: any = {
      to: () => ({ emit: () => {} })
    };

    const waveMgr = new WaveManager(mockIo, roomState, 'Facility', () => {});
    waveMgr.start();

    const activeBots = (waveMgr as any).activeBots;
    const botEntry = Array.from(activeBots.values())[0] as any;
    const bot = botEntry.bot;

    // Attempt to position bot outside Facility wall (wall is at ±31..33)
    bot.x = 35.0;
    bot.z = -35.0;

    waveMgr.tick(0.033);

    assert.ok(bot.x <= 30.5, `Facility boundary must clamp X <= 30.5, got: ${bot.x}`);
    assert.ok(bot.z >= -30.5, `Facility boundary must clamp Z >= -30.5, got: ${bot.z}`);
  });
});

describe('Enemy Obstacle Avoidance & Tangential Wall Sliding', () => {
  it('should steer tangentially along obstacle faces to navigate around obstacles', () => {
    const roomState = createMockRoomState('Facility');
    // Human is at (0, 0, 0)
    roomState.players.human_host.x = 0;
    roomState.players.human_host.z = 0;

    const mockIo: any = {
      to: () => ({ emit: () => {} })
    };

    const waveMgr = new WaveManager(mockIo, roomState, 'Facility', () => {});
    waveMgr.start();

    const activeBots = (waveMgr as any).activeBots;
    const botEntry = Array.from(activeBots.values())[0] as any;
    const bot = botEntry.bot;

    // Place bot north of CoverMidNorth (min: [-2, 0, -6], max: [2, 1.5, -4])
    // Direct path south towards (0, 0, 0) is blocked by cover
    bot.x = 0.5;
    bot.y = 0.0;
    bot.z = -6.4;
    bot.vx = 0;
    bot.vz = 4.0;

    waveMgr.tick(0.033);

    // Bot colliding with the North face of cover must actively steer tangentially along X
    assert.ok(
      Math.abs(bot.vx) >= 1.0,
      `Bot colliding with cover north face should steer along X axis around obstacle, got vx=${bot.vx}`
    );
  });
});

describe('PlayCanvas Geometric Boss Height Alignment & Hitbox Parity', () => {
  it('should align boss core and hitboxes with server projectile elevation (y = bot.y + 1.1)', () => {
    // Server bot is at hover position y = 1.6m
    const serverBotY = 1.6;
    const expectedCoreElevation = serverBotY + 1.1; // 2.7m

    const bossModel = new PCGeometricBossModel(undefined, 'boss_test_1', 'PRISM CONSTRUCT', '#f43f5e');
    bossModel.setPosition(0, serverBotY, 0);

    const hitboxes = bossModel.getHitboxes();
    const headHitbox = hitboxes.find((h) => h.isHeadshot);
    assert.ok(headHitbox, 'Boss must have a headshot-capable core hitbox');

    // The center of the core hitbox in world space should be at expected elevation
    assert.ok(
      Math.abs(headHitbox.box.center.y - expectedCoreElevation) < 0.15,
      `Boss core hitbox Y (${headHitbox.box.center.y}) should match server projectile origin (${expectedCoreElevation}) within 0.15m`
    );
  });
});

describe('GameSession & WaveManager Snapshot Bot Role Synchronization', () => {
  it('should include botRole in WorldSnapshot.players so client instantiates PCGeometricBossModel', () => {
    const roomState = createMockRoomState('Facility');
    let emittedSnapshot: WorldSnapshot | null = null;
    const mockIo: any = {
      to: () => ({
        emit: (event: string, data: any) => {
          if (event === 'sync_snapshot') {
            emittedSnapshot = data;
          }
        }
      })
    };

    const session = new GameSession(mockIo, roomState);
    session.startGame();

    // Advance to wave 3 (Boss wave)
    if (session.waveManager) {
      session.waveManager.startWave(3);
    }

    // Trigger tick
    (session as any).tick();

    assert.ok(emittedSnapshot, 'Snapshot must be emitted on tick');
    const players = (emittedSnapshot as WorldSnapshot).players;
    const bossEntry = Object.values(players).find((p: any) => p.isBot && p.botRole === 'boss');
    assert.ok(bossEntry, 'Snapshot players must contain bot with botRole === "boss"');
    session.stop();
  });
});

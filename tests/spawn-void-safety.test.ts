import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { MapBuilder } from '../src/client/engine/MapBuilder.js';
import {
  getMapSpawns,
  getTeamSpawn
} from '../src/shared/constants.js';
import { GameSession } from '../src/server/GameSession.js';
import { WaveManager } from '../src/server/ai/WaveManager.js';

console.log('🧪 Starting Map Spawn Void Safety & Obstacle Clearance Tests...');

const allMaps = [
  'Cartoon City',
  'Arena Classic',
  'Neon Warehouse',
  'Cyber Spire',
  'Quantum Lab',
  'Magma Foundry',
  'Subzero Station',
  'Sky Sanctuary'
];

describe('Map Spawns Ground Integrity & Zero Void Placement', () => {
  const scene = new THREE.Scene();

  it('should verify all individual / FFA spawns on all 8 maps are on solid ground and clear of obstacles', () => {
    for (const mapName of allMaps) {
      const mb = new MapBuilder(scene, mapName);
      const spawns = getMapSpawns(mapName);
      assert.ok(spawns.length >= 6, `${mapName} should have at least 6 spawns`);

      spawns.forEach((s, idx) => {
        const pos = new THREE.Vector3(s.x, s.y, s.z);
        const gLevel = mb.getGroundLevel(pos);
        assert.ok(
          gLevel > -3.0,
          `Spawn #${idx} (${s.x}, ${s.y}, ${s.z}) on ${mapName} must not be over void! Got gLevel=${gLevel}`
        );

        // Player collision envelope (radius 0.35m, height 1.2m)
        const pBox = new THREE.Box3(
          new THREE.Vector3(s.x - 0.35, s.y + 0.1, s.z - 0.35),
          new THREE.Vector3(s.x + 0.35, s.y + 1.2, s.z + 0.35)
        );
        const collidesWith = mb.collisionBoxes.filter(box => box.intersectsBox(pBox));
        assert.strictEqual(
          collidesWith.length,
          0,
          `Spawn #${idx} (${s.x}, ${s.y}, ${s.z}) on ${mapName} intersects ${collidesWith.length} obstacles!`
        );
      });

      mb.dispose();
    }
  });

  it('should verify all 64 team spawns (4 Blue + 4 Red across all 8 maps) are on solid ground and clear of obstacles', () => {
    for (const mapName of allMaps) {
      const mb = new MapBuilder(scene, mapName);

      for (const team of ['blue', 'red'] as const) {
        for (let i = 0; i < 4; i++) {
          const s = getTeamSpawn(team, i, mapName);
          assert.ok(s, `Team spawn for ${team}[${i}] missing on ${mapName}`);
          const pos = new THREE.Vector3(s.x, s.y, s.z);
          const gLevel = mb.getGroundLevel(pos);
          assert.ok(
            gLevel > -3.0,
            `Team ${team}[${i}] (${s.x}, ${s.y}, ${s.z}) on ${mapName} must not be over void! Got gLevel=${gLevel}`
          );

          const pBox = new THREE.Box3(
            new THREE.Vector3(s.x - 0.35, s.y + 0.1, s.z - 0.35),
            new THREE.Vector3(s.x + 0.35, s.y + 1.2, s.z + 0.35)
          );
          const collidesWith = mb.collisionBoxes.filter(box => box.intersectsBox(pBox));
          assert.strictEqual(
            collidesWith.length,
            0,
            `Team ${team}[${i}] (${s.x}, ${s.y}, ${s.z}) on ${mapName} intersects ${collidesWith.length} obstacles!`
          );
        }
      }

      // Check distance between team bases
      const blue0 = getTeamSpawn('blue', 0, mapName);
      const red0 = getTeamSpawn('red', 0, mapName);
      const dist = Math.hypot(blue0.x - red0.x, blue0.z - red0.z);
      assert.ok(dist >= 15, `Team base separation on ${mapName} must be >= 15m (was ${dist.toFixed(1)}m)`);

      mb.dispose();
    }
  });

  it('should verify default team spawn fallback is safe when mapName is omitted', () => {
    const blue = getTeamSpawn('blue', 0);
    const red = getTeamSpawn('red', 0);
    assert.ok(blue && red);
    assert.ok(typeof blue.x === 'number' && typeof blue.y === 'number' && typeof blue.z === 'number');
    assert.ok(typeof red.x === 'number' && typeof red.y === 'number' && typeof red.z === 'number');
    const dist = Math.hypot(blue.x - red.x, blue.z - red.z);
    assert.ok(dist >= 15, `Fallback separation must be >= 15m`);
  });
});

describe('GameSession & WaveManager Void-Free Spawning Integration', () => {
  const scene = new THREE.Scene();

  const mockIo = {
    to: () => ({ emit: () => {} }),
    emit: () => {}
  } as any;

  function createTestSession(roomId: string, mode: '4v4' | 'wave', mapName: string) {
    const roomState: any = {
      roomId,
      hostId: 'host',
      mode,
      mapName,
      fragLimit: 5,
      status: 'lobby',
      countdown: 0,
      players: {}
    };
    return new GameSession(mockIo, roomState);
  }

  it('should spawn 8 players in 4v4 on Cyber Spire without any void fall deaths', () => {
    const session = createTestSession('TEST-ROOM-CS', '4v4', 'Cyber Spire');
    const mb = new MapBuilder(scene, 'Cyber Spire');

    // Add 4 blue players and 4 red players
    for (let i = 0; i < 4; i++) {
      session.addPlayer(`p_blue_${i}`, `BluePilot_${i}`, '#00d2ff', i === 0, 'blue');
      session.addPlayer(`p_red_${i}`, `RedPilot_${i}`, '#ff2a55', false, 'red');
    }

    session.startGame();

    // Check all players' positions
    const players = Object.values(session.roomState.players);
    assert.strictEqual(players.length, 8);

    players.forEach(p => {
      const pos = new THREE.Vector3(p.x, p.y, p.z);
      const gLevel = mb.getGroundLevel(pos);
      assert.ok(gLevel > -3.0, `Player ${p.name} at (${p.x}, ${p.y}, ${p.z}) spawned over void! gLevel=${gLevel}`);
      assert.strictEqual(p.isDead, false, `Player ${p.name} must not be dead on spawn`);
    });

    mb.dispose();
    session.stop();
  });

  it('should spawn 8 players in 4v4 on Magma Foundry without any void fall deaths', () => {
    const session = createTestSession('TEST-ROOM-MF', '4v4', 'Magma Foundry');
    const mb = new MapBuilder(scene, 'Magma Foundry');

    for (let i = 0; i < 4; i++) {
      session.addPlayer(`p_blue_${i}`, `BluePilot_${i}`, '#00d2ff', i === 0, 'blue');
      session.addPlayer(`p_red_${i}`, `RedPilot_${i}`, '#ff2a55', false, 'red');
    }

    session.startGame();

    const players = Object.values(session.roomState.players);
    assert.strictEqual(players.length, 8);

    players.forEach(p => {
      const pos = new THREE.Vector3(p.x, p.y, p.z);
      const gLevel = mb.getGroundLevel(pos);
      assert.ok(gLevel > -3.0, `Player ${p.name} at (${p.x}, ${p.y}, ${p.z}) spawned over void! gLevel=${gLevel}`);
      assert.strictEqual(p.isDead, false, `Player ${p.name} must not be dead on spawn`);
    });

    mb.dispose();
    session.stop();
  });

  it('should spawn 8 players in 4v4 on Sky Sanctuary without any void fall deaths', () => {
    const session = createTestSession('TEST-ROOM-SS', '4v4', 'Sky Sanctuary');
    const mb = new MapBuilder(scene, 'Sky Sanctuary');

    for (let i = 0; i < 4; i++) {
      session.addPlayer(`p_blue_${i}`, `BluePilot_${i}`, '#00d2ff', i === 0, 'blue');
      session.addPlayer(`p_red_${i}`, `RedPilot_${i}`, '#ff2a55', false, 'red');
    }

    session.startGame();

    const players = Object.values(session.roomState.players);
    assert.strictEqual(players.length, 8);

    players.forEach(p => {
      const pos = new THREE.Vector3(p.x, p.y, p.z);
      const gLevel = mb.getGroundLevel(pos);
      assert.ok(gLevel > -3.0, `Player ${p.name} at (${p.x}, ${p.y}, ${p.z}) spawned over void! gLevel=${gLevel}`);
      assert.strictEqual(p.isDead, false, `Player ${p.name} must not be dead on spawn`);
    });

    mb.dispose();
    session.stop();
  });

  it('should spawn Wave bots safely on Cyber Spire platforms without edge slips', () => {
    const session = createTestSession('TEST-WAVE-CS', 'wave', 'Cyber Spire');
    const mb = new MapBuilder(scene, 'Cyber Spire');

    session.addPlayer('pilot_1', 'SoloPilot', '#00d2ff', true, 'blue');
    session.startGame();

    const bots = Object.values(session.roomState.players).filter(p => p.isBot);
    assert.ok(bots.length > 0, 'Wave 1 should spawn bots');

    bots.forEach(b => {
      const pos = new THREE.Vector3(b.x, b.y, b.z);
      const gLevel = mb.getGroundLevel(pos);
      assert.ok(gLevel > -3.0, `Bot ${b.name} at (${b.x}, ${b.y}, ${b.z}) spawned over void! gLevel=${gLevel}`);
    });

    mb.dispose();
    session.stop();
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { MapBuilder } from '../src/client/engine/MapBuilder.js';
import {
  getMapSpawns,
  getTeamSpawn,
  CYBER_SPIRE_SPAWNS,
  QUANTUM_LAB_SPAWNS,
  MAGMA_FOUNDRY_SPAWNS,
  SUBZERO_STATION_SPAWNS,
  SKY_SANCTUARY_SPAWNS
} from '../src/shared/constants.js';
import {
  getMapObstacles,
  hasLineOfSight,
  CYBER_SPIRE_OBSTACLES,
  QUANTUM_LAB_OBSTACLES,
  MAGMA_FOUNDRY_OBSTACLES,
  SUBZERO_STATION_OBSTACLES,
  SKY_SANCTUARY_OBSTACLES
} from '../src/shared/mapObstacles.js';

console.log('🧪 Starting Airsoft BBS 5 New Arena Maps & Portal Integration Tests...');

describe('5 New Arena Maps Architecture & Geometry', () => {
  const scene = new THREE.Scene();

  it('should initialize and build Cyber Spire with multi-tier vertical platforms, jump pads, and teleporter', () => {
    const mb = new MapBuilder(scene, 'Cyber Spire');
    assert.strictEqual(mb.mapName, 'Cyber Spire');
    assert.strictEqual(mb.hasGroundPlane, false, 'Cyber Spire should have void fall abyss');
    assert.ok(mb.collisionBoxes.length > 10, 'Should have multiple colliders for towers & bridges');
    assert.ok(mb.rooftopBoxes.length >= 7, 'Should have walkable platforms for towers & decks');
    assert.strictEqual(mb.jumpPads.length, 6, 'Should have 4 directional boosters and 2 super lifts');
    assert.strictEqual(mb.teleportPorts.length, 2, 'Should have 1 paired teleporter (2 ports)');

    // Test platform height check
    const centerTerracePos = new THREE.Vector3(0, 4.0, 0); // On Tier 2 terrace (max.y = 4.0 -> ground level = 5.0)
    const gLevel = mb.getGroundLevel(centerTerracePos);
    assert.strictEqual(gLevel, 5.0, 'Standing on Tier 2 terrace should provide ground level 5.0');

    // Test stepping off into void
    const voidPos = new THREE.Vector3(-18, 0, -18);
    const voidGLevel = mb.getGroundLevel(voidPos);
    assert.strictEqual(voidGLevel, -100, 'Stepping into empty sky should return -100 (void)');

    mb.dispose();
  });

  it('should initialize and build Quantum Lab with symmetrical collider, cross-wing teleporters, and catwalk pads', () => {
    const mb = new MapBuilder(scene, 'Quantum Lab');
    assert.strictEqual(mb.mapName, 'Quantum Lab');
    assert.strictEqual(mb.hasGroundPlane, true, 'Quantum Lab has indoor facility floor');
    assert.strictEqual(mb.jumpPads.length, 4, 'Should have 4 catwalk jump pads');
    assert.strictEqual(mb.teleportPorts.length, 2, 'Should have 1 paired cross-wing teleporter');

    // Verify observation deck height
    const obsDeckPos = new THREE.Vector3(0, 3.5, 0);
    const obsGLevel = mb.getGroundLevel(obsDeckPos);
    assert.strictEqual(obsGLevel, 4.5, 'Observation deck should provide elevated ground level 4.5');

    mb.dispose();
  });

  it('should initialize and build Magma Foundry with molten lava hazard and crane gantry', () => {
    const mb = new MapBuilder(scene, 'Magma Foundry');
    assert.strictEqual(mb.mapName, 'Magma Foundry');
    assert.strictEqual(mb.hasGroundPlane, false, 'Magma Foundry has lethal lava lake void');
    assert.strictEqual(mb.jumpPads.length, 4, 'Should have 2 chasm boosters and 2 crane lifts');
    assert.strictEqual(mb.teleportPorts.length, 2, 'Should have slag pit to crane teleporter');

    // Test central crucible ground
    const cruciblePos = new THREE.Vector3(0, 0, 0);
    const ground = mb.getGroundLevel(cruciblePos);
    assert.strictEqual(ground, 1.0, 'Central crucible surface provides ground level 1.0');

    // Test lava void drop
    const lavaPos = new THREE.Vector3(15, 0, 15);
    const lavaGround = mb.getGroundLevel(lavaPos);
    assert.strictEqual(lavaGround, -100, 'Lava lake area without platform provides ground level -100');

    mb.dispose();
  });

  it('should initialize and build Subzero Station with arctic bunker, container jump pads, and radar array teleporter', () => {
    const mb = new MapBuilder(scene, 'Subzero Station');
    assert.strictEqual(mb.mapName, 'Subzero Station');
    assert.strictEqual(mb.hasGroundPlane, true, 'Subzero Station has snow/ice terrain floor');
    assert.strictEqual(mb.jumpPads.length, 4, 'Should have 4 super lifts around bunker');
    assert.strictEqual(mb.teleportPorts.length, 2, 'Should have trench to radar array teleporter');

    // Test command center roof height
    const bunkerRoofPos = new THREE.Vector3(0, 4.0, 0);
    const gLevel = mb.getGroundLevel(bunkerRoofPos);
    assert.strictEqual(gLevel, 5.0, 'Bunker roof provides ground level 5.0');

    mb.dispose();
  });

  it('should initialize and build Sky Sanctuary with floating islands and celestial spirit gates', () => {
    const mb = new MapBuilder(scene, 'Sky Sanctuary');
    assert.strictEqual(mb.mapName, 'Sky Sanctuary');
    assert.strictEqual(mb.hasGroundPlane, false, 'Sky Sanctuary has open sky void');
    assert.strictEqual(mb.jumpPads.length, 4, 'Should have 4 sky booster jump pads');
    assert.strictEqual(mb.teleportPorts.length, 2, 'Should have North-South celestial spirit gates');

    // Test island ground
    const shrinePos = new THREE.Vector3(0, 0, 0);
    assert.strictEqual(mb.getGroundLevel(shrinePos), 1.0, 'Shrine island surface provides ground level 1.0');

    // Test open sky chasm
    const chasmPos = new THREE.Vector3(-15, 0, -15);
    assert.strictEqual(mb.getGroundLevel(chasmPos), -100, 'Sky chasm provides ground level -100');

    mb.dispose();
  });
});

describe('Directional Jump Pad & Aerial Booster Mechanics', () => {
  const scene = new THREE.Scene();

  it('should provide vertical-only impulse on standard super lifts', () => {
    const mb = new MapBuilder(scene, 'Cyber Spire');
    // Test Spire super lift at (4.5, 4, 4.5)
    const hit = mb.checkJumpPads(new THREE.Vector3(4.5, 4.3, 4.5));
    assert.notStrictEqual(hit, null);
    assert.strictEqual(hit!.impulseY, 19);
    assert.strictEqual(hit!.impulseX, 0);
    assert.strictEqual(hit!.impulseZ, 0);
    mb.dispose();
  });

  it('should provide both vertical and horizontal impulses on directional aerial boosters', () => {
    const mb = new MapBuilder(scene, 'Cyber Spire');
    // Test North tower booster at (0, 3, -18) launching South (+Z)
    const hit = mb.checkJumpPads(new THREE.Vector3(0, 3.3, -18));
    assert.notStrictEqual(hit, null);
    assert.strictEqual(hit!.impulseY, 14);
    assert.strictEqual(hit!.impulseZ, 16);
    assert.strictEqual(hit!.impulseX, 0);

    // Test West helipad booster at (-18, 2, 0) launching East (+X)
    const hitWest = mb.checkJumpPads(new THREE.Vector3(-18, 2.3, 0));
    assert.notStrictEqual(hitWest, null);
    assert.strictEqual(hitWest!.impulseY, 14);
    assert.strictEqual(hitWest!.impulseX, 16);
    assert.strictEqual(hitWest!.impulseZ, 0);

    mb.dispose();
  });
});

describe('Interactive Teleport Port & Anti-Ping-Pong Cooldown', () => {
  const scene = new THREE.Scene();

  it('should warp player to target exit position and yaw when stepping on portal', () => {
    const mb = new MapBuilder(scene, 'Quantum Lab');
    assert.strictEqual(mb.teleportPorts.length, 2);

    const portWest = mb.teleportPorts.find((p) => p.id === 'quantum_west')!;
    const portEast = mb.teleportPorts.find((p) => p.id === 'quantum_east')!;
    assert.ok(portWest && portEast);

    // Player steps on West Portal at (-25, 0, 0)
    const hit = mb.checkTeleportPorts(new THREE.Vector3(-25, 0.5, 0), 0);
    assert.notStrictEqual(hit, null);
    assert.strictEqual(hit!.id, 'quantum_west');
    assert.strictEqual(hit!.targetId, 'quantum_east');

    // Exit position should be in East Lab Bay facing West (-PI/2)
    assert.strictEqual(hit!.exitYaw, -Math.PI / 2);
    assert.ok(hit!.exitPos.x > 20, 'Exit should be positioned in East Lab Bay');

    // Anti-ping-pong cooldown: immediate query (within 1.5s) must be rejected
    const recentTime = performance.now();
    const cooldownHit = mb.checkTeleportPorts(new THREE.Vector3(-25, 0.5, 0), recentTime);
    assert.strictEqual(cooldownHit, null, 'Immediate re-trigger within 1.5s cooldown must return null');

    // After cooldown elapses (e.g. lastTeleportTime 2000ms ago), query succeeds
    const readyHit = mb.checkTeleportPorts(new THREE.Vector3(-25, 0.5, 0), recentTime - 2000);
    assert.notStrictEqual(readyHit, null, 'Query after cooldown elapses must succeed');

    mb.dispose();
  });
});

describe('Multi-Map Spawn Points & 4v4 Competitive Balance', () => {
  const mapNames = [
    'Cartoon City',
    'Arena Classic',
    'Neon Warehouse',
    'Cyber Spire',
    'Quantum Lab',
    'Magma Foundry',
    'Subzero Station',
    'Sky Sanctuary'
  ];

  it('should provide valid spawns with coordinates and yaw for all 8 maps', () => {
    mapNames.forEach((map) => {
      const spawns = getMapSpawns(map);
      assert.ok(spawns.length >= 6, `Map ${map} must have at least 6 spawns (found ${spawns.length})`);
      spawns.forEach((s, idx) => {
        assert.ok(typeof s.x === 'number' && !Number.isNaN(s.x), `Spawn ${idx} x invalid in ${map}`);
        assert.ok(typeof s.y === 'number' && !Number.isNaN(s.y), `Spawn ${idx} y invalid in ${map}`);
        assert.ok(typeof s.z === 'number' && !Number.isNaN(s.z), `Spawn ${idx} z invalid in ${map}`);
        assert.ok(typeof s.yaw === 'number' && !Number.isNaN(s.yaw), `Spawn ${idx} yaw invalid in ${map}`);
      });
    });
  });

  it('should provide balanced team spawns for 4v4 matches on all 8 maps', () => {
    mapNames.forEach((map) => {
      const blueSpawn = getTeamSpawn('blue', 0, map);
      const redSpawn = getTeamSpawn('red', 0, map);
      assert.ok(blueSpawn, `Blue team spawn missing on ${map}`);
      assert.ok(redSpawn, `Red team spawn missing on ${map}`);

      // Distance between team bases must be substantial (> 15m) for competitive integrity
      const dist = Math.hypot(blueSpawn.x - redSpawn.x, blueSpawn.z - redSpawn.z);
      assert.ok(dist >= 15, `Team spawn distance on ${map} must be >= 15m (was ${dist.toFixed(1)}m)`);
    });
  });
});

describe('Server-side Obstacle Raycasting & Line-of-Sight on New Maps', () => {
  it('should block line of sight through solid building obstacles on Cyber Spire', () => {
    const obs = getMapObstacles('Cyber Spire');
    assert.strictEqual(obs, CYBER_SPIRE_OBSTACLES);

    // Ray passing directly through central spire core [-2, 0, -2] to [2, 12, 2]
    const p1: [number, number, number] = [-10, 5, 0];
    const p2: [number, number, number] = [10, 5, 0];
    const los = hasLineOfSight(p1, p2, obs);
    assert.strictEqual(los, false, 'Line of sight through central spire core must be blocked');

    // Clear sky line of sight
    const clearP1: [number, number, number] = [-10, 5, 15];
    const clearP2: [number, number, number] = [10, 5, 15];
    const clearLos = hasLineOfSight(clearP1, clearP2, obs);
    assert.strictEqual(clearLos, true, 'Line of sight across open skybridge lane must be clear');
  });

  it('should block line of sight through bunker walls on Subzero Station', () => {
    const obs = getMapObstacles('Subzero Station');
    assert.strictEqual(obs, SUBZERO_STATION_OBSTACLES);

    // Ray through Main Command Center bunker [-8, 0, -6] to [8, 4, 6]
    const p1: [number, number, number] = [0, 2, -15];
    const p2: [number, number, number] = [0, 2, 15];
    const los = hasLineOfSight(p1, p2, obs);
    assert.strictEqual(los, false, 'Line of sight through bunker main building must be blocked');
  });
});

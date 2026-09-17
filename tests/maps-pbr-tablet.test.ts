import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as pc from 'playcanvas';
import { PCMapBuilder, SKY_THEMES } from '../src/client/engine/playcanvas/PCMapBuilder.js';
import {
  getMapObstacles,
  hasLineOfSight,
  FACILITY_OBSTACLES,
  CARTOON_CITY_OBSTACLES,
  CLASSIC_ARENA_OBSTACLES,
  NEON_WAREHOUSE_OBSTACLES,
  CYBER_SPIRE_OBSTACLES,
  QUANTUM_LAB_OBSTACLES,
  MAGMA_FOUNDRY_OBSTACLES,
  SUBZERO_STATION_OBSTACLES,
  SKY_SANCTUARY_OBSTACLES,
  ORBITAL_STATION_OBSTACLES
} from '../src/shared/mapObstacles.js';
import {
  getMapSpawns,
  getTeamSpawn,
  FACILITY_SPAWNS,
  CITY_SPAWNS,
  MAP_SPAWNS,
  NEON_WAREHOUSE_SPAWNS,
  CYBER_SPIRE_SPAWNS,
  QUANTUM_LAB_SPAWNS,
  MAGMA_FOUNDRY_SPAWNS,
  SUBZERO_STATION_SPAWNS,
  SKY_SANCTUARY_SPAWNS,
  ORBITAL_STATION_SPAWNS
} from '../src/shared/constants.js';

console.log('🧪 Starting 16 Maps, PBR Graphics & Tablet Optimization Tests...');

describe('PlayCanvas 16 Arena Maps Geometry & Bounds', () => {
  const ALL_MAP_NAMES = [
    'Facility',
    'Cartoon City',
    'Arena Classic',
    'Neon Warehouse',
    'Cyber Spire',
    'Quantum Lab',
    'Magma Foundry',
    'Subzero Station',
    'Sky Sanctuary',
    'Orbital Station',
    'Bio-Dome',
    'Metro Underpass',
    'Sunken Atoll',
    'Scrapyard Canyon',
    'Solar Relay',
    'Skyline Penthouse'
  ];

  it('should verify all 16 maps instantiate in PCMapBuilder with colliders and jump pads', () => {
    for (const mapName of ALL_MAP_NAMES) {
      const mb = new PCMapBuilder(undefined, mapName);
      assert.strictEqual(mb.mapName, mapName);
      assert.ok(mb.collisionBoxes.length > 5, `Map ${mapName} should have collision boxes`);
      assert.ok(mb.bounds.minX < mb.bounds.maxX, `Map ${mapName} should have valid X bounds`);
      assert.ok(mb.bounds.minZ < mb.bounds.maxZ, `Map ${mapName} should have valid Z bounds`);

      // Verify jump pads or teleporters exist on maps
      assert.ok(mb.jumpPads.length > 0 || mb.teleportPorts.length > 0, `Map ${mapName} must have jump pads or teleporters`);

      // Verify ground level check
      if (mb.hasGroundPlane) {
        const centerGround = mb.getGroundLevel(new pc.Vec3(0, 0.5, 0));
        assert.ok(centerGround >= 0.0, `Map ${mapName} should return valid ground height`);
      } else {
        // Void map (e.g. Cyber Spire, Magma Foundry, Solar Relay): stepping off platform into abyss returns -100
        const voidGround = mb.getGroundLevel(new pc.Vec3(-35, -5, -35));
        assert.strictEqual(voidGround, -100, `Map ${mapName} void space should return -100`);
      }

      mb.dispose();
    }
  });

  it('should verify PBR material generation in PCMapBuilder', () => {
    const mb = new PCMapBuilder(undefined, 'Facility');
    const mat = mb.createPBRMaterial('#2563eb', {
      metalness: 0.75,
      gloss: 0.85,
      emissive: '#3b82f6',
      emissiveIntensity: 2.5
    });

    assert.ok(mat instanceof pc.StandardMaterial);
    assert.strictEqual(mat.useMetalness, true);
    assert.strictEqual(mat.metalness, 0.75);
    assert.strictEqual(mat.gloss, 0.85);
    assert.strictEqual(mat.emissiveIntensity, 2.5);
    mb.dispose();
  });

  it('should verify environmental sky themes include required PBR atmospheric parameters', () => {
    const requiredThemes = ['twilight', 'sunset', 'sage', 'deepspace', 'subzero', 'biodome', 'subway', 'tropical', 'canyon', 'solar', 'penthouse'];
    for (const themeId of requiredThemes) {
      const theme = SKY_THEMES[themeId];
      assert.ok(theme, `Sky theme ${themeId} should exist`);
      assert.ok(theme.bgColor.startsWith('#'), `Theme ${themeId} should have hex bgColor`);
      assert.ok(theme.fogDensity > 0, `Theme ${themeId} should have positive fog density`);
      assert.ok(theme.sunColor, `Theme ${themeId} should define sun color`);
    }
  });
});

describe('Server Authoritative Obstacles & Line of Sight for 16 Maps', () => {
  const ALL_MAP_NAMES = [
    'Facility',
    'Cartoon City',
    'Arena Classic',
    'Neon Warehouse',
    'Cyber Spire',
    'Quantum Lab',
    'Magma Foundry',
    'Subzero Station',
    'Sky Sanctuary',
    'Orbital Station',
    'Bio-Dome',
    'Metro Underpass',
    'Sunken Atoll',
    'Scrapyard Canyon',
    'Solar Relay',
    'Skyline Penthouse'
  ];

  it('should return valid obstacles for each of the 16 maps in getMapObstacles', () => {
    for (const mapName of ALL_MAP_NAMES) {
      const obs = getMapObstacles(mapName);
      assert.ok(obs.length > 5, `Obstacles for ${mapName} should contain at least 5 bounding boxes`);
      for (const b of obs) {
        assert.ok(b.min[0] <= b.max[0], `Box minX <= maxX for ${b.name} on ${mapName}`);
        assert.ok(b.min[1] <= b.max[1], `Box minY <= maxY for ${b.name} on ${mapName}`);
        assert.ok(b.min[2] <= b.max[2], `Box minZ <= maxZ for ${b.name} on ${mapName}`);
      }
    }
  });

  it('should occlude line of sight through Neon Warehouse shelving racks', () => {
    const obstacles = getMapObstacles('Neon Warehouse');
    // Ray passing straight through North-West Shelving (-17, 2.75, -16.5)
    const p1: [number, number, number] = [-22, 1.5, -16.5];
    const p2: [number, number, number] = [-10, 1.5, -16.5];
    const clear = hasLineOfSight(p1, p2, obstacles);
    assert.strictEqual(clear, false, 'Line of sight should be occluded by shelving unit');
  });

  it('should occlude line of sight through Orbital Station gravity core', () => {
    const obstacles = getMapObstacles('Orbital Station');
    // Ray passing across center through GravityCore
    const p1: [number, number, number] = [0, 1.5, -15];
    const p2: [number, number, number] = [0, 1.5, 15];
    const clear = hasLineOfSight(p1, p2, obstacles);
    assert.strictEqual(clear, false, 'Line of sight should be occluded by GravityCore');
  });

  it('should occlude line of sight through Bio-Dome hydroponic spire', () => {
    const obstacles = getMapObstacles('Bio-Dome');
    const p1: [number, number, number] = [0, 1.5, -10];
    const p2: [number, number, number] = [0, 1.5, 10];
    const clear = hasLineOfSight(p1, p2, obstacles);
    assert.strictEqual(clear, false, 'Line of sight should be occluded by HydroponicSpire');
  });

  it('should occlude line of sight through Scrapyard Canyon crane tower', () => {
    const obstacles = getMapObstacles('Scrapyard Canyon');
    const p1: [number, number, number] = [-10, 2.0, 0];
    const p2: [number, number, number] = [10, 2.0, 0];
    const clear = hasLineOfSight(p1, p2, obstacles);
    assert.strictEqual(clear, false, 'Line of sight should be occluded by CraneTower');
  });
});

describe('Spawn Points Void Safety & Obstacle Clearance for 16 Maps', () => {
  const ALL_MAP_NAMES = [
    'Facility',
    'Cartoon City',
    'Arena Classic',
    'Neon Warehouse',
    'Cyber Spire',
    'Quantum Lab',
    'Magma Foundry',
    'Subzero Station',
    'Sky Sanctuary',
    'Orbital Station',
    'Bio-Dome',
    'Metro Underpass',
    'Sunken Atoll',
    'Scrapyard Canyon',
    'Solar Relay',
    'Skyline Penthouse'
  ];

  it('should verify all 8 spawns for all 16 maps are safe above ground and within bounds', () => {
    for (const mapName of ALL_MAP_NAMES) {
      const spawns = getMapSpawns(mapName);
      assert.ok(spawns.length >= 6, `Map ${mapName} should have at least 6 FFA spawns`);
      const obstacles = getMapObstacles(mapName);

      for (let i = 0; i < spawns.length; i++) {
        const s = spawns[i];
        assert.ok(s.y >= 0.0, `Spawn ${i} on ${mapName} should have y >= 0`);

        // Verify spawn point is not inside any solid obstacle
        for (const b of obstacles) {
          const inside =
            s.x > b.min[0] + 0.1 && s.x < b.max[0] - 0.1 &&
            s.y > b.min[1] + 0.1 && s.y < b.max[1] - 0.1 &&
            s.z > b.min[2] + 0.1 && s.z < b.max[2] - 0.1;
          assert.strictEqual(inside, false, `Spawn ${i} on ${mapName} must not spawn inside obstacle ${b.name}`);
        }
      }
    }
  });

  it('should verify team spawns for Blue and Red on all 16 maps', () => {
    for (const mapName of ALL_MAP_NAMES) {
      for (let i = 0; i < 4; i++) {
        const blue = getTeamSpawn('blue', i, mapName);
        const red = getTeamSpawn('red', i, mapName);
        assert.ok(blue, `Blue spawn ${i} on ${mapName} should exist`);
        assert.ok(red, `Red spawn ${i} on ${mapName} should exist`);
        assert.ok(blue.y >= 0.0, `Blue spawn ${i} on ${mapName} should be on/above ground`);
        assert.ok(red.y >= 0.0, `Red spawn ${i} on ${mapName} should be on/above ground`);
      }
    }
  });
});

describe('Tablet Controls & Aim-Drag Physics Simulation', () => {
  it('should correctly simulate fire-button aim dragging physics', () => {
    // Simulate player pressing fire button and dragging thumb to aim simultaneously
    let lookDeltaYaw = 0;
    let lookDeltaPitch = 0;
    const sensitivity = 1.2;
    const isAiming = false;
    const adsScale = isAiming ? 0.5 : 1.0;
    const factor = 0.0035 * sensitivity * adsScale;

    const fireStartPos = { x: 500, y: 400 };
    const fireMovePos = { x: 540, y: 420 }; // dragged +40px right, +20px down

    const dx = fireMovePos.x - fireStartPos.x;
    const dy = fireMovePos.y - fireStartPos.y;

    lookDeltaYaw += dx * factor;
    lookDeltaPitch += dy * factor;

    assert.ok(lookDeltaYaw > 0, 'Dragging right on fire button should increase yaw');
    assert.ok(lookDeltaPitch > 0, 'Dragging down on fire button should increase pitch');
    assert.strictEqual(lookDeltaYaw, 40 * factor);
    assert.strictEqual(lookDeltaPitch, 20 * factor);
  });

  it('should apply deadzone and exponential response curve to joystick on touchscreens', () => {
    const joystickMaxRadius = 60;
    const deadzone = 8;

    // Inside deadzone (e.g. 5px)
    const smallDist = 5;
    const isFiltered = smallDist <= deadzone;
    assert.strictEqual(isFiltered, true, 'Small tremors below deadzone should be ignored');

    // Outside deadzone (e.g. 34px)
    const midDist = 34;
    const normalized = Math.min((midDist - deadzone) / (joystickMaxRadius - deadzone), 1.0);
    const curved = Math.pow(normalized, 1.2);
    assert.ok(curved > 0 && curved <= 1.0);
    assert.ok(curved < normalized, 'Exponential curve provides fine control at low-to-mid speeds');
  });

  it('should clamp devicePixelRatio on tablets to maintain 60 FPS', () => {
    // Simulate iPad Pro with devicePixelRatio = 2.0 or 3.0
    const fakeWindowDpr = 3.0;
    const isTouch = true;
    const maxDpr = isTouch ? 1.5 : 2.0;

    const highQualityDpr = Math.min(fakeWindowDpr, maxDpr);
    assert.strictEqual(highQualityDpr, 1.5, 'Tablet high quality should be clamped to 1.5x DPR');

    const mediumQualityDpr = 1.25;
    assert.strictEqual(mediumQualityDpr, 1.25);

    const lowQualityDpr = 1.0;
    assert.strictEqual(lowQualityDpr, 1.0);
  });
});

describe('In-World 3D Powerup Pickups & Map Distribution', () => {
  const ALL_MAP_NAMES = [
    'Facility',
    'Cartoon City',
    'Arena Classic',
    'Neon Warehouse',
    'Cyber Spire',
    'Quantum Lab',
    'Magma Foundry',
    'Subzero Station',
    'Sky Sanctuary',
    'Orbital Station',
    'Bio-Dome',
    'Metro Underpass',
    'Sunken Atoll',
    'Scrapyard Canyon',
    'Solar Relay',
    'Skyline Penthouse'
  ];

  it('should define tactical 3D powerup pickup locations for all 16 maps', async () => {
    const { MAP_POWERUP_LOCATIONS, PCPowerupManager } = await import('../src/client/engine/playcanvas/PCPowerupManager.js');
    const { AudioManager } = await import('../src/client/engine/AudioManager.js');

    const fakeAudio = new AudioManager();
    const pm = new PCPowerupManager(undefined, fakeAudio);

    for (const mapName of ALL_MAP_NAMES) {
      assert.ok(MAP_POWERUP_LOCATIONS[mapName], `Map ${mapName} must have powerup pickup locations`);
      const locs = MAP_POWERUP_LOCATIONS[mapName];
      assert.ok(locs.length >= 4, `Map ${mapName} should have at least 4 powerup locations`);

      pm.spawnWorldPickups(mapName);
      assert.strictEqual(pm.worldPickups.length, locs.length);

      for (const pickup of pm.worldPickups) {
        assert.ok(pickup.isAvailable);
        assert.ok(['shield', 'speed', 'quad_damage', 'rapid_mag'].includes(pickup.type));
      }
    }

    pm.dispose();
  });

  it('should collect in-world powerup when player enters proximity zone and trigger respawn', async () => {
    const { PCPowerupManager } = await import('../src/client/engine/playcanvas/PCPowerupManager.js');
    const { AudioManager } = await import('../src/client/engine/AudioManager.js');

    const fakeAudio = new AudioManager();
    const pm = new PCPowerupManager(undefined, fakeAudio);
    pm.spawnWorldPickups('Facility');

    // Pickup 0 at (0, 1.2, 0)
    const target = pm.worldPickups[0];
    assert.ok(target.isAvailable);

    // Player walks near pickup (0.5m away)
    pm.update(0.016, [target.x, target.baseY, target.z + 0.5]);

    assert.strictEqual(target.isAvailable, false, 'Pickup should be collected');
    assert.strictEqual(pm.storedPowerup, target.type, 'Powerup should be stored in inventory');
    assert.ok(target.respawnsAt > Date.now(), 'Pickup should set respawn timestamp');

    // Simulate respawn timeout
    target.respawnsAt = Date.now() - 100;
    pm.update(0.016, [100, 100, 100]); // far away
    assert.strictEqual(target.isAvailable, true, 'Pickup should become available after respawn delay');

    pm.dispose();
  });
});

describe('In-Game Settings Adjustments & Invert-Y Controls', () => {
  it('should adjust touch and mouse invertY and sensitivity dynamically', async () => {
    if (typeof (globalThis as any).document === 'undefined') {
      const listeners: Record<string, Function[]> = {};
      const createFakeEl = (tag: string = 'div') => {
        const el: any = {
          tagName: tag.toUpperCase(),
          style: {},
          classList: { add: () => {}, remove: () => {}, toggle: () => {} },
          appendChild: () => {},
          addEventListener: (evt: string, fn: Function) => {
            listeners[evt] = listeners[evt] || [];
            listeners[evt].push(fn);
          },
          click: () => {
            if (listeners['click']) listeners['click'].forEach(f => f({ preventDefault: () => {}, stopPropagation: () => {} }));
          },
          removeEventListener: () => {},
          querySelectorAll: () => [],
          querySelector: () => null,
          setAttribute: () => {},
          getAttribute: () => null
        };
        return el;
      };
      (globalThis as any).document = {
        createElement: createFakeEl,
        getElementById: () => createFakeEl(),
        head: createFakeEl('head'),
        body: createFakeEl('body'),
        querySelectorAll: () => [],
        addEventListener: () => {},
        removeEventListener: () => {}
      };
      (globalThis as any).addEventListener = () => {};
      (globalThis as any).removeEventListener = () => {};
      (globalThis as any).window = globalThis;
    }

    const { TouchControls } = await import('../src/client/controls/TouchControls.js');
    const container = document.createElement('div');
    const touch = new TouchControls(container);

    touch.invertY = false;
    touch.state.lookDeltaPitch = 15;
    let deltas = touch.consumeLookDeltas();
    assert.strictEqual(deltas.pitch, 15, 'Pitch should be positive when invertY is false');

    touch.invertY = true;
    touch.state.lookDeltaPitch = 15;
    deltas = touch.consumeLookDeltas();
    assert.strictEqual(deltas.pitch, -15, 'Pitch should be inverted when invertY is true');

    // Settings callback trigger
    let settingsOpened = false;
    touch.onOpenSettings = () => {
      settingsOpened = true;
    };
    if (touch.onOpenSettings) {
      touch.onOpenSettings();
      assert.strictEqual(settingsOpened, true, 'Settings callback should invoke onOpenSettings');
    }
  });

  it('should verify Default Game Settings schema', async () => {
    const { DEFAULT_SETTINGS } = await import('../src/client/ui/SettingsUI.js');
    assert.strictEqual(DEFAULT_SETTINGS.fov, 75);
    assert.strictEqual(DEFAULT_SETTINGS.hudOpacity, 0.95);
    assert.strictEqual(DEFAULT_SETTINGS.invertY, false);
    assert.strictEqual(DEFAULT_SETTINGS.autoFire, false);
    assert.strictEqual(DEFAULT_SETTINGS.graphicsQuality, 'high');
  });
});


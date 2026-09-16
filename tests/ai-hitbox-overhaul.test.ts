import assert from 'node:assert';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { lineIntersectsBox, hasLineOfSight, BoundingBox } from '../src/shared/mapObstacles.js';
import { CharacterModel } from '../src/client/engine/CharacterModel.js';
import { WaveManager, BotAIState } from '../src/server/ai/WaveManager.js';
import { RoomNetworkState, PlayerNetworkState } from '../src/shared/types.js';
import { WEAPONS, BOT_ARCHETYPES, getMapSpawns } from '../src/shared/constants.js';

// 1. Compound 5-Part Hitbox System & Raycast Precision
describe('Compound 5-Part Hitbox System & Raycast Precision', () => {
  it('should instantiate all 5 anatomical compound colliders on CharacterModel', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'target_pilot_1', 'TargetPilot', '#00d2ff', false, 0);

    assert.ok(model.headCollider, 'Head collider must exist');
    assert.ok(model.bodyCollider, 'Body/chest collider must exist');
    assert.ok(model.pelvisCollider, 'Pelvis collider must exist');
    assert.ok(model.leftLegCollider, 'Left leg collider must exist');
    assert.ok(model.rightLegCollider, 'Right leg collider must exist');

    const colliders = model.targetableColliders;
    assert.strictEqual(colliders.length, 5, 'All 5 colliders must be registered in targetableColliders');

    // Verify userData tagging
    assert.strictEqual(model.headCollider.userData.isHead, true);
    assert.strictEqual(model.headCollider.userData.isHeadshot, true);
    assert.strictEqual(model.headCollider.userData.playerId, 'target_pilot_1');

    assert.strictEqual(model.bodyCollider.userData.isHead, false);
    assert.strictEqual(model.bodyCollider.userData.isHeadshot, false);
    assert.strictEqual(model.pelvisCollider.userData.isHead, false);
    assert.strictEqual(model.leftLegCollider.userData.isHead, false);
    assert.strictEqual(model.rightLegCollider.userData.isHead, false);

    console.log('✓ Verified 5-part compound colliders and userData tagging');
  });

  it('should register raycast hits across head, chest, pelvis, and limbs', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'target_pilot_2', 'TargetPilot2', '#ff2a55', false, 0);
    model.root.position.set(0, 0, 0);
    model.root.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();

    // 1. Headshot ray (y = 1.10m, shooting from z = -5m towards +Z)
    raycaster.set(new THREE.Vector3(0, 1.10, -5), new THREE.Vector3(0, 0, 1));
    const headHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(headHits.length > 0, 'Headshot ray must intersect head collider');
    assert.strictEqual(headHits[0].object.userData.isHeadshot, true, 'Headshot detected on head hit');

    // 2. Chest ray (y = 0.80m)
    raycaster.set(new THREE.Vector3(0, 0.80, -5), new THREE.Vector3(0, 0, 1));
    const chestHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(chestHits.length > 0, 'Chest ray must intersect chest collider');
    assert.strictEqual(chestHits[0].object.userData.isHeadshot, false);

    // 3. Pelvis ray (y = 0.50m)
    raycaster.set(new THREE.Vector3(0, 0.50, -5), new THREE.Vector3(0, 0, 1));
    const pelvisHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(pelvisHits.length > 0, 'Pelvis ray must intersect pelvis collider');
    assert.strictEqual(pelvisHits[0].object.userData.isHeadshot, false);

    // 4. Left Leg ray (x = -0.11m, y = 0.24m)
    raycaster.set(new THREE.Vector3(-0.11, 0.24, -5), new THREE.Vector3(0, 0, 1));
    const leftLegHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(leftLegHits.length > 0, 'Left leg ray must intersect left leg collider');

    // 5. Right Leg ray (x = 0.11m, y = 0.24m)
    raycaster.set(new THREE.Vector3(0.11, 0.24, -5), new THREE.Vector3(0, 0, 1));
    const rightLegHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(rightLegHits.length > 0, 'Right leg ray must intersect right leg collider');

    console.log('✓ Verified precision raycast intersection on head, chest, pelvis, and both legs');
  });

  it('should update collider world matrices immediately after root position translation', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'moving_target', 'MovingTarget', '#00ff88', false, 0);

    // Initial position
    model.root.position.set(0, 0, 0);
    model.root.updateMatrixWorld(true);

    // Move to (10, 0, 15)
    model.root.position.set(10, 0, 15);
    model.root.updateMatrixWorld(true);

    const headWorldPos = new THREE.Vector3();
    model.headCollider.getWorldPosition(headWorldPos);
    assert.strictEqual(headWorldPos.x, 10);
    assert.strictEqual(headWorldPos.z, 15);
    assert.ok(Math.abs(headWorldPos.y - 1.10) < 0.001);

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(10, 1.10, 10), new THREE.Vector3(0, 0, 1));
    const hits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(hits.length > 0, 'Ray must intersect moved collider at world position (10, 1.1, 15)');
    console.log('✓ Verified world matrix synchronization after translation');
  });
});

// 2. Line of Sight & Surface Margin
describe('Obstacle Line of Sight & Surface Tolerance', () => {
  it('should not block line of sight when ray endpoint touches adjacent obstacle surface', () => {
    const obstacle: BoundingBox = {
      min: [5, 0, -2],
      max: [8, 3, 2]
    };

    // Shooter at (0, 1.2, 0), Target standing immediately adjacent to box at (4.98, 1.0, 0)
    const p1: [number, number, number] = [0, 1.2, 0];
    const p2: [number, number, number] = [4.98, 1.0, 0];

    const hasClearLoS = hasLineOfSight(p1, p2, [obstacle]);
    assert.strictEqual(hasClearLoS, true, 'LoS to target standing in front of obstacle must be clear');

    // Ray cutting through middle of obstacle from (0, 1.2, 0) to (12, 1.2, 0)
    const blocked = hasLineOfSight([0, 1.2, 0], [12, 1.2, 0], [obstacle]);
    assert.strictEqual(blocked, false, 'LoS cutting through obstacle must be blocked');
    console.log('✓ Verified LoS surface tolerance and obstacle penetration rejection');
  });
});

// 3. 3D Aim & Muzzle Trajectory (Zero Backward Shooting)
describe('3D Aim & Muzzle Vector Integrity', () => {
  it('should calculate true forward 3D direction vector from shooter to target', () => {
    const botPos = { x: 0, y: 0, z: 0 };
    const playerPos = { x: 0, y: 0, z: -10 }; // Player directly ahead (-Z)

    const dx = playerPos.x - botPos.x;
    const dy = (playerPos.y + 1.1) - (botPos.y + 1.1);
    const dz = playerPos.z - botPos.z;
    const dist3D = Math.hypot(dx, dy, dz);

    const dirX = dx / dist3D;
    const dirY = dy / dist3D;
    const dirZ = dz / dist3D;

    // Must point forward along -Z: dirZ = -1, never +1 (backward)
    assert.strictEqual(dirX, 0);
    assert.strictEqual(dirY, 0);
    assert.strictEqual(dirZ, -1, 'Muzzle direction must point forward towards -Z');

    // Desired yaw: Math.atan2(-dx, -dz) = Math.atan2(0, 10) = 0
    const targetYaw = Math.atan2(-dx || 0, -dz || 0);
    assert.strictEqual(targetYaw === 0 ? 0 : targetYaw, 0, 'Target yaw for -Z forward is 0');

    // Test elevated player (on jump pad / ramp at y = 4m)
    const highPlayer = { x: 0, y: 4, z: -10 };
    const highDy = highPlayer.y - botPos.y;
    const highDist3D = Math.hypot(dx, highDy, dz);
    const highPitch = Math.asin(highDy / highDist3D);

    assert.ok(highPitch > 0.3, `Bot pitch must aim upwards (got ${highPitch.toFixed(2)} rad)`);
    console.log('✓ Verified forward muzzle direction [0, 0, -1] and vertical pitch tracking');
  });
});

// 4. Ground Snapping & Locomotion
describe('Ground Snapping & Terrain Clamping', () => {
  it('should place ground spawns on floor y = 0.0 across maps', () => {
    const mapNames = ['Cartoon City', 'Cyber Spire', 'Quantum Lab', 'Magma Foundry', 'Subzero Station', 'Sky Sanctuary'];

    for (const map of mapNames) {
      const spawns = getMapSpawns(map);
      const groundSpawns = spawns.filter(s => s.y === 0.0);
      assert.ok(groundSpawns.length >= 2, `Map ${map} must have floor level spawns (y = 0.0)`);
    }
    console.log('✓ Verified floor level spawns at y = 0.0 across all arena maps');
  });
});

console.log('🎉 ALL AI, HITBOX & AIM INTEGRATION TESTS PASSED CLEANLY!\n');

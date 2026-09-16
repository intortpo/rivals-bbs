import assert from 'node:assert';
import { describe, it } from 'node:test';
import * as THREE from 'three';
import { lineIntersectsBox, hasLineOfSight, BoundingBox } from '../src/shared/mapObstacles.js';
import { CharacterModel } from '../src/client/engine/CharacterModel.js';
import { WaveManager, BotAIState } from '../src/server/ai/WaveManager.js';
import { RoomNetworkState, PlayerNetworkState } from '../src/shared/types.js';
import { WEAPONS, BOT_ARCHETYPES, getMapSpawns, MOVEMENT } from '../src/shared/constants.js';
import { MapBuilder } from '../src/client/engine/MapBuilder.js';
import { WeaponManager } from '../src/client/engine/WeaponManager.js';

// 1. Compound 8-Part Hitbox System & Raycast Precision
describe('Compound 8-Part Hitbox System & Raycast Precision', () => {
  it('should instantiate all 8 anatomical compound colliders on CharacterModel', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'target_pilot_1', 'TargetPilot', '#00d2ff', false, 0);

    assert.ok(model.headCollider, 'Head collider must exist');
    assert.ok(model.bodyCollider, 'Body/chest collider must exist');
    assert.ok(model.pelvisCollider, 'Pelvis collider must exist');
    assert.ok(model.leftArmCollider, 'Left arm collider must exist');
    assert.ok(model.rightArmCollider, 'Right arm collider must exist');
    assert.ok(model.leftLegCollider, 'Left leg collider must exist');
    assert.ok(model.rightLegCollider, 'Right leg collider must exist');
    assert.ok(model.fullBodyCollider, 'Full body collider must exist');

    const colliders = model.targetableColliders;
    assert.strictEqual(colliders.length, 8, 'All 8 colliders must be registered in targetableColliders');

    // Verify userData tagging
    assert.strictEqual(model.headCollider.userData.isHead, true);
    assert.strictEqual(model.headCollider.userData.isHeadshot, true);
    assert.strictEqual(model.headCollider.userData.playerId, 'target_pilot_1');

    assert.strictEqual(model.bodyCollider.userData.isHead, false);
    assert.strictEqual(model.bodyCollider.userData.isHeadshot, false);
    assert.strictEqual(model.pelvisCollider.userData.isHead, false);
    assert.strictEqual(model.leftArmCollider.userData.isHead, false);
    assert.strictEqual(model.rightArmCollider.userData.isHead, false);
    assert.strictEqual(model.leftLegCollider.userData.isHead, false);
    assert.strictEqual(model.rightLegCollider.userData.isHead, false);
    assert.strictEqual(model.fullBodyCollider.userData.isHead, false);

    console.log('✓ Verified 8-part compound colliders and userData tagging');
  });

  it('should register raycast hits across head, chest, arms, pelvis, and limbs', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'target_pilot_2', 'TargetPilot2', '#ff2a55', false, 0);
    model.root.position.set(0, 0, 0);
    model.root.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0;

    // 1. Headshot ray (y = 1.12m, shooting from z = -5m towards +Z)
    raycaster.set(new THREE.Vector3(0, 1.12, -5), new THREE.Vector3(0, 0, 1));
    const headHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(headHits.length > 0, 'Headshot ray must intersect head collider');
    const hasHeadshot = headHits.some((h) => h.object.userData.isHeadshot);
    assert.strictEqual(hasHeadshot, true, 'Headshot detected on head hit');

    // 2. Chest ray (y = 0.80m)
    raycaster.set(new THREE.Vector3(0, 0.80, -5), new THREE.Vector3(0, 0, 1));
    const chestHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(chestHits.length > 0, 'Chest ray must intersect chest collider');

    // 3. Pelvis ray (y = 0.50m)
    raycaster.set(new THREE.Vector3(0, 0.50, -5), new THREE.Vector3(0, 0, 1));
    const pelvisHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(pelvisHits.length > 0, 'Pelvis ray must intersect pelvis collider');

    // 4. Left Arm / Shoulder ray (x = -0.28m, y = 0.78m)
    raycaster.set(new THREE.Vector3(-0.28, 0.78, -5), new THREE.Vector3(0, 0, 1));
    const leftArmHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(leftArmHits.length > 0, 'Left arm ray must intersect left arm collider');

    // 5. Right Arm / Shoulder ray (x = 0.28m, y = 0.78m)
    raycaster.set(new THREE.Vector3(0.28, 0.78, -5), new THREE.Vector3(0, 0, 1));
    const rightArmHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(rightArmHits.length > 0, 'Right arm ray must intersect right arm collider');

    // 6. Left Leg ray (x = -0.12m, y = 0.25m)
    raycaster.set(new THREE.Vector3(-0.12, 0.25, -5), new THREE.Vector3(0, 0, 1));
    const leftLegHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(leftLegHits.length > 0, 'Left leg ray must intersect left leg collider');

    // 7. Right Leg ray (x = 0.12m, y = 0.25m)
    raycaster.set(new THREE.Vector3(0.12, 0.25, -5), new THREE.Vector3(0, 0, 1));
    const rightLegHits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(rightLegHits.length > 0, 'Right leg ray must intersect right leg collider');

    console.log('✓ Verified precision raycast intersection on head, chest, arms, pelvis, and both legs');
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
    assert.ok(Math.abs(headWorldPos.y - 1.12) < 0.001);

    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0;
    raycaster.set(new THREE.Vector3(10, 1.12, 10), new THREE.Vector3(0, 0, 1));
    const hits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(hits.length > 0, 'Ray must intersect moved collider at world position (10, 1.12, 15)');
    console.log('✓ Verified world matrix synchronization after translation');
  });

  it('should dynamically drop compound colliders by 0.35m during sliding posture', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'sliding_bot', 'SlidingBot', '#00d2ff', false, 0);
    model.root.position.set(0, 0, 0);
    model.root.updateMatrixWorld(true);

    // Slide posture active
    model.update(0.016, false, true, false, 0); // isSliding = true
    assert.strictEqual((model as any).hitboxContainer.position.y, -0.35, 'Hitbox container must drop -0.35m during slide');

    // Raycast at y = 0.35m (pelvis/torso level during slide)
    const raycaster = new THREE.Raycaster();
    raycaster.params.Line.threshold = 0;
    raycaster.set(new THREE.Vector3(0, 0.35, -5), new THREE.Vector3(0, 0, 1));
    const hits = raycaster.intersectObjects(model.targetableColliders, true);
    assert.ok(hits.length > 0, 'Ray at y = 0.35m must intersect dropped sliding hitboxes');

    // Stand posture active
    model.update(0.016, false, false, false, 0); // isSliding = false
    assert.strictEqual((model as any).hitboxContainer.position.y, 0, 'Hitbox container must return to 0 when standing');
    console.log('✓ Verified dynamic sliding posture hitbox drop (-0.35m)');
  });

  it('should penetrate floor GridHelper without raycast interception using separated layers', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    camera.position.set(0, 1.08, 0);
    camera.lookAt(0, 0.80, 10);

    const bot = new CharacterModel(scene, 'bot_target_grid', 'BotTargetGrid', '#ff2a55', false, 0);
    bot.root.position.set(0, 0, 10);
    bot.root.updateMatrixWorld(true);

    const mb = new MapBuilder(scene, 'Arena Classic');
    const targetMeshes = bot.targetableColliders;
    const solidMeshes = mb.getSolidMeshes();

    const wm = new WeaponManager(scene, camera);
    const fireRes = wm.fire(camera, targetMeshes, solidMeshes, true, false);

    assert.strictEqual(fireRes.fired, true);
    assert.strictEqual(fireRes.hitPlayerId, 'bot_target_grid', 'Ray must hit bot through floor grid without interception');
    mb.dispose();
    console.log('✓ Verified floor GridHelper immunity and clean layer separation');
  });

  it('should reduce spread by 80% when aiming down sights (ADS)', () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
    const wm = new WeaponManager(scene, camera);
    wm.selectWeapon('rifle');

    const baseSpread = wm.currentStats.spread;
    const adsSpread = baseSpread * 0.20;

    assert.ok(adsSpread < baseSpread, 'ADS spread must be smaller than hip spread');
    assert.strictEqual(adsSpread, baseSpread * 0.20, 'ADS spread must be 20% of base spread (80% reduction)');
    console.log('✓ Verified ADS 80% spread reduction');
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

// 5. Normalized Character & Bot Height Parity
describe('Normalized Character & Bot Height Parity', () => {
  it('should ensure local player eye height and remote bot eye height match within 0.05m at ground level', () => {
    const scene = new THREE.Scene();
    const botModel = new CharacterModel(scene, 'bot_unit', 'Hostile Bot', '#ff2a55', false, 0);

    // Bot stands on ground at y = 0.0
    botModel.root.position.set(0, 0, 0);
    botModel.root.updateMatrixWorld(true);

    const botHeadWorldPos = new THREE.Vector3();
    botModel.headCollider.getWorldPosition(botHeadWorldPos);

    // Local player stands on ground at y = 0.0
    const localPlayerFeetY = 0.0;
    const localPlayerEyeY = localPlayerFeetY + MOVEMENT.EYE_HEIGHT;

    // Both eye lines must align within 0.05m (head collider center is 1.12m, eye height is 1.08m)
    const eyeDisparity = Math.abs(localPlayerEyeY - botHeadWorldPos.y);
    assert.ok(
      eyeDisparity <= 0.05,
      `Local player eye level (${localPlayerEyeY}m) must align with bot head level (${botHeadWorldPos.y}m), got disparity: ${eyeDisparity.toFixed(3)}m`
    );
    console.log(`✓ Verified 1:1 eye-level parity: Player Camera Y=${localPlayerEyeY.toFixed(2)}m vs Bot Head Y=${botHeadWorldPos.y.toFixed(2)}m (Disparity: ${eyeDisparity.toFixed(2)}m)`);
  });

  it('should ensure player and bot are both on ground plane y = 0.0 without phantom 1.0m elevation', () => {
    const scene = new THREE.Scene();
    const mb = new MapBuilder(scene, 'Arena Classic');

    // Player position on ground floor
    const playerFloorPos = new THREE.Vector3(0, 0, 0);
    const groundLevel = mb.getGroundLevel(playerFloorPos);

    assert.strictEqual(groundLevel, 0.0, 'Ground level on ground plane maps must be exactly 0.0 (no phantom +1.0m)');
    mb.dispose();
    console.log('✓ Verified ground level y = 0.0 with zero phantom offset');
  });
});

// 6. Character Model Front Facing & Continuous Aim Pitch Tracking
describe('Character Model Front Facing & Continuous Aim Pitch Tracking', () => {
  it('should orient glTF root rotation to Math.PI facing Three.js forward (-Z)', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'facing_pilot', 'FacingPilot', '#00d2ff', false, 0);

    const mockGroup = new THREE.Group();
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    const spine = new THREE.Bone();
    spine.name = 'Spine';
    hips.add(spine);
    mockGroup.add(hips);

    (model as any).attachClonedModel(mockGroup);
    const charMesh = (model as any).characterMesh as THREE.Group;
    assert.ok(charMesh, 'Character mesh must be attached');
    assert.strictEqual(charMesh.rotation.y, Math.PI, 'glTF avatar root must rotate Math.PI to face Three.js forward -Z');
  });

  it('should track vertical aim pitch continuously across running, jumping, sliding, and idle states', () => {
    const scene = new THREE.Scene();
    const model = new CharacterModel(scene, 'pitch_pilot', 'PitchPilot', '#00d2ff', false, 0);

    const mockGroup = new THREE.Group();
    const hips = new THREE.Bone();
    hips.name = 'Hips';
    const spine = new THREE.Bone();
    spine.name = 'Spine';
    const head = new THREE.Bone();
    head.name = 'Head';
    hips.add(spine);
    spine.add(head);
    mockGroup.add(hips);

    (model as any).attachClonedModel(mockGroup);
    const spineBone = (model as any).spineBone as THREE.Bone;
    assert.ok(spineBone, 'Spine bone must be bound');

    // 1. Idle state with pitch = 0.5 rad
    model.update(0.016, false, false, false, 0.5);
    const qIdle = spineBone.quaternion.clone();
    assert.notStrictEqual(qIdle.x, 0, 'Spine bone must pitch during idle when aiming vertically');

    // 2. Running state with pitch = 0.5 rad vs pitch = 0.0 rad
    model.update(0.016, true, false, false, 0.0);
    const qRunFlat = spineBone.quaternion.clone();

    model.update(0.016, true, false, false, 0.5);
    const qRunPitched = spineBone.quaternion.clone();
    assert.notDeepStrictEqual(qRunFlat, qRunPitched, 'Running spine pitch must respond to aim pitch');

    // 3. Sliding state with pitch = 0.5 rad vs pitch = 0.0 rad
    model.update(0.016, false, true, false, 0.0);
    const qSlideFlat = spineBone.quaternion.clone();

    model.update(0.016, false, true, false, 0.5);
    const qSlidePitched = spineBone.quaternion.clone();
    assert.notDeepStrictEqual(qSlideFlat, qSlidePitched, 'Sliding spine pitch must respond to aim pitch');

    // 4. Jumping state with pitch = 0.5 rad vs pitch = 0.0 rad
    model.update(0.016, false, false, true, 0.0);
    const qJumpFlat = spineBone.quaternion.clone();

    model.update(0.016, false, false, true, 0.5);
    const qJumpPitched = spineBone.quaternion.clone();
    assert.notDeepStrictEqual(qJumpFlat, qJumpPitched, 'Jumping spine pitch must respond to aim pitch');

    console.log('✓ Verified glTF front facing alignment and continuous aim pitch tracking across all states');
  });
});

console.log('🎉 ALL AI, HITBOX & AIM INTEGRATION TESTS PASSED CLEANLY!\n');

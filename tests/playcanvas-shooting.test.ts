import * as pc from 'playcanvas';
import { PCCharacterModel } from '../src/client/engine/playcanvas/PCCharacterModel.js';
import { PCGeometricBossModel } from '../src/client/engine/playcanvas/PCGeometricBossModel.js';
import { WEAPONS } from '../src/shared/constants.js';

console.log('🧪 Starting PlayCanvas Multiplayer Shooting & Hitbox Precision Tests...');

// ─────────────────────────────────────────────────────────────────────────────
// Section 1: PCCharacterModel Compound Hitbox System
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ PCCharacterModel 8-Part Compound Colliders');
const player = new PCCharacterModel(undefined, 'remote_player_1', 'blue', false);
player.setPosition(0, 0, 0);
player.setRotation(0);

const hitboxes = player.getHitboxes();
if (hitboxes.length !== 8) {
  console.error(`❌ Expected 8 compound hitboxes on character, got ${hitboxes.length}`);
  process.exit(1);
}

const headBox = hitboxes.find(hb => hb.part === 'head');
const chestBox = hitboxes.find(hb => hb.part === 'chest');
const pelvisBox = hitboxes.find(hb => hb.part === 'pelvis');
const leftLegBox = hitboxes.find(hb => hb.part === 'leftLeg');

if (!headBox || !chestBox || !pelvisBox || !leftLegBox) {
  console.error('❌ Missing core anatomical hitboxes in PCCharacterModel');
  process.exit(1);
}

if (!headBox.isHeadshot || headBox.part !== 'head') {
  console.error('❌ Head hitbox must have isHeadshot: true');
  process.exit(1);
}

if (chestBox.isHeadshot) {
  console.error('❌ Chest hitbox should have isHeadshot: false');
  process.exit(1);
}

// Head center should be higher than chest center
if (headBox.box.center.y <= chestBox.box.center.y) {
  console.error(`❌ Head Y (${headBox.box.center.y}) must be higher than Chest Y (${chestBox.box.center.y})`);
  process.exit(1);
}
console.log(`✓ Instantiated 8 compound hitboxes (Head Y=${headBox.box.center.y.toFixed(2)}m, Chest Y=${chestBox.box.center.y.toFixed(2)}m)`);

// ─────────────────────────────────────────────────────────────────────────────
// Section 2: Raycast Intersection Precision & Headshot Discrimination
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ PlayCanvas Raycast Hit Precision & Headshot Discrimination');

// Test 2.1: Fire ray directly into the head
const headRay = new pc.Ray(new pc.Vec3(0, headBox.box.center.y, -5), new pc.Vec3(0, 0, 1));
const hitPoint = new pc.Vec3();
let hitHead = false;

for (const hb of player.getHitboxes()) {
  if (hb.box.intersectsRay(headRay, hitPoint)) {
    if (hb.isHeadshot) {
      hitHead = true;
      break;
    }
  }
}
if (!hitHead) {
  console.error('❌ Failed to register headshot with forward ray into head center');
  process.exit(1);
}
console.log(`✓ Direct forward ray precision hits Head hitbox with isHeadshot=true at Z=${hitPoint.z.toFixed(2)}m`);

// Test 2.2: Fire ray directly into the chest
const chestRay = new pc.Ray(new pc.Vec3(0, chestBox.box.center.y, -5), new pc.Vec3(0, 0, 1));
let hitChest = false;
let headshotOnChestRay = false;

for (const hb of player.getHitboxes()) {
  if (hb.box.intersectsRay(chestRay, hitPoint)) {
    if (hb.part === 'chest') {
      hitChest = true;
    }
    if (hb.isHeadshot) {
      headshotOnChestRay = true;
    }
  }
}
if (!hitChest || headshotOnChestRay) {
  console.error('❌ Ray aimed at chest did not cleanly hit chest without triggering headshot');
  process.exit(1);
}
console.log('✓ Ray aimed at torso center cleanly hits Chest without erroneous headshot');

// Test 2.3: Whiffed shot (offset by 2m)
const missRay = new pc.Ray(new pc.Vec3(2.0, 1.45, -5), new pc.Vec3(0, 0, 1));
let anyHit = false;
for (const hb of player.getHitboxes()) {
  if (hb.box.intersectsRay(missRay, hitPoint)) {
    anyHit = true;
    break;
  }
}
if (anyHit) {
  console.error('❌ Off-target ray mistakenly intersected character hitbox');
  process.exit(1);
}
console.log('✓ Off-target ray (2m offset) properly misses all player colliders');

// ─────────────────────────────────────────────────────────────────────────────
// Section 3: Sliding Posture Dynamic Hitbox Lowering
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ Dynamic Sliding Posture Hitbox Drop');
const standingChestY = chestBox.box.center.y;
player.setSliding(true);
const slidingHitboxes = player.getHitboxes();
const slidingChestBox = slidingHitboxes.find(hb => hb.part === 'chest')!;

const yDrop = standingChestY - slidingChestBox.box.center.y;
if (yDrop < 0.25 || yDrop > 0.45) {
  console.error(`❌ Expected sliding height drop ~0.35m, got ${yDrop.toFixed(3)}m`);
  process.exit(1);
}

// Ray aimed at standing chest height should now pass over lowered chest or hit higher part
const standingChestRay = new pc.Ray(new pc.Vec3(0, standingChestY, -5), new pc.Vec3(0, 0, 1));
let hitSlidingChest = false;
for (const hb of slidingHitboxes) {
  if (hb.part === 'chest' && hb.box.intersectsRay(standingChestRay, hitPoint)) {
    hitSlidingChest = true;
  }
}
if (hitSlidingChest) {
  console.error('❌ Standing-height torso shot should miss lowered chest hitbox during slide');
  process.exit(1);
}
console.log(`✓ Sliding posture drops hitboxes by ${yDrop.toFixed(2)}m, allowing ducking under high shots`);

// Reset sliding
player.setSliding(false);

// ─────────────────────────────────────────────────────────────────────────────
// Section 4: 3D Translation & Yaw Rotation Hitbox Synchronisation
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ World Position & Yaw Rotation Synchronization');
player.setPosition(15, 2, -20);
player.setRotation(90); // Facing +X
const rotatedHitboxes = player.getHitboxes();
const rHead = rotatedHitboxes.find(hb => hb.part === 'head')!;

if (Math.abs(rHead.box.center.x - 15) > 0.5 || Math.abs(rHead.box.center.z - (-20)) > 0.5) {
  console.error('❌ Hitboxes did not update to world coordinates (15, 2, -20)');
  process.exit(1);
}
console.log(`✓ Hitbox centers accurately updated in world space: (${rHead.box.center.x.toFixed(1)}, ${rHead.box.center.y.toFixed(1)}, ${rHead.box.center.z.toFixed(1)})`);

// ─────────────────────────────────────────────────────────────────────────────
// Section 5: PCGeometricBossModel Procedural Colliders & Satellites
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ PCGeometricBossModel Core, Hull & Orbiting Satellites');
const boss = new PCGeometricBossModel(undefined, 'boss_1', '#ff0055');
boss.setPosition(0, 0, 0);

const bossHitboxes = boss.getHitboxes();
const coreHitbox = bossHitboxes.find(hb => hb.isHeadshot);
const hullHitbox = bossHitboxes.find(hb => hb.part === 'chest');
const satelliteHitboxes = bossHitboxes.filter(hb => hb.part === 'leftArm');

if (!coreHitbox || !hullHitbox || satelliteHitboxes.length !== 4) {
  console.error('❌ Expected Boss to have 1 Headshot Core, 1 Hull, and 4 Satellites');
  process.exit(1);
}

// Check satellite positions before and after update animation
const initialSat0X = satelliteHitboxes[0].box.center.x;
boss.updateAnimation(0.5); // Advance 0.5s of animation
const updatedBossHitboxes = boss.getHitboxes();
const updatedSat0X = updatedBossHitboxes.filter(hb => hb.part === 'leftArm')[0].box.center.x;

if (Math.abs(initialSat0X - updatedSat0X) < 0.01) {
  console.error('❌ Boss satellite hitboxes did not dynamically orbit during updateBoss');
  process.exit(1);
}
console.log('✓ Boss core headshot, hull, and 4 orbiting dynamic satellites verified');

// ─────────────────────────────────────────────────────────────────────────────
// Section 6: Raycast Simulation with Wall Occlusion & Weapon Damage
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ Weapon Damage Calculation & Obstacle Occlusion');

interface RaycastHitResult {
  hitPlayerId: string | null;
  isHeadshot: boolean;
  hitDistance: number;
  damage: number;
}

function simulateShot(
  origin: pc.Vec3,
  direction: pc.Vec3,
  weaponType: keyof typeof WEAPONS,
  targetHitboxes: { box: pc.BoundingBox; isHeadshot: boolean; playerId: string }[],
  obstacles: pc.BoundingBox[]
): RaycastHitResult {
  const normDir = direction.clone().normalize();
  const ray = new pc.Ray(origin, normDir);
  const hp = new pc.Vec3();

  // 1. Find nearest obstacle
  let nearestObstacleDist = Infinity;
  for (const obs of obstacles) {
    if (obs.intersectsRay(ray, hp)) {
      const dist = origin.distance(hp);
      if (dist < nearestObstacleDist) {
        nearestObstacleDist = dist;
      }
    }
  }

  // 2. Find nearest player hitbox
  let nearestHitboxDist = Infinity;
  let hitIsHeadshot = false;
  let hitPlayerId: string | null = null;

  for (const hb of targetHitboxes) {
    if (hb.box.intersectsRay(ray, hp)) {
      const dist = origin.distance(hp);
      if (dist < nearestHitboxDist) {
        nearestHitboxDist = dist;
        hitIsHeadshot = hb.isHeadshot;
        hitPlayerId = hb.playerId;
      }
    }
  }

  // 3. Occlusion test: If obstacle is closer than player hitbox, shot is blocked
  if (nearestObstacleDist < nearestHitboxDist) {
    return {
      hitPlayerId: null,
      isHeadshot: false,
      hitDistance: nearestObstacleDist,
      damage: 0
    };
  }

  if (hitPlayerId !== null && nearestHitboxDist < Infinity) {
    const stats = WEAPONS[weaponType];
    const baseDamage = stats.damage;
    const mult = hitIsHeadshot ? stats.headshotMultiplier : 1.0;
    return {
      hitPlayerId,
      isHeadshot: hitIsHeadshot,
      hitDistance: nearestHitboxDist,
      damage: baseDamage * mult
    };
  }

  return {
    hitPlayerId: null,
    isHeadshot: false,
    hitDistance: Infinity,
    damage: 0
  };
}

// Target at (0, 0, 10)
player.setPosition(0, 0, 10);
const targetBoxes = player.getHitboxes();

// Case 1: Clear line of sight sniper headshot (Sniper base damage 95 * 2.0 = 190)
const sniperShot = simulateShot(
  new pc.Vec3(0, headBox.box.center.y, 0),
  new pc.Vec3(0, 0, 1),
  'sniper',
  targetBoxes,
  []
);
if (sniperShot.hitPlayerId !== 'remote_player_1' || !sniperShot.isHeadshot || sniperShot.damage !== 190) {
  console.error('❌ Expected sniper headshot to deal 190 damage, got:', sniperShot);
  process.exit(1);
}
console.log(`✓ Sniper headshot unobstructed deals exact 190 damage (${sniperShot.damage} dmg at ${sniperShot.hitDistance.toFixed(1)}m)`);

// Case 2: Wall obstacle between shooter (Z=0) and target (Z=10) at Z=5
const wallBox = new pc.BoundingBox(new pc.Vec3(0, 1.4, 5), new pc.Vec3(2, 2, 0.2));
const blockedShot = simulateShot(
  new pc.Vec3(0, headBox.box.center.y, 0),
  new pc.Vec3(0, 0, 1),
  'sniper',
  targetBoxes,
  [wallBox]
);
if (blockedShot.hitPlayerId !== null || blockedShot.damage !== 0) {
  console.error('❌ Shot should have been occluded by wall obstacle:', blockedShot);
  process.exit(1);
}
console.log(`✓ Shot intercepted by obstacle at Z=${blockedShot.hitDistance.toFixed(1)}m, causing 0 damage to player`);

// Case 3: Wall behind target (Z=15) does not occlude shot
const wallBehind = new pc.BoundingBox(new pc.Vec3(0, 1.4, 15), new pc.Vec3(2, 2, 0.2));
const unblockedShot = simulateShot(
  new pc.Vec3(0, headBox.box.center.y, 0),
  new pc.Vec3(0, 0, 1),
  'rifle',
  targetBoxes,
  [wallBehind]
);
if (unblockedShot.hitPlayerId !== 'remote_player_1' || unblockedShot.damage !== WEAPONS.rifle.damage * WEAPONS.rifle.headshotMultiplier) {
  console.error('❌ Wall behind target should not block hit:', unblockedShot);
  process.exit(1);
}
console.log('✓ Wall behind target properly ignored, ray successfully hits player');

console.log('🎉 ALL PLAYCANVAS MULTIPLAYER SHOOTING TESTS PASSED CLEANLY!');

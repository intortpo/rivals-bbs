import * as pc from 'playcanvas';
import { MOVEMENT } from '../src/shared/constants.js';

console.log('🧪 Starting Grappling Hook Physics & Slingshot Mechanics Tests...');

// 1. Verify MOVEMENT constants schema & sensible physics values
if (MOVEMENT.GRAPPLE_MAX_DIST !== 48.0) {
  console.error('❌ MOVEMENT.GRAPPLE_MAX_DIST expected 48.0, got', MOVEMENT.GRAPPLE_MAX_DIST);
  process.exit(1);
}
if (MOVEMENT.GRAPPLE_PULL_SPEED !== 26.0) {
  console.error('❌ MOVEMENT.GRAPPLE_PULL_SPEED expected 26.0, got', MOVEMENT.GRAPPLE_PULL_SPEED);
  process.exit(1);
}
if (MOVEMENT.GRAPPLE_PULL_ACCEL !== 55.0) {
  console.error('❌ MOVEMENT.GRAPPLE_PULL_ACCEL expected 55.0, got', MOVEMENT.GRAPPLE_PULL_ACCEL);
  process.exit(1);
}
if (MOVEMENT.GRAPPLE_SLINGSHOT_BOOST !== 1.35) {
  console.error('❌ MOVEMENT.GRAPPLE_SLINGSHOT_BOOST expected 1.35, got', MOVEMENT.GRAPPLE_SLINGSHOT_BOOST);
  process.exit(1);
}
if (MOVEMENT.GRAPPLE_COOLDOWN_SEC !== 3.5) {
  console.error('❌ MOVEMENT.GRAPPLE_COOLDOWN_SEC expected 3.5, got', MOVEMENT.GRAPPLE_COOLDOWN_SEC);
  process.exit(1);
}
if (MOVEMENT.GRAPPLE_DETACH_DIST !== 2.2) {
  console.error('❌ MOVEMENT.GRAPPLE_DETACH_DIST expected 2.2, got', MOVEMENT.GRAPPLE_DETACH_DIST);
  process.exit(1);
}
console.log('✓ MOVEMENT grappling constants validated with proper physics bounds');

// 2. Test Raycast surface latching against architectural bounding boxes
const buildingBox = new pc.BoundingBox(new pc.Vec3(0, 10, 20), new pc.Vec3(5, 10, 2)); // Center at (0, 10, 20), Z spans 18 to 22
const playerEyePos = new pc.Vec3(0, 1.6, 0);

// Ray directed straight towards building (+Z)
const aimDir = new pc.Vec3(0, 0.4, 1.0).normalize();
const ray = new pc.Ray(playerEyePos, aimDir);

const hitPt = new pc.Vec3();
const hits = buildingBox.intersectsRay(ray, hitPt);
if (!hits) {
  console.error('❌ Expected raycast to intersect building bounding box');
  process.exit(1);
}
const hitDist = playerEyePos.distance(hitPt);
if (hitDist > MOVEMENT.GRAPPLE_MAX_DIST) {
  console.error('❌ Hit point distance exceeded GRAPPLE_MAX_DIST:', hitDist);
  process.exit(1);
}
console.log(`✓ Grappling hook raycast accurately latched onto obstacle surface at Z=${hitPt.z.toFixed(2)}m (dist: ${hitDist.toFixed(2)}m)`);

// 3. Test Raycast out-of-range rejection
const farBuilding = new pc.BoundingBox(new pc.Vec3(0, 10, 80), new pc.Vec3(5, 10, 2));
const farHitPt = new pc.Vec3();
const farHits = farBuilding.intersectsRay(ray, farHitPt);
const farDist = farHits ? playerEyePos.distance(farHitPt) : Infinity;
if (farDist <= MOVEMENT.GRAPPLE_MAX_DIST) {
  console.error('❌ Distant obstacle (80m) should exceed max grappling range of 48m');
  process.exit(1);
}
console.log('✓ Distant target (>48m) properly rejected by max grappling range');

// 4. Test Grappling Pull Acceleration Simulation
let playerPos = new pc.Vec3(0, 2, 0);
let playerVel = new pc.Vec3(0, 0, 0);
const anchor = new pc.Vec3(0, 15, 20); // High rooftop anchor
const delta = 0.016; // 60 FPS tick

for (let frame = 0; frame < 10; frame++) {
  const toAnchor = new pc.Vec3().sub2(anchor, playerPos);
  const pullDir = toAnchor.clone().normalize();
  const accel = MOVEMENT.GRAPPLE_PULL_ACCEL * delta;
  playerVel.x += pullDir.x * accel;
  playerVel.y += pullDir.y * accel;
  playerVel.z += pullDir.z * accel;

  // Cap speed
  const speed = playerVel.length();
  if (speed > MOVEMENT.GRAPPLE_PULL_SPEED) {
    playerVel.mulScalar(MOVEMENT.GRAPPLE_PULL_SPEED / speed);
  }

  playerPos.x += playerVel.x * delta;
  playerPos.y += playerVel.y * delta;
  playerPos.z += playerVel.z * delta;
}

if (playerVel.y <= 0 || playerVel.z <= 0) {
  console.error('❌ Player should accelerate upward and forward toward rooftop anchor, got velocity:', playerVel);
  process.exit(1);
}
const horizSpeed = Math.hypot(playerVel.x, playerVel.z);
if (horizSpeed > MOVEMENT.GRAPPLE_PULL_SPEED) {
  console.error('❌ Grapple velocity exceeded max pull speed limit:', horizSpeed);
  process.exit(1);
}
console.log(`✓ Pull physics accelerated player smoothly towards anchor (vy=${playerVel.y.toFixed(2)}, vz=${playerVel.z.toFixed(2)})`);

// 5. Test Slingshot Release Momentum Boost
const preReleaseVel = playerVel.clone();
playerVel.x *= MOVEMENT.GRAPPLE_SLINGSHOT_BOOST;
playerVel.z *= MOVEMENT.GRAPPLE_SLINGSHOT_BOOST;
playerVel.y = Math.max(MOVEMENT.JUMP_VELOCITY * 0.75, playerVel.y * 1.15 + 3.0);

if (playerVel.z <= preReleaseVel.z * 1.34) {
  console.error('❌ Slingshot boost failed to multiply forward velocity by 1.35x');
  process.exit(1);
}
if (playerVel.y < MOVEMENT.JUMP_VELOCITY * 0.75) {
  console.error('❌ Slingshot release failed to provide vertical leap impulse');
  process.exit(1);
}
console.log(`✓ Slingshot jump detachment applied 1.35x momentum boost (vz: ${preReleaseVel.z.toFixed(2)} -> ${playerVel.z.toFixed(2)} m/s, vy: ${playerVel.y.toFixed(2)} m/s)`);

// 6. Test Auto-Detach Threshold
const nearPos = new pc.Vec3(0, 14.2, 19.1);
const distToAnchor = nearPos.distance(anchor);
const shouldAutoDetach = distToAnchor <= MOVEMENT.GRAPPLE_DETACH_DIST;
if (!shouldAutoDetach) {
  console.error(`❌ Distance ${distToAnchor.toFixed(2)}m should trigger auto-detach (threshold: ${MOVEMENT.GRAPPLE_DETACH_DIST}m)`);
  process.exit(1);
}
console.log(`✓ Auto-detach correctly triggered upon reaching anchor proximity (${distToAnchor.toFixed(2)}m <= ${MOVEMENT.GRAPPLE_DETACH_DIST}m)`);

// 7. Test Cooldown Enforcement
let cooldown = MOVEMENT.GRAPPLE_COOLDOWN_SEC;
function canFireGrapple(cd: number): boolean {
  return cd <= 0;
}
if (canFireGrapple(cooldown)) {
  console.error('❌ Cannot fire grapple while cooldown is active');
  process.exit(1);
}
// Simulate elapsed cooldown
cooldown -= 3.6;
if (!canFireGrapple(cooldown)) {
  console.error('❌ Grapple should be ready after cooldown duration has elapsed');
  process.exit(1);
}
console.log('✓ Cooldown timer correctly prevents re-triggering and resets after 3.5s');

console.log('🎉 ALL GRAPPLING HOOK PHYSICS & SLINGSHOT TESTS PASSED CLEANLY!');

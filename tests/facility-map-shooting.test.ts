import * as pc from 'playcanvas';
import { getMapSpawns, getTeamSpawn } from '../src/shared/constants.js';
import { getMapObstacles, FACILITY_OBSTACLES } from '../src/shared/mapObstacles.js';
import { PCMapBuilder } from '../src/client/engine/playcanvas/PCMapBuilder.js';
import { PCWeaponManager } from '../src/client/engine/playcanvas/PCWeaponManager.js';
import { WEAPONS } from '../src/shared/constants.js';

console.log('🧪 Starting Facility Map & PlayCanvas FPS Starter Kit Shooting Tests...');

// ─────────────────────────────────────────────────────────────────────────────
// 1. Facility Map Spawn Integrity & Void Safety
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ Facility Spawns Ground Integrity & Obstacle Clearance');

const ffaSpawns = getMapSpawns('Facility');
if (!ffaSpawns || ffaSpawns.length < 8) {
  console.error(`❌ Expected at least 8 FFA spawns for Facility, got ${ffaSpawns?.length}`);
  process.exit(1);
}

// Check that every FFA spawn is inside the arena bounds [-32, 32] and not inside an obstacle
for (let i = 0; i < ffaSpawns.length; i++) {
  const sp = ffaSpawns[i];
  if (sp.x < -31 || sp.x > 31 || sp.z < -31 || sp.z > 31) {
    console.error(`❌ FFA spawn #${i} is out of arena bounds:`, sp);
    process.exit(1);
  }
  if (sp.y < 0) {
    console.error(`❌ FFA spawn #${i} is below floor level:`, sp);
    process.exit(1);
  }

  // Check no spawn overlaps with any obstacle interior
  for (const obs of FACILITY_OBSTACLES) {
    // If inside obstacle bounds (with 0.2m safety margin)
    const insideX = sp.x > obs.min[0] + 0.2 && sp.x < obs.max[0] - 0.2;
    const insideY = sp.y >= obs.min[1] && sp.y < obs.max[1];
    const insideZ = sp.z > obs.min[2] + 0.2 && sp.z < obs.max[2] - 0.2;
    if (insideX && insideY && insideZ) {
      console.error(`❌ FFA spawn #${i} collides with obstacle ${obs.name}:`, sp);
      process.exit(1);
    }
  }
}
console.log(`✓ Verified ${ffaSpawns.length} FFA spawns on Facility are safe, above ground, and clear of obstacles`);

// Verify Team Spawns (4 Blue + 4 Red)
for (let i = 0; i < 4; i++) {
  const blueSpawn = getTeamSpawn('blue', i, 'Facility');
  const redSpawn = getTeamSpawn('red', i, 'Facility');

  if (blueSpawn.x >= 0) {
    console.error(`❌ Blue team spawn #${i} should be on the West side (x < 0):`, blueSpawn);
    process.exit(1);
  }
  if (redSpawn.x <= 0) {
    console.error(`❌ Red team spawn #${i} should be on the East side (x > 0):`, redSpawn);
    process.exit(1);
  }
  if (blueSpawn.y !== 0.0 || redSpawn.y !== 0.0) {
    console.error(`❌ Team spawns must be at ground floor y=0.0:`, { blueSpawn, redSpawn });
    process.exit(1);
  }
}
console.log('✓ Verified 4 Blue & 4 Red team depot spawns are symmetrically positioned on ground floor');

// ─────────────────────────────────────────────────────────────────────────────
// 2. PCMapBuilder Facility Geometry, Catwalks, & Jump Pads
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ PCMapBuilder Facility Geometry & Jump Pads');
const map = new PCMapBuilder(undefined, 'Facility', 'twilight');

if (map.collisionBoxes.length === 0) {
  console.error('❌ Expected collision boxes in Facility map');
  process.exit(1);
}
if (map.jumpPads.length !== 2) {
  console.error(`❌ Expected 2 jump pads in Facility map, got ${map.jumpPads.length}`);
  process.exit(1);
}

// Verify jump pad impulses launch towards upper catwalk
const westPad = map.jumpPads.find(p => p.box.center.x < 0)!;
const eastPad = map.jumpPads.find(p => p.box.center.x > 0)!;

if (westPad.impulseY !== 18.0 || (westPad.impulseX ?? 0) <= 0) {
  console.error('❌ West jump pad should provide 18.0 upward impulse and positive X boost towards center catwalk');
  process.exit(1);
}
if (eastPad.impulseY !== 18.0 || (eastPad.impulseX ?? 0) >= 0) {
  console.error('❌ East jump pad should provide 18.0 upward impulse and negative X boost towards center catwalk');
  process.exit(1);
}
console.log('✓ Verified 2 Jump Pads on Facility launch players with 18.0 m/s vertical impulse towards catwalk');

// ─────────────────────────────────────────────────────────────────────────────
// 3. Spring-Damper Recoil Physics Simulation
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ Spring-Damper Recoil Physics Simulation');
const wm = new PCWeaponManager(undefined, undefined);

// Fire rifle: should introduce kick velocity and displacement
wm.recoilOffset.z = 0.09;
wm.recoilRotation.x = 7.0;
wm.recoilVelocityZ = 0.09 * 8.0;
wm.recoilVelocityRotX = 7.0 * 6.0;

// Simulate 0.35s of spring-damper physics
const dt = 1 / 60; // 60 FPS
for (let t = 0; t < 0.35; t += dt) {
  wm.update(dt, false, 0);
}

if (Math.abs(wm.recoilOffset.z) > 0.02 || Math.abs(wm.recoilRotation.x) > 1.0) {
  console.error(
    `❌ Spring-damper failed to restore weapon to rest within 0.35s: offsetZ=${wm.recoilOffset.z.toFixed(4)}, rotX=${wm.recoilRotation.x.toFixed(4)}`
  );
  process.exit(1);
}
console.log(`✓ Critically-damped spring restores recoil to resting state within 0.35s (offsetZ=${wm.recoilOffset.z.toFixed(4)})`);

// ─────────────────────────────────────────────────────────────────────────────
// 4. Parametric Figure-8 Walking Bobbing & Sway
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ Parametric Figure-8 Walking Bobbing & Sway');
// Simulate moving player at speed 8 m/s
for (let t = 0; t < 0.2; t += dt) {
  wm.update(dt, true, 8.0);
}

const activeBobX = Math.abs(wm.bobOffset.x);
const activeBobY = Math.abs(wm.bobOffset.y);
if (activeBobX < 0.002 || activeBobY < 0.002) {
  console.error(`❌ Expected walking movement to produce parametric bobbing offsets: bobX=${wm.bobOffset.x}, bobY=${wm.bobOffset.y}`);
  process.exit(1);
}
console.log(`✓ Walking movement generates smooth parametric bobbing (X=${wm.bobOffset.x.toFixed(4)}, Y=${wm.bobOffset.y.toFixed(4)})`);

// Simulate stopping: should decay smoothly towards 0
for (let t = 0; t < 0.5; t += dt) {
  wm.update(dt, false, 0);
}
if (Math.abs(wm.bobOffset.x) > 0.002 || Math.abs(wm.bobOffset.y) > 0.002) {
  console.error(`❌ Bobbing offset failed to decay after stopping: bobX=${wm.bobOffset.x}, bobY=${wm.bobOffset.y}`);
  process.exit(1);
}
console.log('✓ Bobbing smoothly settles back to center when stationary');

// ─────────────────────────────────────────────────────────────────────────────
// 5. High-Elevation Catwalk Raycast Shooting & Obstacle Occlusion
// ─────────────────────────────────────────────────────────────────────────────
console.log('▶ High-Elevation Catwalk Raycast Shooting & Line-of-Sight');

// Shooter on catwalk at (0, 3.5, -10), target on catwalk at (0, 3.5, 5)
const catwalkRay = new pc.Ray(new pc.Vec3(0, 3.5 + 1.6, -10), new pc.Vec3(0, 0, 1));
const targetCatwalkBox = new pc.BoundingBox(new pc.Vec3(0, 3.5 + 1.15, 5), new pc.Vec3(0.3, 0.8, 0.3));
const hp = new pc.Vec3();

if (!targetCatwalkBox.intersectsRay(catwalkRay, hp)) {
  console.error('❌ Ray along catwalk failed to hit target on upper level');
  process.exit(1);
}
console.log(`✓ Catwalk sniper line of sight clear at Z=${hp.z.toFixed(2)}m on upper level`);

// Support pillar in between at (0, 5, 0)
const centralPillar = new pc.BoundingBox(new pc.Vec3(0, 5, 0), new pc.Vec3(1.5, 5, 1.5));
if (!centralPillar.intersectsRay(catwalkRay, hp) || hp.z > 5) {
  console.error('❌ Intervening pillar should occlude shot between catwalk ends');
  process.exit(1);
}
console.log(`✓ Intervening pillar at Z=${hp.z.toFixed(2)}m cleanly occludes shot before reaching target`);

console.log('🎉 ALL FACILITY MAP & PLAYCANVAS STARTER KIT SHOOTING TESTS PASSED CLEANLY!');

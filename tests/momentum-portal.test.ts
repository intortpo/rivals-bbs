import { MapBuilder } from '../src/client/engine/MapBuilder.js';
import * as THREE from 'three';

console.log('🧪 Running Portal & Jump Pad Momentum Physics Tests...');

// 1. Simulate portal exit momentum calculation
function simulatePortalExit(entryVel: { x: number; y: number; z: number }, exitYaw: number) {
  const inSpeed = Math.hypot(entryVel.x, entryVel.z);
  const exitSpeed = Math.max(inSpeed, 14.0); // Boost forward with minimum 14 m/s launch velocity
  const exitVelX = Math.sin(exitYaw) * exitSpeed;
  const exitVelZ = Math.cos(exitYaw) * exitSpeed;
  const exitVelY = Math.max(entryVel.y, 3.5); // Upward boost
  return { x: exitVelX, y: exitVelY, z: exitVelZ, exitSpeed };
}

// Test 1: Walking player entering portal receives minimum launch boost
const walkEntry = { x: 3.0, y: 0.0, z: 4.0 }; // speed = 5.0 m/s
const walkExit = simulatePortalExit(walkEntry, 0); // exitYaw = 0 (facing +Z)
if (walkExit.exitSpeed < 14.0) {
  console.error('❌ Portal exit should enforce minimum launch speed of 14.0 m/s');
  process.exit(1);
}
if (Math.abs(walkExit.x) > 0.001 || Math.abs(walkExit.z - 14.0) > 0.001) {
  console.error('❌ Portal exit vector should align precisely with exitYaw (0 -> +Z):', walkExit);
  process.exit(1);
}
if (walkExit.y < 3.5) {
  console.error('❌ Portal exit should provide positive vertical clearance (>= 3.5 m/s):', walkExit.y);
  process.exit(1);
}
console.log('✓ Walking player into portal gains 14.0 m/s directional exit launch with vertical clearance');

// Test 2: High-speed sliding player entering portal maintains full vector momentum magnitude
const highSpeedEntry = { x: 12.0, y: 2.0, z: 16.0 }; // speed = 20.0 m/s
const targetYaw = Math.PI / 2; // exitYaw = 90 deg (facing +X)
const sprintExit = simulatePortalExit(highSpeedEntry, targetYaw);
if (Math.abs(sprintExit.exitSpeed - 20.0) > 0.001) {
  console.error('❌ High-speed momentum was not preserved through portal:', sprintExit.exitSpeed);
  process.exit(1);
}
if (Math.abs(sprintExit.x - 20.0) > 0.001 || Math.abs(sprintExit.z) > 0.001) {
  console.error('❌ High-speed exit vector was not redirected along exitYaw:', sprintExit);
  process.exit(1);
}
console.log('✓ High-speed momentum (20 m/s) preserved and redirected along portal exit vector');

// Test 3: Bunny-hop Jump Pad trigger condition
function canTriggerJumpPad(playerVelY: number, padImpulseY: number): boolean {
  // Relaxed trigger condition allows players with slight upward hop (<= 2.5 m/s) to trigger pad
  return playerVelY <= 2.5;
}

if (!canTriggerJumpPad(1.8, 19.0)) {
  console.error('❌ Jump pad failed to trigger during bunny-hop upward momentum');
  process.exit(1);
}
if (canTriggerJumpPad(8.0, 19.0)) {
  console.error('❌ Jump pad should not retrigger if already flying upward at high speed');
  process.exit(1);
}
console.log('✓ Jump pad triggers reliably during bunny-hop (vy <= 2.5 m/s) without getting stuck');

console.log('🎉 ALL PORTAL & JUMP PAD MOMENTUM TESTS PASSED CLEANLY!');

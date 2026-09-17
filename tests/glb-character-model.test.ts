import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as pc from 'playcanvas';
import { PCGLBCharacterModel } from '../src/client/engine/playcanvas/PCGLBCharacterModel.js';
import { PCCharacterModel } from '../src/client/engine/playcanvas/PCCharacterModel.js';
import { RoomManager } from '../src/server/RoomManager.js';
import { Server } from 'socket.io';
import * as http from 'http';

console.log('🧪 Starting Arena BBS GLB Character Model & Wave Mode Integration Tests...');

describe('Arena BBS Mixamo GLB Model Integrity', () => {
  const glbPath = path.resolve('public/models/characters/arena_character.glb');

  it('should have arena_character.glb generated and present in public directory', () => {
    assert.strictEqual(fs.existsSync(glbPath), true, 'arena_character.glb must exist in public/models/characters/');
    const stats = fs.statSync(glbPath);
    assert.ok(stats.size > 5 * 1024 * 1024, `GLB file should be complete with all clips, actual size: ${stats.size} bytes`);
  });

  it('should match procedural character hitbox definitions and counts for accurate server parity', () => {
    const glbModel = new PCGLBCharacterModel(undefined, 'bot_test_1', 'red', undefined, 'scout', false);
    const proceduralModel = new PCCharacterModel(undefined, 'bot_test_1', 'red', false);

    assert.strictEqual(glbModel.localHitboxes.length, proceduralModel.localHitboxes.length, 'Hitbox count must match');
    assert.strictEqual(glbModel.localHitboxes.length, 8, 'Must have 8 defined hitboxes');

    for (let i = 0; i < glbModel.localHitboxes.length; i++) {
      const gHb = glbModel.localHitboxes[i];
      const pHb = proceduralModel.localHitboxes[i];

      assert.strictEqual(gHb.part, pHb.part, `Part at index ${i} must match`);
      assert.strictEqual(gHb.isHead, pHb.isHead, `isHead flag must match for ${gHb.part}`);
      assert.ok(Math.abs(gHb.offset.y - pHb.offset.y) < 0.001, `Y offset must match for ${gHb.part}`);
      assert.ok(Math.abs(gHb.halfExtents.x - pHb.halfExtents.x) < 0.001, `HalfExtents X must match for ${gHb.part}`);
      assert.ok(Math.abs(gHb.halfExtents.y - pHb.halfExtents.y) < 0.001, `HalfExtents Y must match for ${gHb.part}`);
      assert.ok(Math.abs(gHb.halfExtents.z - pHb.halfExtents.z) < 0.001, `HalfExtents Z must match for ${gHb.part}`);
    }
  });

  it('should correctly transform world hitboxes when character moves and slides', () => {
    const glbModel = new PCGLBCharacterModel(undefined, 'bot_test_1', 'red', undefined, 'heavy', false);
    glbModel.setPosition(10, 5, -8);
    glbModel.setRotation(0);

    const hitboxesStanding = glbModel.getHitboxes();
    const headHb = hitboxesStanding.find(h => h.part === 'head');
    assert.ok(headHb, 'Head hitbox must exist');
    assert.ok(Math.abs(headHb.box.center.x - 10) < 0.01);
    assert.ok(Math.abs(headHb.box.center.y - (5 + 1.65)) < 0.01);
    assert.ok(Math.abs(headHb.box.center.z - (-8)) < 0.01);
    const standingHeadY = headHb.box.center.y;

    // Sliding lowers the torso/head
    glbModel.setSliding(true);
    const hitboxesSliding = glbModel.getHitboxes();
    const slidingHeadHb = hitboxesSliding.find(h => h.part === 'head');
    assert.ok(slidingHeadHb);
    assert.ok(slidingHeadHb.box.center.y < standingHeadY, 'Sliding head should be lower than standing head');
  });

  it('should enforce wave mode in room creation and room state', () => {
    const server = http.createServer();
    const io = new Server(server);
    const roomManager = new RoomManager(io);

    const mockSocket: any = {
      id: 'socket_host_123',
      join: (_room: string) => {},
      emit: (_event: string, ..._args: any[]) => {}
    };

    // Create room with wave mode
    const res = roomManager.createRoom(mockSocket, 'WaveHost', 'wave', 10, 'Facility');
    assert.ok(res.roomId);
    assert.ok(res.session);

    const state = res.session.roomState;
    assert.ok(state);
    assert.strictEqual(state.mode, 'wave', 'Room state mode must be wave');
    assert.strictEqual(state.mapName, 'Facility');
  });

  it('should support overhead UI health updates and billboarding on both GLB and procedural models', () => {
    const glbModel = new PCGLBCharacterModel(undefined, 'bot_w1_1', 'red', undefined, 'scout', false);
    const proceduralModel = new PCCharacterModel(undefined, 'bot_w1_2', 'red', false, 'rusher');

    // Verify updateHealth and updateBillboard exist on both models
    assert.strictEqual(typeof (glbModel as any).updateHealth, 'function');
    assert.strictEqual(typeof (glbModel as any).updateBillboard, 'function');
    assert.strictEqual(typeof (proceduralModel as any).updateHealth, 'function');
    assert.strictEqual(typeof (proceduralModel as any).updateBillboard, 'function');

    // Verify calling updateHealth does not throw
    glbModel.updateHealth(60, 100, 25, 50);
    proceduralModel.updateHealth(40, 100, 0, 50);

    // Verify billboarding with dummy camera position does not throw
    const camPos = new pc.Vec3(0, 1.8, 10);
    glbModel.updateBillboard(camPos);
    proceduralModel.updateBillboard(camPos);
  });

  it('should verify all 11 Mixamo animation tracks in arena_character.glb', () => {
    const buffer = fs.readFileSync(glbPath);
    const chunkLen = buffer.readUInt32LE(12);
    const jsonStr = buffer.toString('utf8', 20, 20 + chunkLen);
    const glbData = JSON.parse(jsonStr);

    const animNames = (glbData.animations || []).map((a: any) => a.name);
    const expected = [
      'idle',
      'run',
      'sprint',
      'slide',
      'turn180',
      'strafe_left',
      'strafe_right',
      'reload',
      'stab',
      'slash',
      'death'
    ];

    for (const exp of expected) {
      assert.ok(animNames.includes(exp), `Animation '${exp}' must be present in GLB, found: ${animNames.join(', ')}`);
    }
  });
});

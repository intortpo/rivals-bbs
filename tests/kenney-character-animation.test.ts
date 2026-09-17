import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as fs from 'fs';
import * as path from 'path';
import * as pc from 'playcanvas';
import { PCKenneyCharacterModel, BOT_ROLE_SKIN_MAP } from '../src/client/engine/playcanvas/PCKenneyCharacterModel.js';

console.log('🧪 Starting Kenney Character Model Animation & Skinning Tests...');

describe('Kenney Animated Character Model & Animation Graph', () => {
  const glbPath = path.resolve('public/models/characters/kenney/kenney_character.glb');

  it('should have kenney_character.glb present in public directory', () => {
    assert.strictEqual(fs.existsSync(glbPath), true, 'kenney_character.glb must exist');
    const stats = fs.statSync(glbPath);
    assert.ok(stats.size > 200 * 1024, `GLB file size should be substantial, actual: ${stats.size} bytes`);
  });

  it('should construct Kenney character model and setup hitboxes matching targetable interface', () => {
    const model = new PCKenneyCharacterModel(undefined, 'bot_kenney_1', 'red', undefined, 'cyborgFemaleA', 'rusher', false);

    assert.strictEqual(model.playerId, 'bot_kenney_1');
    assert.strictEqual(model.team, 'red');
    assert.strictEqual(model.skin, 'cyborgFemaleA');
    assert.strictEqual(model.localHitboxes.length, 8, 'Must have 8 defined hitboxes');

    model.setPosition(5, 2, -10);
    model.setRotation(90);

    const hitboxes = model.getHitboxes();
    assert.strictEqual(hitboxes.length, 8);
    const head = hitboxes.find(h => h.part === 'head');
    assert.ok(head);
    assert.ok(head.isHead);
    assert.ok(Math.abs(head.box.center.y - (2 + 1.65)) < 0.01);
  });

  it('should drop hitboxes when sliding to allow ducking under fire', () => {
    const model = new PCKenneyCharacterModel(undefined, 'bot_kenney_2', 'blue', undefined, 'skaterMaleA', 'grunt', false);
    model.setPosition(0, 0, 0);
    model.setRotation(0);

    const standingHitboxes = model.getHitboxes();
    const standingHeadY = standingHitboxes.find(h => h.part === 'head')!.box.center.y;

    model.setSliding(true);
    const slidingHitboxes = model.getHitboxes();
    const slidingHeadY = slidingHitboxes.find(h => h.part === 'head')!.box.center.y;

    assert.ok(slidingHeadY < standingHeadY, 'Sliding head must be lowered below standing head');
    assert.ok(Math.abs((standingHeadY - slidingHeadY) - 0.35) < 0.01, 'Head should drop by ~0.35m');
  });

  it('should map bot roles to valid Kenney skins', () => {
    assert.strictEqual(BOT_ROLE_SKIN_MAP['rusher'], 'zombieMaleA');
    assert.strictEqual(BOT_ROLE_SKIN_MAP['grunt'], 'skaterMaleA');
    assert.strictEqual(BOT_ROLE_SKIN_MAP['heavy'], 'cyborgFemaleA');
    assert.strictEqual(BOT_ROLE_SKIN_MAP['sniper'], 'humanFemaleA');
    assert.strictEqual(BOT_ROLE_SKIN_MAP['scout'], 'skaterFemaleA');
  });

  it('should transition animation states based on movement speed, strafing, sliding and jumping', () => {
    const model = new PCKenneyCharacterModel(undefined, 'bot_kenney_3', 'blue', undefined, 'humanMaleA', 'grunt', false);

    // Mock entity and anim layer to verify state machine transitions without a full WebGL context
    let playedState = '';
    let transitionedState = '';
    let animSpeed = 1.0;

    const mockLayer: any = {
      play: (s: string) => { playedState = s; },
      transition: (s: string, _dur: number) => { transitionedState = s; },
      set speed(val: number) { animSpeed = val; },
      get speed() { return animSpeed; }
    };

    (model as any).modelEntity = {
      anim: {
        baseLayer: mockLayer
      }
    };

    // 1. Moving forward at standard speed -> run
    model.updateAnimation(4.5, 0.016, 0, false);
    assert.strictEqual(transitionedState, 'run');

    // 2. Sprinting (> 6.0 m/s) -> sprint
    model.updateAnimation(7.5, 0.016, 0, false);
    assert.strictEqual(transitionedState, 'sprint');

    // 3. Strafing left
    model.updateAnimation(0.1, 0.016, -3.0, false);
    assert.strictEqual(transitionedState, 'strafe_left');

    // 4. Strafing right
    model.updateAnimation(0.1, 0.016, 3.0, false);
    assert.strictEqual(transitionedState, 'strafe_right');

    // 5. Sliding
    model.setSliding(true);
    model.updateAnimation(5.0, 0.016, 0, false);
    assert.strictEqual(transitionedState, 'slide');

    // 6. Jumping takes precedence
    model.updateAnimation(5.0, 0.016, 0, true);
    assert.strictEqual(transitionedState, 'jump');

    // 7. Stationary / idle
    model.setSliding(false);
    model.updateAnimation(0.0, 0.016, 0, false);
    assert.strictEqual(transitionedState, 'idle');
  });
});

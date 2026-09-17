import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as pc from 'playcanvas';
import { MOVEMENT } from '../src/shared/constants.js';
import { GameSession } from '../src/server/GameSession.js';

describe('Grappling Hook Mechanics & Network Sync', () => {
  it('should verify grapple physics constants', () => {
    assert.strictEqual(MOVEMENT.GRAPPLE_MAX_DIST, 48.0);
    assert.strictEqual(MOVEMENT.GRAPPLE_PULL_SPEED, 26.0);
    assert.strictEqual(MOVEMENT.GRAPPLE_PULL_ACCEL, 55.0);
    assert.strictEqual(MOVEMENT.GRAPPLE_SLINGSHOT_BOOST, 1.35);
    assert.strictEqual(MOVEMENT.GRAPPLE_COOLDOWN_SEC, 3.5);
    assert.strictEqual(MOVEMENT.GRAPPLE_DETACH_DIST, 2.2);
  });

  it('should intersect obstacle within max grapple range', () => {
    const camPos = new pc.Vec3(0, 1.6, 0);
    const camDir = new pc.Vec3(0, 0, -1);
    const ray = new pc.Ray(camPos, camDir);

    const obstacleBox = new pc.BoundingBox(new pc.Vec3(0, 2, -25), new pc.Vec3(4, 4, 1));
    const hitPt = new pc.Vec3();

    const hit = obstacleBox.intersectsRay(ray, hitPt);
    assert.strictEqual(hit, true);
    const dist = camPos.distance(hitPt);
    assert.ok(dist <= MOVEMENT.GRAPPLE_MAX_DIST, `Distance ${dist} should be <= ${MOVEMENT.GRAPPLE_MAX_DIST}`);
    assert.ok(dist >= 24 && dist <= 26, `Hit distance should be near 25m, got ${dist}`);
  });

  it('should accelerate player towards anchor and cap at pull speed', () => {
    const playerPos = new pc.Vec3(0, 5, 0);
    const anchorPos = new pc.Vec3(0, 25, -20);
    const playerVel = new pc.Vec3(0, 0, 0);
    const dt = 0.016;

    const pullDir = new pc.Vec3().sub2(anchorPos, playerPos).normalize();
    for (let step = 0; step < 60; step++) {
      playerVel.x += pullDir.x * MOVEMENT.GRAPPLE_PULL_ACCEL * dt;
      playerVel.y += pullDir.y * MOVEMENT.GRAPPLE_PULL_ACCEL * dt;
      playerVel.z += pullDir.z * MOVEMENT.GRAPPLE_PULL_ACCEL * dt;

      const speed = playerVel.length();
      if (speed > MOVEMENT.GRAPPLE_PULL_SPEED) {
        playerVel.mulScalar(MOVEMENT.GRAPPLE_PULL_SPEED / speed);
      }
    }

    const finalSpeed = playerVel.length();
    assert.ok(Math.abs(finalSpeed - MOVEMENT.GRAPPLE_PULL_SPEED) < 0.01, `Speed ${finalSpeed} should equal ${MOVEMENT.GRAPPLE_PULL_SPEED}`);
    assert.ok(playerVel.y > 0, 'Velocity Y should be upward towards high anchor');
    assert.ok(playerVel.z < 0, 'Velocity Z should be forward towards anchor');
  });

  it('should apply slingshot boost upon jump cancel release', () => {
    const playerVel = new pc.Vec3(10, 15, -15);
    const prevSpeed = playerVel.length();

    // Apply slingshot boost
    playerVel.mulScalar(MOVEMENT.GRAPPLE_SLINGSHOT_BOOST);
    playerVel.y = Math.max(playerVel.y, MOVEMENT.JUMP_VELOCITY * 1.2);

    const boostedSpeed = playerVel.length();
    assert.ok(boostedSpeed > prevSpeed * 1.3, 'Boosted speed should reflect slingshot multiplier');
  });

  it('should synchronize grapple state across GameSession snapshots', () => {
    let emittedSnapshot: any = null;
    const mockIo = {
      to: () => ({
        emit: (event: string, data: any) => {
          if (event === 'sync_snapshot') {
            emittedSnapshot = data;
          }
        }
      }),
      emit: () => {}
    } as any;

    const roomState: any = {
      roomId: 'grapple-test',
      hostId: 'p1',
      mode: 'ffa',
      mapName: 'Facility',
      fragLimit: 25,
      status: 'playing',
      countdown: 0,
      players: {}
    };

    const session = new GameSession(mockIo, roomState);
    session.addPlayer('p1', 'PlayerOne', '#00d2ff', true, 'none');

    // Send input with grapple active
    session.handlePlayerInput('p1', {
      x: 5,
      y: 2,
      z: -10,
      vx: 0,
      vy: 12,
      vz: -15,
      yaw: 0,
      pitch: 0.2,
      isSliding: false,
      isJumping: true,
      isGrounded: false,
      isGrappling: true,
      grappleAnchor: [5, 20, -35],
      timestamp: Date.now()
    });

    // Check player state in roomState
    const p1 = session.roomState.players['p1'];
    assert.ok(p1, 'Player 1 must be present in roomState');
    assert.strictEqual(p1.isGrappling, true);
    assert.deepStrictEqual(p1.grappleAnchor, [5, 20, -35]);

    // Trigger snapshot broadcast via tick
    (session as any).tick();
    assert.ok(emittedSnapshot, 'Snapshot must be broadcast');
    const p1Snapshot = emittedSnapshot.players['p1'];
    assert.ok(p1Snapshot, 'Player 1 must be in broadcast snapshot');
    assert.strictEqual(p1Snapshot.isGrappling, true);
    assert.deepStrictEqual(p1Snapshot.grappleAnchor, [5, 20, -35]);

    session.stop();
  });
});

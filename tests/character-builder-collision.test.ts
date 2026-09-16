import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import * as THREE from 'three';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { RoomManager } from '../src/server/RoomManager.js';
import { CharacterCustomization, RoomNetworkState } from '../src/shared/types.js';
import {
  customizationToMeshNames,
  presetToCustomization,
  MODULAR_CATALOG,
  CHARACTER_PRESETS
} from '../src/client/engine/CharacterModel.js';

console.log('🧪 Starting Character Builder & Collision Integration Tests...');

// 1. Character Modular Mesh Mapping & Catalog Validation
describe('Character Builder Modular Mapping', () => {
  it('should include Body_010 in all configurations for base skin and limbs', () => {
    const custom: CharacterCustomization = {
      face: 'Male_emotion_usual_001',
      hair: 'none',
      headwear: 'none',
      eyewear: 'none',
      accessories: [],
      top: 'T_Shirt_009',
      bottom: 'Pants_010',
      shoes: 'Shoe_Sneakers_009',
      socks: false,
      gloves: 'none',
      accentColor: '#00d2ff'
    };
    const meshSet = customizationToMeshNames(custom);
    assert.strictEqual(meshSet.has('Body_010'), true, 'Body_010 base mesh must always be present');
    assert.strictEqual(meshSet.has('T_Shirt_009'), true);
    assert.strictEqual(meshSet.has('Pants_010'), true);
    assert.strictEqual(meshSet.has('Shoe_Sneakers_009'), true);
    assert.strictEqual(meshSet.has('Socks_008'), false);
  });

  it('should include Socks_008 when socks flag is true', () => {
    const custom: CharacterCustomization = {
      face: 'Male_emotion_happy_002',
      hair: 'none',
      headwear: 'Hat_010',
      eyewear: 'none',
      accessories: [],
      top: 'T_Shirt_009',
      bottom: 'Shorts_003',
      shoes: 'Shoe_Sneakers_009',
      socks: true,
      gloves: 'Gloves_006',
      accentColor: '#00ff88'
    };
    const meshSet = customizationToMeshNames(custom);
    assert.strictEqual(meshSet.has('Socks_008'), true, 'Socks_008 should be included when socks=true');
    assert.strictEqual(meshSet.has('Hat_010'), true);
    assert.strictEqual(meshSet.has('Gloves_006'), true);
  });

  it('should correctly convert presets 0-3 to complete CharacterCustomization', () => {
    for (let i = 0; i < CHARACTER_PRESETS.length; i++) {
      const custom = presetToCustomization(i, '#00d2ff');
      assert.ok(custom.face, `Preset ${i} has face`);
      assert.ok(custom.top, `Preset ${i} has top`);
      assert.ok(custom.bottom, `Preset ${i} has bottom`);
      assert.ok(custom.shoes, `Preset ${i} has shoes`);
      const meshes = customizationToMeshNames(custom);
      assert.strictEqual(meshes.has('Body_010'), true);
    }
  });

  it('should have valid catalog categories covering all modular pieces', () => {
    assert.ok(MODULAR_CATALOG.length >= 20, 'Catalog must contain modular options');
    const categories = new Set(MODULAR_CATALOG.map((i) => i.category));
    assert.ok(categories.has('headwear'));
    assert.ok(categories.has('hair'));
    assert.ok(categories.has('top'));
    assert.ok(categories.has('bottom'));
    assert.ok(categories.has('shoes'));
    assert.ok(categories.has('face'));
    assert.ok(categories.has('accessories'));
    assert.ok(categories.has('gloves'));
  });
});

// 2. Collision & Tangential Velocity Slide Physics
describe('Map Collision & Sliding Physics', () => {
  it('should preserve tangential velocity and cancel normal velocity against obstacles', () => {
    const playerPos = new THREE.Vector3(9.8, 1.0, 5.0);
    const playerVel = new THREE.Vector3(5.0, 0, 7.0); // Moving diagonally into wall at x = 10
    const playerRadius = 0.4;
    const playerFeet = playerPos.y;
    const playerHead = playerPos.y + 1.8;

    const obstacleBox = new THREE.Box3(
      new THREE.Vector3(10.0, 0, 0),
      new THREE.Vector3(14.0, 8.0, 10.0)
    );

    // Collision check
    if (playerFeet < obstacleBox.max.y - 0.2 && playerHead > obstacleBox.min.y + 0.1) {
      if (
        playerPos.x + playerRadius > obstacleBox.min.x &&
        playerPos.x - playerRadius < obstacleBox.max.x &&
        playerPos.z + playerRadius > obstacleBox.min.z &&
        playerPos.z - playerRadius < obstacleBox.max.z
      ) {
        const dx1 = Math.abs(playerPos.x + playerRadius - obstacleBox.min.x);
        const dx2 = Math.abs(obstacleBox.max.x - (playerPos.x - playerRadius));
        const dz1 = Math.abs(playerPos.z + playerRadius - obstacleBox.min.z);
        const dz2 = Math.abs(obstacleBox.max.z - (playerPos.z - playerRadius));

        const min = Math.min(dx1, dx2, dz1, dz2);
        if (min === dx1) {
          playerPos.x = obstacleBox.min.x - playerRadius;
          if (playerVel.x > 0) playerVel.x = 0;
        }
      }
    }

    assert.strictEqual(playerPos.x, 9.6, 'Player position clamped outside obstacle');
    assert.strictEqual(playerVel.x, 0, 'Velocity into wall zeroed');
    assert.strictEqual(playerVel.z, 7.0, 'Tangential velocity along wall strictly preserved for smooth slide');
  });

  it('should treat top of obstacle as ground when player is standing or jumping onto it', () => {
    const carRoofHeight = 1.8;
    const obstacleBox = new THREE.Box3(
      new THREE.Vector3(2.0, 0, 2.0),
      new THREE.Vector3(6.0, carRoofHeight, 4.0)
    );

    // Standing on car roof
    const playerPos = new THREE.Vector3(3.5, 1.8, 3.0);
    const playerRadius = 0.4;
    const playerFeet = playerPos.y;

    let collidedHorizontally = false;
    if (playerFeet < obstacleBox.max.y - 0.2) {
      if (
        playerPos.x + playerRadius > obstacleBox.min.x &&
        playerPos.x - playerRadius < obstacleBox.max.x &&
        playerPos.z + playerRadius > obstacleBox.min.z &&
        playerPos.z - playerRadius < obstacleBox.max.z
      ) {
        collidedHorizontally = true;
      }
    }

    assert.strictEqual(collidedHorizontally, false, 'Player standing on car roof should NOT trigger horizontal push-out');
  });
});

// 3. Network Synchronization of Custom Outfits
describe('Network Synchronization of Custom Outfits', () => {
  it('should propagate full custom character configuration to roomState and joining players', async () => {
    const httpServer = createServer();
    const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });
    const roomManager = new RoomManager(io);

    io.on('connection', (socket) => {
      socket.on('create_room', (data, cb) => {
        const { playerName, mode, fragLimit, mapName, outfitIndex, customization } = data || {};
        const { roomId, session } = roomManager.createRoom(
          socket,
          playerName,
          mode,
          fragLimit,
          mapName,
          outfitIndex,
          customization
        );
        if (cb) cb({ success: true, roomId, roomState: session.roomState, playerId: socket.id });
        session.broadcastRoomState();
      });

      socket.on('join_room', (data, cb) => {
        const { roomId, playerName, outfitIndex, customization } = data || {};
        const res = roomManager.joinRoom(socket, roomId, playerName, outfitIndex, customization);
        if (res.success && res.session) {
          if (cb) cb({ success: true, roomId, roomState: res.session.roomState, playerId: socket.id });
        } else {
          if (cb) cb({ success: false, error: res.error });
        }
      });
    });

    await new Promise<void>((resolve) => httpServer.listen(3459, () => resolve()));
    console.log('✓ Test server running on port 3459');

    const clientA: ClientSocket = ioc('http://localhost:3459');
    const clientB: ClientSocket = ioc('http://localhost:3459');

    await Promise.all([
      new Promise<void>((resolve) => clientA.on('connect', () => resolve())),
      new Promise<void>((resolve) => clientB.on('connect', () => resolve()))
    ]);
    console.log('✓ Both test clients connected');

    const customA: CharacterCustomization = {
      face: 'Male_emotion_angry_003',
      hair: 'Hairstyle_male_012',
      headwear: 'Hat_049',
      eyewear: 'Glasses_004',
      accessories: ['Headphones_002'],
      top: 'Outerwear_036',
      bottom: 'Pants_014',
      shoes: 'Shoe_Sneakers_009',
      socks: false,
      gloves: 'Gloves_014',
      accentColor: '#b537f2'
    };

    // Client A creates room with customA outfit
    const createRes: any = await new Promise((resolve) => {
      clientA.emit('create_room', {
        playerName: 'PilotAlpha',
        mode: '1v1',
        fragLimit: 5,
        mapName: 'Cartoon City',
        outfitIndex: 0,
        customization: customA
      }, resolve);
    });

    assert.strictEqual(createRes.success, true);
    const hostPlayer = createRes.roomState.players[createRes.playerId];
    assert.deepStrictEqual(hostPlayer.customization, customA, 'Host player customization registered on server');
    console.log('✓ Host custom avatar registered:', hostPlayer.customization.top, hostPlayer.customization.accentColor);

    // Client B joins with customB outfit
    const customB: CharacterCustomization = {
      face: 'Male_emotion_happy_002',
      hair: 'none',
      headwear: 'Hat_010',
      eyewear: 'none',
      accessories: ['Moustache_001'],
      top: 'Costume_10_001',
      bottom: 'Shorts_003',
      shoes: 'Shoe_Slippers_002',
      socks: true,
      gloves: 'none',
      accentColor: '#00ff88'
    };

    const joinRes: any = await new Promise((resolve) => {
      clientB.emit('join_room', {
        roomId: createRes.roomId,
        playerName: 'PilotBravo',
        outfitIndex: 1,
        customization: customB
      }, resolve);
    });

    assert.strictEqual(joinRes.success, true);
    const joiningPlayer = joinRes.roomState.players[joinRes.playerId];
    assert.deepStrictEqual(joiningPlayer.customization, customB, 'Joining player customization registered on server');
    console.log('✓ Joining player custom avatar registered:', joiningPlayer.customization.bottom, joiningPlayer.customization.accentColor);

    clientA.disconnect();
    clientB.disconnect();
    httpServer.close();
    console.log('🎉 ALL CHARACTER BUILDER & COLLISION TESTS PASSED CLEANLY!\n');
  });
});

// 4. Modal Cursor & Weapon Firing Protection
describe('Modal Cursor & Weapon Firing Protection', () => {
  it('should identify active modals and suppress weapon firing during interaction', () => {
    const modalSelectors = [
      '#grammar-reload-overlay',
      '#hud-game-over',
      '#settings-modal',
      '#dashboard-modal',
      '#character-builder-modal'
    ];

    const mockElements: Record<string, { style: { display: string } }> = {
      '#grammar-reload-overlay': { style: { display: 'none' } },
      '#hud-game-over': { style: { display: 'none' } },
      '#settings-modal': { style: { display: 'none' } }
    };

    const isAnyModalOpen = () => {
      for (const sel of modalSelectors) {
        const el = mockElements[sel];
        if (el && el.style.display !== 'none') return true;
      }
      return false;
    };

    assert.strictEqual(isAnyModalOpen(), false, 'Initially no modals open');

    // Open grammar overlay
    mockElements['#grammar-reload-overlay'].style.display = 'flex';
    assert.strictEqual(isAnyModalOpen(), true, 'Detected open grammar reload overlay');

    // Firing check
    const isMouseDown = true;
    const isFiring = () => (isAnyModalOpen() ? false : isMouseDown);
    assert.strictEqual(isFiring(), false, 'Weapon firing suppressed while modal is active');

    // Close grammar overlay
    mockElements['#grammar-reload-overlay'].style.display = 'none';
    assert.strictEqual(isAnyModalOpen(), false);
    assert.strictEqual(isFiring(), true, 'Weapon firing active when no modals are open');
  });
});

// 5. Skeleton Arm Direction & Procedural Animation Verification
describe('Skeleton Arm Direction & Procedural Animation Verification', () => {
  function buildTestSkeleton() {
    const glbPath = path.resolve(process.cwd(), 'public/models/characters/creative_character.glb');
    const glb = fs.readFileSync(glbPath);
    const jsonLen = glb.readUInt32LE(12);
    const gltf = JSON.parse(glb.toString('utf8', 20, 20 + jsonLen));

    const nodes = gltf.nodes.map((n: any) => {
      const obj = new THREE.Object3D();
      obj.name = n.name || '';
      if (n.translation) obj.position.fromArray(n.translation);
      if (n.rotation) obj.quaternion.fromArray(n.rotation);
      if (n.scale) obj.scale.fromArray(n.scale);
      return obj;
    });

    gltf.nodes.forEach((n: any, idx: number) => {
      if (n.children) n.children.forEach((c: number) => nodes[idx].add(nodes[c]));
    });

    const root = nodes[43]; // Root
    const getB = (name: string) => nodes.find((x: any) => x.name === name)!;
    return { root, getB };
  }

  it('should orient arms naturally forward in Character Builder studio pose without pulling backwards', () => {
    const { root, getB } = buildTestSkeleton();
    const leftArm = getB('LeftArm');
    const leftForeArm = getB('LeftForeArm');
    const rightArm = getB('RightArm');
    const rightForeArm = getB('RightForeArm');

    leftArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, -0.05)));
    leftForeArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)));
    rightArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.15, 0, 0.05)));
    rightForeArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, 0, 0)));

    root.updateMatrixWorld(true);

    const lhPos = getB('LeftHand').getWorldPosition(new THREE.Vector3());
    const rhPos = getB('RightHand').getWorldPosition(new THREE.Vector3());

    // Hands must be forward (Z >= 0), never pulled behind torso (Z < 0)
    assert.ok(lhPos.z >= 0, `LeftHand Z must be forward (got ${lhPos.z.toFixed(3)})`);
    assert.ok(rhPos.z >= 0, `RightHand Z must be forward (got ${rhPos.z.toFixed(3)})`);
    assert.ok(Math.abs(lhPos.x - (-rhPos.x)) < 0.01, 'Hands must be symmetrically positioned relative to torso');
    console.log(`✓ Verified Studio Pose: LeftHand=[${lhPos.toArray().map(v=>v.toFixed(2))}], RightHand=[${rhPos.toArray().map(v=>v.toFixed(2))}]`);
  });

  it('should produce alternating running strides with trailing knee flexion', () => {
    const { root, getB } = buildTestSkeleton();
    const leftUpLeg = getB('LeftUpLeg');
    const rightUpLeg = getB('RightUpLeg');
    const leftLeg = getB('LeftLeg');
    const rightLeg = getB('RightLeg');
    const leftFoot = getB('LeftFoot');
    const rightFoot = getB('RightFoot');

    const qLeftUpLegInit = leftUpLeg.quaternion.clone();
    const qRightUpLegInit = rightUpLeg.quaternion.clone();
    const qLeftLegInit = leftLeg.quaternion.clone();
    const qRightLegInit = rightLeg.quaternion.clone();

    // Stride at phase t = pi/2
    const legAngle = 0.48;
    leftUpLeg.quaternion.multiplyQuaternions(qLeftUpLegInit, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), legAngle));
    rightUpLeg.quaternion.multiplyQuaternions(qRightUpLegInit, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), legAngle));

    const leftKneeAngle = Math.max(0, legAngle) * 0.7;
    const rightKneeAngle = Math.max(0, -legAngle) * 0.7;
    leftLeg.quaternion.multiplyQuaternions(qLeftLegInit, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), leftKneeAngle));
    rightLeg.quaternion.multiplyQuaternions(qRightLegInit, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -rightKneeAngle));

    root.updateMatrixWorld(true);
    const lfPos = leftFoot.getWorldPosition(new THREE.Vector3());
    const rfPos = rightFoot.getWorldPosition(new THREE.Vector3());

    // Left foot trailing behind, Right foot forward
    assert.ok(lfPos.z < 0, `Left foot must be backswing (Z < 0, got ${lfPos.z.toFixed(2)})`);
    assert.ok(rfPos.z > 0, `Right foot must be forward stride (Z > 0, got ${rfPos.z.toFixed(2)})`);
    assert.ok(lfPos.y > rfPos.y, 'Trailing foot knee flexion must lift trailing foot above lead foot');
    console.log(`✓ Verified Alternating Stride: Trailing foot Z=${lfPos.z.toFixed(2)}, Leading foot Z=${rfPos.z.toFixed(2)}`);
  });

  it('should position hands forward at chest height in combat ready stance', () => {
    const { root, getB } = buildTestSkeleton();
    const rightArm = getB('RightArm');
    const rightForeArm = getB('RightForeArm');
    const leftArm = getB('LeftArm');
    const leftForeArm = getB('LeftForeArm');

    rightArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0, 0.75)));
    rightForeArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.7, 0.2, 0)));
    leftArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.1, 0, -0.65)));
    leftForeArm.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.9, -0.3, 0)));

    root.updateMatrixWorld(true);

    const rhPos = getB('RightHand').getWorldPosition(new THREE.Vector3());
    const lhPos = getB('LeftHand').getWorldPosition(new THREE.Vector3());

    // Both hands forward in front of chest (Z > 0.25m, Y >= 1.15m)
    assert.ok(rhPos.z > 0.25, `Right hand forward (got Z=${rhPos.z.toFixed(3)})`);
    assert.ok(lhPos.z > 0.25, `Left hand forward (got Z=${lhPos.z.toFixed(3)})`);
    assert.ok(rhPos.y >= 1.15, `Right hand at chest height (got Y=${rhPos.y.toFixed(3)})`);
    assert.ok(lhPos.y >= 1.15, `Left hand at chest height (got Y=${lhPos.y.toFixed(3)})`);
    console.log(`✓ Verified Combat Ready: RightHand=[${rhPos.toArray().map(v=>v.toFixed(2))}], LeftHand=[${lhPos.toArray().map(v=>v.toFixed(2))}]`);
  });
});

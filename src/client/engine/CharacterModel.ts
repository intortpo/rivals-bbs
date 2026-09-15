import * as THREE from 'three';
import { WeaponType } from '../../shared/types.js';

interface BrickDebris {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
}

export class CharacterModel {
  public root: THREE.Group;
  public headMesh!: THREE.Mesh;
  public torsoMesh!: THREE.Mesh;
  public leftArmMesh!: THREE.Mesh;
  public rightArmMesh!: THREE.Mesh;
  public leftLegMesh!: THREE.Mesh;
  public rightLegMesh!: THREE.Mesh;
  public weaponSocket!: THREE.Group;
  public nameplateGroup!: THREE.Group;
  private nameCanvas!: HTMLCanvasElement;
  private nameTexture!: THREE.CanvasTexture;

  private leftArmPivot!: THREE.Group;
  private rightArmPivot!: THREE.Group;
  private leftLegPivot!: THREE.Group;
  private rightLegPivot!: THREE.Group;

  public isLocal: boolean;
  public playerId: string;
  public playerName: string;
  public playerColor: string;
  public currentWeapon: WeaponType = 'rifle';

  private animTime: number = 0;
  private isDead: boolean = false;

  private static debrisList: BrickDebris[] = [];
  private static sceneRef: THREE.Scene | null = null;

  constructor(
    scene: THREE.Scene,
    playerId: string,
    playerName: string,
    playerColor: string,
    isLocal: boolean = false
  ) {
    CharacterModel.sceneRef = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    this.playerColor = playerColor;
    this.isLocal = isLocal;

    this.root = new THREE.Group();
    this.buildRobloxR6Mesh();

    if (!isLocal) {
      this.buildNameplate();
    }

    scene.add(this.root);
  }

  private buildRobloxR6Mesh(): void {
    // Plastic materials like Roblox
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.playerColor,
      roughness: 0.25,
      metalness: 0.08
    });

    const skinMat = new THREE.MeshStandardMaterial({
      color: '#f5cd90', // Classic Roblox skin yellow/tan
      roughness: 0.35,
      metalness: 0.05
    });

    const pantsMat = new THREE.MeshStandardMaterial({
      color: '#1a2238', // Dark tactical jeans
      roughness: 0.4
    });

    // 1. Torso: width 1.0, height 1.0, depth 0.5
    const torsoGeo = new THREE.BoxGeometry(1.0, 1.0, 0.5);
    this.torsoMesh = new THREE.Mesh(torsoGeo, bodyMat);
    this.torsoMesh.position.y = 1.0;
    this.torsoMesh.castShadow = true;
    this.torsoMesh.receiveShadow = true;
    this.root.add(this.torsoMesh);

    // 2. Head: 0.6 x 0.6 x 0.6
    const headGeo = new THREE.BoxGeometry(0.65, 0.65, 0.65);
    this.headMesh = new THREE.Mesh(headGeo, skinMat);
    this.headMesh.position.y = 0.85; // on top of torso
    this.headMesh.castShadow = true;
    this.torsoMesh.add(this.headMesh);

    // Head Visor / Face
    const visorGeo = new THREE.BoxGeometry(0.5, 0.2, 0.06);
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#111',
      roughness: 0.1,
      metalness: 0.9
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.05, 0.33);
    this.headMesh.add(visor);

    // 3. Left Arm Pivot & Mesh
    this.leftArmPivot = new THREE.Group();
    this.leftArmPivot.position.set(-0.75, 0.45, 0);
    this.torsoMesh.add(this.leftArmPivot);

    const armGeo = new THREE.BoxGeometry(0.45, 1.0, 0.45);
    this.leftArmMesh = new THREE.Mesh(armGeo, bodyMat);
    this.leftArmMesh.position.y = -0.45;
    this.leftArmMesh.castShadow = true;
    this.leftArmPivot.add(this.leftArmMesh);

    // 4. Right Arm Pivot & Mesh
    this.rightArmPivot = new THREE.Group();
    this.rightArmPivot.position.set(0.75, 0.45, 0);
    this.torsoMesh.add(this.rightArmPivot);

    this.rightArmMesh = new THREE.Mesh(armGeo, bodyMat);
    this.rightArmMesh.position.y = -0.45;
    this.rightArmMesh.castShadow = true;
    this.rightArmPivot.add(this.rightArmMesh);

    // Weapon socket attached to right arm
    this.weaponSocket = new THREE.Group();
    this.weaponSocket.position.set(0, -0.45, 0.35);
    this.rightArmMesh.add(this.weaponSocket);

    // 5. Left Leg Pivot & Mesh
    this.leftLegPivot = new THREE.Group();
    this.leftLegPivot.position.set(-0.25, -0.5, 0);
    this.torsoMesh.add(this.leftLegPivot);

    const legGeo = new THREE.BoxGeometry(0.45, 1.0, 0.45);
    this.leftLegMesh = new THREE.Mesh(legGeo, pantsMat);
    this.leftLegMesh.position.y = -0.45;
    this.leftLegMesh.castShadow = true;
    this.leftLegPivot.add(this.leftLegMesh);

    // 6. Right Leg Pivot & Mesh
    this.rightLegPivot = new THREE.Group();
    this.rightLegPivot.position.set(0.25, -0.5, 0);
    this.torsoMesh.add(this.rightLegPivot);

    this.rightLegMesh = new THREE.Mesh(legGeo, pantsMat);
    this.rightLegMesh.position.y = -0.45;
    this.rightLegMesh.castShadow = true;
    this.rightLegPivot.add(this.rightLegMesh);

    // Tag parts for raycast hit detection
    this.headMesh.userData = { isHead: true, playerId: this.playerId };
    this.torsoMesh.userData = { isBody: true, playerId: this.playerId };
    this.leftArmMesh.userData = { isBody: true, playerId: this.playerId };
    this.rightArmMesh.userData = { isBody: true, playerId: this.playerId };
    this.leftLegMesh.userData = { isBody: true, playerId: this.playerId };
    this.rightLegMesh.userData = { isBody: true, playerId: this.playerId };

    if (this.isLocal) {
      // Local player body is hidden in first-person view, or visible shadow
      this.torsoMesh.castShadow = true;
      // Keep meshes visible in 3rd person or shadow
    }
  }

  private buildNameplate(): void {
    this.nameCanvas = document.createElement('canvas');
    this.nameCanvas.width = 256;
    this.nameCanvas.height = 64;

    this.nameTexture = new THREE.CanvasTexture(this.nameCanvas);
    this.nameTexture.minFilter = THREE.LinearFilter;

    const spriteMat = new THREE.SpriteMaterial({
      map: this.nameTexture,
      transparent: true,
      depthTest: false
    });

    const sprite = new THREE.Sprite(spriteMat);
    sprite.scale.set(2.4, 0.6, 1);
    sprite.position.y = 2.4;

    this.nameplateGroup = new THREE.Group();
    this.nameplateGroup.add(sprite);
    this.root.add(this.nameplateGroup);

    this.updateNameplate(100);
  }

  public updateNameplate(hp: number): void {
    if (!this.nameCanvas) return;
    const ctx = this.nameCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, 256, 64);

    // Rounded background box
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.roundRect(8, 6, 240, 52, 10);
    ctx.fill();

    // Name text
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(this.playerName, 128, 30);

    // Mini Health Bar
    const barWidth = 190;
    const barHeight = 8;
    const barX = 33;
    const barY = 38;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = Math.max(0, Math.min(1, hp / 100));
    ctx.fillStyle = hpPercent > 0.4 ? '#00ff88' : hpPercent > 0.2 ? '#ffbb00' : '#ff2a55';
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    this.nameTexture.needsUpdate = true;
  }

  public update(
    delta: number,
    isMoving: boolean,
    isSliding: boolean,
    isJumping: boolean,
    pitch: number
  ): void {
    if (this.isDead) return;

    // Pitch adjusts head angle
    this.headMesh.rotation.x = pitch;

    if (isSliding) {
      // Sliding pose: lean torso back, legs extended forward, arms balancing
      this.torsoMesh.rotation.x = -0.45;
      this.torsoMesh.position.y = 0.55; // lowered center of gravity
      this.leftLegPivot.rotation.x = -1.1;
      this.rightLegPivot.rotation.x = -1.1;
      this.leftArmPivot.rotation.x = 0.6;
      this.rightArmPivot.rotation.x = -0.8;
      this.animTime = 0;
    } else if (isJumping) {
      // In-air pose
      this.torsoMesh.rotation.x = 0;
      this.torsoMesh.position.y = 1.0;
      this.leftLegPivot.rotation.x = 0.4;
      this.rightLegPivot.rotation.x = -0.3;
      this.leftArmPivot.rotation.x = -0.9;
      this.rightArmPivot.rotation.x = -0.9;
    } else if (isMoving) {
      // Running gait
      this.animTime += delta * 14;
      this.torsoMesh.rotation.x = 0.1;
      this.torsoMesh.position.y = 1.0 + Math.abs(Math.sin(this.animTime)) * 0.1;

      const swing = Math.sin(this.animTime) * 0.7;
      this.leftArmPivot.rotation.x = swing;
      this.rightArmPivot.rotation.x = -0.8 + swing * 0.2; // holding weapon forward
      this.leftLegPivot.rotation.x = -swing;
      this.rightLegPivot.rotation.x = swing;
    } else {
      // Idle breathing
      this.animTime += delta * 2;
      this.torsoMesh.rotation.x = 0;
      this.torsoMesh.position.y = 1.0 + Math.sin(this.animTime) * 0.02;
      this.leftLegPivot.rotation.x = 0;
      this.rightLegPivot.rotation.x = 0;
      this.leftArmPivot.rotation.x = 0;
      this.rightArmPivot.rotation.x = -0.8; // ready weapon stance
    }
  }

  public triggerRecoil(): void {
    // Right arm kicks back on firing
    this.rightArmPivot.rotation.x -= 0.25;
  }

  public shatterIntoBricks(): void {
    if (this.isDead || !CharacterModel.sceneRef) return;
    this.isDead = true;

    // Hide character model
    this.root.visible = false;

    // Detach each limb and turn into an explosive physics brick debris
    const parts = [
      { mesh: this.headMesh, size: [0.65, 0.65, 0.65], color: '#f5cd90' },
      { mesh: this.torsoMesh, size: [1.0, 1.0, 0.5], color: this.playerColor },
      { mesh: this.leftArmMesh, size: [0.45, 1.0, 0.45], color: this.playerColor },
      { mesh: this.rightArmMesh, size: [0.45, 1.0, 0.45], color: this.playerColor },
      { mesh: this.leftLegMesh, size: [0.45, 1.0, 0.45], color: '#1a2238' },
      { mesh: this.rightLegMesh, size: [0.45, 1.0, 0.45], color: '#1a2238' }
    ];

    const worldPos = new THREE.Vector3();
    this.root.getWorldPosition(worldPos);

    for (const p of parts) {
      const geo = new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]);
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.3,
        transparent: true,
        opacity: 1
      });
      const debris = new THREE.Mesh(geo, mat);
      debris.position.set(
        worldPos.x + (Math.random() - 0.5) * 0.8,
        worldPos.y + 0.8 + (Math.random() - 0.5) * 0.6,
        worldPos.z + (Math.random() - 0.5) * 0.8
      );
      debris.castShadow = true;
      CharacterModel.sceneRef.add(debris);

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;

      CharacterModel.debrisList.push({
        mesh: debris,
        vx: Math.cos(angle) * speed,
        vy: 5 + Math.random() * 7,
        vz: Math.sin(angle) * speed,
        rx: (Math.random() - 0.5) * 15,
        ry: (Math.random() - 0.5) * 15,
        rz: (Math.random() - 0.5) * 15,
        life: 3.0 // 3 seconds before cleanup
      });
    }
  }

  public respawn(x: number, y: number, z: number, yaw: number): void {
    this.isDead = false;
    this.root.visible = true;
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.updateNameplate(100);
  }

  public static updateDebris(delta: number): void {
    for (let i = CharacterModel.debrisList.length - 1; i >= 0; i--) {
      const d = CharacterModel.debrisList[i];
      d.life -= delta;

      // Gravity & velocity
      d.vy -= 22 * delta;
      d.mesh.position.x += d.vx * delta;
      d.mesh.position.y += d.vy * delta;
      d.mesh.position.z += d.vz * delta;

      // Tumbling rotation
      d.mesh.rotation.x += d.rx * delta;
      d.mesh.rotation.y += d.ry * delta;
      d.mesh.rotation.z += d.rz * delta;

      // Floor bounce
      if (d.mesh.position.y < 0.25) {
        d.mesh.position.y = 0.25;
        d.vy = -d.vy * 0.45;
        d.vx *= 0.7;
        d.vz *= 0.7;
      }

      // Fade out near end of life
      if (d.life < 0.8) {
        const mat = d.mesh.material as THREE.MeshStandardMaterial;
        mat.opacity = d.life / 0.8;
      }

      if (d.life <= 0) {
        if (d.mesh.parent) {
          d.mesh.parent.remove(d.mesh);
        }
        d.mesh.geometry.dispose();
        (d.mesh.material as THREE.Material).dispose();
        CharacterModel.debrisList.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    if (this.root.parent) {
      this.root.parent.remove(this.root);
    }
  }
}

import * as THREE from 'three';
import { WeaponType } from '../../shared/types.js';

interface PolyDebris {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  rz: number;
  life: number;
}

export class GeometricBossModel {
  public root: THREE.Group;
  public playerId: string;
  public playerName: string;
  public playerColor: string;
  public currentWeapon: WeaponType = 'plasma_launcher';
  public isDead: boolean = false;

  // Visual geometric meshes
  private visualGroup: THREE.Group;
  private coreMesh: THREE.Mesh;
  private innerCrystalMesh: THREE.Mesh;
  private wireframeShroud: THREE.Mesh;
  private ringMesh: THREE.Mesh;
  private satellites: THREE.Mesh[] = [];

  // Floating Nameplate
  public nameplateGroup: THREE.Group;
  private nameplateCanvas?: HTMLCanvasElement;
  private nameplateCtx: CanvasRenderingContext2D | null = null;
  private nameplateTexture?: THREE.CanvasTexture;

  // Hitbox colliders for weapon raycasting
  public coreCollider!: THREE.Mesh;
  public hullCollider!: THREE.Mesh;
  public satelliteColliders: THREE.Mesh[] = [];
  public hitboxContainer!: THREE.Group;

  public get torsoMesh(): THREE.Mesh {
    return this.hullCollider;
  }

  public get headMesh(): THREE.Mesh {
    return this.coreCollider;
  }

  public get targetableColliders(): THREE.Object3D[] {
    return [this.coreCollider, this.hullCollider, ...this.satelliteColliders].filter(Boolean);
  }

  // Animation and state
  private animTime: number = 0;
  private recoilImpulse: number = 0;
  private sceneRef: THREE.Scene;
  private debrisList: PolyDebris[] = [];

  constructor(
    scene: THREE.Scene,
    playerId: string,
    playerName: string,
    playerColor: string = '#f43f5e'
  ) {
    this.sceneRef = scene;
    this.playerId = playerId;
    this.playerName = playerName;
    this.playerColor = playerColor;
    this.root = new THREE.Group();
    this.visualGroup = new THREE.Group();
    this.root.add(this.visualGroup);

    // 1. Build Central Polyhedral Core
    const coreGeo = new THREE.IcosahedronGeometry(0.88, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(playerColor),
      roughness: 0.15,
      metalness: 0.85,
      flatShading: true,
      emissive: new THREE.Color(playerColor).multiplyScalar(0.4),
      emissiveIntensity: 0.6
    });
    this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
    this.coreMesh.castShadow = true;
    this.coreMesh.receiveShadow = true;
    this.visualGroup.add(this.coreMesh);

    // 2. Inner Pulsating Power Crystal
    const innerGeo = new THREE.OctahedronGeometry(0.44, 0);
    const innerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xff3b77,
      emissiveIntensity: 1.8,
      roughness: 0.1,
      metalness: 0.9,
      flatShading: true
    });
    this.innerCrystalMesh = new THREE.Mesh(innerGeo, innerMat);
    this.visualGroup.add(this.innerCrystalMesh);

    // 3. Outer Counter-Rotating Wireframe Shroud
    const shroudGeo = new THREE.IcosahedronGeometry(1.24, 0);
    const shroudMat = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      wireframe: true,
      transparent: true,
      opacity: 0.75
    });
    this.wireframeShroud = new THREE.Mesh(shroudGeo, shroudMat);
    this.visualGroup.add(this.wireframeShroud);

    // 4. Equatorial Energy Ring
    const ringGeo = new THREE.TorusGeometry(1.42, 0.035, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffaa00,
      emissive: 0xffaa00,
      emissiveIntensity: 1.2,
      roughness: 0.3
    });
    this.ringMesh = new THREE.Mesh(ringGeo, ringMat);
    this.ringMesh.rotation.x = Math.PI / 2;
    this.visualGroup.add(this.ringMesh);

    // 5. Orbiting Satellite Prisms (4 units)
    const satGeo = new THREE.TetrahedronGeometry(0.24, 0);
    const satMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      flatShading: true,
      metalness: 0.6,
      roughness: 0.2
    });

    for (let i = 0; i < 4; i++) {
      const sat = new THREE.Mesh(satGeo, satMat);
      this.satellites.push(sat);
      this.visualGroup.add(sat);
    }

    // 6. Setup Hitbox Colliders for Precision Raycast
    this.hitboxContainer = new THREE.Group();
    this.root.add(this.hitboxContainer);

    const invisMat = new THREE.MeshBasicMaterial({
      visible: false,
      wireframe: true
    });

    // Core Collider (Critical hit / headshot equivalent)
    this.coreCollider = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8), invisMat);
    this.coreCollider.position.set(0, 0, 0);
    this.coreCollider.userData = {
      playerId: this.playerId,
      isHead: true,
      isHeadshot: true,
      part: 'core'
    };
    this.hitboxContainer.add(this.coreCollider);

    // Hull Collider (Body hit)
    this.hullCollider = new THREE.Mesh(new THREE.SphereGeometry(1.22, 10, 10), invisMat);
    this.hullCollider.position.set(0, 0, 0);
    this.hullCollider.userData = {
      playerId: this.playerId,
      isHead: false,
      isHeadshot: false,
      part: 'hull'
    };
    this.hitboxContainer.add(this.hullCollider);

    // Satellite Colliders
    for (let i = 0; i < 4; i++) {
      const satCol = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), invisMat);
      satCol.userData = {
        playerId: this.playerId,
        isHead: false,
        isHeadshot: false,
        part: 'satellite'
      };
      this.satelliteColliders.push(satCol);
      this.hitboxContainer.add(satCol);
    }

    // 7. Overhead Nameplate
    this.nameplateGroup = new THREE.Group();
    if (typeof document !== 'undefined') {
      this.nameplateCanvas = document.createElement('canvas');
      this.nameplateCanvas.width = 300;
      this.nameplateCanvas.height = 76;
      this.nameplateCtx = this.nameplateCanvas.getContext('2d');
      this.nameplateTexture = new THREE.CanvasTexture(this.nameplateCanvas);
      this.nameplateTexture.minFilter = THREE.LinearFilter;

      const spriteMat = new THREE.SpriteMaterial({
        map: this.nameplateTexture,
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(3.0, 0.76, 1.0);
      this.nameplateGroup.position.set(0, 2.25, 0);
      this.nameplateGroup.add(sprite);

      this.updateNameplate(100);
    }
    this.root.add(this.nameplateGroup);
    this.sceneRef.add(this.root);
  }

  public updateNameplate(hp: number, maxHp: number = 100): void {
    if (!this.nameplateCtx) return;
    const ctx = this.nameplateCtx;

    ctx.clearRect(0, 0, 300, 76);

    // Frame backdrop
    ctx.fillStyle = 'rgba(10, 14, 24, 0.88)';
    ctx.roundRect(10, 8, 280, 60, 12);
    ctx.fill();

    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 3;
    ctx.roundRect(10, 8, 280, 60, 12);
    ctx.stroke();

    // Name text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.playerName.slice(0, 18), 150, 28);

    // HP Bar background
    ctx.fillStyle = '#331118';
    ctx.fillRect(25, 48, 250, 10);

    // HP Bar fill
    const pct = Math.max(0, Math.min(1.0, hp / (maxHp || 100)));
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(25, 48, 250 * pct, 10);

    if (this.nameplateTexture) {
      this.nameplateTexture.needsUpdate = true;
    }
  }

  public triggerRecoil(): void {
    this.recoilImpulse = 0.28;
  }

  public getMuzzlePosition(): THREE.Vector3 {
    // Projectiles emit from front apex of the rotating core
    const m = new THREE.Vector3(0, 0, -1.2);
    m.applyQuaternion(this.root.quaternion);
    m.add(this.root.position);
    return m;
  }

  public setEquippedWeapon(weapon: WeaponType): void {
    this.currentWeapon = weapon;
  }

  public respawn(x: number, y: number, z: number, yaw: number): void {
    this.isDead = false;
    this.visualGroup.visible = true;
    this.nameplateGroup.visible = true;
    this.root.position.set(x, y, z);
    this.root.rotation.y = yaw;
    this.updateNameplate(100);
  }

  public update(
    dt: number,
    _isMoving: boolean = false,
    _isSliding: boolean = false,
    _isJumping: boolean = false,
    pitch: number = 0
  ): void {
    this.animTime += dt;

    // Decay recoil impulse
    if (this.recoilImpulse > 0) {
      this.recoilImpulse = Math.max(0, this.recoilImpulse - dt * 2.0);
    }

    if (this.visualGroup.visible) {
      // Rotate polyhedral core
      this.coreMesh.rotation.x += 1.2 * dt;
      this.coreMesh.rotation.y += 1.6 * dt;

      // Pulse inner crystal
      const pulse = 1.0 + Math.sin(this.animTime * 4.0) * 0.15;
      this.innerCrystalMesh.scale.setScalar(pulse);
      this.innerCrystalMesh.rotation.x -= 2.0 * dt;
      this.innerCrystalMesh.rotation.z += 2.0 * dt;

      // Counter-rotate outer wireframe shroud
      this.wireframeShroud.rotation.x -= 0.8 * dt;
      this.wireframeShroud.rotation.y -= 1.1 * dt;
      this.wireframeShroud.rotation.z += 0.5 * dt;

      // Tilt energy ring with aim pitch
      this.ringMesh.rotation.z += 1.5 * dt;
      this.visualGroup.rotation.x = pitch * 0.5;

      // Recoil scale compression
      const recoilScale = 1.0 + this.recoilImpulse * 0.3;
      this.visualGroup.scale.set(recoilScale, recoilScale, 1.0 - this.recoilImpulse * 0.2);

      // Orbit satellite prisms
      const satRadius = 1.95;
      for (let i = 0; i < this.satellites.length; i++) {
        const theta = this.animTime * 2.2 + (i * Math.PI) / 2;
        const satY = Math.sin(this.animTime * 3.0 + i * 1.5) * 0.35;
        const satX = Math.cos(theta) * satRadius;
        const satZ = Math.sin(theta) * satRadius;

        const sat = this.satellites[i];
        sat.position.set(satX, satY, satZ);
        sat.rotation.x += 3.0 * dt;
        sat.rotation.y += 2.5 * dt;

        // Synchronize satellite collider world positions
        if (this.satelliteColliders[i]) {
          this.satelliteColliders[i].position.set(satX, satY, satZ);
        }
      }
    }

    // Tick shattering poly debris
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.sceneRef.remove(d.mesh);
        d.mesh.geometry.dispose();
        this.debrisList.splice(i, 1);
        continue;
      }
      d.mesh.position.x += d.vx * dt;
      d.mesh.position.y += d.vy * dt;
      d.mesh.position.z += d.vz * dt;
      d.vy -= 18.0 * dt; // Gravity
      d.mesh.rotation.x += d.rx * dt;
      d.mesh.rotation.y += d.ry * dt;
      d.mesh.rotation.z += d.rz * dt;

      const fade = Math.max(0, d.life / 2.0);
      d.mesh.scale.setScalar(fade);
    }
  }

  public shatterIntoBricks(): void {
    if (this.isDead) return;
    this.isDead = true;

    this.visualGroup.visible = false;
    this.nameplateGroup.visible = false;

    // Explode into 24 stylized glowing geometric fragments
    const geos = [
      new THREE.TetrahedronGeometry(0.28, 0),
      new THREE.OctahedronGeometry(0.26, 0),
      new THREE.ConeGeometry(0.2, 0.45, 4)
    ];

    const mats = [
      new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xf43f5e, emissiveIntensity: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0x00f3ff, emissive: 0x00f3ff, emissiveIntensity: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xffaa00, emissiveIntensity: 0.8, flatShading: true }),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.2, flatShading: true })
    ];

    for (let i = 0; i < 24; i++) {
      const geo = geos[i % geos.length];
      const mat = mats[i % mats.length];
      const shard = new THREE.Mesh(geo, mat);

      shard.position.copy(this.root.position);
      shard.position.y += 0.5 + Math.random() * 0.8;
      shard.position.x += (Math.random() - 0.5) * 0.6;
      shard.position.z += (Math.random() - 0.5) * 0.6;

      const angle = Math.random() * Math.PI * 2;
      const speed = 4.0 + Math.random() * 6.0;

      this.sceneRef.add(shard);
      this.debrisList.push({
        mesh: shard,
        vx: Math.cos(angle) * speed,
        vy: 4.5 + Math.random() * 5.0,
        vz: Math.sin(angle) * speed,
        rx: (Math.random() - 0.5) * 14,
        ry: (Math.random() - 0.5) * 14,
        rz: (Math.random() - 0.5) * 14,
        life: 2.0
      });
    }
  }

  public dispose(): void {
    this.sceneRef.remove(this.root);
    for (const d of this.debrisList) {
      this.sceneRef.remove(d.mesh);
      d.mesh.geometry.dispose();
    }
    this.debrisList = [];

    this.coreMesh.geometry.dispose();
    this.innerCrystalMesh.geometry.dispose();
    this.wireframeShroud.geometry.dispose();
    this.ringMesh.geometry.dispose();
    for (const sat of this.satellites) {
      sat.geometry.dispose();
    }
    if (this.nameplateTexture) {
      this.nameplateTexture.dispose();
    }
  }
}

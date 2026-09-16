import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponStats, WeaponType } from '../../shared/types.js';
import { WEAPONS } from '../../shared/constants.js';
import { FXManager } from './FXManager.js';
import { AudioManager } from './AudioManager.js';

interface Tracer {
  line: THREE.Line;
  posAttr: THREE.BufferAttribute;
  startX: number;
  startY: number;
  startZ: number;
  endX: number;
  endY: number;
  endZ: number;
  dist: number;
  progress: number;
  speed: number;
}

interface ActivePlasmaProjectile {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  targetPos: THREE.Vector3;
}

export class WeaponManager {
  public currentWeaponType: WeaponType = 'rifle';
  public ammoInMag: Record<WeaponType, number> = {
    rifle: WEAPONS.rifle.magazineSize,
    shotgun: WEAPONS.shotgun.magazineSize,
    sniper: WEAPONS.sniper.magazineSize,
    katana: WEAPONS.katana.magazineSize,
    needle_carbine: WEAPONS.needle_carbine.magazineSize,
    plasma_launcher: WEAPONS.plasma_launcher.magazineSize,
    railgun: WEAPONS.railgun.magazineSize,
    arc_disruptor: WEAPONS.arc_disruptor.magazineSize
  };

  public ammoReserve: Record<WeaponType, number> = {
    rifle: 60,
    shotgun: 24,
    sniper: 12,
    katana: 0,
    needle_carbine: 56,
    plasma_launcher: 16,
    railgun: 8,
    arc_disruptor: 80
  };

  public isReloading: boolean = false;
  public reloadProgress: number = 0; // 0 to 1
  private lastFireTime: number = 0;

  // Railgun charging state
  public railgunChargeProgress: number = 0;
  public isChargingRailgun: boolean = false;

  // Active plasma projectiles
  private activePlasmaOrbs: ActivePlasmaProjectile[] = [];

  // Viewmodel (first-person hands & gun pinned to camera)
  public viewModelContainer: THREE.Group;
  public viewModelPivot: THREE.Group;
  private weaponMeshes: Map<WeaponType, THREE.Group> = new Map();
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashMesh: THREE.Mesh;
  private flashDuration: number = 0;

  // Static cache of loaded weapon scenes for third-person CharacterModel reuse
  public static cachedWeaponModels: Map<WeaponType, THREE.Group> = new Map();

  private tracers: Tracer[] = [];
  private tracerPool: Tracer[] = [];
  private sceneRef: THREE.Scene;
  private fx?: FXManager;
  private audio?: AudioManager;

  // Recoil recovery
  public recoilOffset: THREE.Vector3 = new THREE.Vector3();
  public recoilRotation: THREE.Euler = new THREE.Euler();

  constructor(scene: THREE.Scene, camera: THREE.Camera, fx?: FXManager, audio?: AudioManager) {
    this.sceneRef = scene;
    this.fx = fx;
    this.audio = audio;

    this.viewModelContainer = new THREE.Group();
    camera.add(this.viewModelContainer);

    this.viewModelPivot = new THREE.Group();
    this.viewModelContainer.add(this.viewModelPivot);

    // Build procedural fallback models first (zero delay)
    this.buildProceduralWeaponModels();

    // Muzzle flash
    this.muzzleFlashLight = new THREE.PointLight('#ffdd88', 0, 10);
    this.muzzleFlashLight.position.set(0.2, -0.16, -0.85);
    this.viewModelContainer.add(this.muzzleFlashLight);

    const flashGeo = new THREE.PlaneGeometry(0.35, 0.35);
    const flashMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0.2, -0.16, -0.85);
    this.viewModelContainer.add(this.muzzleFlashMesh);

    // Load high-quality 3D GLB models from public/models/weapons/
    this.loadGLBWeapons();

    this.selectWeapon('rifle');
  }

  public get currentStats(): WeaponStats {
    return WEAPONS[this.currentWeaponType];
  }

  private buildProceduralWeaponModels(): void {
    // 1. Assault Rifle
    const rifleGroup = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2d42', roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#8d99ae', metalness: 0.6, roughness: 0.2 });
    const neonCyan = new THREE.MeshStandardMaterial({ color: '#00d2ff', emissive: '#00d2ff', emissiveIntensity: 0.6 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.6), darkMat);
    rifleGroup.add(body);
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), metalMat);
    barrel.position.set(0, 0.04, -0.45);
    rifleGroup.add(barrel);
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), darkMat);
    mag.position.set(0, -0.15, -0.05);
    mag.rotation.x = 0.2;
    rifleGroup.add(mag);
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.15), neonCyan);
    sight.position.set(0, 0.11, 0.05);
    rifleGroup.add(sight);

    rifleGroup.position.set(0.22, -0.22, -0.5);
    this.viewModelPivot.add(rifleGroup);
    this.weaponMeshes.set('rifle', rifleGroup);

    // 2. Shotgun
    const shotgunGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.6 });
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.7), metalMat);
    shotgunGroup.add(sBody);
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), darkMat);
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, 0.04, -0.5);
    shotgunGroup.add(sBarrel);
    const sPump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), woodMat);
    sPump.position.set(0, -0.04, -0.38);
    shotgunGroup.add(sPump);

    shotgunGroup.position.set(0.22, -0.22, -0.5);
    this.viewModelPivot.add(shotgunGroup);
    this.weaponMeshes.set('shotgun', shotgunGroup);

    // 3. Sniper
    const sniperGroup = new THREE.Group();
    const snipBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.9), darkMat);
    sniperGroup.add(snipBody);
    const snipBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), metalMat);
    snipBarrel.position.set(0, 0.03, -0.75);
    sniperGroup.add(snipBarrel);
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 12), darkMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, -0.05);
    sniperGroup.add(scope);

    sniperGroup.position.set(0.22, -0.22, -0.55);
    this.viewModelPivot.add(sniperGroup);
    this.weaponMeshes.set('sniper', sniperGroup);

    // 4. Knife / Melee
    const knifeGroup = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), darkMat);
    knifeGroup.add(handle);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), metalMat);
    guard.position.y = 0.16;
    knifeGroup.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.02), neonCyan);
    blade.position.y = 0.65;
    knifeGroup.add(blade);

    knifeGroup.rotation.set(-Math.PI / 4, Math.PI / 6, -Math.PI / 6);
    knifeGroup.position.set(0.24, -0.25, -0.4);
    this.viewModelPivot.add(knifeGroup);
    this.weaponMeshes.set('katana', knifeGroup);

    // 5. Crystalline Needler
    const needlerGroup = new THREE.Group();
    const needleDark = new THREE.MeshStandardMaterial({ color: '#1e1b4b', roughness: 0.35, metalness: 0.4 });
    const needlePurple = new THREE.MeshStandardMaterial({ color: '#7c3aed', roughness: 0.25, metalness: 0.5 });
    const crystalPink = new THREE.MeshStandardMaterial({
      color: '#ff00aa',
      emissive: '#ff00aa',
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.1
    });

    const nBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.55), needleDark);
    needlerGroup.add(nBody);
    const nCrest = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.42), needlePurple);
    nCrest.position.set(0, 0.11, -0.04);
    needlerGroup.add(nCrest);

    // 12 glowing crystalline needles along the top spine
    for (let c = 0; c < 12; c++) {
      const needle = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.09, 5), crystalPink);
      needle.rotation.x = Math.PI / 4;
      needle.position.set(
        (c % 2 === 0 ? -0.025 : 0.025),
        0.18,
        -0.2 + (c * 0.035)
      );
      needlerGroup.add(needle);
    }
    const nBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 8), needleDark);
    nBarrel.rotation.x = Math.PI / 2;
    nBarrel.position.set(0, 0.02, -0.38);
    needlerGroup.add(nBarrel);

    needlerGroup.position.set(0.22, -0.22, -0.48);
    this.viewModelPivot.add(needlerGroup);
    this.weaponMeshes.set('needle_carbine', needlerGroup);

    // 6. Quantum Plasma Launcher
    const plasmaGroup = new THREE.Group();
    const launcherDark = new THREE.MeshStandardMaterial({ color: '#0f172a', roughness: 0.4, metalness: 0.7 });
    const bronzeMat = new THREE.MeshStandardMaterial({ color: '#d97706', roughness: 0.3, metalness: 0.8 });
    const plasmaGlow = new THREE.MeshStandardMaterial({
      color: '#b537f2',
      emissive: '#d946ef',
      emissiveIntensity: 1.2,
      roughness: 0.1
    });

    const plBody = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.65), launcherDark);
    plasmaGroup.add(plBody);

    // Twin containment barrels
    const barrelL = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 12), launcherDark);
    barrelL.rotation.x = Math.PI / 2;
    barrelL.position.set(-0.045, 0.02, -0.42);
    plasmaGroup.add(barrelL);
    const barrelR = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.4, 12), launcherDark);
    barrelR.rotation.x = Math.PI / 2;
    barrelR.position.set(0.045, 0.02, -0.42);
    plasmaGroup.add(barrelR);

    // Center glowing plasma sphere
    const plasmaCore = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 16), plasmaGlow);
    plasmaCore.position.set(0, 0.08, -0.05);
    plasmaGroup.add(plasmaCore);

    // Bronze magnetic accelerator rings
    [-0.3, -0.4, -0.5].forEach((zPos) => {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.065, 0.012, 8, 16), bronzeMat);
      ring.position.set(0, 0.02, zPos);
      plasmaGroup.add(ring);
    });

    plasmaGroup.position.set(0.22, -0.22, -0.5);
    this.viewModelPivot.add(plasmaGroup);
    this.weaponMeshes.set('plasma_launcher', plasmaGroup);

    // 7. Hyper-Velocity Railgun
    const railgunGroup = new THREE.Group();
    const railDark = new THREE.MeshStandardMaterial({ color: '#020617', roughness: 0.2, metalness: 0.8 });
    const copperRail = new THREE.MeshStandardMaterial({ color: '#ea580c', roughness: 0.25, metalness: 0.9 });
    const cyanIon = new THREE.MeshStandardMaterial({
      color: '#00ffff',
      emissive: '#00ffff',
      emissiveIntensity: 1.0
    });

    const rgBody = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.9), railDark);
    railgunGroup.add(rgBody);

    // Top & bottom copper rails
    const railTop = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.7), copperRail);
    railTop.position.set(0, 0.06, -0.65);
    railgunGroup.add(railTop);
    const railBottom = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.025, 0.7), copperRail);
    railBottom.position.set(0, -0.03, -0.65);
    railgunGroup.add(railBottom);

    // Central ionization guide channel
    const ionSlot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.04, 0.68), cyanIon);
    ionSlot.position.set(0, 0.015, -0.65);
    railgunGroup.add(ionSlot);

    // Capacitor power cells
    const cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), copperRail);
    cap1.rotation.x = Math.PI / 2;
    cap1.position.set(0.05, 0.11, 0.05);
    railgunGroup.add(cap1);
    const cap2 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 8), copperRail);
    cap2.rotation.x = Math.PI / 2;
    cap2.position.set(-0.05, 0.11, 0.05);
    railgunGroup.add(cap2);

    railgunGroup.position.set(0.22, -0.22, -0.55);
    this.viewModelPivot.add(railgunGroup);
    this.weaponMeshes.set('railgun', railgunGroup);

    // 8. Tesla Arc Disruptor
    const teslaGroup = new THREE.Group();
    const teslaBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.5), darkMat);
    teslaGroup.add(teslaBody);

    // Dual forward high-voltage tungsten electrodes
    const prongL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.25), metalMat);
    prongL.position.set(-0.06, 0.04, -0.38);
    prongL.rotation.y = -0.15;
    teslaGroup.add(prongL);

    const prongR = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.25), metalMat);
    prongR.position.set(0.06, 0.04, -0.38);
    prongR.rotation.y = 0.15;
    teslaGroup.add(prongR);

    // Center Tesla spark emitter
    const sparkCathode = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), neonCyan);
    sparkCathode.position.set(0, 0.04, -0.3);
    teslaGroup.add(sparkCathode);

    // Induction coil
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 12), bronzeMat);
    coil.rotation.x = Math.PI / 2;
    coil.position.set(0, 0.04, -0.1);
    teslaGroup.add(coil);

    teslaGroup.position.set(0.22, -0.22, -0.45);
    this.viewModelPivot.add(teslaGroup);
    this.weaponMeshes.set('arc_disruptor', teslaGroup);

    // Cache procedural models initially for third-person CharacterModel
    this.weaponMeshes.forEach((mesh, type) => {
      WeaponManager.cachedWeaponModels.set(type, mesh.clone());
    });
  }

  private loadGLBWeapons(): void {
    const loader = new GLTFLoader();

    const configs: {
      type: WeaponType;
      url: string;
      scale: number;
      position: [number, number, number];
      rotation: [number, number, number];
      muzzleOffset: [number, number, number];
    }[] = [
      {
        type: 'rifle',
        url: '/models/weapons/rifle_001.glb',
        scale: 0.36,
        // Model length is on +X, rotate Y +PI/2 to point down -Z (forward)
        position: [0.22, -0.24, -0.42],
        rotation: [0, Math.PI / 2, 0],
        muzzleOffset: [0.22, -0.16, -0.85]
      },
      {
        type: 'shotgun',
        url: '/models/weapons/shotgun_001.glb',
        scale: 0.36,
        position: [0.22, -0.24, -0.44],
        rotation: [0, Math.PI / 2, 0],
        muzzleOffset: [0.22, -0.16, -0.85]
      },
      {
        type: 'sniper',
        url: '/models/weapons/sniper_rifle_001.glb',
        scale: 0.32,
        position: [0.22, -0.24, -0.48],
        rotation: [0, Math.PI / 2, 0],
        muzzleOffset: [0.22, -0.15, -0.92]
      },
      {
        type: 'katana', // Knife model
        url: '/models/weapons/knife_001.glb',
        scale: 0.55,
        position: [0.22, -0.25, -0.38],
        // Knife length is on +Y, angle forward
        rotation: [-Math.PI / 2.8, Math.PI / 5, -Math.PI / 10],
        muzzleOffset: [0.22, -0.2, -0.6]
      }
    ];

    configs.forEach((cfg) => {
      loader.load(
        cfg.url,
        (gltf) => {
          const model = gltf.scene;
          model.scale.setScalar(cfg.scale);
          model.position.set(...cfg.position);
          model.rotation.set(...cfg.rotation);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              // Ensure material is responsive to lights
              const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
              if (mat) {
                mat.roughness = 0.35;
                mat.metalness = 0.2;
              }
            }
          });

          // Cache for CharacterModel
          WeaponManager.cachedWeaponModels.set(cfg.type, model.clone());

          // Replace the procedural fallback model
          const oldMesh = this.weaponMeshes.get(cfg.type);
          if (oldMesh) {
            this.viewModelPivot.remove(oldMesh);
          }

          this.viewModelPivot.add(model);
          this.weaponMeshes.set(cfg.type, model);

          // Update visibility according to active weapon
          model.visible = this.currentWeaponType === cfg.type;

          console.log(`[WeaponManager] Successfully loaded 3D GLB model for ${cfg.type}`);
        },
        undefined,
        (err) => {
          console.warn(`[WeaponManager] Could not load ${cfg.url}, using procedural fallback:`, err);
        }
      );
    });
  }

  public selectWeapon(type: WeaponType): void {
    this.currentWeaponType = type;
    this.isReloading = false;
    this.reloadProgress = 0;

    for (const [t, mesh] of this.weaponMeshes.entries()) {
      mesh.visible = t === type;
    }

    // Adjust muzzle flash offset for weapon
    if (type === 'sniper') {
      this.muzzleFlashLight.position.set(0.22, -0.15, -0.92);
      this.muzzleFlashMesh.position.set(0.22, -0.15, -0.92);
    } else {
      this.muzzleFlashLight.position.set(0.22, -0.16, -0.85);
      this.muzzleFlashMesh.position.set(0.22, -0.16, -0.85);
    }
  }

  public canFire(): boolean {
    if (this.isReloading) return false;
    const now = performance.now() / 1000;
    const stats = this.currentStats;
    if (now - this.lastFireTime < stats.fireRate) return false;
    if (this.ammoInMag[this.currentWeaponType] <= 0 && stats.type !== 'katana') return false;
    return true;
  }

  public grantAmmo(amount: number = 60): void {
    const stats = this.currentStats;
    if (stats.type === 'katana') return;

    this.ammoReserve[this.currentWeaponType] += amount;
    // Immediately refill current magazine
    const needed = stats.magazineSize - this.ammoInMag[this.currentWeaponType];
    const fill = Math.min(needed, this.ammoReserve[this.currentWeaponType]);
    this.ammoInMag[this.currentWeaponType] += fill;
    this.ammoReserve[this.currentWeaponType] -= fill;

    this.isReloading = false;
    this.reloadProgress = 0;
  }

  public startReload(): boolean {
    const stats = this.currentStats;
    if (stats.type === 'katana') return false;
    if (this.isReloading) return false;
    if (this.ammoInMag[this.currentWeaponType] >= stats.magazineSize) return false;
    if (this.ammoReserve[this.currentWeaponType] <= 0) return false;

    this.isReloading = true;
    this.reloadProgress = 0;
    return true;
  }

  public fire(
    camera: THREE.Camera,
    targetableMeshes: THREE.Object3D[],
    _isFiringInput: boolean = true
  ): {
    fired: boolean;
    hitPlayerId?: string;
    isHeadshot?: boolean;
    hitPoint?: [number, number, number];
    tracerEnd?: [number, number, number];
    isCharging?: boolean;
  } {
    if (!this.canFire()) {
      if (this.ammoInMag[this.currentWeaponType] <= 0 && !this.isReloading && this.currentWeaponType !== 'katana') {
        this.startReload();
      }
      return { fired: false };
    }

    const stats = this.currentStats;

    // Railgun charge-up mechanic (0.45s capacitor ramp)
    if (stats.type === 'railgun') {
      if (!this.isChargingRailgun) {
        this.isChargingRailgun = true;
        this.railgunChargeProgress = 0;
        this.audio?.playRailgunCharge();
        return { fired: false, isCharging: true };
      }
      if (this.railgunChargeProgress < 1.0) {
        return { fired: false, isCharging: true };
      }
      // Reached full 100% capacitor charge!
      this.isChargingRailgun = false;
      this.railgunChargeProgress = 0;
    }

    this.lastFireTime = performance.now() / 1000;

    if (stats.type !== 'katana') {
      this.ammoInMag[this.currentWeaponType]--;
    }

    // Trigger visual muzzle flash
    this.triggerMuzzleFlash();

    // Weapon recoil animation on pivot
    this.recoilOffset.z = stats.type === 'sniper' || stats.type === 'railgun' ? 0.18
      : stats.type === 'plasma_launcher' ? 0.15
      : stats.type === 'shotgun' ? 0.14 : 0.09;
    this.recoilRotation.x = stats.type === 'sniper' || stats.type === 'railgun' ? 0.24
      : stats.type === 'plasma_launcher' ? 0.18
      : stats.type === 'shotgun' ? 0.20 : 0.12;

    const raycaster = new THREE.Raycaster();
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);

    // Apply spread
    if (stats.spread > 0) {
      const spreadX = (Math.random() - 0.5) * stats.spread;
      const spreadY = (Math.random() - 0.5) * stats.spread;
      camDir.x += spreadX;
      camDir.y += spreadY;
      camDir.normalize();
    }

    const camPos = new THREE.Vector3();
    camera.getWorldPosition(camPos);
    const muzzlePos = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(muzzlePos);

    let hitPlayerId: string | undefined;
    let isHeadshot = false;
    let hitPointVec: THREE.Vector3 = camPos.clone().add(camDir.clone().multiplyScalar(stats.range));

    // Archetype 1: Arc Disruptor (Tesla Cone auto-targeting within 16m)
    if (stats.type === 'arc_disruptor') {
      let bestDist = 16;
      let bestTargetId: string | undefined;
      let bestPoint = hitPointVec;

      for (const root of targetableMeshes) {
        root.traverse((child) => {
          if (child.userData?.playerId && !bestTargetId) {
            const targetPos = new THREE.Vector3();
            child.getWorldPosition(targetPos);
            targetPos.y += 0.9;
            const toTarget = targetPos.clone().sub(camPos);
            const dist = toTarget.length();
            if (dist <= 16) {
              toTarget.normalize();
              const angle = camDir.angleTo(toTarget);
              if (angle < 0.45 && dist < bestDist) {
                bestDist = dist;
                bestTargetId = child.userData.playerId;
                bestPoint = targetPos;
              }
            }
          }
        });
      }

      if (bestTargetId) {
        hitPlayerId = bestTargetId;
        hitPointVec = bestPoint;
      } else {
        // Raycast straight forward to check for wall
        raycaster.set(camPos, camDir);
        raycaster.far = 16;
        const hits = raycaster.intersectObjects(targetableMeshes, true);
        if (hits.length > 0) {
          hitPointVec = hits[0].point;
        }
      }

      this.fx?.spawnTeslaArc(muzzlePos, hitPointVec);
      return {
        fired: true,
        hitPlayerId,
        isHeadshot: false,
        hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
        tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
      };
    }

    // Archetype 2: Needle Carbine (Crystalline Ricochet up to 2 bounces)
    if (stats.type === 'needle_carbine') {
      let curOrigin = camPos.clone();
      let curDir = camDir.clone();
      let bouncesLeft = 2;
      const bouncePoints: THREE.Vector3[] = [muzzlePos.clone()];

      while (bouncesLeft >= 0) {
        raycaster.set(curOrigin, curDir);
        raycaster.far = stats.range;
        const hits = raycaster.intersectObjects(targetableMeshes, true);
        if (hits.length === 0) {
          hitPointVec = curOrigin.clone().add(curDir.clone().multiplyScalar(stats.range));
          bouncePoints.push(hitPointVec.clone());
          break;
        }

        const hit = hits[0];
        hitPointVec = hit.point;
        bouncePoints.push(hitPointVec.clone());

        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData?.playerId) {
          obj = obj.parent;
        }

        if (obj && obj.userData?.playerId) {
          hitPlayerId = obj.userData.playerId;
          isHeadshot = Boolean(hit.object.userData?.isHead || hit.object.userData?.isHeadshot);
          break; // Hit enemy!
        }

        if (hit.face && bouncesLeft > 0) {
          const normal = hit.face.normal.clone().applyQuaternion(hit.object.quaternion).normalize();
          this.fx?.spawnNeedleRicochet(hit.point, normal);
          curDir = curDir.clone().sub(normal.clone().multiplyScalar(2 * curDir.dot(normal))).normalize();
          curOrigin = hit.point.clone().add(curDir.clone().multiplyScalar(0.08));
          bouncesLeft--;
        } else {
          break;
        }
      }

      for (let b = 0; b < bouncePoints.length - 1; b++) {
        this.spawnTracer(bouncePoints[b], bouncePoints[b + 1]);
      }

      return {
        fired: true,
        hitPlayerId,
        isHeadshot,
        hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
        tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
      };
    }

    // Archetype 3: Quantum Plasma Launcher (Ballistic arc projectile + splash)
    if (stats.type === 'plasma_launcher') {
      raycaster.set(camPos, camDir);
      raycaster.far = stats.range;
      const hits = raycaster.intersectObjects(targetableMeshes, true);
      if (hits.length > 0) {
        hitPointVec = hits[0].point;
        let obj: THREE.Object3D | null = hits[0].object;
        while (obj && !obj.userData?.playerId) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.playerId) {
          hitPlayerId = obj.userData.playerId;
          isHeadshot = Boolean(hits[0].object.userData?.isHead || hits[0].object.userData?.isHeadshot);
        }
      }

      // Spawn traveling plasma orb entity
      const orbMat = new THREE.MeshBasicMaterial({
        color: '#d946ef',
        transparent: true,
        opacity: 0.95
      });
      const orbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), orbMat);
      orbMesh.position.copy(muzzlePos);
      const orbLight = new THREE.PointLight('#b537f2', 2.5, 5);
      orbMesh.add(orbLight);
      this.sceneRef.add(orbMesh);

      const speed = stats.projectileSpeed || 36;
      const dirToTarget = hitPointVec.clone().sub(muzzlePos).normalize();
      const velocity = dirToTarget.multiplyScalar(speed);
      const flightDist = muzzlePos.distanceTo(hitPointVec);
      const flightTime = Math.max(0.05, flightDist / speed);

      this.activePlasmaOrbs.push({
        mesh: orbMesh,
        light: orbLight,
        position: muzzlePos.clone(),
        velocity,
        life: flightTime,
        targetPos: hitPointVec.clone()
      });

      return {
        fired: true,
        hitPlayerId,
        isHeadshot,
        hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
        tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
      };
    }

    // Archetype 4: Hyper-Velocity Railgun (Piercing Supersonic Beam)
    if (stats.type === 'railgun') {
      raycaster.set(camPos, camDir);
      raycaster.far = stats.range;
      const hits = raycaster.intersectObjects(targetableMeshes, true);

      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj && !obj.userData?.playerId) {
          obj = obj.parent;
        }
        if (obj && obj.userData?.playerId) {
          if (!hitPlayerId) {
            hitPlayerId = obj.userData.playerId;
            isHeadshot = Boolean(hit.object.userData?.isHead || hit.object.userData?.isHeadshot);
          }
        } else {
          // Solid map geometry stops the line
          hitPointVec = hit.point;
          break;
        }
      }

      this.fx?.spawnRailgunTracer(muzzlePos, hitPointVec);

      return {
        fired: true,
        hitPlayerId,
        isHeadshot,
        hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
        tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
      };
    }

    // Default: Conventional Weapons (rifle, shotgun, sniper, katana)
    raycaster.set(camPos, camDir);
    raycaster.far = stats.range;
    const intersects = raycaster.intersectObjects(targetableMeshes, true);

    for (const hit of intersects) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData?.playerId) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.playerId) {
        hitPlayerId = obj.userData.playerId;
        isHeadshot = Boolean(hit.object.userData?.isHead || hit.object.userData?.isHeadshot);
        hitPointVec = hit.point;
        break;
      } else {
        hitPointVec = hit.point;
        break;
      }
    }

    this.spawnTracer(muzzlePos, hitPointVec);

    return {
      fired: true,
      hitPlayerId,
      isHeadshot,
      hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
      tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
    };
  }

  private triggerMuzzleFlash(): void {
    this.muzzleFlashLight.intensity = 5;
    (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0.9;
    this.muzzleFlashMesh.rotation.z = Math.random() * Math.PI * 2;
    this.flashDuration = 0.05;
  }

  public spawnTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz) || 1;

    let tr = this.tracerPool.pop();
    if (!tr) {
      const positions = new Float32Array(6);
      const geo = new THREE.BufferGeometry();
      const posAttr = new THREE.BufferAttribute(positions, 3);
      geo.setAttribute('position', posAttr);
      const mat = new THREE.LineBasicMaterial({
        color: '#ffee55',
        linewidth: 2,
        transparent: true,
        opacity: 0.85
      });
      const line = new THREE.Line(geo, mat);
      tr = {
        line,
        posAttr,
        startX: 0,
        startY: 0,
        startZ: 0,
        endX: 0,
        endY: 0,
        endZ: 0,
        dist: 1,
        progress: 0,
        speed: 180
      };
    }

    (tr.line.material as THREE.LineBasicMaterial).color.set(
      this.currentWeaponType === 'needle_carbine' ? '#ff00aa'
      : this.currentWeaponType === 'sniper' ? '#ff3366'
      : this.currentWeaponType === 'plasma_launcher' ? '#b537f2'
      : '#ffee55'
    );

    tr.startX = from.x;
    tr.startY = from.y;
    tr.startZ = from.z;
    tr.endX = to.x;
    tr.endY = to.y;
    tr.endZ = to.z;
    tr.dist = dist;
    tr.progress = 0;

    // Set initial position
    const pArr = tr.posAttr.array as Float32Array;
    pArr[0] = from.x; pArr[1] = from.y; pArr[2] = from.z;
    pArr[3] = from.x; pArr[4] = from.y; pArr[5] = from.z;
    tr.posAttr.needsUpdate = true;

    this.sceneRef.add(tr.line);
    this.tracers.push(tr);
  }

  public update(delta: number, isFiringInput: boolean = false): void {
    // Update muzzle flash
    if (this.flashDuration > 0) {
      this.flashDuration -= delta;
      if (this.flashDuration <= 0) {
        this.muzzleFlashLight.intensity = 0;
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }

    // Update railgun capacitor charging
    if (this.currentWeaponType === 'railgun') {
      if (this.isChargingRailgun) {
        this.railgunChargeProgress += delta / (this.currentStats.chargeTime || 0.45);
        if (this.railgunChargeProgress > 1.0) this.railgunChargeProgress = 1.0;
        this.viewModelPivot.position.x += (Math.random() - 0.5) * 0.003 * this.railgunChargeProgress;
        this.viewModelPivot.position.y += (Math.random() - 0.5) * 0.003 * this.railgunChargeProgress;
      }
      if (!isFiringInput) {
        this.isChargingRailgun = false;
        this.railgunChargeProgress = 0;
      }
    } else {
      this.isChargingRailgun = false;
      this.railgunChargeProgress = 0;
    }

    // Update active plasma projectiles
    for (let i = this.activePlasmaOrbs.length - 1; i >= 0; i--) {
      const orb = this.activePlasmaOrbs[i];
      orb.life -= delta;
      orb.position.addScaledVector(orb.velocity, delta);
      orb.velocity.y -= 3.5 * delta; // slight ballistic arc
      orb.mesh.position.copy(orb.position);

      if (orb.life <= 0 || orb.position.y <= 0.1) {
        this.fx?.spawnPlasmaExplosion(orb.targetPos);
        this.audio?.playPlasmaExplosion();
        this.sceneRef.remove(orb.mesh);
        orb.mesh.geometry.dispose();
        (orb.mesh.material as THREE.Material).dispose();
        this.activePlasmaOrbs.splice(i, 1);
      }
    }

    // Update reload progress with clean pivot rotation & translation
    if (this.isReloading) {
      const stats = this.currentStats;
      this.reloadProgress += delta / stats.reloadTime;

      this.viewModelPivot.position.y = -Math.sin(this.reloadProgress * Math.PI) * 0.18;
      this.viewModelPivot.rotation.z = Math.sin(this.reloadProgress * Math.PI) * 0.35;

      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
        const needed = stats.magazineSize - this.ammoInMag[this.currentWeaponType];
        const fill = Math.min(needed, this.ammoReserve[this.currentWeaponType]);
        this.ammoInMag[this.currentWeaponType] += fill;
        this.ammoReserve[this.currentWeaponType] -= fill;
        this.viewModelPivot.position.y = 0;
        this.viewModelPivot.rotation.z = 0;
      }
    } else {
      this.viewModelPivot.position.y = 0;
      this.viewModelPivot.rotation.z = 0;
    }

    // Recover weapon recoil smoothly on viewModelPivot
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 15);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, delta * 15);

    if (!this.isReloading) {
      this.viewModelPivot.position.z = this.recoilOffset.z;
      this.viewModelPivot.rotation.x = this.recoilRotation.x;
    }

    // Update bullet tracers without vector allocations
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.progress += (tr.speed * delta) / tr.dist;

      if (tr.progress >= 1.0) {
        this.sceneRef.remove(tr.line);
        this.tracerPool.push(tr);
        this.tracers.splice(i, 1);
      } else {
        const pArr = tr.posAttr.array as Float32Array;
        const tailProgress = Math.max(0, tr.progress - 0.2);

        // Tail vertex
        pArr[0] = tr.startX + (tr.endX - tr.startX) * tailProgress;
        pArr[1] = tr.startY + (tr.endY - tr.startY) * tailProgress;
        pArr[2] = tr.startZ + (tr.endZ - tr.startZ) * tailProgress;

        // Head vertex
        pArr[3] = tr.startX + (tr.endX - tr.startX) * tr.progress;
        pArr[4] = tr.startY + (tr.endY - tr.startY) * tr.progress;
        pArr[5] = tr.startZ + (tr.endZ - tr.startZ) * tr.progress;

        tr.posAttr.needsUpdate = true;
      }
    }
  }
}

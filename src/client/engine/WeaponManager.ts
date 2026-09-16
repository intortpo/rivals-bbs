import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { WeaponStats, WeaponType } from '../../shared/types.js';
import { WEAPONS } from '../../shared/constants.js';

interface Tracer {
  line: THREE.Line;
  start: THREE.Vector3;
  end: THREE.Vector3;
  progress: number;
  speed: number;
}

export class WeaponManager {
  public currentWeaponType: WeaponType = 'rifle';
  public ammoInMag: Record<WeaponType, number> = {
    rifle: WEAPONS.rifle.magazineSize,
    shotgun: WEAPONS.shotgun.magazineSize,
    sniper: WEAPONS.sniper.magazineSize,
    katana: WEAPONS.katana.magazineSize
  };

  public ammoReserve: Record<WeaponType, number> = {
    rifle: 60,
    shotgun: 24,
    sniper: 12,
    katana: 0
  };

  public isReloading: boolean = false;
  public reloadProgress: number = 0; // 0 to 1
  private lastFireTime: number = 0;

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
  private sceneRef: THREE.Scene;

  // Recoil recovery
  public recoilOffset: THREE.Vector3 = new THREE.Vector3();
  public recoilRotation: THREE.Euler = new THREE.Euler();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.sceneRef = scene;

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
    targetableMeshes: THREE.Object3D[]
  ): {
    fired: boolean;
    hitPlayerId?: string;
    isHeadshot?: boolean;
    hitPoint?: [number, number, number];
    tracerEnd?: [number, number, number];
  } {
    if (!this.canFire()) {
      if (this.ammoInMag[this.currentWeaponType] <= 0 && !this.isReloading && this.currentWeaponType !== 'katana') {
        this.startReload();
      }
      return { fired: false };
    }

    this.lastFireTime = performance.now() / 1000;
    const stats = this.currentStats;

    if (stats.type !== 'katana') {
      this.ammoInMag[this.currentWeaponType]--;
    }

    // Trigger visual muzzle flash
    this.triggerMuzzleFlash();

    // Weapon recoil animation on pivot
    this.recoilOffset.z = stats.type === 'sniper' ? 0.16 : 0.09;
    this.recoilRotation.x = stats.type === 'sniper' ? 0.22 : 0.12;

    // Raycast shooting
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

    raycaster.set(camPos, camDir);
    raycaster.far = stats.range;

    const intersects = raycaster.intersectObjects(targetableMeshes, true);
    let hitPlayerId: string | undefined;
    let isHeadshot = false;
    let hitPointVec: THREE.Vector3 = camPos.clone().add(camDir.clone().multiplyScalar(stats.range));

    for (const hit of intersects) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj && !obj.userData?.playerId) {
        obj = obj.parent;
      }
      if (obj && obj.userData?.playerId) {
        hitPlayerId = obj.userData.playerId;
        isHeadshot = Boolean(hit.object.userData?.isHead);
        hitPointVec = hit.point;
        break;
      } else {
        // Hit map geometry / wall
        hitPointVec = hit.point;
        break;
      }
    }

    // Spawn visual tracer
    const muzzlePos = new THREE.Vector3();
    this.muzzleFlashMesh.getWorldPosition(muzzlePos);
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
    const geo = new THREE.BufferGeometry().setFromPoints([from, from.clone()]);
    const mat = new THREE.LineBasicMaterial({
      color: this.currentWeaponType === 'sniper' ? '#ff3366' : '#ffee55',
      linewidth: 2,
      transparent: true,
      opacity: 0.85
    });
    const line = new THREE.Line(geo, mat);
    this.sceneRef.add(line);

    this.tracers.push({
      line,
      start: from.clone(),
      end: to.clone(),
      progress: 0,
      speed: 160 // units/sec
    });
  }

  public update(delta: number): void {
    // Update muzzle flash
    if (this.flashDuration > 0) {
      this.flashDuration -= delta;
      if (this.flashDuration <= 0) {
        this.muzzleFlashLight.intensity = 0;
        (this.muzzleFlashMesh.material as THREE.MeshBasicMaterial).opacity = 0;
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

    // Update bullet tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      const dist = tr.start.distanceTo(tr.end);
      tr.progress += (tr.speed * delta) / (dist || 1);

      if (tr.progress >= 1.0) {
        this.sceneRef.remove(tr.line);
        tr.line.geometry.dispose();
        (tr.line.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      } else {
        const head = tr.start.clone().lerp(tr.end, tr.progress);
        const tail = tr.start.clone().lerp(tr.end, Math.max(0, tr.progress - 0.2));
        tr.line.geometry.setFromPoints([tail, head]);
      }
    }
  }
}

import * as THREE from 'three';
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

  public isReloading: boolean = false;
  public reloadProgress: number = 0; // 0 to 1
  private lastFireTime: number = 0;

  // Viewmodel (first-person hands & gun pinned to camera)
  public viewModelContainer: THREE.Group;
  private weaponMeshes: Map<WeaponType, THREE.Group> = new Map();
  private muzzleFlashLight: THREE.PointLight;
  private muzzleFlashMesh: THREE.Mesh;
  private flashDuration: number = 0;

  private tracers: Tracer[] = [];
  private sceneRef: THREE.Scene;

  // Recoil recovery
  public recoilOffset: THREE.Vector3 = new THREE.Vector3();
  public recoilRotation: THREE.Euler = new THREE.Euler();

  constructor(scene: THREE.Scene, camera: THREE.Camera) {
    this.sceneRef = scene;

    this.viewModelContainer = new THREE.Group();
    camera.add(this.viewModelContainer);

    // Build 3D models for all 4 weapons
    this.buildWeaponModels();

    // Muzzle flash
    this.muzzleFlashLight = new THREE.PointLight('#ffdd88', 0, 10);
    this.muzzleFlashLight.position.set(0.28, -0.22, -0.85);
    this.viewModelContainer.add(this.muzzleFlashLight);

    const flashGeo = new THREE.PlaneGeometry(0.3, 0.3);
    const flashMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    this.muzzleFlashMesh = new THREE.Mesh(flashGeo, flashMat);
    this.muzzleFlashMesh.position.set(0.28, -0.22, -0.85);
    this.viewModelContainer.add(this.muzzleFlashMesh);

    this.selectWeapon('rifle');
  }

  public get currentStats(): WeaponStats {
    return WEAPONS[this.currentWeaponType];
  }

  private buildWeaponModels(): void {
    // 1. Assault Rifle
    const rifleGroup = new THREE.Group();
    const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2d42', roughness: 0.3 });
    const metalMat = new THREE.MeshStandardMaterial({ color: '#8d99ae', metalness: 0.6, roughness: 0.2 });
    const neonCyan = new THREE.MeshStandardMaterial({ color: '#00d2ff', emissive: '#00d2ff', emissiveIntensity: 0.6 });

    // Receiver
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.16, 0.6), darkMat);
    rifleGroup.add(body);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.4), metalMat);
    barrel.position.set(0, 0.04, -0.45);
    rifleGroup.add(barrel);
    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.22, 0.12), darkMat);
    mag.position.set(0, -0.15, -0.05);
    mag.rotation.x = 0.2;
    rifleGroup.add(mag);
    // Sight Rail & Neon Sight
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.15), neonCyan);
    sight.position.set(0, 0.11, 0.05);
    rifleGroup.add(sight);

    rifleGroup.position.set(0.28, -0.24, -0.55);
    this.viewModelContainer.add(rifleGroup);
    this.weaponMeshes.set('rifle', rifleGroup);

    // 2. Pump Shotgun
    const shotgunGroup = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: '#8b5a2b', roughness: 0.6 });
    const sBody = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.7), metalMat);
    shotgunGroup.add(sBody);
    // Double Barrel
    const sBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8), darkMat);
    sBarrel.rotation.x = Math.PI / 2;
    sBarrel.position.set(0, 0.04, -0.5);
    shotgunGroup.add(sBarrel);
    // Pump Grip
    const sPump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.2), woodMat);
    sPump.position.set(0, -0.04, -0.38);
    shotgunGroup.add(sPump);

    shotgunGroup.position.set(0.28, -0.26, -0.55);
    this.viewModelContainer.add(shotgunGroup);
    this.weaponMeshes.set('shotgun', shotgunGroup);

    // 3. Sniper Rifle
    const sniperGroup = new THREE.Group();
    const snipBody = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.18, 0.9), darkMat);
    sniperGroup.add(snipBody);
    // Long barrel
    const snipBarrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.8), metalMat);
    snipBarrel.position.set(0, 0.03, -0.75);
    sniperGroup.add(snipBarrel);
    // Scope cylinder
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.35, 12), darkMat);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.14, -0.05);
    sniperGroup.add(scope);

    sniperGroup.position.set(0.28, -0.24, -0.6);
    this.viewModelContainer.add(sniperGroup);
    this.weaponMeshes.set('sniper', sniperGroup);

    // 4. Energy Katana
    const katanaGroup = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 8), darkMat);
    katanaGroup.add(handle);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.03, 0.1), metalMat);
    guard.position.y = 0.16;
    katanaGroup.add(guard);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.9, 0.02), neonCyan);
    blade.position.y = 0.65;
    katanaGroup.add(blade);

    katanaGroup.rotation.set(-Math.PI / 4, Math.PI / 6, -Math.PI / 6);
    katanaGroup.position.set(0.3, -0.28, -0.45);
    this.viewModelContainer.add(katanaGroup);
    this.weaponMeshes.set('katana', katanaGroup);
  }

  public selectWeapon(type: WeaponType): void {
    if (this.currentWeaponType === type) return;
    this.currentWeaponType = type;
    this.isReloading = false;
    this.reloadProgress = 0;

    for (const [t, mesh] of this.weaponMeshes.entries()) {
      mesh.visible = t === type;
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

  public startReload(): boolean {
    const stats = this.currentStats;
    if (stats.type === 'katana') return false;
    if (this.isReloading) return false;
    if (this.ammoInMag[this.currentWeaponType] >= stats.magazineSize) return false;

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

    // Weapon recoil animation
    this.recoilOffset.z = 0.12;
    this.recoilRotation.x = 0.18;

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

    // Update reload progress
    if (this.isReloading) {
      const stats = this.currentStats;
      this.reloadProgress += delta / stats.reloadTime;

      // Reload dip animation
      const currentMesh = this.weaponMeshes.get(this.currentWeaponType);
      if (currentMesh) {
        currentMesh.position.y = -0.24 - Math.sin(this.reloadProgress * Math.PI) * 0.2;
        currentMesh.rotation.z = Math.sin(this.reloadProgress * Math.PI) * 0.4;
      }

      if (this.reloadProgress >= 1.0) {
        this.isReloading = false;
        this.reloadProgress = 0;
        this.ammoInMag[this.currentWeaponType] = stats.magazineSize;
        if (currentMesh) {
          currentMesh.position.y = -0.24;
          currentMesh.rotation.z = 0;
        }
      }
    }

    // Recover weapon recoil smoothly
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), delta * 15);
    this.recoilRotation.x = THREE.MathUtils.lerp(this.recoilRotation.x, 0, delta * 15);

    const currentMesh = this.weaponMeshes.get(this.currentWeaponType);
    if (currentMesh && !this.isReloading) {
      currentMesh.position.z = -0.55 + this.recoilOffset.z;
      currentMesh.rotation.x = this.recoilRotation.x;
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

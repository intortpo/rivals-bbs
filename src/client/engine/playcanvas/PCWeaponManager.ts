import * as pc from 'playcanvas';
import { WeaponStats, WeaponType } from '../../../shared/types.js';
import { WEAPONS } from '../../../shared/constants.js';
import { PCFXManager } from './PCFXManager.js';
import { PCPlayerHitbox } from './PCCharacterModel.js';
import { AudioManager } from '../AudioManager.js';
import { PCGLBLoader } from './PCGLBLoader.js';

export interface PCTargetable {
  playerId: string;
  isDead: boolean;
  getHitboxes(): PCPlayerHitbox[];
}

export class PCWeaponManager {
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
  public reloadProgress: number = 0;
  private lastFireTime: number = 0;

  // Railgun charging state
  public railgunChargeProgress: number = 0;
  public isChargingRailgun: boolean = false;

  // Viewmodel entities
  public viewModelContainer!: pc.Entity;
  public viewModelPivot!: pc.Entity;
  private weaponEntities: Map<WeaponType, pc.Entity> = new Map();
  private muzzleFlashEntity!: pc.Entity;
  private muzzleLight!: pc.Entity;
  private flashDuration: number = 0;

  // Recoil spring & bobbing state
  public recoilOffset: pc.Vec3 = new pc.Vec3();
  public recoilRotation: pc.Vec3 = new pc.Vec3();
  public recoilVelocityZ: number = 0;
  public recoilVelocityRotX: number = 0;
  public bobTimer: number = 0;
  public bobOffset: pc.Vec2 = new pc.Vec2();

  private app?: pc.Application;
  private fx?: PCFXManager;
  private audio?: AudioManager;

  constructor(app: pc.Application | undefined, cameraEntity: pc.Entity | undefined, fx?: PCFXManager, audio?: AudioManager) {
    this.app = app;
    this.fx = fx;
    this.audio = audio;

    if (app && cameraEntity) {
      this.setupViewModel(cameraEntity);
      this.buildProceduralWeapons();
    }
  }

  public get currentStats(): WeaponStats {
    return WEAPONS[this.currentWeaponType];
  }

  private setupViewModel(cameraEntity: pc.Entity): void {
    this.viewModelContainer = new pc.Entity('ViewModelContainer');
    cameraEntity.addChild(this.viewModelContainer);

    this.viewModelPivot = new pc.Entity('ViewModelPivot');
    this.viewModelContainer.addChild(this.viewModelPivot);

    // Muzzle flash entity & omni light
    this.muzzleFlashEntity = new pc.Entity('MuzzleFlashMesh');
    const flashMat = new pc.StandardMaterial();
    flashMat.diffuse = new pc.Color(1, 0.9, 0.4);
    flashMat.emissive = new pc.Color(1, 0.8, 0.2);
    flashMat.emissiveIntensity = 4.0;
    flashMat.opacity = 0;
    flashMat.blendType = pc.BLEND_ADDITIVE;
    flashMat.update();
    this.muzzleFlashEntity.addComponent('render', { type: 'sphere', material: flashMat });
    this.muzzleFlashEntity.setLocalPosition(0.22, -0.16, -0.85);
    this.muzzleFlashEntity.setLocalScale(0.12, 0.12, 0.12);
    this.viewModelPivot.addChild(this.muzzleFlashEntity);

    this.muzzleLight = new pc.Entity('MuzzleFlashLight');
    this.muzzleLight.addComponent('light', {
      type: 'omni',
      color: new pc.Color(1, 0.85, 0.3),
      intensity: 0,
      range: 8,
      castShadows: false
    });
    this.muzzleLight.setLocalPosition(0.22, -0.16, -0.85);
    this.viewModelPivot.addChild(this.muzzleLight);
  }

  private buildProceduralWeapons(): void {
    if (!this.app) return;

    const darkMat = new pc.StandardMaterial();
    darkMat.diffuse = new pc.Color(0.12, 0.14, 0.18);
    darkMat.update();

    const cyanMat = new pc.StandardMaterial();
    cyanMat.diffuse = new pc.Color(0.0, 0.85, 1.0);
    cyanMat.emissive = new pc.Color(0.0, 0.85, 1.0);
    cyanMat.emissiveIntensity = 2.0;
    cyanMat.update();

    const orangeMat = new pc.StandardMaterial();
    orangeMat.diffuse = new pc.Color(1.0, 0.5, 0.0);
    orangeMat.emissive = new pc.Color(1.0, 0.5, 0.0);
    orangeMat.emissiveIntensity = 2.0;
    orangeMat.update();

    const purpleMat = new pc.StandardMaterial();
    purpleMat.diffuse = new pc.Color(0.85, 0.2, 0.95);
    purpleMat.emissive = new pc.Color(0.85, 0.2, 0.95);
    purpleMat.emissiveIntensity = 2.0;
    purpleMat.update();

    // 1. Rifle: Tactical assault carbine
    const rifle = new pc.Entity('Weapon_Rifle');
    rifle.setLocalPosition(0.22, -0.24, -0.42);
    const rifleBody = new pc.Entity('RifleBody');
    rifleBody.addComponent('render', { type: 'box', material: darkMat });
    rifleBody.setLocalScale(0.08, 0.14, 0.65);
    rifle.addChild(rifleBody);
    const rifleBarrel = new pc.Entity('RifleBarrel');
    rifleBarrel.addComponent('render', { type: 'cylinder', material: darkMat });
    rifleBarrel.setLocalPosition(0, 0.04, -0.38);
    rifleBarrel.setLocalEulerAngles(90, 0, 0);
    rifleBarrel.setLocalScale(0.04, 0.35, 0.04);
    rifle.addChild(rifleBarrel);
    const rifleTrim = new pc.Entity('RifleTrim');
    rifleTrim.addComponent('render', { type: 'box', material: cyanMat });
    rifleTrim.setLocalPosition(0, 0.07, -0.05);
    rifleTrim.setLocalScale(0.02, 0.02, 0.45);
    rifle.addChild(rifleTrim);
    this.viewModelPivot.addChild(rifle);
    this.weaponEntities.set('rifle', rifle);

    // 2. Shotgun: Heavy pump shotgun
    const shotgun = new pc.Entity('Weapon_Shotgun');
    shotgun.setLocalPosition(0.22, -0.24, -0.42);
    const shotBody = new pc.Entity('ShotBody');
    shotBody.addComponent('render', { type: 'box', material: darkMat });
    shotBody.setLocalScale(0.10, 0.16, 0.55);
    shotgun.addChild(shotBody);
    const shotBarrel = new pc.Entity('ShotBarrel');
    shotBarrel.addComponent('render', { type: 'cylinder', material: orangeMat });
    shotBarrel.setLocalPosition(0, 0.04, -0.35);
    shotBarrel.setLocalEulerAngles(90, 0, 0);
    shotBarrel.setLocalScale(0.06, 0.40, 0.06);
    shotgun.addChild(shotBarrel);
    shotgun.enabled = false;
    this.viewModelPivot.addChild(shotgun);
    this.weaponEntities.set('shotgun', shotgun);

    // 3. Sniper: High-magnification rifle
    const sniper = new pc.Entity('Weapon_Sniper');
    sniper.setLocalPosition(0.22, -0.24, -0.45);
    const snipBody = new pc.Entity('SnipBody');
    snipBody.addComponent('render', { type: 'box', material: darkMat });
    snipBody.setLocalScale(0.07, 0.12, 0.85);
    sniper.addChild(snipBody);
    const snipScope = new pc.Entity('SnipScope');
    snipScope.addComponent('render', { type: 'cylinder', material: cyanMat });
    snipScope.setLocalPosition(0, 0.10, -0.10);
    snipScope.setLocalEulerAngles(90, 0, 0);
    snipScope.setLocalScale(0.06, 0.32, 0.06);
    sniper.addChild(snipScope);
    sniper.enabled = false;
    this.viewModelPivot.addChild(sniper);
    this.weaponEntities.set('sniper', sniper);

    // 4. Katana: Neon energy blade
    const katana = new pc.Entity('Weapon_Katana');
    katana.setLocalPosition(0.22, -0.22, -0.35);
    katana.setLocalEulerAngles(-40, 20, -10);
    const blade = new pc.Entity('Blade');
    blade.addComponent('render', { type: 'box', material: cyanMat });
    blade.setLocalScale(0.02, 0.80, 0.06);
    blade.setLocalPosition(0, 0.40, 0);
    katana.addChild(blade);
    katana.enabled = false;
    this.viewModelPivot.addChild(katana);
    this.weaponEntities.set('katana', katana);

    // 5. Needle Carbine: Crystalline projector
    const needle = new pc.Entity('Weapon_Needler');
    needle.setLocalPosition(0.22, -0.24, -0.40);
    const needleBody = new pc.Entity('NeedleBody');
    needleBody.addComponent('render', { type: 'box', material: purpleMat });
    needleBody.setLocalScale(0.11, 0.14, 0.50);
    needle.addChild(needleBody);
    needle.enabled = false;
    this.viewModelPivot.addChild(needle);
    this.weaponEntities.set('needle_carbine', needle);

    // 6. Plasma Launcher: Mortar cannon
    const plasma = new pc.Entity('Weapon_Plasma');
    plasma.setLocalPosition(0.22, -0.24, -0.40);
    const plasmaCoil = new pc.Entity('PlasmaCoil');
    plasmaCoil.addComponent('render', { type: 'cylinder', material: purpleMat });
    plasmaCoil.setLocalEulerAngles(90, 0, 0);
    plasmaCoil.setLocalScale(0.12, 0.60, 0.12);
    plasma.addChild(plasmaCoil);
    plasma.enabled = false;
    this.viewModelPivot.addChild(plasma);
    this.weaponEntities.set('plasma_launcher', plasma);

    // 7. Railgun: Accelerator core
    const railgun = new pc.Entity('Weapon_Railgun');
    railgun.setLocalPosition(0.22, -0.24, -0.45);
    const railBody = new pc.Entity('RailBody');
    railBody.addComponent('render', { type: 'box', material: cyanMat });
    railBody.setLocalScale(0.09, 0.14, 0.80);
    railgun.addChild(railBody);
    railgun.enabled = false;
    this.viewModelPivot.addChild(railgun);
    this.weaponEntities.set('railgun', railgun);

    // 8. Arc Disruptor: Tesla projector
    const arc = new pc.Entity('Weapon_Arc');
    arc.setLocalPosition(0.22, -0.24, -0.38);
    const arcBody = new pc.Entity('ArcBody');
    arcBody.addComponent('render', { type: 'box', material: orangeMat });
    arcBody.setLocalScale(0.12, 0.12, 0.45);
    arc.addChild(arcBody);
    arc.enabled = false;
    this.viewModelPivot.addChild(arc);
    this.weaponEntities.set('arc_disruptor', arc);
  }

  public async loadBlasterModels(loader: PCGLBLoader): Promise<void> {
    if (!this.app || !this.viewModelPivot) return;

    const blasterMap: Record<WeaponType, { url: string; pos: [number, number, number]; rot: [number, number, number]; scale: number }> = {
      rifle: { url: '/models/blasters/blaster-a.glb', pos: [0.20, -0.22, -0.42], rot: [0, 180, 0], scale: 0.90 },
      shotgun: { url: '/models/blasters/blaster-b.glb', pos: [0.20, -0.22, -0.38], rot: [0, 180, 0], scale: 0.95 },
      sniper: { url: '/models/blasters/blaster-e.glb', pos: [0.20, -0.22, -0.45], rot: [0, 180, 0], scale: 0.85 },
      katana: { url: '/models/blasters/blaster-c.glb', pos: [0.18, -0.18, -0.35], rot: [-10, 170, 5], scale: 0.85 },
      needle_carbine: { url: '/models/blasters/blaster-g.glb', pos: [0.20, -0.22, -0.40], rot: [0, 180, 0], scale: 0.90 },
      plasma_launcher: { url: '/models/blasters/blaster-o.glb', pos: [0.22, -0.22, -0.42], rot: [0, 180, 0], scale: 1.0 },
      railgun: { url: '/models/blasters/blaster-j.glb', pos: [0.20, -0.22, -0.44], rot: [0, 180, 0], scale: 0.90 },
      arc_disruptor: { url: '/models/blasters/blaster-m.glb', pos: [0.20, -0.22, -0.40], rot: [0, 180, 0], scale: 0.90 }
    };

    for (const [weaponType, cfg] of Object.entries(blasterMap) as [WeaponType, any][]) {
      try {
        const container = await loader.load(cfg.url);
        if (container) {
          const blasterEnt = container.instantiateRenderEntity({ castShadows: false });
          blasterEnt.name = `Blaster_${weaponType}`;
          blasterEnt.setLocalPosition(cfg.pos[0], cfg.pos[1], cfg.pos[2]);
          blasterEnt.setLocalEulerAngles(cfg.rot[0], cfg.rot[1], cfg.rot[2]);
          blasterEnt.setLocalScale(cfg.scale, cfg.scale, cfg.scale);

          // Replace or swap previous procedural entity
          const prev = this.weaponEntities.get(weaponType);
          if (prev) {
            blasterEnt.enabled = prev.enabled;
            this.viewModelPivot.removeChild(prev);
            prev.destroy();
          } else {
            blasterEnt.enabled = weaponType === this.currentWeaponType;
          }

          this.viewModelPivot.addChild(blasterEnt);
          this.weaponEntities.set(weaponType, blasterEnt);
        }
      } catch (err) {
        console.warn(`[PCWeaponManager] Failed to load blaster GLB for ${weaponType}:`, err);
      }
    }
  }

  public selectWeapon(type: WeaponType): void {
    this.currentWeaponType = type;
    this.isReloading = false;
    this.reloadProgress = 0;

    for (const [t, ent] of this.weaponEntities.entries()) {
      ent.enabled = t === type;
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
    cameraEntity: pc.Entity,
    remotePlayers: PCTargetable[],
    obstacleBoxes: pc.BoundingBox[] = [],
    isAiming: boolean = false
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

    // Railgun charge-up logic
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
      this.isChargingRailgun = false;
      this.railgunChargeProgress = 0;
    }

    this.lastFireTime = performance.now() / 1000;
    if (stats.type !== 'katana') {
      this.ammoInMag[this.currentWeaponType]--;
    }

    this.triggerMuzzleFlash();

    // Recoil spring kick impulse
    const kickZ = stats.type === 'sniper' || stats.type === 'railgun' ? 0.18
      : stats.type === 'plasma_launcher' ? 0.15
      : stats.type === 'shotgun' ? 0.14 : 0.09;
    const kickRotX = stats.type === 'sniper' || stats.type === 'railgun' ? 14
      : stats.type === 'plasma_launcher' ? 10
      : stats.type === 'shotgun' ? 12 : 7;

    this.recoilOffset.z = kickZ;
    this.recoilRotation.x = kickRotX;
    this.recoilVelocityZ = kickZ * 8.0;
    this.recoilVelocityRotX = kickRotX * 6.0;

    // Camera raycast
    const camPos = cameraEntity.getPosition();
    const camDir = new pc.Vec3().copy(cameraEntity.forward).normalize();

    // Spread factor (reduced 80% when ADS)
    const spreadFactor = isAiming ? 0.20 : 1.0;
    const effectiveSpread = stats.spread * spreadFactor;
    if (effectiveSpread > 0) {
      camDir.x += (Math.random() - 0.5) * effectiveSpread;
      camDir.y += (Math.random() - 0.5) * effectiveSpread;
      camDir.normalize();
    }

    const ray = new pc.Ray(camPos, camDir);

    // 1. Find closest obstacle wall hit
    let closestWallDist = stats.range;
    let wallHitPoint = new pc.Vec3().add2(camPos, new pc.Vec3().copy(camDir).mulScalar(stats.range));
    const testPt = new pc.Vec3();

    for (const box of obstacleBoxes) {
      if (box.intersectsRay(ray, testPt)) {
        const d = camPos.distance(testPt);
        if (d < closestWallDist) {
          closestWallDist = d;
          wallHitPoint.copy(testPt);
        }
      }
    }

    // 2. Check player hitboxes in front of the wall
    let hitPlayerId: string | undefined;
    let isHeadshot = false;
    let closestTargetDist = closestWallDist;
    let hitPointVec = new pc.Vec3().copy(wallHitPoint);

    for (const target of remotePlayers) {
      if (target.isDead) continue;
      const hitboxes = target.getHitboxes();

      for (const hb of hitboxes) {
        if (hb.box.intersectsRay(ray, testPt)) {
          const d = camPos.distance(testPt);
          if (d < closestTargetDist) {
            closestTargetDist = d;
            hitPointVec.copy(testPt);
            hitPlayerId = hb.playerId;
            isHeadshot = hb.isHeadshot;
          }
        }
      }
    }

    // Archetype FX & Mechanics
    if (stats.type === 'plasma_launcher') {
      this.fx?.spawnPlasmaExplosion(hitPointVec);
    } else if (stats.type === 'railgun') {
      this.fx?.spawnRailgunTracer(camPos, hitPointVec);
    } else if (stats.type === 'arc_disruptor') {
      this.fx?.spawnTeslaArc(camPos, hitPointVec);
    } else {
      // Conventional tracer & sparks
      if (hitPlayerId) {
        this.fx?.spawnHitSparks(hitPointVec, undefined, isHeadshot);
      } else {
        this.fx?.spawnHitSparks(hitPointVec, undefined, false);
      }
    }

    return {
      fired: true,
      hitPlayerId,
      isHeadshot,
      hitPoint: [hitPointVec.x, hitPointVec.y, hitPointVec.z],
      tracerEnd: [hitPointVec.x, hitPointVec.y, hitPointVec.z]
    };
  }

  private triggerMuzzleFlash(): void {
    if (this.muzzleLight?.light) {
      this.muzzleLight.light.intensity = 5;
    }
    this.flashDuration = 0.05;
  }

  public update(dt: number, isMoving: boolean = false, moveSpeed: number = 0): void {
    const dtClamped = Math.min(dt, 0.05);

    // Flash decay
    if (this.flashDuration > 0) {
      this.flashDuration -= dt;
      if (this.flashDuration <= 0 && this.muzzleLight?.light) {
        this.muzzleLight.light.intensity = 0;
      }
    }

    // Railgun charge ramp
    if (this.isChargingRailgun) {
      this.railgunChargeProgress = Math.min(1.0, this.railgunChargeProgress + dt * 2.2);
    }

    // Spring-damper integration (critically damped harmonic spring: F = -k*x - c*v)
    const springK = 140;
    const damping = 16;

    const accelZ = -springK * this.recoilOffset.z - damping * this.recoilVelocityZ;
    this.recoilVelocityZ += accelZ * dtClamped;
    this.recoilOffset.z += this.recoilVelocityZ * dtClamped;

    const accelRotX = -springK * this.recoilRotation.x - damping * this.recoilVelocityRotX;
    this.recoilVelocityRotX += accelRotX * dtClamped;
    this.recoilRotation.x += this.recoilVelocityRotX * dtClamped;

    // Parametric Figure-8 Walk Bobbing
    if (isMoving && moveSpeed > 0.5) {
      this.bobTimer += dtClamped * Math.min(moveSpeed, 10) * 1.5;
      const targetBobX = Math.cos(this.bobTimer) * 0.015;
      const targetBobY = Math.abs(Math.sin(this.bobTimer)) * 0.012;
      this.bobOffset.x = pc.math.lerp(this.bobOffset.x, targetBobX, dtClamped * 12);
      this.bobOffset.y = pc.math.lerp(this.bobOffset.y, targetBobY, dtClamped * 12);
    } else {
      this.bobOffset.x = pc.math.lerp(this.bobOffset.x, 0, dtClamped * 10);
      this.bobOffset.y = pc.math.lerp(this.bobOffset.y, 0, dtClamped * 10);
    }

    // Apply to viewmodel pivot
    if (this.viewModelPivot) {
      this.viewModelPivot.setLocalPosition(this.bobOffset.x, -this.bobOffset.y, this.recoilOffset.z);
      this.viewModelPivot.setLocalEulerAngles(
        this.recoilRotation.x,
        this.bobOffset.x * 6.0,
        -this.bobOffset.x * 4.0
      );
    }
  }

  public dispose(): void {
    if (this.viewModelContainer) {
      this.viewModelContainer.destroy();
    }
  }
}

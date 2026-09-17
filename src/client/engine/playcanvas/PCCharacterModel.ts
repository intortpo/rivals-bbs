import * as pc from 'playcanvas';
import { WeaponType, CharacterCustomization, TeamColor } from '../../../shared/types.js';

export interface PCPlayerHitbox {
  box: pc.BoundingBox;
  part: 'head' | 'chest' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'capsule';
  isHead: boolean;
  isHeadshot: boolean;
  playerId: string;
}

export class PCCharacterModel {
  public root: pc.Entity;
  public playerId: string;
  public team: TeamColor;
  public currentWeapon: WeaponType = 'rifle';
  public isLocalPlayer: boolean = false;
  public isSliding: boolean = false;
  public isDead: boolean = false;

  // Visual skeleton entities
  private pelvisEntity!: pc.Entity;
  private chestEntity!: pc.Entity;
  private headEntity!: pc.Entity;
  private visorEntity!: pc.Entity;
  private leftArmEntity!: pc.Entity;
  private rightArmEntity!: pc.Entity;
  private leftLegEntity!: pc.Entity;
  private rightLegEntity!: pc.Entity;
  private weaponHolder!: pc.Entity;

  // Hitboxes (local bounding boxes transformed during raycasting)
  public localHitboxes: {
    offset: pc.Vec3;
    halfExtents: pc.Vec3;
    part: 'head' | 'chest' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'capsule';
    isHead: boolean;
  }[] = [];

  // Cached world hitboxes
  private worldHitboxes: PCPlayerHitbox[] = [];

  // Animation state
  private animTimer: number = 0;
  public aimPitch: number = 0;
  public botRole?: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss';

  // 3D Overhead Billboard Entity
  public overheadRoot?: pc.Entity;
  private hpBarFillEntity?: pc.Entity;
  private shieldBarFillEntity?: pc.Entity;

  constructor(
    app: pc.Application | undefined,
    playerId: string,
    team: TeamColor = 'blue',
    isLocal: boolean = false,
    botRole?: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss'
  ) {
    this.playerId = playerId;
    this.team = team;
    this.isLocalPlayer = isLocal;
    this.botRole = botRole;
    this.root = new pc.Entity(`Player_${playerId}`);

    this.setupHitboxDefinitions();

    if (app && !isLocal) {
      this.buildProceduralAvatar();
      this.setupOverheadUI();
      app.root.addChild(this.root);
    }
  }

  private setupHitboxDefinitions(): void {
    // 1. Head: Centered at y = 1.65m, radius/half-extents ~ 0.18m
    this.localHitboxes.push({
      offset: new pc.Vec3(0, 1.65, 0),
      halfExtents: new pc.Vec3(0.20, 0.20, 0.20),
      part: 'head',
      isHead: true
    });

    // 2. Chest: Centered at y = 1.15m, half-extents (0.25, 0.22, 0.16)
    this.localHitboxes.push({
      offset: new pc.Vec3(0, 1.15, 0),
      halfExtents: new pc.Vec3(0.25, 0.22, 0.16),
      part: 'chest',
      isHead: false
    });

    // 3. Pelvis: Centered at y = 0.80m, half-extents (0.23, 0.16, 0.15)
    this.localHitboxes.push({
      offset: new pc.Vec3(0, 0.80, 0),
      halfExtents: new pc.Vec3(0.23, 0.16, 0.15),
      part: 'pelvis',
      isHead: false
    });

    // 4. Left Arm: Centered at (-0.28, 1.10, 0), half-extents (0.11, 0.22, 0.12)
    this.localHitboxes.push({
      offset: new pc.Vec3(-0.28, 1.10, 0),
      halfExtents: new pc.Vec3(0.11, 0.22, 0.12),
      part: 'leftArm',
      isHead: false
    });

    // 5. Right Arm: Centered at (0.28, 1.10, 0), half-extents (0.11, 0.22, 0.12)
    this.localHitboxes.push({
      offset: new pc.Vec3(0.28, 1.10, 0),
      halfExtents: new pc.Vec3(0.11, 0.22, 0.12),
      part: 'rightArm',
      isHead: false
    });

    // 6. Left Leg: Centered at (-0.13, 0.40, 0), half-extents (0.12, 0.25, 0.14)
    this.localHitboxes.push({
      offset: new pc.Vec3(-0.13, 0.40, 0),
      halfExtents: new pc.Vec3(0.12, 0.25, 0.14),
      part: 'leftLeg',
      isHead: false
    });

    // 7. Right Leg: Centered at (0.13, 0.40, 0), half-extents (0.12, 0.25, 0.14)
    this.localHitboxes.push({
      offset: new pc.Vec3(0.13, 0.40, 0),
      halfExtents: new pc.Vec3(0.12, 0.25, 0.14),
      part: 'rightLeg',
      isHead: false
    });

    // 8. Full-Body Silhouette Capsule: Centered at y = 0.64m, half-extents (0.32, 0.64, 0.32)
    this.localHitboxes.push({
      offset: new pc.Vec3(0, 0.64, 0),
      halfExtents: new pc.Vec3(0.32, 0.64, 0.32),
      part: 'capsule',
      isHead: false
    });

    // Preallocate world hitboxes
    this.worldHitboxes = this.localHitboxes.map((def) => ({
      box: new pc.BoundingBox(new pc.Vec3(), def.halfExtents),
      part: def.part,
      isHead: def.isHead,
      isHeadshot: def.isHead,
      playerId: this.playerId
    }));
  }

  private buildProceduralAvatar(): void {
    const isBlue = this.team === 'blue';
    const armorCol = isBlue ? new pc.Color(0.1, 0.45, 0.95) : new pc.Color(0.95, 0.2, 0.2);
    const darkCol = new pc.Color(0.12, 0.14, 0.18);
    const visorCol = isBlue ? new pc.Color(0.0, 0.9, 1.0) : new pc.Color(1.0, 0.6, 0.0);

    const armorMat = new pc.StandardMaterial();
    armorMat.diffuse = armorCol;
    armorMat.update();

    const darkMat = new pc.StandardMaterial();
    darkMat.diffuse = darkCol;
    darkMat.update();

    const visorMat = new pc.StandardMaterial();
    visorMat.diffuse = visorCol;
    visorMat.emissive = visorCol;
    visorMat.emissiveIntensity = 2.0;
    visorMat.update();

    // Pelvis
    this.pelvisEntity = new pc.Entity('Pelvis');
    this.pelvisEntity.addComponent('render', { type: 'box', material: darkMat });
    this.pelvisEntity.setLocalPosition(0, 0.80, 0);
    this.pelvisEntity.setLocalScale(0.44, 0.26, 0.28);
    this.root.addChild(this.pelvisEntity);

    // Chest
    this.chestEntity = new pc.Entity('Chest');
    this.chestEntity.addComponent('render', { type: 'box', material: armorMat });
    this.chestEntity.setLocalPosition(0, 0.35, 0); // relative to pelvis
    this.chestEntity.setLocalScale(0.48, 0.44, 0.30);
    this.pelvisEntity.addChild(this.chestEntity);

    // Head
    this.headEntity = new pc.Entity('Head');
    this.headEntity.addComponent('render', { type: 'box', material: darkMat });
    this.headEntity.setLocalPosition(0, 0.38, 0); // relative to chest
    this.headEntity.setLocalScale(0.36, 0.36, 0.36);
    this.chestEntity.addChild(this.headEntity);

    // Visor
    this.visorEntity = new pc.Entity('Visor');
    this.visorEntity.addComponent('render', { type: 'box', material: visorMat });
    this.visorEntity.setLocalPosition(0, 0.02, -0.19);
    this.visorEntity.setLocalScale(0.30, 0.12, 0.04);
    this.headEntity.addChild(this.visorEntity);

    // Left Arm
    this.leftArmEntity = new pc.Entity('LeftArm');
    this.leftArmEntity.addComponent('render', { type: 'box', material: armorMat });
    this.leftArmEntity.setLocalPosition(-0.28, 0.08, 0);
    this.leftArmEntity.setLocalScale(0.18, 0.44, 0.20);
    this.chestEntity.addChild(this.leftArmEntity);

    // Right Arm
    this.rightArmEntity = new pc.Entity('RightArm');
    this.rightArmEntity.addComponent('render', { type: 'box', material: armorMat });
    this.rightArmEntity.setLocalPosition(0.28, 0.08, 0);
    this.rightArmEntity.setLocalScale(0.18, 0.44, 0.20);
    this.chestEntity.addChild(this.rightArmEntity);

    // Left Leg
    this.leftLegEntity = new pc.Entity('LeftLeg');
    this.leftLegEntity.addComponent('render', { type: 'box', material: darkMat });
    this.leftLegEntity.setLocalPosition(-0.13, -0.40, 0);
    this.leftLegEntity.setLocalScale(0.20, 0.50, 0.22);
    this.pelvisEntity.addChild(this.leftLegEntity);

    // Right Leg
    this.rightLegEntity = new pc.Entity('RightLeg');
    this.rightLegEntity.addComponent('render', { type: 'box', material: darkMat });
    this.rightLegEntity.setLocalPosition(0.13, -0.40, 0);
    this.rightLegEntity.setLocalScale(0.20, 0.50, 0.22);
    this.pelvisEntity.addChild(this.rightLegEntity);

    // Weapon Holder
    this.weaponHolder = new pc.Entity('WeaponHolder');
    this.weaponHolder.setLocalPosition(0.18, -0.10, -0.30);
    this.chestEntity.addChild(this.weaponHolder);
  }

  public setPosition(x: number, y: number, z: number): void {
    this.root.setPosition(x, y, z);
  }

  public setRotation(yawDegrees: number): void {
    this.root.setEulerAngles(0, yawDegrees, 0);
  }

  public setAimPitch(pitchDegrees: number): void {
    this.aimPitch = pitchDegrees;
    if (this.chestEntity) {
      this.chestEntity.setLocalEulerAngles(pitchDegrees * 0.4, 0, 0);
    }
    if (this.headEntity) {
      this.headEntity.setLocalEulerAngles(pitchDegrees * 0.6, 0, 0);
    }
  }

  public setSliding(sliding: boolean): void {
    this.isSliding = sliding;
    if (this.pelvisEntity) {
      this.pelvisEntity.setLocalPosition(0, sliding ? 0.45 : 0.80, 0);
      this.pelvisEntity.setLocalEulerAngles(sliding ? -25 : 0, 0, 0);
    }
  }

  public updateAnimation(speed: number, dt: number, strafeSpeed: number = 0, isJumping: boolean = false): void {
    if (this.isSliding || this.isDead) return;

    if (isJumping) {
      if (this.leftLegEntity) this.leftLegEntity.setLocalEulerAngles(-20, 0, 0);
      if (this.rightLegEntity) this.rightLegEntity.setLocalEulerAngles(15, 0, 0);
      if (this.leftArmEntity) this.leftArmEntity.setLocalEulerAngles(35, 0, 0);
      if (this.rightArmEntity) this.rightArmEntity.setLocalEulerAngles(-30, 0, 0);
      return;
    }

    const totalSpeed = Math.hypot(speed, strafeSpeed);
    if (totalSpeed > 0.35) {
      const stepRate = Math.max(4.0, Math.min(12.0, totalSpeed * 1.05));
      this.animTimer += dt * stepRate;
      const swing = Math.sin(this.animTimer) * 24;
      const strafeTilt = Math.sin(this.animTimer) * 5 * Math.sign(strafeSpeed);
      if (this.leftLegEntity) this.leftLegEntity.setLocalEulerAngles(swing, 0, strafeTilt);
      if (this.rightLegEntity) this.rightLegEntity.setLocalEulerAngles(-swing, 0, -strafeTilt);
      if (this.leftArmEntity) this.leftArmEntity.setLocalEulerAngles(-swing * 0.7, 0, 0);
      if (this.rightArmEntity) this.rightArmEntity.setLocalEulerAngles(swing * 0.7, 0, 0);
    } else {
      if (this.leftLegEntity) this.leftLegEntity.setLocalEulerAngles(0, 0, 0);
      if (this.rightLegEntity) this.rightLegEntity.setLocalEulerAngles(0, 0, 0);
      if (this.leftArmEntity) this.leftArmEntity.setLocalEulerAngles(0, 0, 0);
      if (this.rightArmEntity) this.rightArmEntity.setLocalEulerAngles(0, 0, 0);
    }
  }

  public getHitboxes(): PCPlayerHitbox[] {
    const rootPos = this.root.getPosition();
    const yawRad = (this.root.getEulerAngles().y * Math.PI) / 180;
    const cosY = Math.cos(yawRad);
    const sinY = Math.sin(yawRad);

    const yDrop = this.isSliding ? -0.35 : 0;

    for (let i = 0; i < this.localHitboxes.length; i++) {
      const def = this.localHitboxes[i];
      const hb = this.worldHitboxes[i];

      // Rotate local offset by player's world yaw
      const rotX = def.offset.x * cosY + def.offset.z * sinY;
      const rotZ = -def.offset.x * sinY + def.offset.z * cosY;

      hb.box.center.set(
        rootPos.x + rotX,
        rootPos.y + def.offset.y + (def.part !== 'leftLeg' && def.part !== 'rightLeg' ? yDrop : 0),
        rootPos.z + rotZ
      );
      hb.box.halfExtents.copy(def.halfExtents);
      if (this.isSliding && def.part === 'chest') {
        hb.box.halfExtents.y = def.halfExtents.y * 0.8;
      }
    }

    return this.worldHitboxes;
  }

  private setupOverheadUI(): void {
    this.overheadRoot = new pc.Entity(`Overhead_${this.playerId}`);
    this.overheadRoot.setLocalPosition(0, 2.15, 0);

    const isBlue = this.team === 'blue';
    let beaconCol = isBlue ? new pc.Color(0.0, 0.85, 1.0) : new pc.Color(1.0, 0.2, 0.3);
    if (this.botRole === 'scout') beaconCol = new pc.Color(0.0, 1.0, 0.5);
    else if (this.botRole === 'rusher') beaconCol = new pc.Color(1.0, 0.55, 0.0);
    else if (this.botRole === 'heavy') beaconCol = new pc.Color(1.0, 0.1, 0.1);
    else if (this.botRole === 'sniper') beaconCol = new pc.Color(0.8, 0.3, 1.0);
    else if (this.botRole === 'boss') beaconCol = new pc.Color(1.0, 0.8, 0.0);

    // Glowing diamond beacon
    const beaconMat = new pc.StandardMaterial();
    beaconMat.diffuse = beaconCol;
    beaconMat.emissive = beaconCol;
    beaconMat.emissiveIntensity = 2.5;
    beaconMat.update();

    const beacon = new pc.Entity('Beacon');
    beacon.addComponent('render', { type: 'box', material: beaconMat });
    beacon.setLocalPosition(0, 0.15, 0);
    beacon.setLocalEulerAngles(45, 45, 0);
    beacon.setLocalScale(0.12, 0.12, 0.12);
    this.overheadRoot.addChild(beacon);

    // Background bar
    const bgMat = new pc.StandardMaterial();
    bgMat.diffuse = new pc.Color(0.08, 0.10, 0.15);
    bgMat.update();

    const bgBar = new pc.Entity('BgBar');
    bgBar.addComponent('render', { type: 'box', material: bgMat });
    bgBar.setLocalScale(0.72, 0.07, 0.03);
    this.overheadRoot.addChild(bgBar);

    // Health bar fill
    const hpMat = new pc.StandardMaterial();
    hpMat.diffuse = new pc.Color(0.1, 0.85, 0.35);
    hpMat.emissive = new pc.Color(0.1, 0.85, 0.35);
    hpMat.emissiveIntensity = 1.0;
    hpMat.update();

    this.hpBarFillEntity = new pc.Entity('HpFill');
    this.hpBarFillEntity.addComponent('render', { type: 'box', material: hpMat });
    this.hpBarFillEntity.setLocalPosition(0, 0, 0.01);
    this.hpBarFillEntity.setLocalScale(0.68, 0.05, 0.03);
    this.overheadRoot.addChild(this.hpBarFillEntity);

    // Shield bar fill
    const shieldMat = new pc.StandardMaterial();
    shieldMat.diffuse = new pc.Color(0.0, 0.85, 1.0);
    shieldMat.emissive = new pc.Color(0.0, 0.85, 1.0);
    shieldMat.emissiveIntensity = 1.2;
    shieldMat.update();

    this.shieldBarFillEntity = new pc.Entity('ShieldFill');
    this.shieldBarFillEntity.addComponent('render', { type: 'box', material: shieldMat });
    this.shieldBarFillEntity.setLocalPosition(0, 0.045, 0.015);
    this.shieldBarFillEntity.setLocalScale(0.68, 0.02, 0.03);
    this.overheadRoot.addChild(this.shieldBarFillEntity);

    this.root.addChild(this.overheadRoot);
  }

  public updateHealth(hp: number, maxHp: number = 100, shield: number = 0, maxShield: number = 50): void {
    if (this.hpBarFillEntity) {
      const pct = Math.max(0, Math.min(1, hp / maxHp));
      this.hpBarFillEntity.setLocalScale(Math.max(0.001, 0.68 * pct), 0.05, 0.03);
      this.hpBarFillEntity.setLocalPosition(-0.34 * (1 - pct), 0, 0.01);
    }
    if (this.shieldBarFillEntity) {
      const sPct = maxShield > 0 ? Math.max(0, Math.min(1, shield / maxShield)) : 0;
      this.shieldBarFillEntity.enabled = sPct > 0;
      if (sPct > 0) {
        this.shieldBarFillEntity.setLocalScale(Math.max(0.001, 0.68 * sPct), 0.02, 0.03);
        this.shieldBarFillEntity.setLocalPosition(-0.34 * (1 - sPct), 0.045, 0.015);
      }
    }
  }

  public updateBillboard(camPos: pc.Vec3 | null | undefined): void {
    if (!this.overheadRoot || !camPos) return;
    this.overheadRoot.lookAt(camPos.x, camPos.y, camPos.z);
  }

  public applyCustomization(_custom: CharacterCustomization): void {
    // Customization hooks for character builder presets
  }

  public setVisible(visible: boolean): void {
    this.root.enabled = visible;
  }

  public destroy(): void {
    this.root.destroy();
  }
}

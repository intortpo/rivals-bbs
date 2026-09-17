import * as pc from 'playcanvas';
import { WeaponType, CharacterCustomization, TeamColor } from '../../../shared/types.js';
import { PCPlayerHitbox } from './PCCharacterModel.js';
import { PCTargetable } from './PCWeaponManager.js';

export type CharacterArchetype = 'player' | 'scout' | 'rusher' | 'heavy' | 'sniper';

export class PCGLBCharacterModel implements PCTargetable {
  public root: pc.Entity;
  public playerId: string;
  public team: TeamColor;
  public botRole?: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss';
  public currentWeapon: WeaponType = 'rifle';
  public isLocalPlayer: boolean = false;
  public isSliding: boolean = false;
  public isDead: boolean = false;

  // Model & bone entities
  public modelEntity?: pc.Entity;
  private headBone?: pc.Entity;
  private spineBone?: pc.Entity;
  private rightHandBone?: pc.Entity;
  public weaponHolder!: pc.Entity;

  // 3D Overhead Billboard Entity
  public overheadRoot?: pc.Entity;
  private hpBarFillEntity?: pc.Entity;
  private shieldBarFillEntity?: pc.Entity;

  // Animation controller
  private currentAnimState: string = 'idle';
  private actionTimer: number = 0;

  // Hitboxes
  public localHitboxes: {
    offset: pc.Vec3;
    halfExtents: pc.Vec3;
    part: 'head' | 'chest' | 'pelvis' | 'leftArm' | 'rightArm' | 'leftLeg' | 'rightLeg' | 'capsule';
    isHead: boolean;
  }[] = [];
  private worldHitboxes: PCPlayerHitbox[] = [];

  constructor(
    app: pc.Application | undefined,
    playerId: string,
    team: TeamColor = 'blue',
    container?: pc.ContainerResource,
    botRole?: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss',
    isLocal: boolean = false
  ) {
    this.playerId = playerId;
    this.team = team;
    this.botRole = botRole;
    this.isLocalPlayer = isLocal;
    this.root = new pc.Entity(`GLBPlayer_${playerId}`);

    this.setupHitboxDefinitions();

    if (app && !isLocal) {
      if (container) {
        this.instantiateFromContainer(container);
      }
      this.setupOverheadUI();
      app.root.addChild(this.root);
    }
  }

  private setupHitboxDefinitions(): void {
    // 1. Head: Centered at y = 1.65m, radius/half-extents ~ 0.20m
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

    this.worldHitboxes = this.localHitboxes.map((def) => ({
      box: new pc.BoundingBox(new pc.Vec3(), def.halfExtents),
      part: def.part,
      isHead: def.isHead,
      isHeadshot: def.isHead,
      playerId: this.playerId
    }));
  }

  private instantiateFromContainer(container: pc.ContainerResource): void {
    // 1. Instantiate the GLB render entity
    this.modelEntity = container.instantiateRenderEntity({ castShadows: true });
    // Scale 0.01 converts Mixamo centimeters (180 cm) to game world meters (1.80 m)
    this.modelEntity.setLocalScale(0.01, 0.01, 0.01);
    // Mixamo characters face +Z, rotate 180 around Y so they face forward (-Z) in game
    this.modelEntity.setLocalEulerAngles(0, 180, 0);
    this.root.addChild(this.modelEntity);

    // 2. Discover key skeleton bones
    this.headBone = this.modelEntity.findByName('mixamorigHead') as pc.Entity;
    this.spineBone = this.modelEntity.findByName('mixamorigSpine1') as pc.Entity;
    this.rightHandBone = this.modelEntity.findByName('mixamorigRightHand') as pc.Entity;

    // 3. Create weapon attachment point
    this.weaponHolder = new pc.Entity('WeaponHolder');
    if (this.rightHandBone) {
      // In Mixamo bone local coordinates (centimeters)
      this.weaponHolder.setLocalPosition(0, 10, 5);
      this.weaponHolder.setLocalEulerAngles(0, 90, 0);
      this.weaponHolder.setLocalScale(100, 100, 100); // Inverse scale so weapons have normal 1m units
      this.rightHandBone.addChild(this.weaponHolder);
    } else {
      this.weaponHolder.setLocalPosition(0.2, 1.1, 0.3);
      this.root.addChild(this.weaponHolder);
    }

    // 4. Color & theme styling per team / archetype
    this.applyColorTheme();

    // 5. Setup animation tracks
    this.setupAnimations(container);
  }

  private applyColorTheme(): void {
    if (!this.modelEntity) return;

    const isBlue = this.team === 'blue';
    let baseColor = isBlue ? new pc.Color(0.12, 0.22, 0.45) : new pc.Color(0.45, 0.12, 0.15);
    let accentColor = isBlue ? new pc.Color(0.0, 0.85, 1.0) : new pc.Color(1.0, 0.2, 0.3);
    let emissiveColor = isBlue ? new pc.Color(0.0, 0.85, 1.0) : new pc.Color(1.0, 0.2, 0.3);

    // Role-specific accents for bots
    if (this.botRole === 'scout') {
      accentColor = new pc.Color(0.0, 0.95, 0.45); // Emerald Green
      emissiveColor = new pc.Color(0.0, 0.95, 0.45);
      baseColor = new pc.Color(0.1, 0.35, 0.18);
    } else if (this.botRole === 'rusher') {
      accentColor = new pc.Color(1.0, 0.55, 0.0); // Blaze Orange
      emissiveColor = new pc.Color(1.0, 0.55, 0.0);
      baseColor = new pc.Color(0.4, 0.2, 0.08);
    } else if (this.botRole === 'heavy') {
      accentColor = new pc.Color(0.95, 0.08, 0.08); // Deep Crimson
      emissiveColor = new pc.Color(0.95, 0.1, 0.1);
      baseColor = new pc.Color(0.35, 0.08, 0.08);
    } else if (this.botRole === 'sniper') {
      accentColor = new pc.Color(0.75, 0.25, 1.0); // Neon Violet
      emissiveColor = new pc.Color(0.75, 0.25, 1.0);
      baseColor = new pc.Color(0.25, 0.12, 0.38);
    }

    const surfaceMat = new pc.StandardMaterial();
    surfaceMat.diffuse = baseColor;
    surfaceMat.gloss = 0.5;
    surfaceMat.metalness = 0.3;
    surfaceMat.useMetalness = true;
    surfaceMat.update();

    const jointMat = new pc.StandardMaterial();
    jointMat.diffuse = accentColor;
    jointMat.emissive = emissiveColor;
    jointMat.emissiveIntensity = 2.0;
    jointMat.update();

    const renderComps = this.modelEntity.findComponents('render') as pc.RenderComponent[];
    for (const r of renderComps) {
      const isJoint = r.entity.name.toLowerCase().includes('joint');
      const mat = isJoint ? jointMat : surfaceMat;
      if (r.meshInstances && r.meshInstances.length > 0) {
        for (const mi of r.meshInstances) {
          mi.material = mat;
        }
      }
    }
  }

  private setupAnimations(container: pc.ContainerResource): void {
    if (!this.modelEntity) return;

    const animAssets = (container as any).animations as pc.Asset[] | undefined;
    if (!animAssets || animAssets.length === 0) return;

    try {
      this.modelEntity.addComponent('anim', { activate: true });
      const animComponent = this.modelEntity.anim;
      if (!animComponent) return;

      const stateNames = [
        'idle',
        'run',
        'sprint',
        'slide',
        'turn180',
        'strafe_left',
        'strafe_right',
        'reload',
        'stab',
        'slash',
        'death'
      ];

      const graph = {
        layers: [
          {
            name: 'Base',
            states: [
              { name: 'START', speed: 1 },
              ...stateNames.map((name) => ({
                name,
                speed: 1.0,
                loop: !['slide', 'turn180', 'reload', 'stab', 'slash', 'death'].includes(name),
                defaultState: name === 'idle'
              }))
            ],
            transitions: [{ from: 'START', to: 'idle' }]
          }
        ],
        parameters: {}
      };

      animComponent.loadStateGraph(graph);

      // Map track resources into their respective state nodes
      for (const asset of animAssets) {
        if (!asset || !asset.resource) continue;
        const track = asset.resource as pc.AnimTrack;
        const rawName = (track.name || asset.name || '').toLowerCase();

        for (const s of stateNames) {
          if (rawName === s || rawName.includes(s) || (s === 'turn180' && rawName.includes('180'))) {
            animComponent.baseLayer?.assignAnimation(s, track);
          }
        }
      }

      animComponent.baseLayer?.play('idle');
      this.currentAnimState = 'idle';
    } catch (err) {
      console.warn('[PCGLBCharacterModel] Could not initialize anim component:', err);
    }
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

  public setPosition(x: number, y: number, z: number): void {
    this.root.setPosition(x, y, z);
  }

  public setRotation(yawDegrees: number): void {
    this.root.setEulerAngles(0, yawDegrees, 0);
  }

  public setAimPitch(pitchDegrees: number): void {
    if (this.headBone) {
      // Rotate head bone up/down according to look pitch
      this.headBone.setLocalEulerAngles(pitchDegrees * 0.7, 0, 0);
    }
    if (this.spineBone) {
      this.spineBone.setLocalEulerAngles(pitchDegrees * 0.3, 0, 0);
    }
  }

  public setSliding(sliding: boolean): void {
    this.isSliding = sliding;
  }

  public updateAnimation(speed: number, dt: number, strafeSpeed: number = 0, isJumping: boolean = false): void {
    const layer = this.modelEntity?.anim?.baseLayer;
    if (!layer) return;

    // Preserve transient attack / reload actions until their duration expires
    if (this.actionTimer > 0) {
      this.actionTimer -= dt;
      return;
    }

    let targetState = 'idle';
    if (this.isDead) {
      targetState = 'death';
    } else if (this.isSliding) {
      targetState = 'slide';
    } else if (isJumping) {
      targetState = 'run';
    } else if (Math.abs(strafeSpeed) > 1.5 && Math.abs(strafeSpeed) > Math.abs(speed) * 0.7) {
      targetState = strafeSpeed > 0 ? 'strafe_right' : 'strafe_left';
    } else if (Math.abs(speed) > 9.5) {
      targetState = 'sprint';
    } else if (Math.abs(speed) > 0.4 || Math.abs(strafeSpeed) > 0.4) {
      targetState = 'run';
    }

    // Sync animation playback rate with actual ground velocity so feet do not slide
    if (targetState === 'run' || targetState === 'sprint' || targetState.startsWith('strafe')) {
      const totalSpeed = Math.hypot(speed, strafeSpeed);
      (layer as any).speed = Math.max(0.65, Math.min(1.4, totalSpeed / 6.5));
    } else {
      (layer as any).speed = 1.0;
    }

    if (this.currentAnimState !== targetState) {
      try {
        layer.transition(targetState, 0.15);
        this.currentAnimState = targetState;
      } catch {
        layer.play(targetState);
        this.currentAnimState = targetState;
      }
    }
  }

  public playAction(actionName: 'reload' | 'stab' | 'slash' | 'death', duration: number = 0.45): void {
    const layer = this.modelEntity?.anim?.baseLayer;
    if (!layer) return;
    if (actionName === 'death') {
      this.isDead = true;
      this.actionTimer = 9999;
    } else if (this.isDead) {
      return;
    } else {
      this.actionTimer = duration;
    }
    try {
      layer.transition(actionName, 0.08);
      this.currentAnimState = actionName;
    } catch {
      layer.play(actionName);
      this.currentAnimState = actionName;
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

  public applyCustomization(_custom: CharacterCustomization): void {
    // Modular customization hook
  }

  public setVisible(visible: boolean): void {
    this.root.enabled = visible;
  }

  public destroy(): void {
    this.root.destroy();
  }
}

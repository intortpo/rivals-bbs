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

  // Animation controller
  private currentAnimState: string = 'idle';

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
      accentColor = new pc.Color(0.0, 0.9, 0.45); // Emerald Green
      emissiveColor = new pc.Color(0.0, 0.9, 0.45);
      baseColor = new pc.Color(0.1, 0.25, 0.15);
    } else if (this.botRole === 'rusher') {
      accentColor = new pc.Color(1.0, 0.55, 0.0); // Blaze Orange
      emissiveColor = new pc.Color(1.0, 0.55, 0.0);
      baseColor = new pc.Color(0.3, 0.18, 0.08);
    } else if (this.botRole === 'heavy') {
      accentColor = new pc.Color(0.85, 0.0, 0.0); // Deep Crimson
      emissiveColor = new pc.Color(0.9, 0.1, 0.1);
      baseColor = new pc.Color(0.2, 0.08, 0.08);
    } else if (this.botRole === 'sniper') {
      accentColor = new pc.Color(0.65, 0.2, 1.0); // Violet
      emissiveColor = new pc.Color(0.65, 0.2, 1.0);
      baseColor = new pc.Color(0.18, 0.1, 0.28);
    }

    const surfaceMat = new pc.StandardMaterial();
    surfaceMat.diffuse = baseColor;
    surfaceMat.gloss = 0.6;
    surfaceMat.metalness = 0.25;
    surfaceMat.useMetalness = true;
    surfaceMat.update();

    const jointMat = new pc.StandardMaterial();
    jointMat.diffuse = accentColor;
    jointMat.emissive = emissiveColor;
    jointMat.emissiveIntensity = 1.4;
    jointMat.update();

    const renders = this.modelEntity.findComponents('render') as pc.RenderComponent[];
    for (const r of renders) {
      if (r.entity.name.includes('Joints')) {
        r.material = jointMat;
      } else {
        r.material = surfaceMat;
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

      for (const asset of animAssets) {
        if (!asset || !asset.resource) continue;
        const track = asset.resource as pc.AnimTrack;
        const trackName = track.name || asset.name;
        const isOneShot =
          trackName === 'death' ||
          trackName === 'reload' ||
          trackName === 'stab' ||
          trackName === 'slash' ||
          trackName === 'turn180';

        animComponent.addAnimationState(trackName, track, 1.0, !isOneShot);
      }

      animComponent.baseLayer?.play('idle');
      this.currentAnimState = 'idle';
    } catch (err) {
      console.warn('[PCGLBCharacterModel] Could not initialize anim component:', err);
    }
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

  public updateAnimation(speed: number, _dt: number): void {
    const layer = this.modelEntity?.anim?.baseLayer;
    if (!layer) return;

    let targetState = 'idle';
    if (this.isDead) {
      targetState = 'death';
    } else if (this.isSliding) {
      targetState = 'slide';
    } else if (speed > 7.5) {
      targetState = 'sprint';
    } else if (speed > 0.4) {
      targetState = 'run';
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

  public playAction(actionName: 'reload' | 'stab' | 'slash' | 'death'): void {
    const layer = this.modelEntity?.anim?.baseLayer;
    if (!layer) return;
    if (actionName === 'death') {
      this.isDead = true;
    } else if (this.isDead) {
      return;
    }
    try {
      layer.transition(actionName, 0.1);
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

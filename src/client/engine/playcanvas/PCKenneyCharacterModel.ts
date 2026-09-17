import * as pc from 'playcanvas';
import { TeamColor } from '../../../shared/types.js';
import { PCTargetable } from './PCWeaponManager.js';
import { PCPlayerHitbox } from './PCCharacterModel.js';

export type KenneySkin =
  | 'cyborgFemaleA'
  | 'criminalMaleA'
  | 'skaterMaleA'
  | 'skaterFemaleA'
  | 'humanMaleA'
  | 'humanFemaleA'
  | 'zombieFemaleA'
  | 'zombieMaleA';

export const BOT_ROLE_SKIN_MAP: Record<string, KenneySkin> = {
  rusher: 'zombieMaleA',
  grunt: 'skaterMaleA',
  heavy: 'cyborgFemaleA',
  sniper: 'humanFemaleA',
  scout: 'skaterFemaleA',
  boss: 'cyborgFemaleA'
};

export const OUTFIT_SKIN_LIST: KenneySkin[] = [
  'cyborgFemaleA',
  'criminalMaleA',
  'skaterMaleA',
  'skaterFemaleA',
  'humanMaleA',
  'humanFemaleA',
  'zombieFemaleA',
  'zombieMaleA'
];

export class PCKenneyCharacterModel implements PCTargetable {
  public root: pc.Entity;
  public playerId: string;
  public team: TeamColor;
  public skin: KenneySkin;
  public botRole?: string;
  public isLocalPlayer: boolean = false;
  public isDead: boolean = false;
  public isSliding: boolean = false;
  public currentWeapon?: string;

  private app?: pc.Application;
  public modelEntity?: pc.Entity;
  public weaponHolder?: pc.Entity;

  // Overhead Billboard UI
  public overheadRoot?: pc.Entity;
  private hpBarFillEntity?: pc.Entity;

  // Animation state
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
    skin: KenneySkin = 'cyborgFemaleA',
    botRole?: string,
    isLocal: boolean = false
  ) {
    this.app = app;
    this.playerId = playerId;
    this.team = team;
    this.skin = skin;
    this.botRole = botRole;
    this.isLocalPlayer = isLocal;
    this.root = new pc.Entity(`KenneyChar_${playerId}`);

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

    // 8. Capsule / Torso Core: Full body bounds
    this.localHitboxes.push({
      offset: new pc.Vec3(0, 0.90, 0),
      halfExtents: new pc.Vec3(0.38, 0.90, 0.38),
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

  public instantiateFromContainer(container: pc.ContainerResource): void {
    // 1. Instantiate render entity from GLB
    this.modelEntity = container.instantiateRenderEntity({ castShadows: true });
    // Scale ~0.0048 scales 376.5cm Kenney character to 1.80m in world units
    this.modelEntity.setLocalScale(0.0048, 0.0048, 0.0048);
    // Face forward
    this.modelEntity.setLocalEulerAngles(0, 180, 0);
    this.root.addChild(this.modelEntity);

    // 2. Load and assign skin texture
    this.applySkinTexture(this.skin);

    // 3. Attach weapon holder node near right hand
    this.weaponHolder = new pc.Entity('KenneyWeaponHolder');
    const rightHand = this.modelEntity.findByName('RightHand') ||
                      this.modelEntity.findByName('RightWrist') ||
                      this.modelEntity.findByName('RightArm') ||
                      this.modelEntity.findByName('arm-right');
    if (rightHand) {
      this.weaponHolder.setLocalPosition(0, 20, 10);
      this.weaponHolder.setLocalEulerAngles(0, 90, 0);
      this.weaponHolder.setLocalScale(208, 208, 208);
      rightHand.addChild(this.weaponHolder);
    } else {
      this.weaponHolder.setLocalPosition(0.25, 1.1, 0.3);
      this.root.addChild(this.weaponHolder);
    }

    // 4. Setup animation tracks
    this.setupAnimations(container);
  }

  private applySkinTexture(_skinName: KenneySkin): void {
    return;
  }

  private setupAnimations(container: pc.ContainerResource): void {
    if (!this.modelEntity) return;

    const animClips = (container as any).animations;
    if (!animClips || animClips.length === 0) return;

    try {
      this.modelEntity.addComponent('anim', {
        activate: true,
        speed: 1.0
      });

      const animComponent = this.modelEntity.anim;
      if (!animComponent) return;

      const stateNames = [
        'idle',
        'run',
        'sprint',
        'slide',
        'jump',
        'strafe_left',
        'strafe_right'
      ];

      // PlayCanvas 2.x AnimComponent requires an explicit State Graph
      // before assignAnimation can register clips to states
      const graph = {
        layers: [
          {
            name: 'Base',
            states: [
              { name: 'START', speed: 1 },
              ...stateNames.map((name) => ({
                name,
                speed: 1.0,
                loop: !['jump', 'slide'].includes(name),
                defaultState: name === 'idle'
              }))
            ],
            transitions: [
              { from: 'START', to: 'idle' },
              ...stateNames.map((name) => ({
                from: 'idle',
                to: name,
                time: 0,
                exitTime: 0,
                blendDuration: 0.15
              })),
              ...stateNames.map((name) => ({
                from: name,
                to: 'idle',
                time: 0,
                exitTime: 0,
                blendDuration: 0.15
              })),
              { from: 'run', to: 'sprint', blendDuration: 0.15 },
              { from: 'sprint', to: 'run', blendDuration: 0.15 },
              { from: 'run', to: 'slide', blendDuration: 0.15 },
              { from: 'sprint', to: 'slide', blendDuration: 0.15 },
              { from: 'slide', to: 'run', blendDuration: 0.2 },
              { from: 'jump', to: 'run', blendDuration: 0.15 },
              { from: 'jump', to: 'idle', blendDuration: 0.15 }
            ]
          }
        ],
        parameters: {}
      };

      animComponent.loadStateGraph(graph);

      for (const clip of animClips) {
        // Can be a pc.Asset or pc.AnimTrack
        const track: pc.AnimTrack = (clip && clip.resource) ? clip.resource : clip;
        const rawName = (track.name || clip.name || '').toLowerCase();

        for (const s of stateNames) {
          if (rawName === s || rawName.includes(s)) {
            animComponent.baseLayer?.assignAnimation(s, track);
          }
        }
      }

      animComponent.baseLayer?.play('idle');
      this.currentAnimState = 'idle';
    } catch (e) {
      console.warn('[PCKenneyCharacterModel] Anim setup notice:', e);
    }
  }

  private setupOverheadUI(): void {
    if (!this.app) return;

    this.overheadRoot = new pc.Entity(`Overhead_${this.playerId}`);
    this.overheadRoot.setLocalPosition(0, 2.15, 0);

    const bgMat = new pc.StandardMaterial();
    bgMat.diffuse = new pc.Color(0.05, 0.08, 0.12);
    bgMat.useLighting = false;
    bgMat.update();

    const hpMat = new pc.StandardMaterial();
    const hpColor = this.team === 'blue' ? new pc.Color(0.0, 0.85, 1.0) : new pc.Color(1.0, 0.25, 0.35);
    hpMat.diffuse = hpColor;
    hpMat.emissive = hpColor;
    hpMat.emissiveIntensity = 2.0;
    hpMat.useLighting = false;
    hpMat.update();

    const bg = new pc.Entity('HPBackground');
    bg.addComponent('render', { type: 'box', material: bgMat });
    bg.setLocalScale(0.9, 0.09, 0.04);
    this.overheadRoot.addChild(bg);

    this.hpBarFillEntity = new pc.Entity('HPFill');
    this.hpBarFillEntity.addComponent('render', { type: 'box', material: hpMat });
    this.hpBarFillEntity.setLocalScale(0.86, 0.06, 0.05);
    this.hpBarFillEntity.setLocalPosition(0, 0, 0.01);
    this.overheadRoot.addChild(this.hpBarFillEntity);

    this.root.addChild(this.overheadRoot);
  }

  public updateHealth(hp: number, maxHp: number, _shieldHp: number = 0, _maxShield: number = 50): void {
    if (this.hpBarFillEntity) {
      const pct = Math.max(0, Math.min(1, hp / maxHp));
      this.hpBarFillEntity.setLocalScale(0.86 * pct, 0.06, 0.05);
      this.hpBarFillEntity.setLocalPosition((pct - 1) * 0.43, 0, 0.01);
    }
  }

  public updateBillboard(camPos: pc.Vec3): void {
    if (!this.overheadRoot) return;
    const worldPos = this.overheadRoot.getPosition();
    this.overheadRoot.lookAt(camPos.x, worldPos.y, camPos.z);
    this.overheadRoot.rotateLocal(0, 180, 0);
  }

  public setSliding(sliding: boolean): void {
    this.isSliding = sliding;
  }

  public setAimPitch(_pitchDegrees: number): void {
    // Optional neck pitch bending
  }

  public updateAnimation(speed: number, _dt: number, strafeSpeed: number = 0, isJumping: boolean = false): void {
    const layer = this.modelEntity?.anim?.baseLayer;
    if (!layer) return;

    let targetState = 'idle';
    if (this.isDead) {
      targetState = 'idle';
    } else if (isJumping) {
      targetState = 'jump';
    } else if (this.isSliding) {
      targetState = 'slide';
    } else {
      const fwd = Math.abs(speed);
      const strafe = Math.abs(strafeSpeed);
      if (fwd > 6.0) {
        targetState = 'sprint';
      } else if (fwd > 0.3) {
        targetState = 'run';
      } else if (strafe > 0.3) {
        targetState = strafeSpeed > 0 ? 'strafe_right' : 'strafe_left';
      } else {
        targetState = 'idle';
      }
    }

    // Sync animation playback rate with actual ground velocity so feet do not slide
    if (targetState === 'run' || targetState === 'sprint' || targetState.startsWith('strafe')) {
      const totalSpeed = Math.hypot(speed, strafeSpeed);
      (layer as any).speed = Math.max(0.65, Math.min(1.4, totalSpeed / 6.0));
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

  public playAction(_actionName: string, _duration: number = 0.45): void {
    // Action trigger
  }

  public setVisible(visible: boolean): void {
    this.root.enabled = visible;
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
        rootPos.y + def.offset.y + yDrop,
        rootPos.z + rotZ
      );
      hb.box.halfExtents.copy(def.halfExtents);
      if (this.isSliding && def.part === 'head') {
        hb.box.halfExtents.y = 0.15;
      }
    }

    return this.worldHitboxes;
  }

  public setPosition(x: number, y: number, z: number): void {
    this.root.setPosition(x, y, z);
  }

  public setRotation(yawDegrees: number): void {
    this.root.setEulerAngles(0, yawDegrees, 0);
  }

  public getPosition(): pc.Vec3 {
    return this.root.getPosition();
  }

  public destroy(): void {
    this.root.destroy();
  }
}

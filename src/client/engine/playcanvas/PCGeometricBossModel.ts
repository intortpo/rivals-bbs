import * as pc from 'playcanvas';
import { WeaponType } from '../../../shared/types.js';
import { PCPlayerHitbox } from './PCCharacterModel.js';

export class PCGeometricBossModel {
  public root: pc.Entity;
  public playerId: string;
  public playerName: string;
  public playerColor: string;
  public currentWeapon: WeaponType = 'plasma_launcher';
  public isDead: boolean = false;

  // Visual entities
  private coreEntity!: pc.Entity;
  private ringEntity!: pc.Entity;
  private satellites: pc.Entity[] = [];

  // Hitbox bounding boxes
  public coreBox: pc.BoundingBox;
  public hullBox: pc.BoundingBox;
  public satelliteBoxes: pc.BoundingBox[] = [];

  private animTime: number = 0;

  constructor(app: pc.Application | undefined, playerId: string, name: string = 'TITAN AXIOM', color: string = '#d946ef') {
    this.playerId = playerId;
    this.playerName = name;
    this.playerColor = color;
    this.root = new pc.Entity(`Boss_${playerId}`);

    this.coreBox = new pc.BoundingBox(new pc.Vec3(0, 1.1, 0), new pc.Vec3(0.7, 0.7, 0.7));
    this.hullBox = new pc.BoundingBox(new pc.Vec3(0, 1.1, 0), new pc.Vec3(1.6, 1.6, 1.6));

    for (let i = 0; i < 4; i++) {
      this.satelliteBoxes.push(new pc.BoundingBox(new pc.Vec3(), new pc.Vec3(0.4, 0.4, 0.4)));
    }

    if (app) {
      this.buildBossGeometry();
      app.root.addChild(this.root);
    }
  }

  private buildBossGeometry(): void {
    const bossCol = new pc.Color().fromString(this.playerColor);

    const coreMat = new pc.StandardMaterial();
    coreMat.diffuse = bossCol;
    coreMat.emissive = bossCol;
    coreMat.emissiveIntensity = 3.0;
    coreMat.update();

    const hullMat = new pc.StandardMaterial();
    hullMat.diffuse = new pc.Color(0.12, 0.14, 0.20);
    hullMat.update();

    // Central Core
    this.coreEntity = new pc.Entity('BossCore');
    this.coreEntity.addComponent('render', { type: 'sphere', material: coreMat });
    this.coreEntity.setLocalPosition(0, 1.1, 0);
    this.coreEntity.setLocalScale(1.4, 1.4, 1.4);
    this.root.addChild(this.coreEntity);

    // Orbiting Ring
    this.ringEntity = new pc.Entity('BossRing');
    this.ringEntity.addComponent('render', { type: 'cylinder', material: hullMat });
    this.ringEntity.setLocalPosition(0, 1.1, 0);
    this.ringEntity.setLocalScale(3.6, 0.3, 3.6);
    this.root.addChild(this.ringEntity);

    // 4 Satellites
    for (let i = 0; i < 4; i++) {
      const sat = new pc.Entity(`Satellite_${i}`);
      sat.addComponent('render', { type: 'box', material: coreMat });
      sat.setLocalScale(0.8, 0.8, 0.8);
      this.root.addChild(sat);
      this.satellites.push(sat);
    }
  }

  public setPosition(x: number, y: number, z: number): void {
    this.root.setPosition(x, y, z);
  }

  public setRotation(yawDegrees: number): void {
    this.root.setEulerAngles(0, yawDegrees, 0);
  }

  public updateAnimation(dt: number): void {
    this.animTime += dt;

    if (this.coreEntity) {
      this.coreEntity.rotateLocal(45 * dt, 60 * dt, 0);
    }
    if (this.ringEntity) {
      this.ringEntity.rotateLocal(0, -90 * dt, 30 * dt);
    }

    const rootPos = this.root.getPosition();
    this.coreBox.center.set(rootPos.x, rootPos.y + 1.1, rootPos.z);
    this.hullBox.center.set(rootPos.x, rootPos.y + 1.1, rootPos.z);

    // Update satellites in orbital circle
    for (let i = 0; i < this.satelliteBoxes.length; i++) {
      const angle = this.animTime * 2.0 + (i * Math.PI) / 2;
      const radius = 3.2;
      const sx = Math.cos(angle) * radius;
      const sz = Math.sin(angle) * radius;
      const sy = 1.1 + Math.sin(this.animTime * 3.0 + i) * 0.5;

      const sat = this.satellites[i];
      if (sat) {
        sat.setLocalPosition(sx, sy, sz);
        sat.rotateLocal(120 * dt, 90 * dt, 0);
      }

      this.satelliteBoxes[i].center.set(rootPos.x + sx, rootPos.y + sy, rootPos.z + sz);
    }
  }

  public getHitboxes(): PCPlayerHitbox[] {
    const rootPos = this.root.getPosition();
    this.coreBox.center.set(rootPos.x, rootPos.y + 1.1, rootPos.z);
    this.hullBox.center.set(rootPos.x, rootPos.y + 1.1, rootPos.z);

    const hitboxes: PCPlayerHitbox[] = [
      {
        box: this.coreBox,
        part: 'head',
        isHead: true,
        isHeadshot: true,
        playerId: this.playerId
      },
      {
        box: this.hullBox,
        part: 'chest',
        isHead: false,
        isHeadshot: false,
        playerId: this.playerId
      }
    ];

    for (let i = 0; i < this.satelliteBoxes.length; i++) {
      hitboxes.push({
        box: this.satelliteBoxes[i],
        part: 'leftArm',
        isHead: false,
        isHeadshot: false,
        playerId: this.playerId
      });
    }

    return hitboxes;
  }

  public setVisible(visible: boolean): void {
    this.root.enabled = visible;
  }

  public destroy(): void {
    this.root.destroy();
  }
}

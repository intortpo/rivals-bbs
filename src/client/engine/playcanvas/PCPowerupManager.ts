import * as pc from 'playcanvas';
import { POWERUPS } from '../../../shared/constants.js';
import { PowerupType } from '../../../shared/types.js';
import { AudioManager } from '../AudioManager.js';

export class PCPowerupManager {
  private app?: pc.Application;
  private audio: AudioManager;

  public storedPowerup: PowerupType | null = null;
  public activePowerup: PowerupType | null = null;
  public expiresAt: number = 0;
  public shieldHp: number = 0;
  public powerupsUsedInMatch: number = 0;

  // Visual effects
  private shieldEntity: pc.Entity | null = null;
  private airstrikeEntity: pc.Entity | null = null;

  public onInventoryChanged?: (stored: PowerupType | null) => void;
  public onActiveChanged?: (active: PowerupType | null, remainingSec: number) => void;

  constructor(app: pc.Application | undefined, audio: AudioManager) {
    this.app = app;
    this.audio = audio;
    if (app) {
      this.createShieldEntity();
    }
  }

  public hasActivePowerup(): boolean {
    return this.activePowerup !== null && Date.now() < this.expiresAt;
  }

  public get remainingActiveSec(): number {
    return Math.max(0, (this.expiresAt - Date.now()) / 1000);
  }

  public triggerRemoteAura(powerup: PowerupType): void {
    if (powerup === 'shield') this.audio.playPowerupShield();
    else if (powerup === 'speed') this.audio.playPowerupSpeed();
    else if (powerup === 'quad_damage') this.audio.playPowerupQuadDamage();
    else if (powerup === 'airstrike') this.audio.playPowerupAirstrike();
    else this.audio.playPowerupInstantRefill();
  }

  private createShieldEntity(): void {
    if (!this.app) return;
    this.shieldEntity = new pc.Entity('PlayerShield');
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(0, 0.8, 1.0);
    mat.emissive = new pc.Color(0, 0.8, 1.0);
    mat.emissiveIntensity = 1.5;
    mat.opacity = 0.35;
    mat.blendType = pc.BLEND_ADDITIVE;
    mat.update();

    this.shieldEntity.addComponent('render', { type: 'sphere', material: mat });
    this.shieldEntity.setLocalScale(2.4, 2.4, 2.4);
    this.shieldEntity.enabled = false;
    this.app.root.addChild(this.shieldEntity);
  }

  public storePowerup(type: PowerupType): void {
    this.storedPowerup = type;
    if (this.onInventoryChanged) {
      this.onInventoryChanged(this.storedPowerup);
    }
  }

  public activatePowerup(type?: PowerupType, targetPoint?: [number, number, number]): PowerupType | null {
    const toActivate = type || this.storedPowerup;
    if (!toActivate) return null;

    const def = POWERUPS[toActivate];
    if (!def) return null;

    if (toActivate === this.storedPowerup) {
      this.storedPowerup = null;
      if (this.onInventoryChanged) this.onInventoryChanged(null);
    }

    this.activePowerup = toActivate;
    this.expiresAt = Date.now() + def.durationSec * 1000;
    this.powerupsUsedInMatch++;

    switch (toActivate) {
      case 'shield':
        this.shieldHp = 50;
        if (this.shieldEntity) this.shieldEntity.enabled = true;
        this.audio.playPowerupShield();
        break;
      case 'speed':
        this.audio.playPowerupSpeed();
        break;
      case 'quad_damage':
        this.audio.playPowerupQuadDamage();
        break;
      case 'rapid_mag':
        this.audio.playPowerupInstantRefill();
        break;
      case 'radar':
        this.audio.playPowerupRadar();
        break;
      case 'phase_shift':
        this.audio.playPowerupPhaseShift();
        break;
      case 'airstrike':
        this.audio.playPowerupAirstrike();
        if (targetPoint) {
          this.spawnAirstrikeMarker(targetPoint);
        }
        break;
    }

    if (this.onActiveChanged) {
      this.onActiveChanged(this.activePowerup, def.durationSec);
    }

    return toActivate;
  }

  private spawnAirstrikeMarker(point: [number, number, number]): void {
    if (!this.app) return;
    if (this.airstrikeEntity) {
      this.airstrikeEntity.destroy();
    }

    this.airstrikeEntity = new pc.Entity('AirstrikeMarker');
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color(1, 0.1, 0.2);
    mat.emissive = new pc.Color(1, 0.1, 0.2);
    mat.emissiveIntensity = 2.0;
    mat.opacity = 0.6;
    mat.blendType = pc.BLEND_ADDITIVE;
    mat.update();

    const beacon = new pc.Entity('Beam');
    beacon.addComponent('render', { type: 'cylinder', material: mat });
    beacon.setLocalScale(0.6, 100, 0.6);
    beacon.setLocalPosition(0, 50, 0);
    this.airstrikeEntity.addChild(beacon);

    this.airstrikeEntity.setPosition(point[0], point[1], point[2]);
    this.app.root.addChild(this.airstrikeEntity);
  }

  public getSpeedMultiplier(): number {
    return this.hasActivePowerup() && this.activePowerup === 'speed' ? 1.45 : 1.0;
  }

  public isPhaseCloakActive(): boolean {
    return this.hasActivePowerup() && this.activePowerup === 'phase_shift';
  }

  public isRapidMagActive(): boolean {
    return this.hasActivePowerup() && this.activePowerup === 'rapid_mag';
  }

  public applyActivePowerup(type: PowerupType, durationSec: number): void {
    this.activePowerup = type;
    this.expiresAt = Date.now() + durationSec * 1000;
    if (type === 'shield') {
      this.shieldHp = 50;
      if (this.shieldEntity) this.shieldEntity.enabled = true;
    }
  }

  public reset(): void {
    this.storedPowerup = null;
    this.activePowerup = null;
    this.expiresAt = 0;
    this.shieldHp = 0;
    this.powerupsUsedInMatch = 0;
    if (this.shieldEntity) this.shieldEntity.enabled = false;
    if (this.airstrikeEntity) {
      this.airstrikeEntity.destroy();
      this.airstrikeEntity = null;
    }
    if (this.onInventoryChanged) this.onInventoryChanged(null);
    if (this.onActiveChanged) this.onActiveChanged(null, 0);
  }

  public update(delta: number, playerPos: pc.Vec3 | [number, number, number]): void {
    const now = Date.now();
    if (this.shieldEntity && this.shieldEntity.enabled) {
      const px = Array.isArray(playerPos) ? playerPos[0] : playerPos.x;
      const py = Array.isArray(playerPos) ? playerPos[1] : playerPos.y;
      const pz = Array.isArray(playerPos) ? playerPos[2] : playerPos.z;
      this.shieldEntity.setPosition(px, py + 1.0, pz);
      this.shieldEntity.rotateLocal(45 * delta, 60 * delta, 0);
    }

    if (this.activePowerup && now >= this.expiresAt) {
      if (this.activePowerup === 'shield' && this.shieldEntity) {
        this.shieldEntity.enabled = false;
      }
      this.activePowerup = null;
      if (this.onActiveChanged) this.onActiveChanged(null, 0);
    } else if (this.activePowerup && this.onActiveChanged) {
      const rem = Math.max(0, (this.expiresAt - now) / 1000);
      this.onActiveChanged(this.activePowerup, rem);
    }
  }

  public absorbDamage(damage: number): { remainingDamage: number; absorbed: number } {
    if (!this.hasActivePowerup() || this.activePowerup !== 'shield' || this.shieldHp <= 0) {
      return { remainingDamage: damage, absorbed: 0 };
    }
    const absorbed = Math.min(this.shieldHp, damage);
    this.shieldHp -= absorbed;
    if (this.shieldHp <= 0) {
      if (this.shieldEntity) this.shieldEntity.enabled = false;
      this.activePowerup = null;
      if (this.onActiveChanged) this.onActiveChanged(null, 0);
    }
    return { remainingDamage: damage - absorbed, absorbed };
  }

  public dispose(): void {
    if (this.shieldEntity) this.shieldEntity.destroy();
    if (this.airstrikeEntity) this.airstrikeEntity.destroy();
  }
}

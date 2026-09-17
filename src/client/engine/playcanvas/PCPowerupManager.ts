import * as pc from 'playcanvas';
import { POWERUPS } from '../../../shared/constants.js';
import { PowerupType } from '../../../shared/types.js';
import { AudioManager } from '../AudioManager.js';

export interface WorldPickupItem {
  id: string;
  type: PowerupType;
  x: number;
  baseY: number;
  z: number;
  entity?: pc.Entity;
  crystalEntity?: pc.Entity;
  ringEntity?: pc.Entity;
  isAvailable: boolean;
  respawnsAt: number;
}

export const MAP_POWERUP_LOCATIONS: Record<string, { type: PowerupType; x: number; y: number; z: number }[]> = {
  Facility: [
    { type: 'speed', x: 0, y: 1.2, z: 0 },
    { type: 'shield', x: -14, y: 1.2, z: 12 },
    { type: 'quad_damage', x: 14, y: 1.2, z: -12 },
    { type: 'rapid_mag', x: 0, y: 3.8, z: 18 }
  ],
  'Cartoon City': [
    { type: 'speed', x: 0, y: 1.2, z: 0 },
    { type: 'shield', x: -16, y: 1.2, z: -14 },
    { type: 'quad_damage', x: 16, y: 1.2, z: 14 },
    { type: 'rapid_mag', x: 0, y: 1.2, z: -22 }
  ],
  'Arena Classic': [
    { type: 'quad_damage', x: 0, y: 3.8, z: 0 },
    { type: 'speed', x: -18, y: 1.2, z: 0 },
    { type: 'shield', x: 18, y: 1.2, z: 0 },
    { type: 'rapid_mag', x: 0, y: 1.2, z: -18 }
  ],
  'Neon Warehouse': [
    { type: 'speed', x: 0, y: 4.2, z: 0 },
    { type: 'shield', x: -15, y: 1.2, z: 15 },
    { type: 'quad_damage', x: 15, y: 1.2, z: -15 },
    { type: 'rapid_mag', x: 0, y: 1.2, z: 18 }
  ],
  'Cyber Spire': [
    { type: 'quad_damage', x: 0, y: 12.2, z: 0 },
    { type: 'shield', x: -12, y: 6.2, z: 0 },
    { type: 'speed', x: 12, y: 6.2, z: 0 },
    { type: 'rapid_mag', x: 0, y: 6.2, z: 12 }
  ],
  'Quantum Lab': [
    { type: 'quad_damage', x: 0, y: 3.2, z: 0 },
    { type: 'shield', x: -16, y: 1.2, z: -14 },
    { type: 'speed', x: 16, y: 1.2, z: 14 },
    { type: 'rapid_mag', x: 0, y: 5.2, z: -16 }
  ],
  'Magma Foundry': [
    { type: 'quad_damage', x: 0, y: 1.2, z: 0 },
    { type: 'shield', x: -14, y: 1.2, z: -14 },
    { type: 'speed', x: 14, y: 1.2, z: 14 },
    { type: 'rapid_mag', x: 14, y: 1.2, z: -14 }
  ],
  'Subzero Station': [
    { type: 'shield', x: 0, y: 1.2, z: 0 },
    { type: 'speed', x: -18, y: 1.2, z: 12 },
    { type: 'quad_damage', x: 18, y: 1.2, z: -12 },
    { type: 'rapid_mag', x: 0, y: 4.8, z: -16 }
  ],
  'Sky Sanctuary': [
    { type: 'quad_damage', x: 0, y: 4.2, z: 0 },
    { type: 'speed', x: -15, y: 2.2, z: -12 },
    { type: 'shield', x: 15, y: 2.2, z: 12 },
    { type: 'rapid_mag', x: 0, y: 1.2, z: 18 }
  ],
  'Orbital Station': [
    { type: 'quad_damage', x: 0, y: 6.2, z: 0 },
    { type: 'speed', x: -16, y: 1.2, z: 0 },
    { type: 'shield', x: 16, y: 1.2, z: 0 },
    { type: 'rapid_mag', x: 0, y: 1.2, z: 16 }
  ]
};

export class PCPowerupManager {
  private app?: pc.Application;
  private audio: AudioManager;

  public storedPowerup: PowerupType | null = null;
  public activePowerup: PowerupType | null = null;
  public expiresAt: number = 0;
  public shieldHp: number = 0;
  public powerupsUsedInMatch: number = 0;

  // In-world 3D pickups
  public worldPickups: WorldPickupItem[] = [];
  private hoverTime: number = 0;

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

  private getPowerupColor(type: PowerupType): pc.Color {
    switch (type) {
      case 'shield':
        return new pc.Color(0, 0.82, 1.0);
      case 'speed':
        return new pc.Color(1.0, 0.67, 0);
      case 'quad_damage':
        return new pc.Color(1.0, 0.16, 0.33);
      case 'rapid_mag':
        return new pc.Color(0, 1.0, 0.53);
      case 'airstrike':
        return new pc.Color(0.96, 0.25, 0.37);
      case 'phase_shift':
        return new pc.Color(0.66, 0.33, 0.97);
      default:
        return new pc.Color(0.23, 0.51, 0.96);
    }
  }

  public spawnWorldPickups(mapName: string): void {
    this.clearWorldPickups();

    const locs = MAP_POWERUP_LOCATIONS[mapName] || MAP_POWERUP_LOCATIONS['Facility'];
    if (!locs) return;

    for (let i = 0; i < locs.length; i++) {
      const def = locs[i];
      const item: WorldPickupItem = {
        id: `${mapName}_${def.type}_${i}`,
        type: def.type,
        x: def.x,
        baseY: def.y,
        z: def.z,
        isAvailable: true,
        respawnsAt: 0
      };

      if (this.app) {
        const root = new pc.Entity(`WorldPickup_${item.id}`);
        root.setPosition(def.x, def.y, def.z);

        const color = this.getPowerupColor(def.type);
        const pbrMat = new pc.StandardMaterial();
        pbrMat.diffuse = color;
        pbrMat.emissive = color;
        pbrMat.emissiveIntensity = 2.4;
        pbrMat.useLighting = false;
        pbrMat.update();

        // 3D Diamond / Crystal
        const crystal = new pc.Entity('Crystal');
        crystal.addComponent('render', { type: 'box', material: pbrMat });
        crystal.setLocalScale(0.48, 0.48, 0.48);
        crystal.setLocalEulerAngles(45, 45, 0);
        root.addChild(crystal);

        // 3D Orbital Halo Ring
        const ring = new pc.Entity('Ring');
        ring.addComponent('render', { type: 'cylinder', material: pbrMat });
        ring.setLocalScale(0.9, 0.04, 0.9);
        root.addChild(ring);

        this.app.root.addChild(root);

        item.entity = root;
        item.crystalEntity = crystal;
        item.ringEntity = ring;
      }

      this.worldPickups.push(item);
    }
  }

  public clearWorldPickups(): void {
    for (const p of this.worldPickups) {
      if (p.entity) {
        p.entity.destroy();
      }
    }
    this.worldPickups = [];
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
    const px = Array.isArray(playerPos) ? playerPos[0] : playerPos.x;
    const py = Array.isArray(playerPos) ? playerPos[1] : playerPos.y;
    const pz = Array.isArray(playerPos) ? playerPos[2] : playerPos.z;

    if (this.shieldEntity && this.shieldEntity.enabled) {
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

    // World pickup hover animation and collision collection
    this.hoverTime += delta;
    for (const pickup of this.worldPickups) {
      if (!pickup.isAvailable) {
        if (now >= pickup.respawnsAt) {
          pickup.isAvailable = true;
          if (pickup.entity) pickup.entity.enabled = true;
          this.audio.playPowerupInstantRefill();
        }
        continue;
      }

      if (pickup.entity) {
        const floatY = pickup.baseY + Math.sin(this.hoverTime * 2.8 + pickup.x) * 0.16;
        pickup.entity.setPosition(pickup.x, floatY, pickup.z);
        if (pickup.crystalEntity) {
          pickup.crystalEntity.rotateLocal(0, 80 * delta, 40 * delta);
        }
        if (pickup.ringEntity) {
          pickup.ringEntity.rotateLocal(30 * delta, 0, 60 * delta);
        }
      }

      const dist = Math.hypot(px - pickup.x, py - pickup.baseY, pz - pickup.z);
      if (dist < 1.85) {
        pickup.isAvailable = false;
        pickup.respawnsAt = now + 25000;
        if (pickup.entity) pickup.entity.enabled = false;

        if (!this.storedPowerup) {
          this.storePowerup(pickup.type);
        } else if (!this.hasActivePowerup()) {
          this.activatePowerup(pickup.type);
        } else {
          this.storePowerup(pickup.type);
        }

        this.triggerRemoteAura(pickup.type);
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(35);
        }
      }
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
    this.clearWorldPickups();
    if (this.shieldEntity) this.shieldEntity.destroy();
    if (this.airstrikeEntity) this.airstrikeEntity.destroy();
  }
}

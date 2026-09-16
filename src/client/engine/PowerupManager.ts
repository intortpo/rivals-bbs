import * as THREE from 'three';
import { POWERUPS } from '../../shared/constants.js';
import { PowerupType } from '../../shared/types.js';
import { AudioManager } from './AudioManager.js';

export class PowerupManager {
  private scene: THREE.Scene;
  private audio: AudioManager;

  public storedPowerup: PowerupType | null = null;
  public activePowerup: PowerupType | null = null;
  public expiresAt: number = 0;
  public shieldHp: number = 0;
  public powerupsUsedInMatch: number = 0;

  // Visual effects
  private shieldMesh: THREE.Mesh | null = null;
  private airstrikeMarker: THREE.Group | null = null;

  public onInventoryChanged?: (stored: PowerupType | null) => void;
  public onActiveChanged?: (active: PowerupType | null, remainingSec: number) => void;

  constructor(scene: THREE.Scene, audio: AudioManager) {
    this.scene = scene;
    this.audio = audio;
    this.createShieldMesh();
  }

  public hasActivePowerup(): boolean {
    return this.activePowerup !== null && Date.now() < this.expiresAt;
  }

  public get remainingActiveSec(): number {
    return Math.max(0, (this.expiresAt - Date.now()) / 1000);
  }

  public triggerRemoteAura(_targetRoot: THREE.Object3D, powerup: PowerupType): void {
    if (powerup === 'shield') this.audio.playPowerupShield();
    else if (powerup === 'speed') this.audio.playPowerupSpeed();
    else if (powerup === 'quad_damage') this.audio.playPowerupQuadDamage();
    else if (powerup === 'airstrike') this.audio.playPowerupAirstrike();
    else this.audio.playPowerupInstantRefill();
  }

  private createShieldMesh(): void {
    const geom = new THREE.SphereGeometry(1.2, 16, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00d2ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    this.shieldMesh = new THREE.Mesh(geom, mat);
    this.shieldMesh.visible = false;
    this.scene.add(this.shieldMesh);
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

    // Trigger local audio and effects
    switch (toActivate) {
      case 'shield':
        this.shieldHp = 50;
        if (this.shieldMesh) this.shieldMesh.visible = true;
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
    if (this.airstrikeMarker) {
      this.scene.remove(this.airstrikeMarker);
    }

    const group = new THREE.Group();
    group.position.set(point[0], point[1] + 0.1, point[2]);

    // Red ground beacon ring
    const ringGeom = new THREE.RingGeometry(0.5, 8.0, 32);
    ringGeom.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xff2a55,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    group.add(ring);

    // Vertical orbital beam
    const beamGeom = new THREE.CylinderGeometry(0.3, 0.3, 120, 16);
    beamGeom.translate(0, 60, 0);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xff5577,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Mesh(beamGeom, beamMat);
    group.add(beam);

    this.scene.add(group);
    this.airstrikeMarker = group;

    // Clean up after 2.5s
    setTimeout(() => {
      if (this.airstrikeMarker === group) {
        this.scene.remove(group);
        this.airstrikeMarker = null;
      }
    }, 2500);
  }

  public getSpeedMultiplier(): number {
    if (this.activePowerup === 'speed' && Date.now() < this.expiresAt) {
      return 1.4; // 40% speed boost
    }
    return 1.0;
  }

  public getDamageMultiplier(): number {
    if (this.activePowerup === 'quad_damage' && Date.now() < this.expiresAt) {
      return 2.0; // 2x damage
    }
    return 1.0;
  }

  public isRadarActive(): boolean {
    return this.activePowerup === 'radar' && Date.now() < this.expiresAt;
  }

  public isPhaseCloakActive(): boolean {
    return this.activePowerup === 'phase_shift' && Date.now() < this.expiresAt;
  }

  public isRapidMagActive(): boolean {
    return this.activePowerup === 'rapid_mag' && Date.now() < this.expiresAt;
  }

  public update(delta: number, playerPos: THREE.Vector3): void {
    const now = Date.now();

    // Shield mesh positioning & rotation
    if (this.shieldMesh) {
      if (this.shieldHp > 0) {
        this.shieldMesh.visible = true;
        this.shieldMesh.position.copy(playerPos);
        this.shieldMesh.position.y += 0.9;
        this.shieldMesh.rotation.y += delta * 1.5;
        this.shieldMesh.rotation.x += delta * 0.8;
      } else {
        this.shieldMesh.visible = false;
      }
    }

    if (this.activePowerup && now >= this.expiresAt) {
      this.activePowerup = null;
      if (this.onActiveChanged) {
        this.onActiveChanged(null, 0);
      }
    } else if (this.activePowerup && this.onActiveChanged) {
      const rem = Math.max(0, (this.expiresAt - now) / 1000);
      this.onActiveChanged(this.activePowerup, rem);
    }
  }

  public absorbDamage(incomingDamage: number): number {
    if (this.shieldHp <= 0) return incomingDamage;
    const absorbed = Math.min(this.shieldHp, incomingDamage);
    this.shieldHp -= absorbed;
    if (this.shieldHp <= 0 && this.shieldMesh) {
      this.shieldMesh.visible = false;
    }
    return incomingDamage - absorbed;
  }

  public applyActivePowerup(type: PowerupType, durationSec: number): void {
    this.activePowerup = type;
    this.expiresAt = Date.now() + durationSec * 1000;
    if (type === 'shield') {
      this.shieldHp = 50;
      if (this.shieldMesh) this.shieldMesh.visible = true;
    }
  }

  public reset(): void {
    this.storedPowerup = null;
    this.activePowerup = null;
    this.expiresAt = 0;
    this.shieldHp = 0;
    this.powerupsUsedInMatch = 0;
    if (this.shieldMesh) this.shieldMesh.visible = false;
    if (this.airstrikeMarker) {
      this.scene.remove(this.airstrikeMarker);
      this.airstrikeMarker = null;
    }
    if (this.onInventoryChanged) this.onInventoryChanged(null);
    if (this.onActiveChanged) this.onActiveChanged(null, 0);
  }
}

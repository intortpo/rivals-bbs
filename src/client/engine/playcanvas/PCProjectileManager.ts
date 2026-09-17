import * as pc from 'playcanvas';
import { BotProjectilePayload, ProjectileImpactPayload, ProjectilePattern } from '../../../shared/types.js';
import { PCFXManager } from './PCFXManager.js';

interface ClientProjectile {
  id: string;
  entity: pc.Entity;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  pattern: ProjectilePattern;
  spawnTime: number;
}

interface SparkParticle {
  entity: pc.Entity;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export class PCProjectileManager {
  private app?: pc.Application;
  private rootEntity?: pc.Entity;
  private fx: PCFXManager;
  private activeProjectiles: Map<string, ClientProjectile> = new Map();
  private entityPool: pc.Entity[] = [];
  private static readonly MAX_POOL_SIZE = 120;

  // Impact spark debris
  private sparkParticles: SparkParticle[] = [];
  private sparkPool: pc.Entity[] = [];

  constructor(app: pc.Application | undefined, fx: PCFXManager) {
    this.app = app;
    this.fx = fx;
    if (app) {
      this.rootEntity = new pc.Entity('ProjectileRoot');
      app.root.addChild(this.rootEntity);
    }
  }

  private getPooledEntity(pattern: ProjectilePattern, colorHex: string): pc.Entity {
    let ent = this.entityPool.pop();
    const col = new pc.Color();
    col.fromString(colorHex);

    if (!ent) {
      ent = new pc.Entity('Projectile');
      const mat = new pc.StandardMaterial();
      mat.diffuse = col;
      mat.emissive = col;
      mat.emissiveIntensity = 2.0;
      mat.opacity = 0.95;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.update();

      const shapeType = pattern === 'beam' ? 'cylinder' : 'sphere';
      ent.addComponent('render', { type: shapeType, material: mat });
      if (this.rootEntity) {
        this.rootEntity.addChild(ent);
      }
    } else {
      const render = ent.render;
      if (render?.material) {
        (render.material as pc.StandardMaterial).diffuse = col;
        (render.material as pc.StandardMaterial).emissive = col;
        render.material.update();
      }
    }

    ent.enabled = true;
    return ent;
  }

  private releaseEntity(ent: pc.Entity): void {
    ent.enabled = false;
    if (this.entityPool.length < PCProjectileManager.MAX_POOL_SIZE) {
      this.entityPool.push(ent);
    } else {
      ent.destroy();
    }
  }

  public onProjectileSpawn(payload: BotProjectilePayload): void {
    if (!this.app || !this.rootEntity) return;

    const ent = this.getPooledEntity(payload.pattern, payload.color);
    ent.setPosition(payload.x, payload.y, payload.z);
    ent.setLocalScale(payload.radius * 2, payload.radius * 2, payload.radius * 2);

    // Orient mesh along velocity vector
    const dir = new pc.Vec3(payload.vx, payload.vy, payload.vz).normalize();
    const target = new pc.Vec3(payload.x + dir.x, payload.y + dir.y, payload.z + dir.z);
    ent.lookAt(target);

    this.activeProjectiles.set(payload.id, {
      id: payload.id,
      entity: ent,
      vx: payload.vx,
      vy: payload.vy,
      vz: payload.vz,
      radius: payload.radius,
      color: payload.color,
      pattern: payload.pattern,
      spawnTime: performance.now()
    });
  }

  public onProjectileImpact(payload: ProjectileImpactPayload): void {
    const proj = this.activeProjectiles.get(payload.id);
    const hitPos = new pc.Vec3(...payload.hitPoint);

    if (proj) {
      this.spawnImpactSparks(hitPos, proj.color);
      this.releaseEntity(proj.entity);
      this.activeProjectiles.delete(payload.id);
    } else {
      this.spawnImpactSparks(hitPos, '#ffaa00');
    }

    if (payload.hitPlayerId) {
      this.fx.spawnPlasmaExplosion(hitPos);
    }
  }

  private spawnImpactSparks(pos: pc.Vec3, color: string): void {
    if (!this.app || !this.rootEntity) return;
    const col = new pc.Color();
    col.fromString(color);

    for (let i = 0; i < 5; i++) {
      let p = this.sparkPool.pop();
      if (!p) {
        p = new pc.Entity('ImpactSpark');
        const mat = new pc.StandardMaterial();
        mat.diffuse = col;
        mat.emissive = col;
        mat.emissiveIntensity = 2.0;
        mat.update();
        p.addComponent('render', { type: 'box', material: mat });
        this.rootEntity.addChild(p);
      }
      p.enabled = true;
      p.setPosition(pos);
      p.setLocalScale(0.12, 0.12, 0.12);

      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 3.5;
      this.sparkParticles.push({
        entity: p,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 2.5,
        vz: Math.sin(angle) * speed,
        life: 0.35
      });
    }
  }

  public update(dt: number): void {
    const now = performance.now();

    // Step projectiles
    for (const [id, proj] of this.activeProjectiles.entries()) {
      if (now - proj.spawnTime > 5000) {
        this.releaseEntity(proj.entity);
        this.activeProjectiles.delete(id);
        continue;
      }

      const p = proj.entity.getPosition();
      proj.entity.setPosition(p.x + proj.vx * dt, p.y + proj.vy * dt, p.z + proj.vz * dt);

      if (proj.pattern === 'shard' || proj.pattern === 'ring') {
        proj.entity.rotateLocal(180 * dt, 240 * dt, 0);
      }
    }

    // Step impact sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const s = this.sparkParticles[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.entity.enabled = false;
        this.sparkPool.push(s.entity);
        this.sparkParticles.splice(i, 1);
        continue;
      }
      const p = s.entity.getPosition();
      s.entity.setPosition(p.x + s.vx * dt, p.y + s.vy * dt, p.z + s.vz * dt);
      s.vy -= 16.0 * dt;
      const scale = Math.max(0.02, (s.life / 0.35) * 0.12);
      s.entity.setLocalScale(scale, scale, scale);
    }
  }

  public clear(): void {
    for (const proj of this.activeProjectiles.values()) {
      this.releaseEntity(proj.entity);
    }
    this.activeProjectiles.clear();

    for (const s of this.sparkParticles) {
      s.entity.enabled = false;
      this.sparkPool.push(s.entity);
    }
    this.sparkParticles = [];
  }

  public dispose(): void {
    this.clear();
    for (const ent of this.entityPool) {
      ent.destroy();
    }
    this.entityPool = [];
    for (const ent of this.sparkPool) {
      ent.destroy();
    }
    this.sparkPool = [];
  }
}

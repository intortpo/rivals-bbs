import * as pc from 'playcanvas';

interface DustParticle {
  entity: pc.Entity;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface SparkParticle {
  entity: pc.Entity;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ExpandingRing {
  entity: pc.Entity;
  scale: number;
  maxScale: number;
  growthRate: number;
  life: number;
  maxLife: number;
}

interface BeamTracer {
  entity: pc.Entity;
  life: number;
  maxLife: number;
}

export class PCFXManager {
  private app?: pc.Application;
  private rootEntity?: pc.Entity;

  // Particle pools
  private dustParticles: DustParticle[] = [];
  private dustPool: pc.Entity[] = [];
  private sparkParticles: SparkParticle[] = [];
  private sparkPool: pc.Entity[] = [];
  private expandingRings: ExpandingRing[] = [];
  private ringPool: pc.Entity[] = [];
  private beamTracers: BeamTracer[] = [];
  private beamPool: pc.Entity[] = [];

  // Hitmarker DOM
  private hitmarkerEl: HTMLElement | null = null;
  private hitmarkerTimer: number = 0;

  constructor(app?: pc.Application) {
    this.app = app;
    if (app) {
      this.rootEntity = new pc.Entity('FXRoot');
      app.root.addChild(this.rootEntity);
    }
    if (typeof document !== 'undefined') {
      this.createHitmarkerOverlay();
    }
  }

  private createHitmarkerOverlay(): void {
    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.id = 'pc-fx-hitmarker';
    this.hitmarkerEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 24px;
      height: 24px;
      transform: translate(-50%, -50%);
      pointer-events: none;
      display: none;
      z-index: 15;
    `;
    this.hitmarkerEl.innerHTML = `
      <svg viewBox="0 0 24 24" width="24" height="24" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round">
        <line x1="4" y1="4" x2="8" y2="8" />
        <line x1="20" y1="4" x2="16" y2="8" />
        <line x1="4" y1="20" x2="8" y2="16" />
        <line x1="20" y1="20" x2="16" y2="16" />
      </svg>
    `;
    document.body.appendChild(this.hitmarkerEl);
  }

  public showHitmarker(isHeadshot: boolean = false): void {
    if (!this.hitmarkerEl) return;
    const svg = this.hitmarkerEl.querySelector('svg');
    if (svg) {
      svg.setAttribute('stroke', isHeadshot ? '#ef4444' : '#00f0ff');
      svg.setAttribute('stroke-width', isHeadshot ? '3' : '2.2');
    }
    this.hitmarkerEl.style.display = 'block';
    this.hitmarkerTimer = 0.14;
  }

  public spawnSlideDust(pos: pc.Vec3 | [number, number, number]): void {
    if (!this.app || !this.rootEntity) return;
    const px = Array.isArray(pos) ? pos[0] : pos.x;
    const py = Array.isArray(pos) ? pos[1] : pos.y;
    const pz = Array.isArray(pos) ? pos[2] : pos.z;

    for (let i = 0; i < 3; i++) {
      let ent = this.dustPool.pop();
      if (!ent) {
        ent = new pc.Entity('SlideDust');
        const mat = new pc.StandardMaterial();
        mat.diffuse = new pc.Color(0.8, 0.8, 0.85);
        mat.opacity = 0.6;
        mat.blendType = pc.BLEND_NORMAL;
        mat.update();
        ent.addComponent('render', { type: 'box', material: mat });
        this.rootEntity.addChild(ent);
      }
      ent.enabled = true;
      ent.setLocalScale(0.18, 0.18, 0.18);
      ent.setPosition(px + (Math.random() - 0.5) * 0.4, py + 0.1, pz + (Math.random() - 0.5) * 0.4);

      this.dustParticles.push({
        entity: ent,
        vx: (Math.random() - 0.5) * 2,
        vy: Math.random() * 1.5 + 0.5,
        vz: (Math.random() - 0.5) * 2,
        life: 0.35
      });
    }
  }

  public spawnHitSparks(pos: pc.Vec3 | [number, number, number], normal?: pc.Vec3, isHeadshot: boolean = false): void {
    if (!this.app || !this.rootEntity) return;
    const px = Array.isArray(pos) ? pos[0] : pos.x;
    const py = Array.isArray(pos) ? pos[1] : pos.y;
    const pz = Array.isArray(pos) ? pos[2] : pos.z;

    const count = isHeadshot ? 12 : 6;
    const color = isHeadshot ? new pc.Color(1, 0.15, 0.2) : new pc.Color(1, 0.85, 0.2);

    for (let i = 0; i < count; i++) {
      let ent = this.sparkPool.pop();
      if (!ent) {
        ent = new pc.Entity('Spark');
        const mat = new pc.StandardMaterial();
        mat.diffuse = color;
        mat.emissive = color;
        mat.emissiveIntensity = 2.0;
        mat.update();
        ent.addComponent('render', { type: 'box', material: mat });
        this.rootEntity.addChild(ent);
      } else {
        const render = ent.render;
        if (render?.material) {
          (render.material as pc.StandardMaterial).diffuse = color;
          (render.material as pc.StandardMaterial).emissive = color;
          render.material.update();
        }
      }

      ent.enabled = true;
      const size = isHeadshot ? 0.10 : 0.07;
      ent.setLocalScale(size, size, size);
      ent.setPosition(px, py, pz);

      const speed = isHeadshot ? 7 : 5;
      const nx = normal ? normal.x * speed * 0.5 : 0;
      const ny = normal ? normal.y * speed * 0.5 : 0;
      const nz = normal ? normal.z * speed * 0.5 : 0;
      this.sparkParticles.push({
        entity: ent,
        vx: (Math.random() - 0.5) * speed + nx,
        vy: Math.random() * speed * 0.8 + 1 + ny,
        vz: (Math.random() - 0.5) * speed + nz,
        life: 0.25,
        maxLife: 0.25
      });
    }
  }

  public spawnShieldDeflect(pos: pc.Vec3 | [number, number, number]): void {
    if (!this.app || !this.rootEntity) return;
    const px = Array.isArray(pos) ? pos[0] : pos.x;
    const py = Array.isArray(pos) ? pos[1] : pos.y;
    const pz = Array.isArray(pos) ? pos[2] : pos.z;

    let ent = this.ringPool.pop();
    if (!ent) {
      ent = new pc.Entity('ShieldDeflect');
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(0, 0.8, 1);
      mat.emissive = new pc.Color(0, 0.8, 1);
      mat.opacity = 0.8;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.update();
      ent.addComponent('render', { type: 'cylinder', material: mat });
      this.rootEntity.addChild(ent);
    }

    ent.enabled = true;
    ent.setPosition(px, py, pz);
    ent.setLocalScale(0.2, 0.02, 0.2);

    this.expandingRings.push({
      entity: ent,
      scale: 0.2,
      maxScale: 1.8,
      growthRate: 8,
      life: 0.2,
      maxLife: 0.2
    });
  }

  public spawnRailgunTracer(from: pc.Vec3, to: pc.Vec3): void {
    if (!this.app || !this.rootEntity) return;
    const dist = from.distance(to);
    if (dist <= 0.1) return;

    let ent = this.beamPool.pop();
    if (!ent) {
      ent = new pc.Entity('RailgunBeam');
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color(0, 0.9, 1);
      mat.emissive = new pc.Color(0, 0.9, 1);
      mat.emissiveIntensity = 3.0;
      mat.opacity = 0.95;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.update();
      ent.addComponent('render', { type: 'cylinder', material: mat });
      this.rootEntity.addChild(ent);
    }

    ent.enabled = true;
    const mid = new pc.Vec3().add2(from, to).mulScalar(0.5);
    ent.setPosition(mid);
    ent.lookAt(to);
    ent.rotateLocal(90, 0, 0); // Align cylinder axis along forward
    ent.setLocalScale(0.08, dist, 0.08);

    this.beamTracers.push({
      entity: ent,
      life: 0.18,
      maxLife: 0.18
    });
  }

  public spawnTeslaArc(from: pc.Vec3, to: pc.Vec3): void {
    if (!this.app || !this.rootEntity) return;
    this.spawnRailgunTracer(from, to);
  }

  public spawnNeedleRicochet(pos: pc.Vec3, normal: pc.Vec3): void {
    this.spawnHitSparks(pos, normal, false);
  }

  public spawnPlasmaExplosion(pos: pc.Vec3): void {
    this.spawnShieldDeflect(pos);
    this.spawnHitSparks(pos, undefined, true);
  }

  public update(dt: number): void {
    // Hitmarker timer
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= dt;
      if (this.hitmarkerTimer <= 0 && this.hitmarkerEl) {
        this.hitmarkerEl.style.display = 'none';
      }
    }

    // Step dust
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.entity.enabled = false;
        this.dustPool.push(p.entity);
        this.dustParticles.splice(i, 1);
      } else {
        const pos = p.entity.getPosition();
        p.entity.setPosition(pos.x + p.vx * dt, pos.y + p.vy * dt, pos.z + p.vz * dt);
        p.vy -= 4 * dt;
        const s = (p.life / 0.35) * 0.18;
        p.entity.setLocalScale(s, s, s);
      }
    }

    // Step sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const p = this.sparkParticles[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.entity.enabled = false;
        this.sparkPool.push(p.entity);
        this.sparkParticles.splice(i, 1);
      } else {
        const pos = p.entity.getPosition();
        p.entity.setPosition(pos.x + p.vx * dt, pos.y + p.vy * dt, pos.z + p.vz * dt);
        p.vy -= 9.8 * dt;
        const s = (p.life / p.maxLife) * 0.10;
        p.entity.setLocalScale(s, s, s);
      }
    }

    // Step rings
    for (let i = this.expandingRings.length - 1; i >= 0; i--) {
      const r = this.expandingRings[i];
      r.life -= dt;
      if (r.life <= 0) {
        r.entity.enabled = false;
        this.ringPool.push(r.entity);
        this.expandingRings.splice(i, 1);
      } else {
        r.scale += r.growthRate * dt;
        r.entity.setLocalScale(r.scale, 0.02, r.scale);
      }
    }

    // Step beam tracers
    for (let i = this.beamTracers.length - 1; i >= 0; i--) {
      const b = this.beamTracers[i];
      b.life -= dt;
      if (b.life <= 0) {
        b.entity.enabled = false;
        this.beamPool.push(b.entity);
        this.beamTracers.splice(i, 1);
      } else {
        const factor = b.life / b.maxLife;
        const curScale = b.entity.getLocalScale();
        b.entity.setLocalScale(0.08 * factor, curScale.y, 0.08 * factor);
      }
    }
  }

  public dispose(): void {
    if (this.hitmarkerEl?.parentNode) {
      this.hitmarkerEl.parentNode.removeChild(this.hitmarkerEl);
    }
  }
}

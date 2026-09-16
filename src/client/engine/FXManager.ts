import * as THREE from 'three';

interface PooledDamageSprite {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
  sprite: THREE.Sprite;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

interface DustParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  maxLife: number;
}

interface ExpandingRing {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  scale: number;
  maxScale: number;
  growthRate: number;
  life: number;
  maxLife: number;
}

interface FadingLine {
  line: THREE.Line | THREE.LineSegments;
  mat: THREE.LineBasicMaterial;
  life: number;
  maxLife: number;
}

export class FXManager {
  private scene: THREE.Scene;
  
  // Pooled damage sprites
  private damageSpritePool: PooledDamageSprite[] = [];
  private static readonly MAX_DAMAGE_SPRITES = 10;

  // Pooled dust particles
  private dustParticles: DustParticle[] = [];
  private dustPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private static readonly dustGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  private static readonly MAX_ACTIVE_DUST = 24;

  // Pooled spark particles (for plasma, ricochet, supercombine)
  private sparkParticles: SparkParticle[] = [];
  private sparkPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private static readonly sparkGeometry = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  private static readonly MAX_ACTIVE_SPARKS = 48;

  // Pooled expanding shockwave rings
  private expandingRings: ExpandingRing[] = [];
  private ringPool: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial }[] = [];
  private static readonly ringGeometry = new THREE.RingGeometry(0.3, 0.6, 24);

  // Fading energy lines (railgun spiral, tesla lightning)
  private fadingLines: FadingLine[] = [];

  // Hitmarker UI elements
  private hitmarkerEl: HTMLElement | null = null;
  private hitmarkerTimer: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.createHitmarkerOverlay();
  }

  private createHitmarkerOverlay(): void {
    this.hitmarkerEl = document.createElement('div');
    this.hitmarkerEl.id = 'fx-hitmarker';
    this.hitmarkerEl.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 32px;
      height: 32px;
      transform: translate(-50%, -50%) scale(0.8);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.05s ease-out, transform 0.08s ease-out;
      z-index: 900;
    `;

    // 4 diagonal slashes of hitmarker
    this.hitmarkerEl.innerHTML = `
      <svg viewBox="0 0 32 32" width="32" height="32">
        <line x1="6" y1="6" x2="12" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round" />
        <line x1="26" y1="6" x2="20" y2="12" stroke="white" stroke-width="2.5" stroke-linecap="round" />
        <line x1="6" y1="26" x2="12" y2="20" stroke="white" stroke-width="2.5" stroke-linecap="round" />
        <line x1="26" y1="26" x2="20" y2="20" stroke="white" stroke-width="2.5" stroke-linecap="round" />
      </svg>
    `;
    document.body.appendChild(this.hitmarkerEl);
  }

  public showHitmarker(isHeadshot: boolean): void {
    if (!this.hitmarkerEl) return;
    const lines = this.hitmarkerEl.querySelectorAll('line');
    const color = isHeadshot ? '#ff2a55' : '#ffffff';
    lines.forEach(l => l.setAttribute('stroke', color));

    this.hitmarkerEl.style.opacity = '1';
    this.hitmarkerEl.style.transform = isHeadshot
      ? 'translate(-50%, -50%) scale(1.3)'
      : 'translate(-50%, -50%) scale(1.0)';

    this.hitmarkerTimer = 0.15;
  }

  public spawnDamageNumber(pos: [number, number, number], damage: number, isHeadshot: boolean): void {
    // Find or create an available pooled damage sprite
    let pooled = this.damageSpritePool.find(p => !p.active);
    if (!pooled && this.damageSpritePool.length < FXManager.MAX_DAMAGE_SPRITES) {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const texture = new THREE.CanvasTexture(canvas);
      const spriteMat = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthTest: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      pooled = { canvas, ctx, texture, sprite, vy: 1.8, life: 0.9, maxLife: 0.9, active: false };
      this.damageSpritePool.push(pooled);
    } else if (!pooled) {
      // Reuse oldest active sprite if pool is at capacity
      pooled = this.damageSpritePool[0];
      this.scene.remove(pooled.sprite);
    }

    const { canvas, ctx, texture, sprite } = pooled;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = isHeadshot ? '900 52px system-ui, sans-serif' : 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Text shadow / outline
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 7;
    const text = isHeadshot ? `-${damage} CRIT!` : `-${damage}`;
    ctx.strokeText(text, 128, 64);

    ctx.fillStyle = isHeadshot ? '#ff2a55' : '#ffea00';
    ctx.fillText(text, 128, 64);

    texture.needsUpdate = true;
    sprite.material.opacity = 1.0;
    sprite.scale.set(isHeadshot ? 2.5 : 1.8, isHeadshot ? 1.25 : 0.9, 1);
    sprite.position.set(
      pos[0] + (Math.random() - 0.5) * 0.4,
      pos[1] + 1.2 + (Math.random() - 0.5) * 0.2,
      pos[2] + (Math.random() - 0.5) * 0.4
    );

    pooled.life = 0.9;
    pooled.maxLife = 0.9;
    pooled.vy = 1.8;
    pooled.active = true;

    if (!sprite.parent) {
      this.scene.add(sprite);
    }
  }

  public spawnSlideDust(pos: THREE.Vector3): void {
    if (this.dustParticles.length >= FXManager.MAX_ACTIVE_DUST) return;

    let item = this.dustPool.pop();
    if (!item) {
      const mat = new THREE.MeshBasicMaterial({
        color: '#cbd5e1',
        transparent: true,
        opacity: 0.6
      });
      const mesh = new THREE.Mesh(FXManager.dustGeometry, mat);
      item = { mesh, mat };
    }

    const { mesh, mat } = item;
    mat.opacity = 0.6;
    mesh.scale.set(1, 1, 1);
    mesh.position.set(
      pos.x + (Math.random() - 0.5) * 0.4,
      0.1,
      pos.z + (Math.random() - 0.5) * 0.4
    );

    this.scene.add(mesh);
    this.dustParticles.push({
      mesh,
      mat,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0.8 + Math.random() * 1.2,
      vz: (Math.random() - 0.5) * 1.5,
      life: 0.4
    });
  }

  public spawnPlasmaExplosion(pos: THREE.Vector3 | [number, number, number]): void {
    const px = Array.isArray(pos) ? pos[0] : pos.x;
    const py = Array.isArray(pos) ? pos[1] : pos.y;
    const pz = Array.isArray(pos) ? pos[2] : pos.z;

    // Expanding purple shockwave ring
    this.spawnExpandingRing(new THREE.Vector3(px, py + 0.1, pz), '#b537f2', 8.0, 0.45);

    // 16 outward plasma sparks
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2 + Math.random() * 0.2;
      const speed = 4.0 + Math.random() * 6.0;
      this.spawnSpark(
        new THREE.Vector3(px, py + 0.2, pz),
        Math.cos(angle) * speed,
        2.0 + Math.random() * 5.0,
        Math.sin(angle) * speed,
        '#d946ef',
        0.5
      );
    }
  }

  public spawnRailgunTracer(from: THREE.Vector3, to: THREE.Vector3): void {
    // 1. Core high-intensity supersonic beam
    const coreMat = new THREE.LineBasicMaterial({
      color: '#00ffff',
      linewidth: 3,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending
    });
    const coreGeo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const coreLine = new THREE.Line(coreGeo, coreMat);
    this.scene.add(coreLine);
    this.fadingLines.push({ line: coreLine, mat: coreMat, life: 0.35, maxLife: 0.35 });

    // 2. Outer spiral / ionized particles
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    if (len > 1) {
      const spiralPoints: THREE.Vector3[] = [];
      const steps = Math.min(60, Math.floor(len * 2));
      const up = Math.abs(dir.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      const right = new THREE.Vector3().crossVectors(dir, up).normalize();
      const perpUp = new THREE.Vector3().crossVectors(right, dir).normalize();

      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const angle = t * Math.PI * 12; // 6 rotations
        const radius = 0.25;
        const p = from.clone().lerp(to, t);
        p.addScaledVector(right, Math.cos(angle) * radius);
        p.addScaledVector(perpUp, Math.sin(angle) * radius);
        spiralPoints.push(p);
      }

      const spiralMat = new THREE.LineBasicMaterial({
        color: '#38bdf8',
        linewidth: 1.5,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending
      });
      const spiralGeo = new THREE.BufferGeometry().setFromPoints(spiralPoints);
      const spiralLine = new THREE.Line(spiralGeo, spiralMat);
      this.scene.add(spiralLine);
      this.fadingLines.push({ line: spiralLine, mat: spiralMat, life: 0.28, maxLife: 0.28 });
    }
  }

  public spawnTeslaArc(from: THREE.Vector3, to: THREE.Vector3): void {
    const points: THREE.Vector3[] = [from.clone()];
    const segments = 6;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      const pt = from.clone().lerp(to, t);
      pt.x += (Math.random() - 0.5) * 0.45;
      pt.y += (Math.random() - 0.5) * 0.45;
      pt.z += (Math.random() - 0.5) * 0.45;
      points.push(pt);
    }
    points.push(to.clone());

    const arcMat = new THREE.LineBasicMaterial({
      color: '#00d2ff',
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    });
    const arcGeo = new THREE.BufferGeometry().setFromPoints(points);
    const arcLine = new THREE.Line(arcGeo, arcMat);
    this.scene.add(arcLine);
    this.fadingLines.push({ line: arcLine, mat: arcMat, life: 0.12, maxLife: 0.12 });
  }

  public spawnNeedleRicochet(pos: THREE.Vector3, normal?: THREE.Vector3): void {
    for (let i = 0; i < 6; i++) {
      const vx = (Math.random() - 0.5) * 3 + (normal ? normal.x * 2 : 0);
      const vy = 1.0 + Math.random() * 2.5 + (normal ? normal.y * 2 : 0);
      const vz = (Math.random() - 0.5) * 3 + (normal ? normal.z * 2 : 0);
      this.spawnSpark(pos, vx, vy, vz, '#ff00aa', 0.35);
    }
  }

  public spawnSupercombineExplosion(pos: THREE.Vector3 | [number, number, number]): void {
    const px = Array.isArray(pos) ? pos[0] : pos.x;
    const py = Array.isArray(pos) ? pos[1] : pos.y;
    const pz = Array.isArray(pos) ? pos[2] : pos.z;

    // Glowing magenta blast ring
    this.spawnExpandingRing(new THREE.Vector3(px, py + 0.1, pz), '#ff00aa', 6.0, 0.4);

    // 20 crystalline shards flying in all directions
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const speed = 3.5 + Math.random() * 5.0;
      this.spawnSpark(
        new THREE.Vector3(px, py + 0.5, pz),
        Math.cos(angle) * speed,
        1.5 + Math.random() * 4.0,
        Math.sin(angle) * speed,
        i % 2 === 0 ? '#ff00aa' : '#ff77e1',
        0.55
      );
    }
  }

  private spawnSpark(pos: THREE.Vector3, vx: number, vy: number, vz: number, color: string, life: number): void {
    if (this.sparkParticles.length >= FXManager.MAX_ACTIVE_SPARKS) return;

    let item = this.sparkPool.pop();
    if (!item) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(FXManager.sparkGeometry, mat);
      item = { mesh, mat };
    }

    const { mesh, mat } = item;
    mat.color.set(color);
    mat.opacity = 0.9;
    mesh.scale.set(1, 1, 1);
    mesh.position.copy(pos);

    this.scene.add(mesh);
    this.sparkParticles.push({
      mesh,
      mat,
      vx,
      vy,
      vz,
      life,
      maxLife: life
    });
  }

  private spawnExpandingRing(pos: THREE.Vector3, color: string, maxScale: number, life: number): void {
    let item = this.ringPool.pop();
    if (!item) {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending
      });
      const mesh = new THREE.Mesh(FXManager.ringGeometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      item = { mesh, mat };
    }

    const { mesh, mat } = item;
    mat.color.set(color);
    mat.opacity = 0.85;
    mesh.scale.set(1, 1, 1);
    mesh.position.copy(pos);

    this.scene.add(mesh);
    this.expandingRings.push({
      mesh,
      mat,
      scale: 1,
      maxScale,
      growthRate: maxScale / life,
      life,
      maxLife: life
    });
  }

  public update(delta: number): void {
    // Hitmarker timer
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= delta;
      if (this.hitmarkerTimer <= 0 && this.hitmarkerEl) {
        this.hitmarkerEl.style.opacity = '0';
        this.hitmarkerEl.style.transform = 'translate(-50%, -50%) scale(0.8)';
      }
    }

    // Pooled damage numbers
    for (const p of this.damageSpritePool) {
      if (!p.active) continue;

      p.life -= delta;
      p.sprite.position.y += p.vy * delta;

      const progress = p.life / p.maxLife;
      p.sprite.material.opacity = Math.min(1, progress * 1.5);

      if (p.life <= 0) {
        p.active = false;
        this.scene.remove(p.sprite);
      }
    }

    // Pooled dust particles
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const dp = this.dustParticles[i];
      dp.life -= delta;
      dp.mesh.position.x += dp.vx * delta;
      dp.mesh.position.y += dp.vy * delta;
      dp.mesh.position.z += dp.vz * delta;
      dp.mesh.scale.multiplyScalar(0.96);

      dp.mat.opacity = Math.max(0, (dp.life / 0.4) * 0.6);

      if (dp.life <= 0) {
        this.scene.remove(dp.mesh);
        this.dustPool.push({ mesh: dp.mesh, mat: dp.mat });
        this.dustParticles.splice(i, 1);
      }
    }

    // Expanding rings
    for (let i = this.expandingRings.length - 1; i >= 0; i--) {
      const ring = this.expandingRings[i];
      ring.life -= delta;
      ring.scale += ring.growthRate * delta;
      ring.mesh.scale.set(ring.scale, ring.scale, ring.scale);
      ring.mat.opacity = Math.max(0, (ring.life / ring.maxLife) * 0.85);

      if (ring.life <= 0) {
        this.scene.remove(ring.mesh);
        this.ringPool.push({ mesh: ring.mesh, mat: ring.mat });
        this.expandingRings.splice(i, 1);
      }
    }

    // Spark particles
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const sp = this.sparkParticles[i];
      sp.life -= delta;
      sp.vy -= 9.8 * delta; // Gravity
      sp.mesh.position.x += sp.vx * delta;
      sp.mesh.position.y += sp.vy * delta;
      sp.mesh.position.z += sp.vz * delta;
      sp.mat.opacity = Math.max(0, (sp.life / sp.maxLife) * 0.9);

      if (sp.life <= 0) {
        this.scene.remove(sp.mesh);
        this.sparkPool.push({ mesh: sp.mesh, mat: sp.mat });
        this.sparkParticles.splice(i, 1);
      }
    }

    // Fading energy lines
    for (let i = this.fadingLines.length - 1; i >= 0; i--) {
      const fl = this.fadingLines[i];
      fl.life -= delta;
      fl.mat.opacity = Math.max(0, fl.life / fl.maxLife);
      if (fl.life <= 0) {
        this.scene.remove(fl.line);
        fl.line.geometry.dispose();
        fl.mat.dispose();
        this.fadingLines.splice(i, 1);
      }
    }
  }

  public dispose(): void {
    if (this.hitmarkerEl && this.hitmarkerEl.parentNode) {
      this.hitmarkerEl.parentNode.removeChild(this.hitmarkerEl);
    }
    for (const p of this.damageSpritePool) {
      this.scene.remove(p.sprite);
      p.texture.dispose();
      p.sprite.material.dispose();
    }
    for (const d of this.dustParticles) {
      this.scene.remove(d.mesh);
      d.mat.dispose();
    }
    for (const item of this.dustPool) {
      item.mat.dispose();
    }
    for (const r of this.expandingRings) {
      this.scene.remove(r.mesh);
      r.mat.dispose();
    }
    for (const item of this.ringPool) {
      item.mat.dispose();
    }
    for (const s of this.sparkParticles) {
      this.scene.remove(s.mesh);
      s.mat.dispose();
    }
    for (const item of this.sparkPool) {
      item.mat.dispose();
    }
    for (const fl of this.fadingLines) {
      this.scene.remove(fl.line);
      fl.line.geometry.dispose();
      fl.mat.dispose();
    }
  }
}

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
  }
}

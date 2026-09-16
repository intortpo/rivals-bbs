import * as THREE from 'three';
import { BotProjectilePayload, ProjectileImpactPayload, ProjectilePattern } from '../../shared/types.js';
import { FXManager } from './FXManager.js';

interface ClientProjectile {
  id: string;
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  color: string;
  pattern: ProjectilePattern;
  spawnTime: number;
}

interface SparkParticle {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

export class ProjectileManager {
  private scene: THREE.Scene;
  private fx: FXManager;
  private activeProjectiles: Map<string, ClientProjectile> = new Map();
  private meshPool: THREE.Mesh[] = [];
  private static readonly MAX_POOL_SIZE = 120;

  // Preallocated shared geometries
  private sphereGeo = new THREE.SphereGeometry(1, 8, 8);
  private shardGeo = new THREE.OctahedronGeometry(1, 0);
  private ringGeo = new THREE.TorusGeometry(1, 0.25, 6, 14);
  private beamGeo = new THREE.CylinderGeometry(0.3, 0.3, 2.5, 6);

  // Spark debris
  private sparkParticles: SparkParticle[] = [];
  private sparkGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

  constructor(scene: THREE.Scene, fx: FXManager) {
    this.scene = scene;
    this.fx = fx;
  }

  private getPooledMesh(pattern: ProjectilePattern, colorHex: string): THREE.Mesh {
    let mesh = this.meshPool.pop();
    if (!mesh) {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(colorHex),
        transparent: true,
        opacity: 0.95
      });
      mesh = new THREE.Mesh(this.sphereGeo, mat);
    }

    // Assign geometry based on pattern
    switch (pattern) {
      case 'shard':
        mesh.geometry = this.shardGeo;
        break;
      case 'ring':
        mesh.geometry = this.ringGeo;
        break;
      case 'beam':
        mesh.geometry = this.beamGeo;
        break;
      case 'plasma':
      case 'spiral':
      case 'bullet':
      default:
        mesh.geometry = this.sphereGeo;
        break;
    }

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.color.set(colorHex);
    mat.opacity = 0.95;
    mesh.visible = true;
    this.scene.add(mesh);
    return mesh;
  }

  private releaseMesh(mesh: THREE.Mesh): void {
    mesh.visible = false;
    this.scene.remove(mesh);
    if (this.meshPool.length < ProjectileManager.MAX_POOL_SIZE) {
      this.meshPool.push(mesh);
    } else {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
  }

  public onProjectileSpawn(payload: BotProjectilePayload): void {
    const mesh = this.getPooledMesh(payload.pattern, payload.color);
    mesh.position.set(payload.x, payload.y, payload.z);
    mesh.scale.setScalar(payload.radius);

    // Orient mesh along velocity vector
    const dir = new THREE.Vector3(payload.vx, payload.vy, payload.vz).normalize();
    if (payload.pattern === 'beam') {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    } else {
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    }

    this.activeProjectiles.set(payload.id, {
      id: payload.id,
      mesh,
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
    const hitPos = new THREE.Vector3(...payload.hitPoint);

    if (proj) {
      this.spawnImpactSparks(hitPos, proj.color);
      this.releaseMesh(proj.mesh);
      this.activeProjectiles.delete(payload.id);
    } else {
      this.spawnImpactSparks(hitPos, '#ffaa00');
    }

    if (payload.hitPlayerId) {
      this.fx.spawnPlasmaExplosion(hitPos);
    }
  }

  private spawnImpactSparks(pos: THREE.Vector3, color: string): void {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
    for (let i = 0; i < 5; i++) {
      const p = new THREE.Mesh(this.sparkGeo, mat);
      p.position.copy(pos);
      const angle = Math.random() * Math.PI * 2;
      const speed = 2.0 + Math.random() * 3.5;
      this.scene.add(p);
      this.sparkParticles.push({
        mesh: p,
        vx: Math.cos(angle) * speed,
        vy: 1.5 + Math.random() * 2.5,
        vz: Math.sin(angle) * speed,
        life: 0.35
      });
    }
  }

  public update(dt: number): void {
    const now = performance.now();

    // Move active projectiles
    for (const [id, proj] of this.activeProjectiles.entries()) {
      // Auto-expire after 5 seconds if no impact received
      if (now - proj.spawnTime > 5000) {
        this.releaseMesh(proj.mesh);
        this.activeProjectiles.delete(id);
        continue;
      }

      proj.mesh.position.x += proj.vx * dt;
      proj.mesh.position.y += proj.vy * dt;
      proj.mesh.position.z += proj.vz * dt;

      if (proj.pattern === 'shard' || proj.pattern === 'ring') {
        proj.mesh.rotation.x += 6.0 * dt;
        proj.mesh.rotation.y += 8.0 * dt;
      }
    }

    // Tick impact sparks
    for (let i = this.sparkParticles.length - 1; i >= 0; i--) {
      const s = this.sparkParticles[i];
      s.life -= dt;
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        (s.mesh.material as THREE.Material).dispose();
        this.sparkParticles.splice(i, 1);
        continue;
      }
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      s.vy -= 16.0 * dt;
      s.mesh.scale.setScalar(Math.max(0.1, s.life / 0.35));
    }
  }

  public clear(): void {
    for (const proj of this.activeProjectiles.values()) {
      this.releaseMesh(proj.mesh);
    }
    this.activeProjectiles.clear();

    for (const s of this.sparkParticles) {
      this.scene.remove(s.mesh);
      (s.mesh.material as THREE.Material).dispose();
    }
    this.sparkParticles = [];
  }

  public dispose(): void {
    this.clear();
    for (const mesh of this.meshPool) {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshPool = [];
    this.sphereGeo.dispose();
    this.shardGeo.dispose();
    this.ringGeo.dispose();
    this.beamGeo.dispose();
    this.sparkGeo.dispose();
  }
}

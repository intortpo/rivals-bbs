import * as THREE from 'three';

export interface JumpPad {
  box: THREE.Box3;
  mesh: THREE.Mesh;
  impulseY: number;
}

export class MapBuilder {
  public collisionBoxes: THREE.Box3[] = [];
  public jumpPads: JumpPad[] = [];
  private group: THREE.Group;

  constructor(scene: THREE.Scene, mapName: string = 'Arena Classic') {
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildMap(mapName);
  }

  private buildMap(mapName: string): void {
    if (mapName === 'Neon Warehouse') {
      this.buildWarehouseMap();
    } else {
      this.buildClassicArena();
    }
  }

  private buildClassicArena(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(60, 60, 30, 30);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1a1d2e',
      roughness: 0.6,
      metalness: 0.1
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    // Floor grid lines
    const grid = new THREE.GridHelper(60, 30, '#00d2ff', '#2a3352');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Outer boundary walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#111422',
      roughness: 0.8
    });

    const wallThickness = 2;
    const wallHeight = 7;
    const arenaSize = 60;

    const wallsData = [
      { x: 0, y: wallHeight / 2, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: 0, y: wallHeight / 2, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: -arenaSize / 2, y: wallHeight / 2, z: 0, w: wallThickness, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: wallHeight / 2, z: 0, w: wallThickness, h: wallHeight, d: arenaSize }
    ];

    wallsData.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Central Elevated Tournament Platform
    this.addBox(0, 1.25, 0, 12, 2.5, 12, '#28314e');
    this.addBox(0, 2.6, 0, 8, 0.2, 8, '#00d2ff'); // central beacon plate

    // 4 Symmetrical Cover Pillars around center
    const pillarDist = 14;
    [-pillarDist, pillarDist].forEach(x => {
      [-pillarDist, pillarDist].forEach(z => {
        // High pillar
        this.addBox(x, 2.5, z, 3, 5, 3, '#ff2a55');
        // Low cover block next to pillar
        this.addBox(x + (x > 0 ? -3 : 3), 1, z, 3, 2, 2, '#384260');
      });
    });

    // Outer Ramp Structures / Cover Bunkers
    this.addBox(-22, 1.5, 0, 4, 3, 10, '#384260');
    this.addBox(22, 1.5, 0, 4, 3, 10, '#384260');
    this.addBox(0, 1.5, -22, 10, 3, 4, '#384260');
    this.addBox(0, 1.5, 22, 10, 3, 4, '#384260');

    // 4 High-Velocity Jump Pads
    this.createJumpPad(-12, 0, 0, 19.0);
    this.createJumpPad(12, 0, 0, 19.0);
    this.createJumpPad(0, 0, -12, 19.0);
    this.createJumpPad(0, 0, 12, 19.0);
  }

  private buildWarehouseMap(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(70, 70, 35, 35);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#161922', roughness: 0.7 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(70, 35, '#ffaa00', '#252936');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Boundary walls
    const wallThickness = 2;
    const wallHeight = 8;
    const arenaSize = 70;

    const wallsData = [
      { x: 0, y: 4, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: 0, y: 4, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: -arenaSize / 2, y: 4, z: 0, w: wallThickness, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: 4, z: 0, w: wallThickness, h: wallHeight, d: arenaSize }
    ];

    const wallMat = new THREE.MeshStandardMaterial({ color: '#0d1017' });
    wallsData.forEach(w => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Stacked shipping containers (Roblox style vibrant blocks)
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#e76f51', '#f4a261'];
    for (let i = 0; i < 14; i++) {
      const x = (Math.sin(i * 1.3) * 22);
      const z = (Math.cos(i * 1.3) * 22);
      const c = colors[i % colors.length];
      this.addBox(x, 1.5, z, 6, 3, 3, c);
      if (i % 3 === 0) {
        // Second tier container
        this.addBox(x, 4.5, z, 5, 3, 3, colors[(i + 1) % colors.length]);
      }
    }

    // Elevated Catwalks
    this.addBox(0, 3.5, 0, 4, 0.4, 28, '#3a445d');
    this.addBox(0, 3.5, 0, 28, 0.4, 4, '#3a445d');

    // Jump pads
    this.createJumpPad(-8, 0, -8, 21.0);
    this.createJumpPad(8, 0, 8, 21.0);
    this.createJumpPad(-8, 0, 8, 21.0);
    this.createJumpPad(8, 0, -8, 21.0);
  }

  private addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.3,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    this.collisionBoxes.push(box);
    return mesh;
  }

  private createJumpPad(x: number, y: number, z: number, impulseY: number): void {
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#222', roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(x, y + 0.125, z);
    this.group.add(base);

    // Glowing pad surface
    const padGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 16);
    const padMat = new THREE.MeshStandardMaterial({
      color: '#00ff88',
      emissive: '#00ff88',
      emissiveIntensity: 0.8
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(x, y + 0.26, z);
    this.group.add(pad);

    const box = new THREE.Box3().setFromObject(pad);
    // Expand box slightly upward so collision triggers reliably when walked on
    box.max.y += 0.4;
    this.jumpPads.push({ box, mesh: pad, impulseY });
  }

  public checkJumpPads(playerPos: THREE.Vector3): number | null {
    for (const jp of this.jumpPads) {
      if (jp.box.containsPoint(playerPos)) {
        return jp.impulseY;
      }
    }
    return null;
  }
}

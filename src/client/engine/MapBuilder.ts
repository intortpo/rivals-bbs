import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface JumpPad {
  box: THREE.Box3;
  mesh: THREE.Mesh;
  impulseY: number;
}

export interface SkyThemeConfig {
  id: string;
  name: string;
  file: string;
  bgColor: string;
  fogDensity: number;
}

export const SKY_THEMES: Record<string, SkyThemeConfig> = {
  twilight: {
    id: 'twilight',
    name: '🌆 Cyber Twilight (Urban 4)',
    file: '/textures/skyboxes/background_urban_4.jpg',
    bgColor: '#031422',
    fogDensity: 0.0025
  },
  sunset: {
    id: 'sunset',
    name: '🌇 Golden Sunset (Urban 2)',
    file: '/textures/skyboxes/background_urban_2.jpg',
    bgColor: '#d4501a',
    fogDensity: 0.002
  },
  sage: {
    id: 'sage',
    name: '🏙️ Emerald Sage (Urban 3)',
    file: '/textures/skyboxes/background_urban_3.jpg',
    bgColor: '#374732',
    fogDensity: 0.0025
  }
};

export class MapBuilder {
  public collisionBoxes: THREE.Box3[] = [];
  public rooftopBoxes: THREE.Box3[] = [];
  public jumpPads: JumpPad[] = [];
  public bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
  public mapName: string;
  public skyTheme: string;
  private group: THREE.Group;
  private sceneRef: THREE.Scene;
  private skyMesh: THREE.Mesh | null = null;

  constructor(scene: THREE.Scene, mapName: string = 'Cartoon City', skyTheme: string = 'twilight') {
    this.sceneRef = scene;
    this.mapName = mapName;
    this.skyTheme = skyTheme;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.buildMap(mapName);
  }

  private buildSkydropHorizon(skyThemeKey: string = 'twilight'): void {
    const theme = SKY_THEMES[skyThemeKey] || SKY_THEMES.twilight;

    // Atmosphere background color and horizon fog
    this.sceneRef.background = new THREE.Color(theme.bgColor);
    this.sceneRef.fog = new THREE.FogExp2(theme.bgColor, theme.fogDensity);

    if (this.skyMesh) {
      this.group.remove(this.skyMesh);
      this.skyMesh.geometry.dispose();
      this.skyMesh = null;
    }

    // 360° Panoramic Horizon Cylinder
    const texLoader = new THREE.TextureLoader();
    texLoader.load(theme.file, (texture) => {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.ClampToEdgeWrapping;
      texture.repeat.set(4, 1); // 4 seamless horizontal repeats around 360° circle

      const skyGeo = new THREE.CylinderGeometry(290, 290, 160, 48, 1, true);
      const skyMat = new THREE.MeshBasicMaterial({
        map: texture,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false
      });
      this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
      this.skyMesh.position.set(0, 40, 0);
      this.group.add(this.skyMesh);
    });
  }

  private buildMap(mapName: string): void {
    // 1. Build 360° skydrop horizon
    this.buildSkydropHorizon(this.skyTheme);

    if (mapName === 'Cartoon City') {
      this.bounds = { minX: -56, maxX: 56, minZ: -70, maxZ: 70 };
      this.buildCartoonCity();
    } else if (mapName === 'Neon Warehouse') {
      this.bounds = { minX: -33, maxX: 33, minZ: -33, maxZ: 33 };
      this.buildWarehouseMap();
    } else {
      this.bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
      this.buildClassicArena();
    }
  }

  private buildCartoonCity(): void {
    // 1. Base ground plane to ensure complete ground coverage
    const floorGeo = new THREE.PlaneGeometry(120, 150);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: '#1a1d28',
      roughness: 0.8
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    floor.position.y = -0.05;
    this.group.add(floor);

    // 2. Load 3D Cartoon City GLB
    const loader = new GLTFLoader();
    loader.load(
      '/models/maps/cartoon_city.glb',
      (gltf) => {
        const city = gltf.scene;
        this.group.add(city);

        city.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const name = mesh.name.toLowerCase();
            const mat = mesh.material as THREE.Material | THREE.Material[];
            const matName = Array.isArray(mat)
              ? mat.map((m) => m.name.toLowerCase()).join(' ')
              : mat?.name?.toLowerCase() || '';

            // 1. Skip walkable ground and road meshes
            const isGround =
              name.includes('road') ||
              name.includes('asphalt') ||
              name.includes('tile') ||
              name.includes('grass') ||
              matName.includes('road') ||
              matName.includes('asphalt') ||
              matName.includes('tile') ||
              matName.includes('grass');

            if (isGround) return;

            // 2. Exclude wheels, spoilers, and non-blocking decorative props
            const isExcluded =
              name.includes('wheel') ||
              name.includes('spoiler') ||
              name.includes('bush') ||
              name.includes('trash') ||
              name.includes('graffiti') ||
              name.includes('billboard') ||
              name.includes('signboard') ||
              name.includes('spotlight') ||
              name.includes('palm');

            if (isExcluded) return;

            // 3. Process vehicle and building obstacles
            const isVehicle = name.includes('car') || name.includes('van') || name.includes('futuristic');
            const box = new THREE.Box3().setFromObject(mesh);
            const height = box.max.y - box.min.y;
            const widthX = box.max.x - box.min.x;
            const depthZ = box.max.z - box.min.z;

            if (height > 0.45 && widthX > 0.3 && depthZ > 0.3) {
              if (isVehicle) {
                // Inset vehicle horizontal bounds slightly (0.12m) to hug visible chassis
                box.min.x += 0.12;
                box.max.x -= 0.12;
                box.min.z += 0.12;
                box.max.z -= 0.12;
                this.collisionBoxes.push(box);

                // Register vehicle roofs (height >= 1.2m) as walkable platforms
                if (box.max.y >= 1.2 && widthX >= 1.0 && depthZ >= 1.5) {
                  this.rooftopBoxes.push(box);
                }
              } else {
                this.collisionBoxes.push(box);

                // Register building roofs, terraces, and bus stop roofs as walkable platforms
                if (box.max.y >= 2.2 && widthX >= 1.8 && depthZ >= 1.8) {
                  this.rooftopBoxes.push(box);
                }
              }
            }
          }
        });

        console.log(
          `[MapBuilder] Cartoon City loaded: ${this.collisionBoxes.length} colliders, ${this.rooftopBoxes.length} walkable roofs/vehicles`
        );
      },
      undefined,
      (err) => {
        console.warn('[MapBuilder] Failed to load cartoon_city.glb, using fallback arena:', err);
        this.buildClassicArena();
      }
    );

    // 3. Jump Pads in Cartoon City
    // Central Plaza Mega Jump Pad: launches player 22m to reach building terraces!
    this.createJumpPad(0, 0, 6, 23.0);

    // North Boulevard Jump Pad
    this.createJumpPad(0, 0, -32, 16.5);

    // South Avenue Jump Pad
    this.createJumpPad(0, 0, 32, 16.5);

    // West Bus Station Flank Jump Pad
    this.createJumpPad(-22, 0, -4, 18.0);

    // East Twisted Tower Flank Jump Pad
    this.createJumpPad(22, 0, -4, 18.0);

    // 4. Glowing Neon Cyber Boundary Walls (120m x 150m)
    const wallHeight = 25;
    const borderMat = new THREE.MeshBasicMaterial({
      color: '#00d2ff',
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });

    const borders = [
      { x: 0, y: wallHeight / 2, z: -75, w: 120, h: wallHeight, d: 2 },
      { x: 0, y: wallHeight / 2, z: 75, w: 120, h: wallHeight, d: 2 },
      { x: -60, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: 150 },
      { x: 60, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: 150 }
    ];

    borders.forEach((b) => {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d);
      const mesh = new THREE.Mesh(geo, borderMat);
      mesh.position.set(b.x, b.y, b.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });
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

    wallsData.forEach((w) => {
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
    this.addBox(0, 2.6, 0, 8, 0.2, 8, '#00d2ff');

    // 4 Symmetrical Cover Pillars around center
    const pillarDist = 14;
    [-pillarDist, pillarDist].forEach((x) => {
      [-pillarDist, pillarDist].forEach((z) => {
        this.addBox(x, 2.5, z, 3, 5, 3, '#ff2a55');
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
    wallsData.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Stacked shipping containers
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#e76f51', '#f4a261'];
    for (let i = 0; i < 14; i++) {
      const x = Math.sin(i * 1.3) * 22;
      const z = Math.cos(i * 1.3) * 22;
      const c = colors[i % colors.length];
      this.addBox(x, 1.5, z, 6, 3, 3, c);
      if (i % 3 === 0) {
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
    box.max.y += 0.5; // Expand trigger height slightly
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

  public getGroundLevel(playerPos: THREE.Vector3): number {
    let highestGround = 1.0; // Street ground level
    for (const roof of this.rooftopBoxes) {
      if (
        playerPos.x >= roof.min.x - 0.2 &&
        playerPos.x <= roof.max.x + 0.2 &&
        playerPos.z >= roof.min.z - 0.2 &&
        playerPos.z <= roof.max.z + 0.2 &&
        playerPos.y >= roof.max.y - 0.6 &&
        playerPos.y <= roof.max.y + 3.0
      ) {
        const candidate = roof.max.y + 1.0;
        if (candidate > highestGround) {
          highestGround = candidate;
        }
      }
    }
    return highestGround;
  }

  public dispose(): void {
    this.sceneRef.remove(this.group);
  }
}

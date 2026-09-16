import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface JumpPad {
  box: THREE.Box3;
  mesh: THREE.Mesh;
  impulseY: number;
  impulseX?: number;
  impulseZ?: number;
}

export interface TeleportPort {
  id: string;
  targetId: string;
  box: THREE.Box3;
  mesh: THREE.Group;
  exitPos: THREE.Vector3;
  exitYaw: number;
  color: string;
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
  public ladderBoxes: THREE.Box3[] = [];
  public jumpPads: JumpPad[] = [];
  public teleportPorts: TeleportPort[] = [];
  public hasGroundPlane: boolean = true;
  public bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
  public mapName: string;
  public skyTheme: string;
  public group: THREE.Group;
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

    if (typeof document === 'undefined') {
      return; // Headless / test environment guard
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
      this.bounds = { minX: -80, maxX: 80, minZ: -100, maxZ: 100 };
      this.hasGroundPlane = true;
      this.buildCartoonCity();
    } else if (mapName === 'Neon Warehouse') {
      this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
      this.hasGroundPlane = true;
      this.buildWarehouseMap();
    } else if (mapName === 'Cyber Spire') {
      this.bounds = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };
      this.hasGroundPlane = false;
      this.buildCyberSpire();
    } else if (mapName === 'Quantum Lab') {
      this.bounds = { minX: -52, maxX: 52, minZ: -52, maxZ: 52 };
      this.hasGroundPlane = true;
      this.buildQuantumLab();
    } else if (mapName === 'Magma Foundry') {
      this.bounds = { minX: -54, maxX: 54, minZ: -54, maxZ: 54 };
      this.hasGroundPlane = false;
      this.buildMagmaFoundry();
    } else if (mapName === 'Subzero Station') {
      this.bounds = { minX: -52, maxX: 52, minZ: -52, maxZ: 52 };
      this.hasGroundPlane = true;
      this.buildSubzeroStation();
    } else if (mapName === 'Sky Sanctuary') {
      this.bounds = { minX: -65, maxX: 65, minZ: -65, maxZ: 65 };
      this.hasGroundPlane = false;
      this.buildSkySanctuary();
    } else {
      this.bounds = { minX: -45, maxX: 45, minZ: -45, maxZ: 45 };
      this.hasGroundPlane = true;
      this.buildClassicArena();
    }
  }

  private buildCartoonCity(): void {
    // 1. Base ground plane to ensure complete ground coverage across expanded arena
    const floorGeo = new THREE.PlaneGeometry(180, 220);
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
    if (typeof window !== 'undefined') {
      const loader = new GLTFLoader();
      loader.load(
        '/models/maps/cartoon_city.glb',
        (gltf) => {
          const city = gltf.scene;
          this.group.add(city);

          city.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
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

              // Selective shadow casting: only large structures and vehicles cast shadows, saving >80% shadow draw calls
              if (isVehicle || (height >= 1.8 && widthX >= 1.5)) {
                mesh.castShadow = true;
              }

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
    }

    // 3. Climbable Fire Escapes, Wall Ladders & Aerial Skybridges
    // West Mid-Avenue Building (x = -6.2, z = 8.0)
    this.addPlatform(-6.2, 3.5 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 1 (y = 3.5)
    this.createLadder(-6.2, 6.6, 0, 3.5, 'north');
    this.addPlatform(-6.2, 7.0 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 2 (y = 7.0)
    this.createLadder(-6.2, 9.4, 3.5, 7.0, 'south');
    this.addPlatform(-6.2, 10.5 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 3 (y = 10.5)
    this.createLadder(-6.2, 6.6, 7.0, 10.5, 'north');
    this.addPlatform(-6.2, 14.0 - 0.125, 8.0, 5.0, 0.25, 5.0, '#242b44', true); // Roof Terrace (y = 14.0)
    this.createLadder(-6.2, 9.4, 10.5, 14.0, 'south');

    // East Mid-Avenue Building (x = 22.0, z = 8.0)
    this.addPlatform(22.0, 3.5 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 1 (y = 3.5)
    this.createLadder(22.0, 6.6, 0, 3.5, 'north');
    this.addPlatform(22.0, 7.0 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 2 (y = 7.0)
    this.createLadder(22.0, 9.4, 3.5, 7.0, 'south');
    this.addPlatform(22.0, 10.5 - 0.125, 8.0, 3.2, 0.25, 3.2, '#1f2536', true); // Tier 3 (y = 10.5)
    this.createLadder(22.0, 6.6, 7.0, 10.5, 'north');
    this.addPlatform(22.0, 14.0 - 0.125, 8.0, 5.0, 0.25, 5.0, '#242b44', true); // Roof Terrace (y = 14.0)
    this.createLadder(22.0, 9.4, 10.5, 14.0, 'south');

    // Aerial High Skybridge spanning across the avenue (x = -6.2 to 22.0 at y = 14.0m)
    this.addPlatform(7.9, 14.0 - 0.15, 8.0, 28.2, 0.3, 3.2, '#00d2ff', true);
    this.addBox(7.9, 14.0 + 0.5, 8.0 - 1.5, 28.2, 1.0, 0.1, '#384260'); // North glass railing
    this.addBox(7.9, 14.0 + 0.5, 8.0 + 1.5, 28.2, 1.0, 0.1, '#384260'); // South glass railing

    // Northwest Skyscraper Facade Ladder & Terraces (x = -6.3, z = 48.0)
    this.addPlatform(-6.3, 4.0 - 0.125, 48.0, 3.2, 0.25, 3.2, '#1f2536', true);
    this.createLadder(-6.3, 46.6, 0, 4.0, 'north');
    this.addPlatform(-6.3, 8.0 - 0.125, 48.0, 3.2, 0.25, 3.2, '#1f2536', true);
    this.createLadder(-6.3, 49.4, 4.0, 8.0, 'south');
    this.addPlatform(-6.3, 12.0 - 0.125, 48.0, 4.0, 0.25, 4.0, '#242b44', true);
    this.createLadder(-6.3, 46.6, 8.0, 12.0, 'north');

    // Southwest Skyscraper Facade Ladder & Terraces (x = -6.0, z = -36.0)
    this.addPlatform(-6.0, 4.0 - 0.125, -36.0, 3.2, 0.25, 3.2, '#1f2536', true);
    this.createLadder(-6.0, -34.6, 0, 4.0, 'north');
    this.addPlatform(-6.0, 8.0 - 0.125, -36.0, 3.2, 0.25, 3.2, '#1f2536', true);
    this.createLadder(-6.0, -37.4, 4.0, 8.0, 'south');
    this.addPlatform(-6.0, 12.0 - 0.125, -36.0, 4.0, 0.25, 4.0, '#242b44', true);
    this.createLadder(-6.0, -34.6, 8.0, 12.0, 'north');

    // 4. Jump Pads in Cartoon City
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

    // 5. Glowing Neon Cyber Boundary Walls (170m x 210m)
    const wallHeight = 28;
    const borderMat = new THREE.MeshBasicMaterial({
      color: '#00d2ff',
      wireframe: true,
      transparent: true,
      opacity: 0.15
    });

    const borders = [
      { x: 0, y: wallHeight / 2, z: -105, w: 170, h: wallHeight, d: 2 },
      { x: 0, y: wallHeight / 2, z: 105, w: 170, h: wallHeight, d: 2 },
      { x: -85, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: 215 },
      { x: 85, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: 215 }
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
    const floorGeo = new THREE.PlaneGeometry(100, 100, 50, 50);
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
    const grid = new THREE.GridHelper(100, 50, '#00d2ff', '#2a3352');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Outer boundary walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: '#111422',
      roughness: 0.8
    });

    const wallThickness = 2;
    const wallHeight = 8;
    const arenaSize = 96;

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

    // 4 High-Velocity Central Jump Pads
    this.createJumpPad(-12, 0, 0, 19.0);
    this.createJumpPad(12, 0, 0, 19.0);
    this.createJumpPad(0, 0, -12, 19.0);
    this.createJumpPad(0, 0, 12, 19.0);

    // 4 Elevated Corner Sniper Bastions (y = 3.0m)
    [-36, 36].forEach((bx) => {
      [-36, 36].forEach((bz) => {
        this.addPlatform(bx, 1.5, bz, 10, 3.0, 10, '#242b44', true);
        // Parapet walls on bastions
        this.addBox(bx, 3.5, bz + (bz > 0 ? 4.5 : -4.5), 10, 1.0, 0.8, '#ff2a55');
        this.addBox(bx + (bx > 0 ? 4.5 : -4.5), 3.5, bz, 0.8, 1.0, 10, '#384260');
      });
    });

    // 4 Corner Jump Pads launching onto Bastions
    this.createJumpPad(28, 0, 28, 17.0, 6, 6);
    this.createJumpPad(-28, 0, 28, 17.0, -6, 6);
    this.createJumpPad(28, 0, -28, 17.0, 6, -6);
    this.createJumpPad(-28, 0, -28, 17.0, -6, -6);

    // Outer Colonnade Pillars
    [-28, 28].forEach((cx) => {
      [-14, 0, 14].forEach((cz) => {
        this.addBox(cx, 3.0, cz, 2, 6, 2, '#384260');
        this.addBox(cz, 3.0, cx, 2, 6, 2, '#384260');
      });
    });
  }

  private buildWarehouseMap(): void {
    // Floor
    const floorGeo = new THREE.PlaneGeometry(110, 110, 55, 55);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#161922', roughness: 0.7 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(110, 55, '#ffaa00', '#252936');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Boundary walls
    const wallThickness = 2;
    const wallHeight = 9;
    const arenaSize = 106;

    const wallsData = [
      { x: 0, y: 4.5, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: 0, y: 4.5, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: wallThickness },
      { x: -arenaSize / 2, y: 4.5, z: 0, w: wallThickness, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: 4.5, z: 0, w: wallThickness, h: wallHeight, d: arenaSize }
    ];

    const wallMat = new THREE.MeshStandardMaterial({ color: '#0d1017' });
    wallsData.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Inner & Outer Stacked shipping containers
    const colors = ['#e63946', '#457b9d', '#2a9d8f', '#e76f51', '#f4a261'];
    for (let i = 0; i < 14; i++) {
      const x = Math.sin(i * 1.3) * 22;
      const z = Math.cos(i * 1.3) * 22;
      const c = colors[i % colors.length];
      this.addPlatform(x, 1.5, z, 6, 3, 3, c, true);
      if (i % 3 === 0) {
        this.addPlatform(x, 4.5, z, 5, 3, 3, colors[(i + 1) % colors.length], true);
      }
    }

    // Outer perimeter container depot (radius 34m - 40m)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const ox = Math.cos(angle) * 36;
      const oz = Math.sin(angle) * 36;
      const c = colors[(i + 2) % colors.length];
      this.addPlatform(ox, 1.5, oz, 6, 3, 3, c, true);
      if (i % 2 === 0) {
        this.addPlatform(ox, 4.5, oz, 5, 3, 3, colors[(i + 3) % colors.length], true);
      }
    }

    // Outer Cargo Loading Docks
    this.addPlatform(38, 1.0, 0, 8, 2.0, 16, '#28314e', true);
    this.addPlatform(-38, 1.0, 0, 8, 2.0, 16, '#28314e', true);

    // Extended High Catwalks (registered in rooftopBoxes)
    this.addPlatform(0, 3.5, 0, 4, 0.4, 44, '#3a445d', true);
    this.addPlatform(0, 3.5, 0, 44, 0.4, 4, '#3a445d', true);

    // Perimeter Catwalk Galleries
    this.addPlatform(0, 3.5, -36, 28, 0.4, 4, '#3a445d', true);
    this.addPlatform(0, 3.5, 36, 28, 0.4, 4, '#3a445d', true);

    // Central & Perimeter Jump pads
    this.createJumpPad(-8, 0, -8, 21.0);
    this.createJumpPad(8, 0, 8, 21.0);
    this.createJumpPad(-8, 0, 8, 21.0);
    this.createJumpPad(8, 0, -8, 21.0);
    this.createJumpPad(32, 0, 32, 18.0, -10, -10);
    this.createJumpPad(-32, 0, 32, 18.0, 10, -10);
    this.createJumpPad(32, 0, -32, 18.0, -10, 10);
    this.createJumpPad(-32, 0, -32, 18.0, 10, 10);
  }

  private buildCyberSpire(): void {
    // Cyber Spire - Vertical high-rise skyscraper complex over neon abyss
    // Central Tower Ground / Lower Plaza
    this.addPlatform(0, -1, 0, 22, 2, 22, '#1a1d2e');

    // Central Tower Tier 2 Terrace
    this.addPlatform(0, 3.5, 0, 14, 1, 14, '#242b44');

    // High Spire Sniper Perch
    this.addPlatform(0, 9.5, 0, 8, 1, 8, '#0d1326');
    this.addBox(0, 5, 0, 2.4, 10, 2.4, '#00d2ff'); // Central energy core

    // North & South Satellite Towers
    this.addPlatform(0, 1.5, -22, 12, 3, 12, '#20263b');
    this.addPlatform(0, 1.5, 22, 12, 3, 12, '#20263b');

    // West & East Flank Decks
    this.addPlatform(-22, 1, 0, 10, 2, 10, '#1c2236'); // West Helipad
    this.addPlatform(22, 1, 0, 10, 2, 10, '#1c2236'); // East Deck

    // Skybridges connecting lower plaza to satellites and flank decks
    this.addPlatform(0, -0.5, -11, 3.5, 1, 11, '#2c3553');
    this.addPlatform(0, -0.5, 11, 3.5, 1, 11, '#2c3553');
    this.addPlatform(-11, -0.5, 0, 11, 1, 3.5, '#2c3553');
    this.addPlatform(11, -0.5, 0, 11, 1, 3.5, '#2c3553');

    // Tactical Covers & Consoles
    this.addBox(0, 4.5, -22, 6, 3, 1.5, '#ff2a55'); // North tower cover
    this.addBox(0, 4.5, 22, 6, 3, 1.5, '#00d2ff'); // South tower cover
    this.addBox(-22, 3.5, 0, 1.5, 3, 4.5, '#384260'); // West helipad console
    this.addBox(22, 3.5, 0, 1.5, 3, 4.5, '#384260'); // East generator
    this.addBox(-5, 5, -5, 2, 2, 2, '#384260'); // Tier 2 NW cover
    this.addBox(5, 5, 5, 2, 2, 2, '#384260'); // Tier 2 SE cover

    // Directional Aerial Boosters launching towards Center Tier 2
    this.createJumpPad(0, 3, -18, 14, 0, 16); // North tower booster (launches South)
    this.createJumpPad(0, 3, 18, 14, 0, -16); // South tower booster (launches North)
    this.createJumpPad(-18, 2, 0, 14, 16, 0); // West helipad booster (launches East)
    this.createJumpPad(18, 2, 0, 14, -16, 0); // East deck booster (launches West)

    // Vertical Super Lifts to High Spire Perch
    this.createJumpPad(4.5, 4, 4.5, 19, 0, 0, '#00d2ff');
    this.createJumpPad(-4.5, 4, -4.5, 19, 0, 0, '#00d2ff');

    // Teleport Port Pair: West Helipad <-> High Spire Sniper Perch
    this.createTeleportPair(
      'spire_helipad',
      new THREE.Vector3(-22, 2, 0),
      Math.PI / 2, // Facing East
      'spire_perch',
      new THREE.Vector3(0, 10, 0),
      -Math.PI / 2, // Facing West
      '#00d2ff'
    );

    // 4 Outer Satellite Helipads across expanded perimeter (y = 2.0m)
    this.addPlatform(42, 1.0, 42, 12, 2.0, 12, '#1c2236', true);
    this.addPlatform(-42, 1.0, 42, 12, 2.0, 12, '#1c2236', true);
    this.addPlatform(42, 1.0, -42, 12, 2.0, 12, '#1c2236', true);
    this.addPlatform(-42, 1.0, -42, 12, 2.0, 12, '#1c2236', true);

    // Diagonal skybridges connecting to outer helipads
    this.addPlatform(32, 0.5, 32, 14, 1.0, 3.2, '#2c3553', true);
    this.addPlatform(-32, 0.5, 32, 14, 1.0, 3.2, '#2c3553', true);
    this.addPlatform(32, 0.5, -32, 14, 1.0, 3.2, '#2c3553', true);
    this.addPlatform(-32, 0.5, -32, 14, 1.0, 3.2, '#2c3553', true);

    // Tactical covers on outer helipads
    this.addBox(42, 3.0, 42, 3, 2, 3, '#00d2ff');
    this.addBox(-42, 3.0, 42, 3, 2, 3, '#ff2a55');
    this.addBox(42, 3.0, -42, 3, 2, 3, '#ffaa00');
    this.addBox(-42, 3.0, -42, 3, 2, 3, '#00ff88');
  }

  private buildQuantumLab(): void {
    // Quantum Lab - Symmetrical Particle Collider Facility
    const floorGeo = new THREE.PlaneGeometry(110, 110, 55, 55);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#131722', roughness: 0.6, metalness: 0.2 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(110, 55, '#a855f7', '#1f273d');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Outer high-tech bunker walls (108m x 108m)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#0d1017', roughness: 0.8 });
    const wallHeight = 8;
    const arenaSize = 108;
    const wallsData = [
      { x: 0, y: wallHeight / 2, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: 0, y: wallHeight / 2, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: -arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize }
    ];
    wallsData.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Central Particle Collider Observation Deck
    this.addPlatform(0, 1.75, 0, 12, 3.5, 12, '#20263b');
    this.addBox(0, 4.2, 0, 5.5, 1.4, 5.5, '#a855f7'); // Central energy console

    // 4 Collider Energy Coils
    this.addBox(8, 3, 8, 2, 6, 2, '#00d2ff');
    this.addBox(8, 3, -8, 2, 6, 2, '#00d2ff');
    this.addBox(-8, 3, 8, 2, 6, 2, '#00d2ff');
    this.addBox(-8, 3, -8, 2, 6, 2, '#00d2ff');

    // West & East Laboratory Bays
    this.addBox(-22, 2, -4, 4, 4, 4, '#384260'); // West cryo bank
    this.addBox(-22, 1.5, 6, 4, 3, 2, '#2a3352'); // West terminal
    this.addBox(22, 2, 4, 4, 4, 4, '#384260'); // East containment
    this.addBox(22, 1.5, -6, 4, 3, 2, '#2a3352'); // East terminal

    // North & South Elevated Catwalks (y = 3.5)
    this.addPlatform(0, 1.75, -24, 28, 3.5, 3, '#2a3352');
    this.addPlatform(0, 1.75, 24, 28, 3.5, 3, '#2a3352');

    // 4 Catwalk Jump Pads launching onto Central Observation Deck
    this.createJumpPad(14, 0, 14, 16, -9, -9);
    this.createJumpPad(14, 0, -14, 16, -9, 9);
    this.createJumpPad(-14, 0, 14, 16, 9, -9);
    this.createJumpPad(-14, 0, -14, 16, 9, 9);

    // Teleport Port Pair: West Lab Bay <-> East Lab Bay Quantum Slipstream
    this.createTeleportPair(
      'quantum_west',
      new THREE.Vector3(-25, 0, 0),
      Math.PI / 2, // Facing East
      'quantum_east',
      new THREE.Vector3(25, 0, 0),
      -Math.PI / 2, // Facing West
      '#a855f7'
    );

    // 4 Outer Cryogenic Cleanroom Bays across expanded perimeter
    [-38, 38].forEach((cx) => {
      [-38, 38].forEach((cz) => {
        this.addPlatform(cx, 1.75, cz, 12, 3.5, 12, '#20263b', true);
        this.addBox(cx, 4.5, cz, 2, 4, 2, '#00d2ff'); // Secondary energy coil
        this.addPlatform(cx > 0 ? 30 : -30, 1.75, cz, 8, 3.5, 3, '#2a3352', true); // Connecting catwalk
      });
    });
  }

  private buildMagmaFoundry(): void {
    // Magma Foundry - Industrial smelting gantries suspended over open molten lava
    // 1. Glowing Lava Lake Plane below
    const lavaGeo = new THREE.PlaneGeometry(120, 120);
    lavaGeo.rotateX(-Math.PI / 2);
    const lavaMat = new THREE.MeshStandardMaterial({
      color: '#ff3700',
      emissive: '#ff2200',
      emissiveIntensity: 1.1,
      roughness: 0.9
    });
    const lava = new THREE.Mesh(lavaGeo, lavaMat);
    lava.position.y = -0.8;
    this.group.add(lava);

    // 2. Perimeter foundry containment rock walls (112m x 112m)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#181210', roughness: 0.9 });
    const wallHeight = 9;
    const arenaSize = 112;
    const wallsData = [
      { x: 0, y: wallHeight / 2, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: 0, y: wallHeight / 2, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: -arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize }
    ];
    wallsData.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // 3. Central Smelting Crucible Platform (16m x 16m)
    this.addPlatform(0, -0.5, 0, 16, 1, 16, '#282c37');
    this.addBox(0, 4, 0, 4, 8, 4, '#1b1d24'); // Central exhaust stack

    // 4. North & South Blast Furnace Platforms
    this.addPlatform(0, -0.5, -22, 14, 1, 12, '#282c37');
    this.addPlatform(0, -0.5, 22, 14, 1, 12, '#282c37');

    // 5. West & East Slag Pour Platforms
    this.addPlatform(-22, -0.5, 0, 12, 1, 14, '#282c37');
    this.addPlatform(22, -0.5, 0, 12, 1, 14, '#282c37');

    // 6. Connecting Steel Catwalks
    this.addPlatform(0, -0.5, -11, 3.4, 1, 11, '#3a4050');
    this.addPlatform(0, -0.5, 11, 3.4, 1, 11, '#3a4050');
    this.addPlatform(-11, -0.5, 0, 11, 1, 3.4, '#3a4050');
    this.addPlatform(11, -0.5, 0, 11, 1, 3.4, '#3a4050');

    // 7. Elevated High Crane Gantry (3m x 24m, height 4.5m)
    this.addPlatform(0, 2.25, 0, 3, 4.5, 24, '#444d63');

    // 8. Blast Furnace & Cooling Tank Cover Props
    this.addBox(0, 2.5, -23, 6, 5, 4, '#e63946');
    this.addBox(0, 2.5, 23, 6, 5, 4, '#e63946');
    this.addBox(-22, 2, 0, 4, 4, 6, '#457b9d');
    this.addBox(22, 2, 0, 4, 4, 6, '#457b9d');

    // 9. Jump Pads: Chasm Boosters & Crane Lifts
    this.createJumpPad(-17, 0, 0, 14, 15, 0); // West chasm booster
    this.createJumpPad(17, 0, 0, 14, -15, 0); // East chasm booster
    this.createJumpPad(0, 0, -6, 19, 0, 0, '#ffaa00'); // North crane lift
    this.createJumpPad(0, 0, 6, 19, 0, 0, '#ffaa00'); // South crane lift

    // 10. Teleport Port Pair: North Furnace Trench <-> High Crane Control Deck
    this.createTeleportPair(
      'magma_trench',
      new THREE.Vector3(0, 0, -26),
      Math.PI, // Facing South
      'magma_crane',
      new THREE.Vector3(0, 4.5, 9),
      0, // Facing North
      '#ff5500'
    );

    // 11. 4 Outer Slag Processing Yards across expanded perimeter
    [-42, 42].forEach((sx) => {
      [-42, 42].forEach((sz) => {
        this.addPlatform(sx, -0.5, sz, 12, 1, 12, '#282c37', true);
        this.addBox(sx, 2.0, sz, 4, 4, 4, '#e63946'); // Cooling tower
        // Connecting catwalk to blast furnace
        this.addPlatform(sx > 0 ? 32 : -32, -0.5, sz > 0 ? 22 : -22, 10, 1, 3.2, '#3a4050', true);
      });
    });
  }

  private buildSubzeroStation(): void {
    // Subzero Station - Arctic Polar Outpost with snowdrifts & radar dome
    const floorGeo = new THREE.PlaneGeometry(115, 115, 50, 50);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({ color: '#dce8f5', roughness: 0.35, metalness: 0.1 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.group.add(floor);

    const grid = new THREE.GridHelper(115, 50, '#00ffee', '#a4b8cc');
    grid.position.y = 0.02;
    this.group.add(grid);

    // Perimeter reinforced arctic bunker walls (110m x 110m)
    const wallMat = new THREE.MeshStandardMaterial({ color: '#253040', roughness: 0.7 });
    const wallHeight = 8;
    const arenaSize = 110;
    const wallsData = [
      { x: 0, y: wallHeight / 2, z: -arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: 0, y: wallHeight / 2, z: arenaSize / 2, w: arenaSize, h: wallHeight, d: 2 },
      { x: -arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize },
      { x: arenaSize / 2, y: wallHeight / 2, z: 0, w: 2, h: wallHeight, d: arenaSize }
    ];
    wallsData.forEach((w) => {
      const geo = new THREE.BoxGeometry(w.w, w.h, w.d);
      const mesh = new THREE.Mesh(geo, wallMat);
      mesh.position.set(w.x, w.y, w.z);
      this.group.add(mesh);
      this.collisionBoxes.push(new THREE.Box3().setFromObject(mesh));
    });

    // Main Subzero Bunker Building (Center, 16m x 12m, height 4m)
    this.addPlatform(0, 2, 0, 16, 4, 12, '#2c3848');
    this.addBox(0, 5.5, 0, 5, 3, 5, '#eef5ff'); // Weather Radar Dome

    // Low Snow Berms flanking central bunker
    this.addBox(0, 1.25, -20, 14, 2.5, 4, '#cbd8e6');
    this.addBox(0, 1.25, 20, 14, 2.5, 4, '#cbd8e6');

    // Stacked Shipping Containers (Arctic Camo)
    this.addBox(-16, 1.5, -3, 6, 3, 4, '#3d5a80');
    this.addBox(-16, 4.5, -3, 5, 3, 3.5, '#293241');
    this.addBox(-16, 1.5, 5, 6, 3, 4, '#98c1d9');
    this.addBox(16, 1.5, 3, 6, 3, 4, '#3d5a80');
    this.addBox(16, 4.5, 3, 5, 3, 3.5, '#293241');
    this.addBox(16, 1.5, -5, 6, 3, 4, '#98c1d9');

    // Jump Pads: Super Lifts to Bunker Roof
    this.createJumpPad(-9, 0, 0, 18.5, 6, 0);
    this.createJumpPad(9, 0, 0, 18.5, -6, 0);
    this.createJumpPad(0, 0, -7, 18.5, 0, 6);
    this.createJumpPad(0, 0, 7, 18.5, 0, -6);

    // Teleport Port Pair: Sub-surface Trench <-> Weather Radar Perch
    this.createTeleportPair(
      'subzero_trench',
      new THREE.Vector3(-22, 0, -18),
      Math.PI / 4,
      'subzero_radar',
      new THREE.Vector3(22, 0, 18),
      -3 * Math.PI / 4,
      '#00ffee'
    );

    // 4 Outer Satellite Radar Outposts across expanded perimeter
    [-40, 40].forEach((rx) => {
      [-40, 40].forEach((rz) => {
        this.addPlatform(rx, 1.5, rz, 10, 3.0, 10, '#2c3848', true); // roof at y = 3.0m
        this.addBox(rx, 3.8, rz, 3, 1.6, 3, '#eef5ff'); // Satellite dish
        this.addBox(rx > 0 ? rx - 8 : rx + 8, 1.5, rz, 6, 3, 4, '#3d5a80'); // Depot container
      });
    });
  }

  private buildSkySanctuary(): void {
    // Sky Sanctuary - Floating celestial shrine islands in open clouds
    // Central Shrine Island (22m x 22m)
    this.addPlatform(0, -1.5, 0, 22, 3, 22, '#2e333d');

    // Central Shrine Pavilion Terrace (10m x 10m at y=3.5)
    this.addPlatform(0, 1.75, 0, 10, 3.5, 10, '#3f4756');
    this.addBox(0, 4.5, 0, 8, 1, 8, '#ff2a55'); // Shrine Pavilion Roof

    // 4 Satellite Islands (Cloud Gardens & Meditation Terraces)
    this.addPlatform(0, -1.5, -26, 14, 3, 14, '#2e333d'); // North Garden
    this.addPlatform(0, -1.5, 26, 14, 3, 14, '#2e333d'); // South Garden
    this.addPlatform(-26, -1.5, 0, 12, 3, 12, '#2e333d'); // West Terrace
    this.addPlatform(26, -1.5, 0, 12, 3, 12, '#2e333d'); // East Bell Tower

    // Stepping Stone Bridges
    this.addPlatform(0, -1, -15, 3.5, 2, 4, '#444d60');
    this.addPlatform(0, -1, 15, 3.5, 2, 4, '#444d60');
    this.addPlatform(-15, -1, 0, 4, 2, 3.5, '#444d60');
    this.addPlatform(15, -1, 0, 4, 2, 3.5, '#444d60');

    // Shrine Architecture Cover Props
    this.addBox(-3, 2.5, -11.5, 1, 5, 1, '#ff2a55'); // North Torii L
    this.addBox(3, 2.5, -11.5, 1, 5, 1, '#ff2a55'); // North Torii R
    this.addBox(-3, 2.5, 11.5, 1, 5, 1, '#ff2a55'); // South Torii L
    this.addBox(3, 2.5, 11.5, 1, 5, 1, '#ff2a55'); // South Torii R
    this.addBox(-26, 1.5, 0, 3, 3, 3, '#5c6475'); // West Rock Shrine
    this.addBox(26, 2.5, 0, 3, 5, 3, '#ffaa00'); // East Pagoda

    // 4 Sky Booster Jump Pads launching onto Central Shrine Island
    this.createJumpPad(0, 0, -21, 15, 0, 17);
    this.createJumpPad(0, 0, 21, 15, 0, -17);
    this.createJumpPad(-21, 0, 0, 15, 17, 0);
    this.createJumpPad(21, 0, 0, 15, -17, 0);

    // Teleport Port Pair: Celestial Spirit Gates (North Garden <-> South Garden)
    this.createTeleportPair(
      'sanctuary_north',
      new THREE.Vector3(0, 0, -28),
      Math.PI, // Facing South
      'sanctuary_south',
      new THREE.Vector3(0, 0, 28),
      0, // Facing North
      '#ffcc00'
    );

    // 4 Outer Floating Spirit Islands across expanded perimeter
    [-50, 50].forEach((ix) => {
      [-50, 50].forEach((iz) => {
        this.addPlatform(ix, -1.5, iz, 14, 3, 14, '#2e333d', true);
        this.addBox(ix, 2.0, iz, 3, 4, 3, ix > 0 ? '#ff2a55' : '#00d2ff'); // Shrine spire
        // Stepping stone bridge
        this.addPlatform(ix > 0 ? 38 : -38, -1, iz > 0 ? 38 : -38, 4, 2, 4, '#444d60', true);
      });
    });
  }

  public addPlatform(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    color: string,
    walkableTop: boolean = true
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.2
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    this.collisionBoxes.push(box);
    if (walkableTop) {
      this.rooftopBoxes.push(box);
    }
    return mesh;
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

  public createJumpPad(
    x: number,
    y: number,
    z: number,
    impulseY: number,
    impulseX: number = 0,
    impulseZ: number = 0,
    color: string = '#00ff88'
  ): void {
    const isDirectional = Math.abs(impulseX) > 0.1 || Math.abs(impulseZ) > 0.1;
    const baseGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 16);
    const baseMat = new THREE.MeshStandardMaterial({ color: '#161922', roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.set(x, y + 0.125, z);
    this.group.add(base);

    // Glowing pad surface
    const padGeo = new THREE.CylinderGeometry(1.3, 1.3, 0.1, 16);
    const padColor = isDirectional ? '#ffaa00' : color;
    const padMat = new THREE.MeshStandardMaterial({
      color: padColor,
      emissive: padColor,
      emissiveIntensity: 0.85
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(x, y + 0.26, z);
    this.group.add(pad);

    // Directional chevron indicator if directional
    if (isDirectional) {
      const arrowGeo = new THREE.ConeGeometry(0.4, 0.9, 4);
      arrowGeo.rotateX(Math.PI / 2);
      const arrowMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.rotation.y = Math.atan2(impulseX, impulseZ);
      arrow.position.set(x, y + 0.35, z);
      this.group.add(arrow);
    }

    const box = new THREE.Box3().setFromObject(pad);
    box.max.y += 0.8; // Expand trigger height slightly
    this.jumpPads.push({ box, mesh: pad, impulseY, impulseX, impulseZ });
  }

  public createTeleportPair(
    idA: string,
    posA: THREE.Vector3,
    yawA: number,
    idB: string,
    posB: THREE.Vector3,
    yawB: number,
    color: string = '#00d2ff'
  ): void {
    const makePort = (
      id: string,
      targetId: string,
      pos: THREE.Vector3,
      targetPos: THREE.Vector3,
      targetYaw: number,
      sourceYaw: number
    ) => {
      const portGroup = new THREE.Group();
      portGroup.position.copy(pos);

      // Base pedestal
      const pedGeo = new THREE.CylinderGeometry(1.8, 2.1, 0.3, 16);
      const pedMat = new THREE.MeshStandardMaterial({ color: '#161922', metalness: 0.8, roughness: 0.3 });
      const ped = new THREE.Mesh(pedGeo, pedMat);
      ped.position.y = 0.15;
      portGroup.add(ped);

      // Outer glowing base ring
      const ringGeo = new THREE.RingGeometry(1.4, 1.7, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.y = 0.31;
      portGroup.add(ring);

      // Vertical Portal Gate Arch (Torus)
      const gateGeo = new THREE.TorusGeometry(1.5, 0.12, 16, 32);
      const gateMat = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: 0.85
      });
      const gate = new THREE.Mesh(gateGeo, gateMat);
      gate.position.y = 1.7;
      gate.rotation.y = sourceYaw;
      portGroup.add(gate);

      // Swirling portal energy disc
      const coreGeo = new THREE.CircleGeometry(1.35, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      core.position.y = 1.7;
      core.rotation.y = sourceYaw;
      portGroup.add(core);

      this.group.add(portGroup);

      // Trigger box centered on the portal base
      const triggerBox = new THREE.Box3(
        new THREE.Vector3(pos.x - 1.4, pos.y, pos.z - 1.4),
        new THREE.Vector3(pos.x + 1.4, pos.y + 3.0, pos.z + 1.4)
      );

      // Exit position: offset slightly forward in target direction
      const exitOffsetDist = 1.6;
      const exitPos = new THREE.Vector3(
        targetPos.x + Math.sin(targetYaw) * exitOffsetDist,
        targetPos.y + 1.0,
        targetPos.z + Math.cos(targetYaw) * exitOffsetDist
      );

      this.teleportPorts.push({
        id,
        targetId,
        box: triggerBox,
        mesh: portGroup,
        exitPos,
        exitYaw: targetYaw,
        color
      });
    };

    makePort(idA, idB, posA, posB, yawB, yawA);
    makePort(idB, idA, posB, posA, yawA, yawB);
  }

  public createLadder(
    x: number,
    z: number,
    bottomY: number,
    topY: number,
    facing: 'north' | 'south' | 'east' | 'west' = 'north'
  ): THREE.Box3 {
    const height = topY - bottomY;
    const ladderGroup = new THREE.Group();
    ladderGroup.position.set(x, bottomY, z);

    const railMat = new THREE.MeshStandardMaterial({ color: '#252936', metalness: 0.8, roughness: 0.3 });
    const rungMat = new THREE.MeshStandardMaterial({
      color: '#ffbb00',
      emissive: '#ff9900',
      emissiveIntensity: 0.4,
      metalness: 0.5,
      roughness: 0.4
    });

    const isZAxis = facing === 'north' || facing === 'south';
    const railWidth = 0.6;
    const railRadius = 0.035;
    const rungRadius = 0.025;

    // 2 Vertical Side Rails
    const railGeo = new THREE.CylinderGeometry(railRadius, railRadius, height, 8);
    const railL = new THREE.Mesh(railGeo, railMat);
    const railR = new THREE.Mesh(railGeo, railMat);

    if (isZAxis) {
      railL.position.set(-railWidth / 2, height / 2, 0);
      railR.position.set(railWidth / 2, height / 2, 0);
    } else {
      railL.position.set(0, height / 2, -railWidth / 2);
      railR.position.set(0, height / 2, railWidth / 2);
    }
    ladderGroup.add(railL);
    ladderGroup.add(railR);

    // Horizontal Rungs every 0.35m
    const rungStep = 0.35;
    const numRungs = Math.floor(height / rungStep);
    const rungGeo = new THREE.CylinderGeometry(rungRadius, rungRadius, railWidth, 8);
    if (isZAxis) {
      rungGeo.rotateZ(Math.PI / 2);
    } else {
      rungGeo.rotateX(Math.PI / 2);
    }

    for (let i = 1; i <= numRungs; i++) {
      const rungMesh = new THREE.Mesh(rungGeo, rungMat);
      rungMesh.position.y = i * rungStep;
      ladderGroup.add(rungMesh);
    }

    this.group.add(ladderGroup);

    // Trigger Box for ladder climbing interaction
    const halfX = isZAxis ? 0.55 : 0.4;
    const halfZ = isZAxis ? 0.4 : 0.55;
    const box = new THREE.Box3(
      new THREE.Vector3(x - halfX, bottomY, z - halfZ),
      new THREE.Vector3(x + halfX, topY, z + halfZ)
    );
    this.ladderBoxes.push(box);
    return box;
  }

  public checkLadders(playerPos: THREE.Vector3): THREE.Box3 | null {
    for (const box of this.ladderBoxes) {
      if (
        playerPos.x >= box.min.x - 0.45 &&
        playerPos.x <= box.max.x + 0.45 &&
        playerPos.z >= box.min.z - 0.45 &&
        playerPos.z <= box.max.z + 0.45 &&
        playerPos.y >= box.min.y - 0.25 &&
        playerPos.y <= box.max.y + 0.5
      ) {
        return box;
      }
    }
    return null;
  }

  public checkJumpPads(playerPos: THREE.Vector3): { impulseY: number; impulseX: number; impulseZ: number } | null {
    for (const jp of this.jumpPads) {
      if (jp.box.containsPoint(playerPos)) {
        return {
          impulseY: jp.impulseY,
          impulseX: jp.impulseX || 0,
          impulseZ: jp.impulseZ || 0
        };
      }
    }
    return null;
  }

  public checkTeleportPorts(pos: THREE.Vector3, lastTeleportTime: number): TeleportPort | null {
    const now = performance.now();
    if (lastTeleportTime > 0 && now - lastTeleportTime < 1500) {
      return null; // Enforce 1.5s anti-ping-pong cooldown
    }
    for (const port of this.teleportPorts) {
      if (port.box.containsPoint(pos)) {
        return port;
      }
    }
    return null;
  }

  public getGroundLevel(playerPos: THREE.Vector3): number {
    let highestGround = this.hasGroundPlane ? 0.0 : -100;
    for (const roof of this.rooftopBoxes) {
      if (
        playerPos.x >= roof.min.x - 0.25 &&
        playerPos.x <= roof.max.x + 0.25 &&
        playerPos.z >= roof.min.z - 0.25 &&
        playerPos.z <= roof.max.z + 0.25 &&
        playerPos.y >= roof.max.y - 0.7 &&
        playerPos.y <= roof.max.y + 2.5
      ) {
        const candidate = roof.max.y;
        if (candidate > highestGround) {
          highestGround = candidate;
        }
      }
    }
    return highestGround;
  }

  public dispose(): void {
    this.collisionBoxes = [];
    this.rooftopBoxes = [];
    this.ladderBoxes = [];
    this.jumpPads = [];
    this.teleportPorts = [];
    this.sceneRef.remove(this.group);
  }
}

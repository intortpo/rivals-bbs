import * as pc from 'playcanvas';

export interface PCJumpPad {
  box: pc.BoundingBox;
  entity?: pc.Entity;
  impulseY: number;
  impulseX?: number;
  impulseZ?: number;
}

export interface PCTeleportPort {
  id: string;
  targetId: string;
  box: pc.BoundingBox;
  entity?: pc.Entity;
  exitPos: pc.Vec3;
  exitYaw: number;
  color: string;
}

export interface SkyThemeConfig {
  id: string;
  name: string;
  bgColor: string;
  fogDensity: number;
  sunColor?: string;
  ambientColor?: string;
}

export const SKY_THEMES: Record<string, SkyThemeConfig> = {
  twilight: {
    id: 'twilight',
    name: '🌆 Cyber Twilight',
    bgColor: '#031422',
    fogDensity: 0.0022,
    sunColor: '#ffe5b4',
    ambientColor: '#1a233a'
  },
  sunset: {
    id: 'sunset',
    name: '🌇 Golden Sunset',
    bgColor: '#d4501a',
    fogDensity: 0.002,
    sunColor: '#ffbb77',
    ambientColor: '#2b1a1a'
  },
  sage: {
    id: 'sage',
    name: '🏙️ Emerald Sage',
    bgColor: '#1a2e26',
    fogDensity: 0.0025,
    sunColor: '#c8f5d0',
    ambientColor: '#13221e'
  },
  deepspace: {
    id: 'deepspace',
    name: '🌌 Deep Orbital Space',
    bgColor: '#050711',
    fogDensity: 0.0012,
    sunColor: '#99d5ff',
    ambientColor: '#0a1020'
  },
  subzero: {
    id: 'subzero',
    name: '❄️ Subzero Blizzard',
    bgColor: '#c8d9ea',
    fogDensity: 0.0035,
    sunColor: '#ffffff',
    ambientColor: '#7a8e9e'
  },
  biodome: {
    id: 'biodome',
    name: '🌿 Biosphere Emerald',
    bgColor: '#0d281e',
    fogDensity: 0.0022,
    sunColor: '#c8f5d0',
    ambientColor: '#13281e'
  },
  subway: {
    id: 'subway',
    name: '🚇 Dystopian Metro',
    bgColor: '#0a0e18',
    fogDensity: 0.003,
    sunColor: '#00d2ff',
    ambientColor: '#111827'
  },
  tropical: {
    id: 'tropical',
    name: '🏝️ Tropical Lagoon',
    bgColor: '#164e63',
    fogDensity: 0.0018,
    sunColor: '#fef08a',
    ambientColor: '#083344'
  },
  canyon: {
    id: 'canyon',
    name: '🏜️ Rust Canyon',
    bgColor: '#431407',
    fogDensity: 0.0022,
    sunColor: '#fdba74',
    ambientColor: '#270e04'
  },
  solar: {
    id: 'solar',
    name: '☀️ Stratosphere Solar',
    bgColor: '#020617',
    fogDensity: 0.0012,
    sunColor: '#ffffff',
    ambientColor: '#0f172a'
  },
  penthouse: {
    id: 'penthouse',
    name: '🍸 Vertigo Skyline',
    bgColor: '#090514',
    fogDensity: 0.0019,
    sunColor: '#e879f9',
    ambientColor: '#190a28'
  }
};

export interface PBROptions {
  metalness?: number;
  gloss?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  blendType?: number;
}

export class PCMapBuilder {
  public app?: pc.Application;
  public mapRoot: pc.Entity;
  public collisionBoxes: pc.BoundingBox[] = [];
  public rooftopBoxes: pc.BoundingBox[] = [];
  public ladderBoxes: pc.BoundingBox[] = [];
  public jumpPads: PCJumpPad[] = [];
  public teleportPorts: PCTeleportPort[] = [];
  public hasGroundPlane: boolean = true;
  public bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
  public mapName: string;
  public skyTheme: string;
  public staticBatchGroupId?: number;

  constructor(app: pc.Application | undefined, mapName: string = 'Facility', skyTheme: string = 'twilight') {
    this.app = app;
    this.mapName = mapName;
    this.skyTheme = skyTheme;
    this.mapRoot = new pc.Entity(`Map_${mapName}`);

    if (app) {
      app.root.addChild(this.mapRoot);
      const theme = SKY_THEMES[skyTheme] || SKY_THEMES.twilight;
      const c = new pc.Color();
      c.fromString(theme.bgColor);
      app.scene.fogColor = c;
      app.scene.fogDensity = theme.fogDensity;

      if ((app as any).batcher) {
        try {
          const batcher = (app as any).batcher;
          let group = batcher.getGroupByName('LevelStatic');
          if (!group) {
            group = batcher.addGroup('LevelStatic', false, 150);
          }
          this.staticBatchGroupId = group?.id;
        } catch (err) {
          console.warn('[PCMapBuilder] BatchGroup init skipped:', err);
        }
      }
    }

    this.buildMap(mapName);
  }

  public createPBRMaterial(colorHex: string, pbr?: PBROptions): pc.StandardMaterial {
    const mat = new pc.StandardMaterial();
    mat.diffuse = new pc.Color().fromString(colorHex);
    mat.useMetalness = true;
    mat.metalness = pbr?.metalness ?? 0.15;
    mat.gloss = pbr?.gloss ?? 0.55;

    if (pbr?.emissive) {
      mat.emissive = new pc.Color().fromString(pbr.emissive);
      mat.emissiveIntensity = pbr.emissiveIntensity ?? 1.5;
    }

    if (pbr?.opacity !== undefined) {
      mat.opacity = pbr.opacity;
      mat.blendType = pbr.blendType ?? pc.BLEND_NORMAL;
    }

    mat.update();
    return mat;
  }

  public addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorHex: string = '#28314e',
    isWalkableRoof: boolean = false,
    pbr?: PBROptions
  ): pc.BoundingBox {
    const box = new pc.BoundingBox(new pc.Vec3(x, y, z), new pc.Vec3(w / 2, h / 2, d / 2));
    this.collisionBoxes.push(box);
    if (isWalkableRoof) {
      this.rooftopBoxes.push(box);
    }

    if (this.app) {
      const ent = new pc.Entity('MapBox');
      const mat = this.createPBRMaterial(colorHex, pbr);
      ent.addComponent('render', { type: 'box', material: mat });
      if (this.staticBatchGroupId !== undefined && ent.render) {
        ent.render.batchGroupId = this.staticBatchGroupId;
      }
      ent.setPosition(x, y, z);
      ent.setLocalScale(w, h, d);
      this.mapRoot.addChild(ent);
    }

    return box;
  }

  public createJumpPad(
    x: number,
    y: number,
    z: number,
    impulseY: number = 18.0,
    impulseX?: number,
    impulseZ?: number
  ): void {
    const padBox = new pc.BoundingBox(new pc.Vec3(x, y + 0.35, z), new pc.Vec3(1.4, 0.45, 1.4));
    let padEnt: pc.Entity | undefined;

    if (this.app) {
      padEnt = new pc.Entity('JumpPad');
      const baseMat = this.createPBRMaterial('#111827', { metalness: 0.8, gloss: 0.7 });
      const glowMat = this.createPBRMaterial('#00f0ff', {
        metalness: 0.2,
        gloss: 0.8,
        emissive: '#00f0ff',
        emissiveIntensity: 3.5
      });

      const base = new pc.Entity('Base');
      base.addComponent('render', { type: 'cylinder', material: baseMat });
      base.setLocalScale(2.8, 0.2, 2.8);
      padEnt.addChild(base);

      const ring = new pc.Entity('GlowRing');
      ring.addComponent('render', { type: 'cylinder', material: glowMat });
      ring.setLocalPosition(0, 0.12, 0);
      ring.setLocalScale(2.0, 0.08, 2.0);
      padEnt.addChild(ring);

      padEnt.setPosition(x, y, z);
      this.mapRoot.addChild(padEnt);
    }

    this.jumpPads.push({
      box: padBox,
      entity: padEnt,
      impulseY,
      impulseX,
      impulseZ
    });
  }

  public createTeleportPort(
    id: string,
    targetId: string,
    x: number,
    y: number,
    z: number,
    exitPos: pc.Vec3,
    exitYaw: number,
    colorHex: string = '#00f0ff'
  ): void {
    const portBox = new pc.BoundingBox(new pc.Vec3(x, y + 1.2, z), new pc.Vec3(1.2, 1.4, 1.2));
    let portEnt: pc.Entity | undefined;

    if (this.app) {
      portEnt = new pc.Entity(`Port_${id}`);
      const mat = this.createPBRMaterial(colorHex, {
        metalness: 0.1,
        gloss: 0.9,
        emissive: colorHex,
        emissiveIntensity: 3.5,
        opacity: 0.85,
        blendType: pc.BLEND_ADDITIVE
      });

      const ring = new pc.Entity('PortRing');
      ring.addComponent('render', { type: 'cylinder', material: mat });
      ring.setLocalScale(2.4, 0.1, 2.4);
      portEnt.addChild(ring);

      const arch = new pc.Entity('PortArch');
      arch.addComponent('render', { type: 'box', material: mat });
      arch.setLocalPosition(0, 1.5, 0);
      arch.setLocalScale(2.2, 2.8, 0.15);
      portEnt.addChild(arch);

      portEnt.setPosition(x, y, z);
      this.mapRoot.addChild(portEnt);
    }

    this.teleportPorts.push({
      id,
      targetId,
      box: portBox,
      entity: portEnt,
      exitPos,
      exitYaw,
      color: colorHex
    });
  }

  public buildMap(name: string): void {
    this.collisionBoxes = [];
    this.rooftopBoxes = [];
    this.ladderBoxes = [];
    this.jumpPads = [];
    this.teleportPorts = [];

    switch (name) {
      case 'Facility':
        this.buildFacilityArena();
        break;
      case 'Cartoon City':
        this.buildCartoonCity();
        break;
      case 'Arena Classic':
        this.buildClassicArena();
        break;
      case 'Neon Warehouse':
        this.buildNeonWarehouse();
        break;
      case 'Cyber Spire':
        this.buildCyberSpire();
        break;
      case 'Quantum Lab':
      case 'Quantum Lab (Dimension)':
        this.buildQuantumLab();
        break;
      case 'Magma Foundry':
      case 'Magma Foundry (Onyx)':
        this.buildMagmaFoundry();
        break;
      case 'Subzero Station':
        this.buildSubzeroStation();
        break;
      case 'Sky Sanctuary':
        this.buildSkySanctuary();
        break;
      case 'Orbital Station':
        this.buildOrbitalStation();
        break;
      case 'Bio-Dome':
      case 'Bio-Dome (Neo Arboretum)':
        this.buildBioDome();
        break;
      case 'Metro Underpass':
      case 'Metro Underpass (Neon Subways)':
        this.buildMetroUnderpass();
        break;
      case 'Sunken Atoll':
      case 'Sunken Atoll (Ancient Coral Ruins)':
        this.buildSunkenAtoll();
        break;
      case 'Scrapyard Canyon':
      case 'Scrapyard Canyon (Rust Basin)':
        this.buildScrapyardCanyon();
        break;
      case 'Solar Relay':
      case 'Solar Relay (Helios Mirror Array)':
        this.buildSolarRelay();
        break;
      case 'Skyline Penthouse':
      case 'Skyline Penthouse (Vertigo Lounge)':
        this.buildSkylinePenthouse();
        break;
      default:
        this.buildFacilityArena();
        break;
    }

    if (this.app && (this.app as any).batcher && this.staticBatchGroupId !== undefined) {
      try {
        (this.app as any).batcher.generate([this.staticBatchGroupId]);
      } catch (err) {
        // Safe fallback in headless/test environments
      }
    }
  }

  // 1. Facility Arena (PlayCanvas FPS Starter Kit level)
  private buildFacilityArena(): void {
    this.bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Heavy concrete floor grid with specular PBR sheen
    this.addBox(0, -0.1, 0, 66, 0.2, 66, '#181b24', false, { metalness: 0.15, gloss: 0.45 });

    // Blue and Red Depot floor accents
    this.addBox(-22, 0.02, 0, 8, 0.05, 16, '#00d2ff', false, { emissive: '#00d2ff', emissiveIntensity: 1.2 });
    this.addBox(22, 0.02, 0, 8, 0.05, 16, '#ff2a55', false, { emissive: '#ff2a55', emissiveIntensity: 1.2 });

    // Perimeter Containment Walls
    this.addBox(0, 4, 32, 66, 8, 2, '#1e2230', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(0, 4, -32, 66, 8, 2, '#1e2230', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(-32, 4, 0, 2, 8, 66, '#1e2230', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(32, 4, 0, 2, 8, 66, '#1e2230', false, { metalness: 0.3, gloss: 0.4 });

    // Central Catwalk (at Y=3.35m, width 6m, length 24m)
    this.addBox(0, 3.35, 0, 6, 0.3, 24, '#2d3748', true, { metalness: 0.6, gloss: 0.65 });

    // Catwalk High Safety Railings
    this.addBox(-3, 3.9, 0, 0.2, 0.8, 24, '#ff9900', false, { emissive: '#ff9900', emissiveIntensity: 2.0 });
    this.addBox(3, 3.9, 0, 0.2, 0.8, 24, '#ff9900', false, { emissive: '#ff9900', emissiveIntensity: 2.0 });

    // Access Ramps (North & South)
    this.addBox(0, 0.6, -16.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 1.8, -13.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 3.0, -10.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });

    this.addBox(0, 0.6, 16.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 1.8, 13.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 3.0, 10.5, 5, 1.2, 3, '#3a4454', true, { metalness: 0.4, gloss: 0.5 });

    // 4 Structural Support Pillars
    this.addBox(-8, 5, -10, 2, 10, 2, '#1a202c', false, { metalness: 0.7, gloss: 0.7 });
    this.addBox(8, 5, -10, 2, 10, 2, '#1a202c', false, { metalness: 0.7, gloss: 0.7 });
    this.addBox(-8, 5, 10, 2, 10, 2, '#1a202c', false, { metalness: 0.7, gloss: 0.7 });
    this.addBox(8, 5, 10, 2, 10, 2, '#1a202c', false, { metalness: 0.7, gloss: 0.7 });

    // Shipping Containers
    this.addBox(-15, 1.5, -6.5, 6, 3, 3, '#2b4c7e', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(-15, 1.5, 6.5, 6, 3, 3, '#2b4c7e', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(15, 1.5, -6.5, 6, 3, 3, '#7e2b2b', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(15, 1.5, 6.5, 6, 3, 3, '#7e2b2b', true, { metalness: 0.5, gloss: 0.6 });

    // Cargo Crate Clusters
    this.addBox(-14.5, 1.1, -18.5, 3, 2.2, 3, '#4a5568', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(14.5, 1.1, -18.5, 3, 2.2, 3, '#4a5568', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(-14.5, 1.1, 18.5, 3, 2.2, 3, '#4a5568', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(14.5, 1.1, 18.5, 3, 2.2, 3, '#4a5568', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(0, 0.75, -5, 4, 1.5, 2, '#3182ce', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 0.75, 5, 4, 1.5, 2, '#e53e3e', true, { metalness: 0.4, gloss: 0.5 });

    // Team Depot Bunker Covers
    this.addBox(-27.5, 1.25, 0, 1, 2.5, 12, '#1e2230', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(27.5, 1.25, 0, 1, 2.5, 12, '#1e2230', true, { metalness: 0.5, gloss: 0.6 });

    // Jump Pads (launching up to upper catwalk)
    this.createJumpPad(-9, 0, 0, 18.0, 3.5, 0);
    this.createJumpPad(9, 0, 0, 18.0, -3.5, 0);
  }

  // 2. Cartoon City (Urban Metropolis)
  private buildCartoonCity(): void {
    this.bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
    this.hasGroundPlane = true;

    // Asphalt Street Grid
    this.addBox(0, -0.1, 0, 130, 0.2, 130, '#11141e', false, { metalness: 0.05, gloss: 0.4 });

    // Central Plaza Fountain & Marble Rim
    this.addBox(0, 0.5, 0, 6, 1.0, 6, '#28314e', true, { metalness: 0.3, gloss: 0.7 });
    this.addBox(0, 1.5, 0, 3, 1.0, 3, '#00d2ff', true, { emissive: '#00d2ff', emissiveIntensity: 2.0 });

    // City Buildings (North, South, East, West blocks)
    this.addBox(-24, 6, -24, 18, 12, 18, '#1e2438', true, { metalness: 0.4, gloss: 0.6 });
    this.addBox(24, 7, -24, 18, 14, 18, '#1e2438', true, { metalness: 0.4, gloss: 0.6 });
    this.addBox(-24, 5, 24, 18, 10, 18, '#1e2438', true, { metalness: 0.4, gloss: 0.6 });
    this.addBox(24, 8, 24, 18, 16, 18, '#1e2438', true, { metalness: 0.4, gloss: 0.6 });

    // Vehicles / Low tactical cover
    this.addBox(8, 0.75, 4, 2.2, 1.5, 4.5, '#ef4444', true, { metalness: 0.8, gloss: 0.75 });
    this.addBox(-8, 0.75, -6, 2.2, 1.5, 4.5, '#3b82f6', true, { metalness: 0.8, gloss: 0.75 });
    this.addBox(14, 0.6, -10, 2.0, 1.2, 4.0, '#f59e0b', true, { metalness: 0.8, gloss: 0.75 });
    this.addBox(-12, 0.6, 12, 2.0, 1.2, 4.0, '#10b981', true, { metalness: 0.8, gloss: 0.75 });

    // Rooftop Jump Pads
    this.createJumpPad(-12, 0, -24, 18.0);
    this.createJumpPad(12, 0, -24, 19.5);
    this.createJumpPad(-12, 0, 24, 17.5);
    this.createJumpPad(12, 0, 24, 20.5);
  }

  // 3. Arena Classic (Symmetrical Cyber Colosseum)
  private buildClassicArena(): void {
    this.bounds = { minX: -46, maxX: 46, minZ: -46, maxZ: 46 };
    this.hasGroundPlane = true;

    // Floor
    this.addBox(0, -0.1, 0, 96, 0.2, 96, '#1a1d2e', false, { metalness: 0.2, gloss: 0.5 });

    // Central Platform
    this.addBox(0, 1.25, 0, 12, 2.5, 12, '#28314e', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(0, 2.6, 0, 8, 0.2, 8, '#00d2ff', true, { emissive: '#00d2ff', emissiveIntensity: 2.5 });

    // 4 Symmetrical Cover Pillars around center
    const d = 14;
    [-d, d].forEach((x) => {
      [-d, d].forEach((z) => {
        this.addBox(x, 2.5, z, 3, 5, 3, '#ff2a55', false, { metalness: 0.6, gloss: 0.7, emissive: '#ff2a55', emissiveIntensity: 1.2 });
        this.addBox(x + (x > 0 ? -3 : 3), 1, z, 3, 2, 2, '#384260', true, { metalness: 0.4, gloss: 0.5 });
      });
    });

    // 4 High-Velocity Central Jump Pads
    this.createJumpPad(-12, 0, 0, 19.0);
    this.createJumpPad(12, 0, 0, 19.0);
    this.createJumpPad(0, 0, -12, 19.0);
    this.createJumpPad(0, 0, 12, 19.0);

    // 4 Corner Bastions and Pads
    [-32, 32].forEach((bx) => {
      [-32, 32].forEach((bz) => {
        this.addBox(bx, 1.5, bz, 10, 3.0, 10, '#242b44', true, { metalness: 0.5, gloss: 0.6 });
      });
    });

    this.createJumpPad(24, 0, 24, 17.0, 6, 6);
    this.createJumpPad(-24, 0, 24, 17.0, -6, 6);
    this.createJumpPad(24, 0, -24, 17.0, 6, -6);
    this.createJumpPad(-24, 0, -24, 17.0, -6, -6);
  }

  // 4. Neon Warehouse (High-Bay Storage & Conveyor Gantry)
  private buildNeonWarehouse(): void {
    this.bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Floor with cyber reflective sheen
    this.addBox(0, -0.1, 0, 66, 0.2, 66, '#10141f', false, { metalness: 0.2, gloss: 0.55 });

    // Perimeter Containment Walls
    this.addBox(0, 4, 32, 66, 8, 2, '#181e2e', false, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 4, -32, 66, 8, 2, '#181e2e', false, { metalness: 0.4, gloss: 0.5 });
    this.addBox(-32, 4, 0, 2, 8, 66, '#181e2e', false, { metalness: 0.4, gloss: 0.5 });
    this.addBox(32, 4, 0, 2, 8, 66, '#181e2e', false, { metalness: 0.4, gloss: 0.5 });

    // Overhead Conveyor Gantry Catwalk (y=3.25m, width 8m, length 30m)
    this.addBox(0, 3.25, 0, 8, 0.3, 30, '#2b3548', true, { metalness: 0.7, gloss: 0.65 });

    // Glowing Neon Safety Railings
    this.addBox(-4, 3.8, 0, 0.2, 0.8, 30, '#00d2ff', false, { emissive: '#00d2ff', emissiveIntensity: 2.5 });
    this.addBox(4, 3.8, 0, 0.2, 0.8, 30, '#00d2ff', false, { emissive: '#00d2ff', emissiveIntensity: 2.5 });

    // Industrial Shelving Racks (North & South Wings)
    this.addBox(-17, 2.75, -16.5, 6, 5.5, 3, '#1f273d', false, { metalness: 0.8, gloss: 0.7 });
    this.addBox(17, 2.75, -16.5, 6, 5.5, 3, '#1f273d', false, { metalness: 0.8, gloss: 0.7 });
    this.addBox(-17, 2.75, 16.5, 6, 5.5, 3, '#1f273d', false, { metalness: 0.8, gloss: 0.7 });
    this.addBox(17, 2.75, 16.5, 6, 5.5, 3, '#1f273d', false, { metalness: 0.8, gloss: 0.7 });

    // Shipping Container Bays
    this.addBox(-13, 1.6, 0, 6, 3.2, 8, '#2563eb', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(13, 1.6, 0, 6, 3.2, 8, '#dc2626', true, { metalness: 0.5, gloss: 0.6 });

    // Pallets and Low Barriers
    this.addBox(-3, 0.7, -4.5, 4, 1.4, 3, '#475569', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(3, 0.7, 4.5, 4, 1.4, 3, '#475569', true, { metalness: 0.3, gloss: 0.5 });

    // Dock Terminals
    this.addBox(-27, 1.25, 0, 2, 2.5, 16, '#1e293b', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(27, 1.25, 0, 2, 2.5, 16, '#1e293b', true, { metalness: 0.5, gloss: 0.6 });

    // Jump pads launching onto conveyor bridge
    this.createJumpPad(-9, 0, 0, 18.0, 3.5, 0);
    this.createJumpPad(9, 0, 0, 18.0, -3.5, 0);
  }

  // 5. Cyber Spire (Floating Multi-tier Skyscraper)
  private buildCyberSpire(): void {
    this.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    // Void fall abyss
    this.hasGroundPlane = false;

    // Tier 1 Base Plaza
    this.addBox(0, 0.5, 0, 20, 1.0, 20, '#1a1e2e', true, { metalness: 0.4, gloss: 0.6 });

    // Tier 2 Central Tower Terrace
    this.addBox(0, 4.0, 0, 12, 6.0, 12, '#242a42', true, { metalness: 0.6, gloss: 0.7 });

    // Glowing Central Spire Needle
    this.addBox(0, 12.0, 0, 4, 10.0, 4, '#00d2ff', false, { emissive: '#00d2ff', emissiveIntensity: 3.5 });

    // Outer Satellite Platforms
    this.addBox(0, 3.0, -22, 10, 1.0, 10, '#1c2136', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 3.0, 22, 10, 1.0, 10, '#1c2136', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(-22, 2.0, 0, 10, 1.0, 10, '#1c2136', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(22, 2.0, 0, 10, 1.0, 10, '#1c2136', true, { metalness: 0.4, gloss: 0.5 });

    // Sky Bridge walkways
    this.addBox(0, 2.8, -14, 4, 0.4, 8, '#2d3748', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(0, 2.8, 14, 4, 0.4, 8, '#2d3748', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(-14, 1.8, 0, 8, 0.4, 4, '#2d3748', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(14, 1.8, 0, 8, 0.4, 4, '#2d3748', true, { metalness: 0.5, gloss: 0.6 });

    // Jump pads launching players up to Tier 2 Terrace
    this.createJumpPad(0, 1.0, -8, 18.0, 0, 3.0);
    this.createJumpPad(0, 1.0, 8, 18.0, 0, -3.0);
    this.createJumpPad(-8, 1.0, 0, 18.0, 3.0, 0);
    this.createJumpPad(8, 1.0, 0, 18.0, -3.0, 0);

    // Cross-spire teleporters
    this.createTeleportPort('SpireNorth', 'SpireSouth', 0, 3.0, -25, new pc.Vec3(0, 3.5, 20), Math.PI, '#00f0ff');
    this.createTeleportPort('SpireSouth', 'SpireNorth', 0, 3.0, 25, new pc.Vec3(0, 3.5, -20), 0, '#ff2a55');
  }

  // 6. Quantum Lab (Dimension Research & Teleport Slipstream)
  private buildQuantumLab(): void {
    this.bounds = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };
    this.hasGroundPlane = true;

    // High-tech floor
    this.addBox(0, -0.1, 0, 110, 0.2, 110, '#0a101d', false, { metalness: 0.3, gloss: 0.65 });

    // Central Core Reactor
    this.addBox(0, 3, 0, 8, 6, 8, '#00f0ff', true, { emissive: '#00f0ff', emissiveIntensity: 3.5 });

    // Quantum Teleport Slipstream Gates (Port A <-> Port B)
    this.createTeleportPort('PortA', 'PortB', -22, 0, 0, new pc.Vec3(22, 1.0, 0), Math.PI / 2, '#00f0ff');
    this.createTeleportPort('PortB', 'PortA', 22, 0, 0, new pc.Vec3(-22, 1.0, 0), -Math.PI / 2, '#d946ef');

    // Floating Observation Platforms
    this.addBox(-15, 3.5, -15, 8, 0.5, 8, '#1f293d', true, { metalness: 0.6, gloss: 0.7 });
    this.addBox(15, 3.5, 15, 8, 0.5, 8, '#1f293d', true, { metalness: 0.6, gloss: 0.7 });
    this.addBox(-15, 3.5, 15, 8, 0.5, 8, '#1f293d', true, { metalness: 0.6, gloss: 0.7 });
    this.addBox(15, 3.5, -15, 8, 0.5, 8, '#1f293d', true, { metalness: 0.6, gloss: 0.7 });

    // Jump pads launching onto catwalk platforms
    this.createJumpPad(-15, 0, 0, 17.5);
    this.createJumpPad(15, 0, 0, 17.5);
  }

  // 7. Magma Foundry (Onyx Crucible over Molten Abyss)
  private buildMagmaFoundry(): void {
    this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    // Void hazard below y = 0
    this.hasGroundPlane = false;

    // Central Floating Crucible
    this.addBox(0, 0.5, 0, 16, 1.0, 16, '#3a1a1a', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(0, 2.0, 0, 6, 2.0, 6, '#ef4444', true, { emissive: '#ff3b00', emissiveIntensity: 3.0 });

    // 4 Corner Spawn Islands
    const d = 30;
    [-d, d].forEach((x) => {
      [-d, d].forEach((z) => {
        this.addBox(x, 0.5, z, 12, 1.0, 12, '#2d1515', true, { metalness: 0.3, gloss: 0.4 });
      });
    });

    // Jump pads launching into central crucible
    this.createJumpPad(-24, 1.0, -24, 18.0, 12, 12);
    this.createJumpPad(24, 1.0, -24, 18.0, -12, 12);
    this.createJumpPad(-24, 1.0, 24, 18.0, 12, -12);
    this.createJumpPad(24, 1.0, 24, 18.0, -12, -12);
  }

  // 8. Subzero Station (Arctic Freight Terminal)
  private buildSubzeroStation(): void {
    this.bounds = { minX: -60, maxX: 60, minZ: -45, maxZ: 45 };
    this.hasGroundPlane = true;

    // Snow Ground with icy gloss
    this.addBox(0, -0.1, 0, 120, 0.2, 90, '#dbeafe', false, { metalness: 0.1, gloss: 0.8 });

    // Train Station Tracks & Cargo Trains
    this.addBox(0, 1.5, -12, 35, 3.0, 4.5, '#475569', true, { metalness: 0.6, gloss: 0.6 }); // Train 1
    this.addBox(10, 1.5, 12, 30, 3.0, 4.5, '#334155', true, { metalness: 0.6, gloss: 0.6 }); // Train 2

    // Station Depot Platform & Roof
    this.addBox(-35, 1.0, 0, 16, 2.0, 40, '#1e293b', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(-35, 5.5, 0, 14, 0.4, 38, '#0f172a', true, { metalness: 0.7, gloss: 0.7 });

    // 4 Outer Satellite Radar Outposts matching SUBZERO_STATION_OBSTACLES
    this.addBox(40, 1.5, 40, 10, 3.0, 10, '#334155', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(40, 1.5, -40, 10, 3.0, 10, '#334155', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(-40, 1.5, 40, 10, 3.0, 10, '#334155', true, { metalness: 0.5, gloss: 0.6 });
    this.addBox(-40, 1.5, -40, 10, 3.0, 10, '#334155', true, { metalness: 0.5, gloss: 0.6 });

    // Snow Berms
    this.addBox(0, 1.25, -20, 12, 2.5, 4, '#e2e8f0', true, { metalness: 0.1, gloss: 0.4 });
    this.addBox(0, 1.25, 20, 12, 2.5, 4, '#e2e8f0', true, { metalness: 0.1, gloss: 0.4 });

    // Jump pads
    this.createJumpPad(-22, 0, 0, 17.5);
    this.createJumpPad(22, 0, 0, 17.5);
  }

  // 9. Sky Sanctuary (Floating Temple Shrines in Clouds)
  private buildSkySanctuary(): void {
    this.bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
    this.hasGroundPlane = true;

    // Sacred Cloud Platform
    this.addBox(0, -0.1, 0, 120, 0.2, 120, '#1e2638', false, { metalness: 0.1, gloss: 0.4 });

    // Central Shrine Pagoda
    this.addBox(0, 2.0, 0, 10, 4.0, 10, '#7f1d1d', true, { metalness: 0.3, gloss: 0.5 });
    this.addBox(0, 4.5, 0, 8, 0.8, 8, '#dc2626', true, { emissive: '#dc2626', emissiveIntensity: 1.5 });

    // Torii Arches (North & South)
    this.addBox(0, 2.5, -18, 8, 5.0, 0.8, '#b91c1c', false, { emissive: '#ef4444', emissiveIntensity: 1.2 });
    this.addBox(0, 2.5, 18, 8, 5.0, 0.8, '#b91c1c', false, { emissive: '#ef4444', emissiveIntensity: 1.2 });

    // Meditation Terraces (NW, NE, SW, SE)
    this.addBox(-26, 1.2, -26, 10, 2.4, 10, '#2d3748', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(26, 1.2, -26, 10, 2.4, 10, '#2d3748', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(-26, 1.2, 26, 10, 2.4, 10, '#2d3748', true, { metalness: 0.4, gloss: 0.5 });
    this.addBox(26, 1.2, 26, 10, 2.4, 10, '#2d3748', true, { metalness: 0.4, gloss: 0.5 });

    // Jump pads to Pagoda and terraces
    this.createJumpPad(0, 0, -10, 18.5);
    this.createJumpPad(0, 0, 10, 18.5);
    this.createJumpPad(-16, 0, 0, 17.0);
    this.createJumpPad(16, 0, 0, 17.0);
  }

  // 10. Orbital Station (Zero-G Space Hangar & Vantage Decks)
  private buildOrbitalStation(): void {
    this.bounds = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };
    this.hasGroundPlane = true;

    // Metallic Hull Grid
    this.addBox(0, -0.1, 0, 72, 0.2, 72, '#0c101c', false, { metalness: 0.7, gloss: 0.8 });

    // Perimeter Containment Bulkheads
    this.addBox(0, 5, 35, 72, 10, 2, '#151b2e', false, { metalness: 0.5, gloss: 0.6 });
    this.addBox(0, 5, -35, 72, 10, 2, '#151b2e', false, { metalness: 0.5, gloss: 0.6 });
    this.addBox(-35, 5, 0, 2, 10, 72, '#151b2e', false, { metalness: 0.5, gloss: 0.6 });
    this.addBox(35, 5, 0, 2, 10, 72, '#151b2e', false, { metalness: 0.5, gloss: 0.6 });

    // Central Gravity Core & Observation Spire
    this.addBox(0, 2.5, 0, 10, 5.0, 10, '#00f0ff', true, { emissive: '#00f0ff', emissiveIntensity: 3.5 });
    this.addBox(0, 0.4, 0, 16, 0.8, 16, '#1e293b', true, { metalness: 0.6, gloss: 0.7 });

    // Solar Control Terminal Wings
    this.addBox(-14.5, 1.6, 18, 7, 3.2, 8, '#2563eb', true, { metalness: 0.6, gloss: 0.7 });
    this.addBox(14.5, 1.6, -18, 7, 3.2, 8, '#dc2626', true, { metalness: 0.6, gloss: 0.7 });

    // Airlock Chambers
    this.addBox(-25, 1.8, 0, 6, 3.6, 12, '#1e293b', true, { metalness: 0.6, gloss: 0.6 });
    this.addBox(25, 1.8, 0, 6, 3.6, 12, '#1e293b', true, { metalness: 0.6, gloss: 0.6 });

    // Elevated Sniper Vantage Decks (y=3.75m)
    this.addBox(-12, 3.75, -15, 6, 0.3, 6, '#38bdf8', true, { metalness: 0.7, gloss: 0.8, emissive: '#0284c7', emissiveIntensity: 1.5 });
    this.addBox(12, 3.75, 15, 6, 0.3, 6, '#f43f5e', true, { metalness: 0.7, gloss: 0.8, emissive: '#e11d48', emissiveIntensity: 1.5 });

    // Gravity Lift Jump Pads
    this.createJumpPad(-12, 0, -8, 18.0, 0, -3.5);
    this.createJumpPad(12, 0, 8, 18.0, 0, 3.5);
  }

  public checkJumpPads(pos: { x: number; y: number; z: number } | pc.Vec3): { impulseY: number; impulseX: number; impulseZ: number } | null {
    const pt = pos instanceof pc.Vec3 ? pos : new pc.Vec3(pos.x, pos.y, pos.z);
    for (const jp of this.jumpPads) {
      if (jp.box.containsPoint(pt)) {
        return {
          impulseY: jp.impulseY,
          impulseX: jp.impulseX || 0,
          impulseZ: jp.impulseZ || 0
        };
      }
    }
    return null;
  }

  public checkTeleportPorts(pos: { x: number; y: number; z: number } | pc.Vec3, lastTeleportTime: number): PCTeleportPort | null {
    const now = performance.now();
    if (lastTeleportTime > 0 && now - lastTeleportTime < 1500) {
      return null;
    }
    const pt = pos instanceof pc.Vec3 ? pos : new pc.Vec3(pos.x, pos.y, pos.z);
    for (const port of this.teleportPorts) {
      if (port.box.containsPoint(pt)) {
        return port;
      }
    }
    return null;
  }

  public checkLadders(pos: { x: number; y: number; z: number } | pc.Vec3): pc.BoundingBox | null {
    const px = pos.x;
    const py = pos.y;
    const pz = pos.z;
    for (const box of this.ladderBoxes) {
      const min = box.getMin();
      const max = box.getMax();
      if (
        px >= min.x - 0.45 &&
        px <= max.x + 0.45 &&
        pz >= min.z - 0.45 &&
        pz <= max.z + 0.45 &&
        py >= min.y - 0.25 &&
        py <= max.y + 0.5
      ) {
        return box;
      }
    }
    return null;
  }

  // 11. Bio-Dome (Neo Arboretum)
  private buildBioDome(): void {
    this.bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Biosphere moss concrete floor
    this.addBox(0, -0.1, 0, 66, 0.2, 66, '#13281e', false, { metalness: 0.1, gloss: 0.4 });

    // Perimeter geodesic containment walls
    this.addBox(0, 4, 32, 66, 8, 2, '#182b22', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(0, 4, -32, 66, 8, 2, '#182b22', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(-32, 4, 0, 2, 8, 66, '#182b22', false, { metalness: 0.3, gloss: 0.4 });
    this.addBox(32, 4, 0, 2, 8, 66, '#182b22', false, { metalness: 0.3, gloss: 0.4 });

    // Central Hydroponic Spire (Glass tower with upper suspended ring)
    this.addBox(0, 3, 0, 8, 6, 8, '#2d4a3e', false, { metalness: 0.4, gloss: 0.7, emissive: '#10b981', emissiveIntensity: 0.5 });
    this.addBox(0, 6.8, 0, 16, 0.4, 16, '#38bdf8', true, { opacity: 0.85, emissive: '#0284c7', emissiveIntensity: 0.8 });

    // Terraced Botanical Planters
    this.addBox(0, 1.2, -18, 14, 2.4, 6, '#22543d', true, { gloss: 0.6 });
    this.addBox(0, 1.2, 18, 14, 2.4, 6, '#22543d', true, { gloss: 0.6 });
    this.addBox(-18, 1.2, 0, 6, 2.4, 14, '#22543d', true, { gloss: 0.6 });
    this.addBox(18, 1.2, 0, 6, 2.4, 14, '#22543d', true, { gloss: 0.6 });

    // Research Stations
    this.addBox(-16, 1.5, -16, 6, 3, 6, '#f8fafc', true, { metalness: 0.2, gloss: 0.8 });
    this.addBox(16, 1.5, 16, 6, 3, 6, '#f8fafc', true, { metalness: 0.2, gloss: 0.8 });

    // Planter Jump Pads launching toward Upper Ring
    this.createJumpPad(0, 2.4, -18, 17.0, 0, 6);
    this.createJumpPad(0, 2.4, 18, 17.0, 0, -6);
  }

  // 12. Metro Underpass (Neon Subways)
  private buildMetroUnderpass(): void {
    this.bounds = { minX: -30, maxX: 30, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Sunken Track Bed
    this.addBox(0, -0.2, 0, 12, 0.4, 64, '#11141c', false, { metalness: 0.5, gloss: 0.3 });
    this.addBox(-2, 0.05, 0, 0.3, 0.1, 64, '#71717a', false, { metalness: 0.9, gloss: 0.6 });
    this.addBox(2, 0.05, 0, 0.3, 0.1, 64, '#71717a', false, { metalness: 0.9, gloss: 0.6 });

    // West and East Passenger Platforms
    this.addBox(-18, 0.6, 0, 14, 1.2, 64, '#27272a', true, { metalness: 0.2, gloss: 0.4 });
    this.addBox(18, 0.6, 0, 14, 1.2, 64, '#27272a', true, { metalness: 0.2, gloss: 0.4 });

    // Perimeter Tunnel Walls
    this.addBox(0, 4, 32, 60, 8, 2, '#090d16', false);
    this.addBox(0, 4, -32, 60, 8, 2, '#090d16', false);
    this.addBox(-26, 4, 0, 2, 8, 64, '#090d16', false);
    this.addBox(26, 4, 0, 2, 8, 64, '#090d16', false);

    // Stationary Subway Train Cars (Walkable elevated cover)
    this.addBox(0, 1.8, -14, 4.2, 3.2, 16, '#0284c7', true, { metalness: 0.7, gloss: 0.6 });
    this.addBox(0, 1.8, 14, 4.2, 3.2, 16, '#0284c7', true, { metalness: 0.7, gloss: 0.6 });

    // Station Columns
    this.addBox(-12, 3, -16, 1.5, 6, 1.5, '#3f3f46');
    this.addBox(-12, 3, 16, 1.5, 6, 1.5, '#3f3f46');
    this.addBox(12, 3, -16, 1.5, 6, 1.5, '#3f3f46');
    this.addBox(12, 3, 16, 1.5, 6, 1.5, '#3f3f46');

    // Overhead Footbridges
    this.addBox(0, 4.5, -24, 28, 0.4, 4, '#18181b', true);
    this.addBox(0, 4.5, 24, 28, 0.4, 4, '#18181b', true);

    // Track bed jump pads
    this.createJumpPad(0, 0.0, -4, 16.0, 0, -6);
    this.createJumpPad(0, 0.0, 4, 16.0, 0, 6);
  }

  // 13. Sunken Atoll (Ancient Coral Ruins)
  private buildSunkenAtoll(): void {
    this.bounds = { minX: -34, maxX: 34, minZ: -34, maxZ: 34 };
    this.hasGroundPlane = true;

    // Lagoon Water Floor
    this.addBox(0, -0.1, 0, 70, 0.2, 70, '#0e7490', false, { metalness: 0.3, gloss: 0.85, emissive: '#0891b2', emissiveIntensity: 0.4 });

    // Central Temple Altar
    this.addBox(0, 0.8, 0, 16, 1.6, 16, '#d6d3d1', true, { metalness: 0.1, gloss: 0.3 });
    this.addBox(0, 3.8, -8, 8, 4.4, 2, '#a8a29e', false);
    this.addBox(0, 3.8, 8, 8, 4.4, 2, '#a8a29e', false);

    // Sandy Dunes & Coral Bastions
    this.addBox(-20, 1.0, 0, 8, 2.0, 24, '#fef08a', true, { metalness: 0.05, gloss: 0.2 });
    this.addBox(20, 1.0, 0, 8, 2.0, 24, '#fef08a', true, { metalness: 0.05, gloss: 0.2 });
    this.addBox(0, 1.2, -22, 14, 2.4, 8, '#78716c', true);
    this.addBox(0, 1.2, 22, 14, 2.4, 8, '#78716c', true);

    // Perimeter Reef Barriers
    this.addBox(0, 3, 34, 70, 6, 2, '#155e75', false);
    this.addBox(0, 3, -34, 70, 6, 2, '#155e75', false);
    this.addBox(-34, 3, 0, 2, 6, 70, '#155e75', false);
    this.addBox(34, 3, 0, 2, 6, 70, '#155e75', false);

    // Jump pads from sand dunes to temple altar
    this.createJumpPad(-14, 2.0, 0, 15.0, 8, 0);
    this.createJumpPad(14, 2.0, 0, 15.0, -8, 0);
  }

  // 14. Scrapyard Canyon (Rust Basin)
  private buildScrapyardCanyon(): void {
    this.bounds = { minX: -34, maxX: 34, minZ: -34, maxZ: 34 };
    this.hasGroundPlane = true;

    // Rust Basin Floor
    this.addBox(0, -0.1, 0, 70, 0.2, 70, '#451a03', false, { metalness: 0.2, gloss: 0.3 });

    // Canyon Rim Ridges
    this.addBox(-26, 4, 0, 10, 8, 70, '#78350f', false);
    this.addBox(26, 4, 0, 10, 8, 70, '#78350f', false);
    this.addBox(0, 4, -30, 70, 8, 8, '#78350f', false);
    this.addBox(0, 4, 30, 70, 8, 8, '#78350f', false);

    // Central Crane Tower & Walkway
    this.addBox(0, 3.5, 0, 4, 7, 4, '#ea580c', false, { metalness: 0.8, gloss: 0.5 });
    this.addBox(0, 4.8, 0, 24, 0.4, 5, '#292524', true);

    // Scrapped Container Clusters
    this.addBox(-12, 1.5, -12, 6, 3, 10, '#b91c1c', true);
    this.addBox(12, 1.5, 12, 6, 3, 10, '#1d4ed8', true);
    this.addBox(-10, 1.5, 12, 8, 3, 6, '#b45309', true);
    this.addBox(10, 1.5, -12, 8, 3, 6, '#047857', true);

    // Jump pads
    this.createJumpPad(0, 0.0, 8, 18.0, 0, -6);
    this.createJumpPad(-20, 0.0, -16, 17.0, 8, 6);
  }

  // 15. Solar Relay (Helios Mirror Array)
  private buildSolarRelay(): void {
    this.bounds = { minX: -35, maxX: 35, minZ: -35, maxZ: 35 };
    this.hasGroundPlane = false; // Void abyss below!

    // Central Relay Hub Platform
    this.addBox(0, -0.5, 0, 18, 1, 18, '#0f172a', true, { metalness: 0.7, gloss: 0.8 });
    this.addBox(0, 5, 0, 3, 10, 3, '#38bdf8', false, { emissive: '#0284c7', emissiveIntensity: 2.2 });

    // Solar Mirror Platforms (Floating wings)
    this.addBox(-20, 2.0, 0, 12, 1, 20, '#0284c7', true, { metalness: 0.95, gloss: 0.95, emissive: '#38bdf8', emissiveIntensity: 0.5 });
    this.addBox(20, 2.0, 0, 12, 1, 20, '#0284c7', true, { metalness: 0.95, gloss: 0.95, emissive: '#38bdf8', emissiveIntensity: 0.5 });
    this.addBox(0, 3.0, -22, 14, 1, 8, '#1e293b', true);
    this.addBox(0, 3.0, 22, 14, 1, 8, '#1e293b', true);

    // Teleport Portals between Mirror Wings
    this.createTeleportPort('Port_W', 'Port_E', -18, 2.0, 0, new pc.Vec3(18, 2.5, 0), -Math.PI / 2, '#38bdf8');
    this.createTeleportPort('Port_E', 'Port_W', 18, 2.0, 0, new pc.Vec3(-18, 2.5, 0), Math.PI / 2, '#38bdf8');

    // Void Crossing Jump Pads
    this.createJumpPad(0, 0.0, -7, 18.0, 0, -12);
    this.createJumpPad(0, 0.0, 7, 18.0, 0, 12);
  }

  // 16. Skyline Penthouse (Vertigo Lounge)
  private buildSkylinePenthouse(): void {
    this.bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Indoor Lounge Marble Floor
    this.addBox(-12, -0.1, 0, 24, 0.2, 48, '#0f172a', false, { metalness: 0.6, gloss: 0.9 });
    this.addBox(-16, 3.8, 0, 14, 0.4, 40, '#1e293b', true);

    // Bar Counter & Elevator Shaft
    this.addBox(-8, 0.6, 0, 2, 1.2, 12, '#e11d48', true, { emissive: '#e11d48', emissiveIntensity: 1.2 });
    this.addBox(-22, 4, 0, 4, 8, 8, '#020617', false);

    // Outdoor Helipad Deck
    this.addBox(14, -0.1, 0, 24, 0.2, 48, '#18181b', false, { metalness: 0.3, gloss: 0.5 });
    this.addBox(14, 0.02, 0, 12, 0.04, 12, '#f59e0b', false, { emissive: '#f59e0b', emissiveIntensity: 1.0 });

    // Glass Balcony Perimeters
    this.addBox(26, 0.6, 0, 0.4, 1.2, 48, '#38bdf8', false, { opacity: 0.5 });
    this.addBox(14, 0.6, 24, 24, 1.2, 0.4, '#38bdf8', false, { opacity: 0.5 });
    this.addBox(14, 0.6, -24, 24, 1.2, 0.4, '#38bdf8', false, { opacity: 0.5 });

    // High Billboard Gantry
    this.addBox(18, 6.5, -18, 10, 0.4, 4, '#334155', true);

    // Jump Pads
    this.createJumpPad(18, 0.0, -10, 19.0, 0, -6);
    this.createJumpPad(4, 0.0, 12, 17.0, -12, 0);
  }

  public getGroundLevel(pos: { x: number; y: number; z: number } | pc.Vec3): number {
    let highestGround = this.hasGroundPlane ? 0.0 : -100;
    const px = pos.x;
    const py = pos.y;
    const pz = pos.z;
    for (const roof of this.rooftopBoxes) {
      const min = roof.getMin();
      const max = roof.getMax();
      if (
        px >= min.x - 0.25 &&
        px <= max.x + 0.25 &&
        pz >= min.z - 0.25 &&
        pz <= max.z + 0.25 &&
        py >= max.y - 0.7 &&
        py <= max.y + 2.5
      ) {
        if (max.y > highestGround) {
          highestGround = max.y;
        }
      }
    }
    return highestGround;
  }

  public dispose(): void {
    this.mapRoot.destroy();
  }
}

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
}

export const SKY_THEMES: Record<string, SkyThemeConfig> = {
  twilight: {
    id: 'twilight',
    name: '🌆 Cyber Twilight',
    bgColor: '#031422',
    fogDensity: 0.0025
  },
  sunset: {
    id: 'sunset',
    name: '🌇 Golden Sunset',
    bgColor: '#d4501a',
    fogDensity: 0.002
  },
  sage: {
    id: 'sage',
    name: '🏙️ Emerald Sage',
    bgColor: '#374732',
    fogDensity: 0.0025
  }
};

export class PCMapBuilder {
  public app?: pc.Application;
  public mapRoot: pc.Entity;
  public collisionBoxes: pc.BoundingBox[] = [];
  public rooftopBoxes: pc.BoundingBox[] = [];
  public ladderBoxes: pc.BoundingBox[] = [];
  public jumpPads: PCJumpPad[] = [];
  public teleportPorts: PCTeleportPort[] = [];
  public hasGroundPlane: boolean = true;
  public bounds = { minX: -28, maxX: 28, minZ: -28, maxZ: 28 };
  public mapName: string;
  public skyTheme: string;

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
    }

    this.buildMap(mapName);
  }

  public addBox(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    colorHex: string = '#28314e',
    isWalkableRoof: boolean = false
  ): pc.BoundingBox {
    const box = new pc.BoundingBox(new pc.Vec3(x, y, z), new pc.Vec3(w / 2, h / 2, d / 2));
    this.collisionBoxes.push(box);
    if (isWalkableRoof) {
      this.rooftopBoxes.push(box);
    }

    if (this.app) {
      const ent = new pc.Entity('MapBox');
      const mat = new pc.StandardMaterial();
      mat.diffuse = new pc.Color().fromString(colorHex);
      mat.update();
      ent.addComponent('render', { type: 'box', material: mat });
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
      const baseMat = new pc.StandardMaterial();
      baseMat.diffuse = new pc.Color(0.1, 0.15, 0.25);
      baseMat.update();

      const glowMat = new pc.StandardMaterial();
      glowMat.diffuse = new pc.Color(0.0, 0.9, 1.0);
      glowMat.emissive = new pc.Color(0.0, 0.9, 1.0);
      glowMat.emissiveIntensity = 2.5;
      glowMat.update();

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
      const mat = new pc.StandardMaterial();
      const c = new pc.Color().fromString(colorHex);
      mat.diffuse = c;
      mat.emissive = c;
      mat.emissiveIntensity = 3.0;
      mat.opacity = 0.85;
      mat.blendType = pc.BLEND_ADDITIVE;
      mat.update();

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
      case 'Arena Classic':
        this.buildClassicArena();
        break;
      case 'Quantum Lab (Dimension)':
        this.buildQuantumLab();
        break;
      case 'Magma Foundry (Onyx)':
        this.buildMagmaFoundry();
        break;
      case 'Subzero Station':
        this.buildSubzeroStation();
        break;
      case 'Cartoon City':
        this.buildCartoonCity();
        break;
      default:
        this.buildFacilityArena();
        break;
    }
  }

  private buildFacilityArena(): void {
    this.bounds = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
    this.hasGroundPlane = true;

    // Heavy concrete floor grid
    this.addBox(0, -0.1, 0, 66, 0.2, 66, '#181b24');

    // Blue and Red Depot floor accents
    this.addBox(-22, 0.02, 0, 8, 0.05, 16, '#00d2ff');
    this.addBox(22, 0.02, 0, 8, 0.05, 16, '#ff2a55');

    // Perimeter Containment Walls
    this.addBox(0, 4, 32, 66, 8, 2, '#1e2230');
    this.addBox(0, 4, -32, 66, 8, 2, '#1e2230');
    this.addBox(-32, 4, 0, 2, 8, 66, '#1e2230');
    this.addBox(32, 4, 0, 2, 8, 66, '#1e2230');

    // Central Catwalk (at Y=3.35m, width 6m, length 24m)
    this.addBox(0, 3.35, 0, 6, 0.3, 24, '#2d3748', true);

    // Catwalk High Safety Railings
    this.addBox(-3, 3.9, 0, 0.2, 0.8, 24, '#ff9900');
    this.addBox(3, 3.9, 0, 0.2, 0.8, 24, '#ff9900');

    // Access Ramps (North & South)
    this.addBox(0, 0.6, -16.5, 5, 1.2, 3, '#3a4454', true);
    this.addBox(0, 1.8, -13.5, 5, 1.2, 3, '#3a4454', true);
    this.addBox(0, 3.0, -10.5, 5, 1.2, 3, '#3a4454', true);

    this.addBox(0, 0.6, 16.5, 5, 1.2, 3, '#3a4454', true);
    this.addBox(0, 1.8, 13.5, 5, 1.2, 3, '#3a4454', true);
    this.addBox(0, 3.0, 10.5, 5, 1.2, 3, '#3a4454', true);

    // 4 Structural Support Pillars
    this.addBox(-8, 5, -10, 2, 10, 2, '#1a202c');
    this.addBox(8, 5, -10, 2, 10, 2, '#1a202c');
    this.addBox(-8, 5, 10, 2, 10, 2, '#1a202c');
    this.addBox(8, 5, 10, 2, 10, 2, '#1a202c');

    // Shipping Containers
    this.addBox(-15, 1.5, -6.5, 6, 3, 3, '#2b4c7e', true);
    this.addBox(-15, 1.5, 6.5, 6, 3, 3, '#2b4c7e', true);
    this.addBox(15, 1.5, -6.5, 6, 3, 3, '#7e2b2b', true);
    this.addBox(15, 1.5, 6.5, 6, 3, 3, '#7e2b2b', true);

    // Cargo Crate Clusters
    this.addBox(-14.5, 1.1, -18.5, 3, 2.2, 3, '#4a5568', true);
    this.addBox(14.5, 1.1, -18.5, 3, 2.2, 3, '#4a5568', true);
    this.addBox(-14.5, 1.1, 18.5, 3, 2.2, 3, '#4a5568', true);
    this.addBox(14.5, 1.1, 18.5, 3, 2.2, 3, '#4a5568', true);
    this.addBox(0, 0.75, -5, 4, 1.5, 2, '#3182ce', true);
    this.addBox(0, 0.75, 5, 4, 1.5, 2, '#e53e3e', true);

    // Team Depot Bunker Covers
    this.addBox(-27.5, 1.25, 0, 1, 2.5, 12, '#1e2230', true);
    this.addBox(27.5, 1.25, 0, 1, 2.5, 12, '#1e2230', true);

    // Jump Pads (launching up to upper catwalk)
    this.createJumpPad(-9, 0, 0, 18.0, 3.5, 0);
    this.createJumpPad(9, 0, 0, 18.0, -3.5, 0);
  }

  private buildCartoonCity(): void {
    this.bounds = { minX: -60, maxX: 60, minZ: -60, maxZ: 60 };
    this.hasGroundPlane = true;

    // Base ground
    this.addBox(0, -0.1, 0, 130, 0.2, 130, '#141824');

    // Central Plaza fountain / cover
    this.addBox(0, 0.5, 0, 6, 1.0, 6, '#28314e', true);
    this.addBox(0, 1.5, 0, 3, 1.0, 3, '#00d2ff', true);

    // City Buildings (North, South, East, West blocks)
    this.addBox(-24, 6, -24, 18, 12, 18, '#1e2438', true);
    this.addBox(24, 7, -24, 18, 14, 18, '#1e2438', true);
    this.addBox(-24, 5, 24, 18, 10, 18, '#1e2438', true);
    this.addBox(24, 8, 24, 18, 16, 18, '#1e2438', true);

    // Vehicles / Low cover
    this.addBox(8, 0.75, 4, 2.2, 1.5, 4.5, '#ef4444', true);
    this.addBox(-8, 0.75, -6, 2.2, 1.5, 4.5, '#3b82f6', true);
    this.addBox(14, 0.6, -10, 2.0, 1.2, 4.0, '#f59e0b', true);
    this.addBox(-12, 0.6, 12, 2.0, 1.2, 4.0, '#10b981', true);

    // Jump pads to rooftops
    this.createJumpPad(-12, 0, -24, 18.0);
    this.createJumpPad(12, 0, -24, 19.5);
    this.createJumpPad(-12, 0, 24, 17.5);
    this.createJumpPad(12, 0, 24, 20.5);
  }

  private buildClassicArena(): void {
    this.bounds = { minX: -46, maxX: 46, minZ: -46, maxZ: 46 };
    this.hasGroundPlane = true;

    // Floor
    this.addBox(0, -0.1, 0, 96, 0.2, 96, '#1a1d2e');

    // Central Platform
    this.addBox(0, 1.25, 0, 12, 2.5, 12, '#28314e', true);
    this.addBox(0, 2.6, 0, 8, 0.2, 8, '#00d2ff', true);

    // 4 Symmetrical Cover Pillars around center
    const d = 14;
    [-d, d].forEach((x) => {
      [-d, d].forEach((z) => {
        this.addBox(x, 2.5, z, 3, 5, 3, '#ff2a55');
        this.addBox(x + (x > 0 ? -3 : 3), 1, z, 3, 2, 2, '#384260', true);
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
        this.addBox(bx, 1.5, bz, 10, 3.0, 10, '#242b44', true);
      });
    });

    this.createJumpPad(24, 0, 24, 17.0, 6, 6);
    this.createJumpPad(-24, 0, 24, 17.0, -6, 6);
    this.createJumpPad(24, 0, -24, 17.0, 6, -6);
    this.createJumpPad(-24, 0, -24, 17.0, -6, -6);
  }

  private buildQuantumLab(): void {
    this.bounds = { minX: -55, maxX: 55, minZ: -55, maxZ: 55 };
    this.hasGroundPlane = true;

    // Floor
    this.addBox(0, -0.1, 0, 110, 0.2, 110, '#0a101d');

    // Central Core Reactor
    this.addBox(0, 3, 0, 8, 6, 8, '#00f0ff', true);

    // Quantum Teleport Slipstream Gates (Port A <-> Port B)
    // Port A at (-22, 0, 0) exits at (+22, 1.0, 0) with yaw +PI/2
    this.createTeleportPort('PortA', 'PortB', -22, 0, 0, new pc.Vec3(22, 1.0, 0), Math.PI / 2, '#00f0ff');
    // Port B at (22, 0, 0) exits at (-22, 1.0, 0) with yaw -PI/2
    this.createTeleportPort('PortB', 'PortA', 22, 0, 0, new pc.Vec3(-22, 1.0, 0), -Math.PI / 2, '#d946ef');

    // Floating Platforms
    this.addBox(-15, 3.5, -15, 8, 0.5, 8, '#1f293d', true);
    this.addBox(15, 3.5, 15, 8, 0.5, 8, '#1f293d', true);
    this.addBox(-15, 3.5, 15, 8, 0.5, 8, '#1f293d', true);
    this.addBox(15, 3.5, -15, 8, 0.5, 8, '#1f293d', true);

    // Jump pads launching onto platforms
    this.createJumpPad(-15, 0, 0, 17.5);
    this.createJumpPad(15, 0, 0, 17.5);
  }

  private buildMagmaFoundry(): void {
    this.bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50 };
    // Void hazard below y = 0
    this.hasGroundPlane = false;

    // Central Floating Crucible
    this.addBox(0, 0.5, 0, 16, 1.0, 16, '#3a1a1a', true);
    this.addBox(0, 2.0, 0, 6, 2.0, 6, '#ef4444', true);

    // 4 Corner Spawn Islands
    const d = 30;
    [-d, d].forEach((x) => {
      [-d, d].forEach((z) => {
        this.addBox(x, 0.5, z, 12, 1.0, 12, '#2d1515', true);
      });
    });

    // Jump pads launching into central crucible
    this.createJumpPad(-24, 1.0, -24, 18.0, 12, 12);
    this.createJumpPad(24, 1.0, -24, 18.0, -12, 12);
    this.createJumpPad(-24, 1.0, 24, 18.0, 12, -12);
    this.createJumpPad(24, 1.0, 24, 18.0, -12, -12);
  }

  private buildSubzeroStation(): void {
    this.bounds = { minX: -60, maxX: 60, minZ: -45, maxZ: 45 };
    this.hasGroundPlane = true;

    // Snow Ground
    this.addBox(0, -0.1, 0, 120, 0.2, 90, '#dbeafe');

    // Train Station Tracks & Cargo Trains
    this.addBox(0, 1.5, -12, 35, 3.0, 4.5, '#475569', true); // Train 1
    this.addBox(10, 1.5, 12, 30, 3.0, 4.5, '#334155', true); // Train 2

    // Station Depot Platform & Roof
    this.addBox(-35, 1.0, 0, 16, 2.0, 40, '#1e293b', true);
    this.addBox(-35, 5.5, 0, 14, 0.4, 38, '#0f172a', true);

    // Jump pads
    this.createJumpPad(-22, 0, 0, 17.5);
    this.createJumpPad(22, 0, 0, 17.5);
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

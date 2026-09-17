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
  skyboxTexture?: string;
}

export const SKY_THEMES: Record<string, SkyThemeConfig> = {
  twilight: {
    id: 'twilight',
    name: '🌆 Cyber Twilight',
    bgColor: '#031422',
    fogDensity: 0.0022,
    sunColor: '#ffe5b4',
    ambientColor: '#1a233a',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-alien.png'
  },
  sunset: {
    id: 'sunset',
    name: '🌇 Golden Sunset',
    bgColor: '#d4501a',
    fogDensity: 0.002,
    sunColor: '#ffbb77',
    ambientColor: '#2b1a1a',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-morning.png'
  },
  sage: {
    id: 'sage',
    name: '🏙️ Emerald Sage',
    bgColor: '#1a2e26',
    fogDensity: 0.0025,
    sunColor: '#c8f5d0',
    ambientColor: '#13221e',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-day.png'
  },
  deepspace: {
    id: 'deepspace',
    name: '🌌 Deep Orbital Space',
    bgColor: '#050711',
    fogDensity: 0.0012,
    sunColor: '#99d5ff',
    ambientColor: '#0a1020',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-space.png'
  },
  subzero: {
    id: 'subzero',
    name: '❄️ Subzero Blizzard',
    bgColor: '#c8d9ea',
    fogDensity: 0.0035,
    sunColor: '#ffffff',
    ambientColor: '#7a8e9e',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-day.png'
  },
  biodome: {
    id: 'biodome',
    name: '🌿 Biosphere Emerald',
    bgColor: '#0d281e',
    fogDensity: 0.0022,
    sunColor: '#c8f5d0',
    ambientColor: '#13281e',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-day.png'
  },
  subway: {
    id: 'subway',
    name: '🚇 Dystopian Metro',
    bgColor: '#0a0e18',
    fogDensity: 0.003,
    sunColor: '#00d2ff',
    ambientColor: '#111827',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-night.png'
  },
  tropical: {
    id: 'tropical',
    name: '🏝️ Tropical Lagoon',
    bgColor: '#164e63',
    fogDensity: 0.0018,
    sunColor: '#fef08a',
    ambientColor: '#083344',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-morning.png'
  },
  canyon: {
    id: 'canyon',
    name: '🏜️ Rust Canyon',
    bgColor: '#431407',
    fogDensity: 0.0022,
    sunColor: '#fdba74',
    ambientColor: '#270e04',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-morning.png'
  },
  solar: {
    id: 'solar',
    name: '☀️ Stratosphere Solar',
    bgColor: '#020617',
    fogDensity: 0.0012,
    sunColor: '#ffffff',
    ambientColor: '#0f172a',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-space.png'
  },
  penthouse: {
    id: 'penthouse',
    name: '🍸 Vertigo Skyline',
    bgColor: '#090514',
    fogDensity: 0.0019,
    sunColor: '#e879f9',
    ambientColor: '#190a28',
    skyboxTexture: '/textures/skyboxes/kenney/skybox-night.png'
  }
};

export interface PBROptions {
  metalness?: number;
  gloss?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  blendType?: number;
  textureType?: 'panel' | 'metal' | 'floor' | 'none';
  tiling?: [number, number];
  bumpiness?: number;
}

export interface PlatformerAssetPlacement {
  asset: string;
  x: number;
  y: number;
  z: number;
  scaleX?: number;
  scaleY?: number;
  scaleZ?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
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
  public platformerPlacements: PlatformerAssetPlacement[] = [];
  public platformerEntities: pc.Entity[] = [];

  private static _panelNormalTex?: pc.Texture;
  private static _panelDetailTex?: pc.Texture;
  private static _floorGridNormalTex?: pc.Texture;
  private static _floorGridDetailTex?: pc.Texture;

  private static getPanelNormalTexture(device: pc.GraphicsDevice): pc.Texture | undefined {
    if (this._panelNormalTex) return this._panelNormalTex;
    if (typeof document === 'undefined') return undefined;

    try {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          let nx = 128;
          let ny = 128;
          let nz = 255;

          const borderDist = Math.min(x, y, size - 1 - x, size - 1 - y);
          if (borderDist < 3) {
            if (x < 3) nx = 75;
            else if (x >= size - 3) nx = 181;
            if (y < 3) ny = 181;
            else if (y >= size - 3) ny = 75;
            nz = 220;
          }

          const boltCenters = [[12, 12], [size - 13, 12], [12, size - 13], [size - 13, size - 13]];
          for (let b = 0; b < boltCenters.length; b++) {
            const bx = boltCenters[b][0];
            const by = boltCenters[b][1];
            const d = Math.hypot(x - bx, y - by);
            if (d < 4.0) {
              nx = Math.floor(128 + (x - bx) * 16);
              ny = Math.floor(128 - (y - by) * 16);
              nz = 210;
            }
          }

          const noise = ((x * 19 + y * 29) % 7) - 3;
          data[idx] = Math.max(0, Math.min(255, nx + noise));
          data[idx + 1] = Math.max(0, Math.min(255, ny + noise));
          data[idx + 2] = nz;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new pc.Texture(device, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_REPEAT,
        addressV: pc.ADDRESS_REPEAT
      });
      tex.setSource(canvas);
      this._panelNormalTex = tex;
      return tex;
    } catch {
      return undefined;
    }
  }

  private static getPanelDetailTexture(device: pc.GraphicsDevice): pc.Texture | undefined {
    if (this._panelDetailTex) return this._panelDetailTex;
    if (typeof document === 'undefined') return undefined;

    try {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.fillStyle = '#dcdde1';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#636e72';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, size - 2, size - 2);

      ctx.strokeStyle = '#f5f6fa';
      ctx.lineWidth = 1;
      ctx.strokeRect(4, 4, size - 8, size - 8);

      ctx.fillStyle = '#2d3436';
      const boltCenters = [[12, 12], [size - 13, 12], [12, size - 13], [size - 13, size - 13]];
      for (let b = 0; b < boltCenters.length; b++) {
        ctx.beginPath();
        ctx.arc(boltCenters[b][0], boltCenters[b][1], 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const tex = new pc.Texture(device, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_REPEAT,
        addressV: pc.ADDRESS_REPEAT
      });
      tex.setSource(canvas);
      this._panelDetailTex = tex;
      return tex;
    } catch {
      return undefined;
    }
  }

  private static getFloorGridNormalTexture(device: pc.GraphicsDevice): pc.Texture | undefined {
    if (this._floorGridNormalTex) return this._floorGridNormalTex;
    if (typeof document === 'undefined') return undefined;

    try {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      const imgData = ctx.createImageData(size, size);
      const data = imgData.data;

      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const idx = (y * size + x) * 4;
          let nx = 128;
          let ny = 128;
          let nz = 255;

          const gridX = x % 32;
          const gridY = y % 32;
          if (gridX < 2 || gridX >= 30) {
            nx = gridX < 2 ? 80 : 176;
            nz = 220;
          }
          if (gridY < 2 || gridY >= 30) {
            ny = gridY < 2 ? 176 : 80;
            nz = 220;
          }

          if ((x + y) % 16 < 3) {
            nx = 145;
            ny = 145;
            nz = 230;
          }

          data[idx] = nx;
          data[idx + 1] = ny;
          data[idx + 2] = nz;
          data[idx + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);

      const tex = new pc.Texture(device, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_REPEAT,
        addressV: pc.ADDRESS_REPEAT
      });
      tex.setSource(canvas);
      this._floorGridNormalTex = tex;
      return tex;
    } catch {
      return undefined;
    }
  }

  private static getFloorGridDetailTexture(device: pc.GraphicsDevice): pc.Texture | undefined {
    if (this._floorGridDetailTex) return this._floorGridDetailTex;
    if (typeof document === 'undefined') return undefined;

    try {
      const size = 128;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return undefined;

      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(0, 0, size, size);

      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      for (let i = 0; i <= size; i += 32) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, size);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(size, i);
        ctx.stroke();
      }

      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 1;
      for (let i = 0; i < size * 2; i += 16) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i - size, size);
        ctx.stroke();
      }

      const tex = new pc.Texture(device, {
        width: size,
        height: size,
        format: pc.PIXELFORMAT_RGBA8,
        mipmaps: true,
        minFilter: pc.FILTER_LINEAR_MIPMAP_LINEAR,
        magFilter: pc.FILTER_LINEAR,
        addressU: pc.ADDRESS_REPEAT,
        addressV: pc.ADDRESS_REPEAT
      });
      tex.setSource(canvas);
      this._floorGridDetailTex = tex;
      return tex;
    } catch {
      return undefined;
    }
  }

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

      if (theme.skyboxTexture) {
        this.createSkyDome(theme.skyboxTexture);
      }

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

  public skyDomeEntity?: pc.Entity;

  public createSkyDome(textureUrl?: string): void {
    if (!this.app || typeof document === 'undefined' || !textureUrl) return;

    try {
      const skyDome = new pc.Entity('KenneySkyDome');
      const skyMat = new pc.StandardMaterial();
      skyMat.cull = pc.CULLFACE_FRONT;
      skyMat.useLighting = false;

      const asset = new pc.Asset(`Skybox_${this.skyTheme}`, 'texture', { url: textureUrl });
      this.app.assets.add(asset);
      asset.ready((loaded) => {
        if (loaded.resource) {
          skyMat.diffuseMap = loaded.resource as pc.Texture;
          skyMat.emissiveMap = loaded.resource as pc.Texture;
          skyMat.emissiveIntensity = 1.0;
          skyMat.update();
        }
      });
      this.app.assets.load(asset);

      skyDome.addComponent('render', { type: 'sphere', material: skyMat });
      skyDome.setLocalScale(600, 600, 600);
      skyDome.setPosition(0, 0, 0);
      this.mapRoot.addChild(skyDome);
      this.skyDomeEntity = skyDome;
    } catch (e) {
      console.warn('[PCMapBuilder] SkyDome initialization fallback:', e);
    }
  }

  public updateSkyDome(camPos: pc.Vec3): void {
    if (this.skyDomeEntity) {
      this.skyDomeEntity.setPosition(camPos.x, camPos.y, camPos.z);
    }
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

    if (this.app?.graphicsDevice && typeof document !== 'undefined') {
      const type = pbr?.textureType ?? (pbr?.emissive ? 'none' : 'panel');
      if (type !== 'none') {
        const dev = this.app.graphicsDevice;
        if (type === 'floor') {
          const norm = PCMapBuilder.getFloorGridNormalTexture(dev);
          const detail = PCMapBuilder.getFloorGridDetailTexture(dev);
          if (norm) {
            mat.normalMap = norm;
            mat.bumpiness = pbr?.bumpiness ?? 0.45;
          }
          if (detail) {
            mat.diffuseMap = detail;
          }
        } else {
          const norm = PCMapBuilder.getPanelNormalTexture(dev);
          const detail = PCMapBuilder.getPanelDetailTexture(dev);
          if (norm) {
            mat.normalMap = norm;
            mat.bumpiness = pbr?.bumpiness ?? 0.35;
          }
          if (detail) {
            mat.diffuseMap = detail;
          }
        }
        const tiling = pbr?.tiling ?? [2, 2];
        mat.diffuseMapTiling = new pc.Vec2(tiling[0], tiling[1]);
        mat.normalMapTiling = new pc.Vec2(tiling[0], tiling[1]);
      }
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
      if (pbr?.opacity !== undefined || pbr?.emissive) {
        // Retain procedural primitives for glass and glowing lights
        const ent = new pc.Entity('MapBox');
        const mat = this.createPBRMaterial(colorHex, pbr);
        ent.addComponent('render', { type: 'box', material: mat });
        if (this.staticBatchGroupId !== undefined && ent.render) {
          ent.render.batchGroupId = this.staticBatchGroupId;
        }
        ent.setPosition(x, y, z);
        ent.setLocalScale(w, h, d);
        this.mapRoot.addChild(ent);
      } else {
        // Use Kenney platformer blocks for structural walls/floors
        let assetName = 'block-grass.glb';
        
        // Bullet Hell Theme Setup: Floors vs Wooden Panels
        const isWall = h > 2.0 || (h > w && h > d);
        if (isWall) {
          assetName = 'crate.glb'; // Wooden tiles for panels
        } else {
          if (this.skyTheme === 'subzero') assetName = 'block-snow.glb';
          else if (this.skyTheme === 'magma') assetName = 'block-moving.glb';
          else if (this.skyTheme === 'neon') assetName = 'block-moving-blue.glb';
          else assetName = 'block-grass.glb'; // Default to ground/floor tiles
        }

        // Procedural Bullet Hell Cover: Scatter trees on large bottom layers
        if (!isWall && y <= 2.0 && w > 8 && d > 8) {
           const numTrees = Math.floor((w * d) / 100);
           for (let i = 0; i < numTrees; i++) {
               const tx = x - w/2 + Math.random() * w;
               const tz = z - d/2 + Math.random() * d;
               this.addPlatformerProp(Math.random() > 0.5 ? 'tree.glb' : 'tree-pine.glb', tx, y + h/2, tz, 2.0);
               
               // NOTE: We don't add server colliders here because this is client-side, 
               // but the bullet hell projectiles can be configured to collide or pierce visually.
               // Actually, let's keep it simple. Visual cover is fine.
           }
        }

        // Tile the blocks across X and Z to avoid horrible stretching on large surfaces
        const BLOCK_SIZE = 2; // Assuming Kenney blocks are ~2x2
        const nx = Math.max(1, Math.round(w / BLOCK_SIZE));
        const nz = Math.max(1, Math.round(d / BLOCK_SIZE));
        
        // For walls, we should also tile vertically!
        const ny = isWall ? Math.max(1, Math.round(h / BLOCK_SIZE)) : 1;
        
        const actualBlockW = w / nx;
        const actualBlockH = h / ny;
        const actualBlockD = d / nz;
        
        const startX = x - w / 2 + actualBlockW / 2;
        const startY = isWall ? (y - h / 2 + actualBlockH / 2) : y;
        const startZ = z - d / 2 + actualBlockD / 2;
        
        for (let ix = 0; ix < nx; ix++) {
          for (let iy = 0; iy < ny; iy++) {
            for (let iz = 0; iz < nz; iz++) {
              const px = startX + ix * actualBlockW;
              const py = isWall ? startY + iy * actualBlockH : startY;
              const pz = startZ + iz * actualBlockD;
              this.addPlatformerProp(
                assetName,
                px, py, pz,
                actualBlockW,
                0, 0, 0,
                isWall ? actualBlockH : h, actualBlockD
              );
            }
          }
        }
      }
    }

    return box;
  }

  public addPlatformerProp(
    asset: string,
    x: number,
    y: number,
    z: number,
    scaleX: number = 1.0,
    rotY: number = 0,
    rotX: number = 0,
    rotZ: number = 0,
    scaleY?: number,
    scaleZ?: number
  ): void {
    this.platformerPlacements.push({
      asset,
      x,
      y,
      z,
      scaleX: scaleX,
      scaleY: scaleY ?? scaleX,
      scaleZ: scaleZ ?? scaleX,
      rotX,
      rotY,
      rotZ
    });
  }

  public async loadPlatformerAssets(loader: any): Promise<void> {
    if (!this.app || !loader || this.platformerPlacements.length === 0) return;

    const uniqueAssets = Array.from(new Set(this.platformerPlacements.map((p) => p.asset)));
    await Promise.all(
      uniqueAssets.map(async (assetName) => {
        try {
          const url = `/models/platformer/${assetName}`;
          await loader.load(url);
        } catch (err) {
          console.warn(`[PCMapBuilder] Could not preload platformer asset ${assetName}:`, err);
        }
      })
    );

    for (const p of this.platformerPlacements) {
      try {
        const url = `/models/platformer/${p.asset}`;
        const container = loader.get(url);
        if (container) {
          const ent = container.instantiateRenderEntity({ castShadows: true });
          ent.setPosition(p.x, p.y, p.z);
          ent.setLocalEulerAngles(p.rotX ?? 0, p.rotY ?? 0, p.rotZ ?? 0);
          ent.setLocalScale(p.scaleX ?? 1, p.scaleY ?? 1, p.scaleZ ?? 1);
          
          if (this.staticBatchGroupId !== undefined) {
            const renders = ent.findComponents('render');
            renders.forEach((r: any) => { r.batchGroupId = this.staticBatchGroupId; });
          }
          
          this.mapRoot.addChild(ent);
          this.platformerEntities.push(ent);
        }
      } catch (err) {
        console.warn(`[PCMapBuilder] Error instantiating platformer asset ${p.asset}:`, err);
      }
    }
  }

  public addLadder(x: number, y: number, z: number, h: number = 4.0, rotY: number = 0): pc.BoundingBox {
    const box = new pc.BoundingBox(new pc.Vec3(x, y + h / 2, z), new pc.Vec3(0.5, h / 2, 0.5));
    this.ladderBoxes.push(box);
    this.addPlatformerProp(h > 3.0 ? 'ladder-long.glb' : 'ladder.glb', x, y, z, 1.2, rotY);
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
    this.addPlatformerProp('spring.glb', x, y + 0.15, z, 1.6);

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
    this.platformerPlacements = [];

    switch (name) {
      case 'Cartoon City':
      case 'Neon Warehouse':
      case 'Urban Slums':
      case 'Metro Underpass':
      case 'Skyline Penthouse':
      case 'Metro Underpass (Neon Subways)':
      case 'Skyline Penthouse (Vertigo Lounge)':
        this.generateUrbanCity();
        break;
        
      case 'Bio-Dome':
      case 'Bio-Dome (Neo Arboretum)':
      case 'Sky Sanctuary':
      case 'Sky Islands':
      case 'Sunken Atoll':
      case 'Sunken Atoll (Ancient Coral Ruins)':
      case 'Scrapyard Canyon':
      case 'Scrapyard Canyon (Rust Basin)':
        this.generateNatureBiome();
        break;

      default:
        this.generateTechFacility();
        break;
    }
  }

  private generateUrbanCity(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = true;
    
    // Base Asphalt
    this.addBox(0, -0.1, 0, 300, 0.2, 300, '#11141e', false, { metalness: 0.1, gloss: 0.5 });
    
    // Grid of roads and buildings
    const gridSize = 10;
    for (let x = -140; x <= 140; x += gridSize) {
      for (let z = -140; z <= 140; z += gridSize) {
        // Leave center open
        if (Math.abs(x) < 20 && Math.abs(z) < 20) continue;
        
        const rand = Math.random();
        if (rand < 0.2) {
          // Intersection
          this.addPlatformerProp('road-asphalt-center.glb', x, 0, z, 1.2);
        } else if (rand < 0.4) {
          // Road straight
          this.addPlatformerProp('road-asphalt-straight.glb', x, 0, z, 1.2);
        } else if (rand < 0.7) {
          // Building
          const bldg = `building-${String.fromCharCode(97 + Math.floor(Math.random() * 10))}.glb`; // building-a to building-j
          // We can set collider height massive so players can grapple up
          this.addPlatformerProp(bldg, x, 0, z, 2.0 + Math.random() * 2.0);
          
          // Occasional roof jump pad
          if (Math.random() < 0.1) {
             this.createJumpPad(x, 15, z, 20); // rough roof height
          }
        }
      }
    }
    
    // Central Monument
    this.addBox(0, 5, 0, 10, 10, 10, '#00d2ff', true, { emissive: '#00d2ff', emissiveIntensity: 2.0 });
    this.createJumpPad(-12, 0, 0, 25);
    this.createJumpPad(12, 0, 0, 25);
    this.createJumpPad(0, 0, -12, 25);
    this.createJumpPad(0, 0, 12, 25);
  }

  private generateNatureBiome(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = true;
    
    // Base Grass/Dirt
    this.addBox(0, -0.1, 0, 300, 0.2, 300, '#14532d', false, { metalness: 0.05, gloss: 0.2 });
    
    // Scatter trees and ruins
    for (let i = 0; i < 600; i++) {
       const x = (Math.random() - 0.5) * 280;
       const z = (Math.random() - 0.5) * 280;
       if (Math.abs(x) < 20 && Math.abs(z) < 20) continue; // Keep center clear

       const r = Math.random();
       if (r < 0.3) {
           this.addPlatformerProp('tree-pine-large.glb', x, 0, z, 2.0 + Math.random() * 1.5);
       } else if (r < 0.6) {
           this.addPlatformerProp('tree-park-large.glb', x, 0, z, 1.5 + Math.random());
       } else if (r < 0.8) {
           this.addPlatformerProp('tree.glb', x, 0, z, 1.5 + Math.random());
       } else {
           // Ruins / ancient column
           this.addPlatformerProp('column-rounded.glb', x, 0, z, 2.0);
           this.addPlatformerProp('column.glb', x + 2, 0, z + 2, 2.0);
           if (Math.random() < 0.1) {
              this.createJumpPad(x, 0, z, 18);
           }
       }
    }
    
    // River / Void crevice
    this.addBox(0, -0.5, 0, 20, 0.1, 300, '#0891b2', false, { emissive: '#06b6d4', emissiveIntensity: 1.0 });
    this.createJumpPad(-15, 0, 0, 20, 15, 0);
    this.createJumpPad(15, 0, 0, 20, -15, 0);
  }

  private generateTechFacility(): void {
    this.bounds = { minX: -150, maxX: 150, minZ: -150, maxZ: 150 };
    this.hasGroundPlane = false; // Void underneath
    
    // Massive scaffolding platforms
    for (let i = 0; i < 80; i++) {
        const x = (Math.random() - 0.5) * 280;
        const z = (Math.random() - 0.5) * 280;
        const y = Math.random() * 25; // Massive verticality
        const w = 15 + Math.random() * 25;
        const d = 15 + Math.random() * 25;
        
        this.addBox(x, y, z, w, 1, d, '#1e293b', true, { metalness: 0.8, gloss: 0.7 });
        
        // Add random tech props from prototype-kit
        if (Math.random() < 0.5) {
            this.addPlatformerProp('barrel.glb', x, y + 0.5, z, 1.5);
        }
        if (Math.random() < 0.3) {
            this.addPlatformerProp('crate-color.glb', x + 2, y + 0.5, z - 2, 1.5);
        }
        
        // Jump pads connecting verticality
        if (Math.random() < 0.5) {
            this.createJumpPad(x, y + 0.5, z, 22);
        }
    }
    
    // Central Hub
    this.addBox(0, 0, 0, 50, 2, 50, '#0f172a', true, { metalness: 0.9, gloss: 0.9, emissive: '#0284c7', emissiveIntensity: 0.3 });
    this.addBox(0, 5, 0, 10, 20, 10, '#f43f5e', true, { emissive: '#e11d48', emissiveIntensity: 1.5 });
    this.createJumpPad(-12, 1, 0, 25);
    this.createJumpPad(12, 1, 0, 25);
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

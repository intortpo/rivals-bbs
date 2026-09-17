import * as pc from 'playcanvas';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export class PCRenderer {
  public app!: pc.Application;
  public cameraEntity!: pc.Entity;
  public sunEntity!: pc.Entity;
  public ambientLight!: pc.Entity;
  public viewmodelLight!: pc.Entity;
  public canvas!: HTMLCanvasElement;
  private currentQuality: GraphicsQuality = 'high';
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    if (typeof document !== 'undefined') {
      this.initApp();
      this.setupCamera();
      this.setupLighting();
      this.setupResize();
    }
  }

  private initApp(): void {
    this.canvas = document.createElement('canvas');
    this.canvas.id = 'pc-game-canvas';
    this.canvas.style.position = 'absolute';
    this.canvas.style.top = '0';
    this.canvas.style.left = '0';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.zIndex = '0';
    this.canvas.style.touchAction = 'none';
    this.container.appendChild(this.canvas);

    this.app = new pc.Application(this.canvas, {
      mouse: new pc.Mouse(this.canvas),
      touch: new pc.TouchDevice(this.canvas),
      keyboard: new pc.Keyboard(window)
    });

    this.app.setCanvasFillMode(pc.FILLMODE_FILL_WINDOW);
    this.app.setCanvasResolution(pc.RESOLUTION_AUTO);

    // Initial background color & fog
    this.app.scene.ambientLight = new pc.Color(0.2, 0.22, 0.28);
    this.app.scene.fog.type = pc.FOG_EXP2;
    this.app.scene.fog.color = new pc.Color(0.01, 0.08, 0.13); // Twilight #031422
    this.app.scene.fog.density = 0.0025;

    this.app.start();
  }

  private setupCamera(): void {
    this.cameraEntity = new pc.Entity('MainCamera');
    this.cameraEntity.addComponent('camera', {
      clearColor: new pc.Color(0.01, 0.08, 0.13),
      fov: 75,
      nearClip: 0.1,
      farClip: 500,
      frustumCulling: true
    });

    this.cameraEntity.setPosition(0, 1.6, 0);
    this.app.root.addChild(this.cameraEntity);

    // Dedicated viewmodel light so first-person weapon meshes are vibrantly lit
    this.viewmodelLight = new pc.Entity('ViewmodelLight');
    this.viewmodelLight.addComponent('light', {
      type: 'omni',
      color: new pc.Color(1, 1, 1),
      intensity: 1.2,
      range: 4,
      castShadows: false
    });
    this.viewmodelLight.setLocalPosition(0.25, 0.2, -0.3);
    this.cameraEntity.addChild(this.viewmodelLight);
  }

  private setupLighting(): void {
    // Directional Sun Light
    this.sunEntity = new pc.Entity('SunLight');
    this.sunEntity.addComponent('light', {
      type: 'directional',
      color: new pc.Color(1.0, 0.96, 0.88),
      intensity: 1.8,
      castShadows: true,
      shadowDistance: 65,
      shadowResolution: 1024,
      shadowBias: 0.05,
      normalOffsetBias: 0.05
    });
    this.sunEntity.setPosition(30, 45, 20);
    this.sunEntity.lookAt(new pc.Vec3(0, 0, 0));
    this.app.root.addChild(this.sunEntity);
  }

  private setupResize(): void {
    window.addEventListener('resize', this.onResize.bind(this));
    this.onResize();
  }

  public onResize(): void {
    if (!this.app || !this.canvas) return;
    this.app.resizeCanvas();
    const dpr = this.currentQuality === 'low' ? 1.0 : this.currentQuality === 'medium' ? 1.25 : Math.min(window.devicePixelRatio, 1.5);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
  }

  public applyGraphicsQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;
    if (!this.sunEntity?.light) return;

    if (quality === 'low') {
      this.sunEntity.light.castShadows = false;
      this.sunEntity.light.shadowResolution = 512;
    } else if (quality === 'medium') {
      this.sunEntity.light.castShadows = true;
      this.sunEntity.light.shadowResolution = 1024;
    } else {
      this.sunEntity.light.castShadows = true;
      this.sunEntity.light.shadowResolution = 2048;
    }

    this.onResize();
  }

  public setFov(fov: number): void {
    if (this.cameraEntity?.camera) {
      this.cameraEntity.camera.fov = fov;
    }
  }

  public setFog(colorHex: string, density: number): void {
    if (!this.app) return;
    const c = new pc.Color();
    c.fromString(colorHex);
    this.app.scene.fogColor = c;
    this.app.scene.fogDensity = density;
    if (this.cameraEntity?.camera) {
      this.cameraEntity.camera.clearColor = c;
    }
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    if (this.app) {
      this.app.destroy();
    }
    if (this.canvas?.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

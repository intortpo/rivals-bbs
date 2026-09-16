import * as THREE from 'three';

export type GraphicsQuality = 'low' | 'medium' | 'high';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private sunLight!: THREE.DirectionalLight;
  private currentQuality: GraphicsQuality = 'high';

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#161823');
    this.scene.fog = new THREE.FogExp2('#161823', 0.012);

    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      500
    );
    this.camera.rotation.order = 'YXZ'; // FPS camera rotation order

    // CRITICAL: In Three.js, camera must be in scene for camera children (viewmodel) to render!
    this.scene.add(this.camera);

    // Dedicated viewmodel light so weapons are always visible and illuminated
    const vmLight = new THREE.PointLight('#ffffff', 1.2, 4);
    vmLight.position.set(0.25, 0.2, -0.3);
    this.camera.add(vmLight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });

    // Default to high quality with capped DPR (1.5) to avoid mobile retina fill-rate penalties
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private setupLighting(): void {
    // Ambient light
    const ambient = new THREE.AmbientLight('#ffffff', 0.85);
    this.scene.add(ambient);

    // Sun directional light with shadows
    this.sunLight = new THREE.DirectionalLight('#fff5e0', 1.8);
    this.sunLight.position.set(30, 45, 20);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 120;

    const d = 35;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0005;

    this.scene.add(this.sunLight);

    // Blue ground bounce hemisphere light
    const hemi = new THREE.HemisphereLight('#88c0d0', '#2e3440', 0.6);
    this.scene.add(hemi);
  }

  public applyGraphicsQuality(quality: GraphicsQuality): void {
    this.currentQuality = quality;

    if (quality === 'low') {
      this.renderer.shadowMap.enabled = false;
      if (this.sunLight) this.sunLight.castShadow = false;
      this.renderer.setPixelRatio(1.0);
    } else if (quality === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.BasicShadowMap;
      if (this.sunLight) this.sunLight.castShadow = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.25));
      this.renderer.shadowMap.needsUpdate = true;
    } else {
      // High
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      if (this.sunLight) this.sunLight.castShadow = true;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      this.renderer.shadowMap.needsUpdate = true;
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    const maxDpr = this.currentQuality === 'low' ? 1.0 : this.currentQuality === 'medium' ? 1.25 : 1.5;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxDpr));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public setFov(targetFov: number): void {
    this.camera.fov = targetFov;
    this.camera.updateProjectionMatrix();
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResize.bind(this));
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}

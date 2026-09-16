import * as THREE from 'three';

export class Renderer {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

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

    // Mobile performance: clamp pixel ratio to 2
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
    const sun = new THREE.DirectionalLight('#fff5e0', 1.8);
    sun.position.set(30, 45, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 120;

    const d = 35;
    sun.shadow.camera.left = -d;
    sun.shadow.camera.right = d;
    sun.shadow.camera.top = d;
    sun.shadow.camera.bottom = -d;
    sun.shadow.bias = -0.0005;

    this.scene.add(sun);

    // Blue ground bounce hemisphere light
    const hemi = new THREE.HemisphereLight('#88c0d0', '#2e3440', 0.6);
    this.scene.add(hemi);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
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

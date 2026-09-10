import * as THREE from 'three';

export class Engine {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly clock: THREE.Clock;

  private updateCallbacks: Array<(delta: number) => void> = [];

  constructor(canvas: HTMLCanvasElement) {
    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // sky blue

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.position.set(0, 5, 10);
    this.camera.lookAt(0, 1, 0);

    // Clock
    this.clock = new THREE.Clock();

    // Lighting
    this.setupLighting();

    // Ground
    this.setupGround();

    // Resize
    window.addEventListener('resize', this.onResize);
  }

  private setupLighting(): void {
    // Hemisphere light — sky/ground ambient
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x8b4513, 0.6);
    hemi.position.set(0, 50, 0);
    this.scene.add(hemi);

    // Directional light — sun
    const sun = new THREE.DirectionalLight(0xffffcc, 1.5);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 2048;
    sun.shadow.mapSize.height = 2048;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -20;
    sun.shadow.camera.right = 20;
    sun.shadow.camera.top = 20;
    sun.shadow.camera.bottom = -20;
    sun.shadow.bias = -0.0001;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
  }

  private setupGround(): void {
    const groundGeo = new THREE.PlaneGeometry(100, 100);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4a7c4f,
      roughness: 0.8,
      metalness: 0.0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
  }

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  onUpdate(callback: (delta: number) => void): void {
    this.updateCallbacks.push(callback);
  }

  start(): void {
    const loop = (): void => {
      requestAnimationFrame(loop);
      const delta = this.clock.getDelta();
      for (const cb of this.updateCallbacks) {
        cb(delta);
      }
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
  }
}

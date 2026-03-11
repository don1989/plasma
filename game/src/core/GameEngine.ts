import * as THREE from 'three';

export interface Updatable {
  update(dt: number): void;
}

export class GameEngine {
  private clock = new THREE.Clock();
  private updatables: Updatable[] = [];

  constructor(
    private renderer: THREE.WebGLRenderer,
    private scene: THREE.Scene,
    private camera: THREE.Camera,
  ) {}

  register(obj: Updatable): void {
    this.updatables.push(obj);
  }

  start(): void {
    this.clock.start();
    this.tick();
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const dt = Math.min(this.clock.getDelta(), 0.1); // cap to prevent spiral
    for (const obj of this.updatables) {
      obj.update(dt);
    }
    this.renderer.render(this.scene, this.camera);
  };
}

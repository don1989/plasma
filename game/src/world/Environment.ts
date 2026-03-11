import * as THREE from 'three';
import type { Updatable } from '../core/GameEngine.ts';
import { createCelMaterial } from '../shaders/cel-shader.ts';

export class Environment implements Updatable {
  constructor(scene: THREE.Scene) {
    // -- Sky --
    scene.background = new THREE.Color(0xeea8c4); // pink sky (Terra)
    scene.fog = new THREE.Fog(0xeea8c4, 50, 200); // fade to sky at distance

    // -- Ground plane (Terra blue grass) --
    const groundGeo = new THREE.PlaneGeometry(400, 400);
    const groundMat = createCelMaterial({ color: 0x3a8a6e, steps: 2 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // -- Dev grid --
    const grid = new THREE.GridHelper(400, 80, 0x2a6a5e, 0x2a6a5e);
    grid.position.y = 0.01; // slight offset to avoid z-fighting
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.2;
    scene.add(grid);

    // -- Directional light (sun) --
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.5);
    sun.position.set(50, 100, 30);
    sun.castShadow = true;
    sun.shadow.mapSize.setScalar(2048);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 200;
    sun.shadow.camera.left = -50;
    sun.shadow.camera.right = 50;
    sun.shadow.camera.top = 50;
    sun.shadow.camera.bottom = -50;
    scene.add(sun);

    // -- Hemisphere light (ambient fill) --
    const hemi = new THREE.HemisphereLight(
      0xeea8c4, // sky color (pink)
      0x3a8a6e, // ground color (blue-green)
      0.6,
    );
    scene.add(hemi);
  }

  update(_dt: number): void {
    // Future: day/night cycle, weather, ambient effects
  }
}

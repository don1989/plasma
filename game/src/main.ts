import * as THREE from 'three';
import { Engine } from './engine/Engine.js';
import { AssetLoader } from './engine/AssetLoader.js';
import { CharacterController } from './character/CharacterController.js';
import { InputManager } from './input/InputManager.js';
import { ThirdPersonCamera } from './camera/ThirdPersonCamera.js';

async function main(): Promise<void> {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) throw new Error('Canvas not found');

  // Engine
  const engine = new Engine(canvas);

  // Input
  const input = new InputManager();

  // Try to load Spyke character
  const assetLoader = new AssetLoader();
  let character: CharacterController | null = null;
  let thirdPersonCam: ThirdPersonCamera | null = null;

  try {
    const loaded = await assetLoader.loadCharacter('/assets/models/spyke/spyke.manifest.json');
    character = new CharacterController(loaded);
    engine.scene.add(character.group);

    // Third-person camera follows the character
    thirdPersonCam = new ThirdPersonCamera(engine.camera, character.group);

    console.log('Spyke loaded successfully');
  } catch (e) {
    console.warn('No character model found — running empty scene. Place spyke.glb + spyke.manifest.json in public/assets/models/spyke/');
    console.warn(e);

    // Without a character, just set a default camera position
    engine.camera.position.set(0, 5, 10);
    engine.camera.lookAt(0, 0, 0);
  }

  // Game loop
  engine.onUpdate((delta) => {
    // Poll input
    input.update();

    if (character && thirdPersonCam) {
      // Camera-relative movement
      const forward = thirdPersonCam.getForwardDirection();
      const right = thirdPersonCam.getRightDirection();

      const moveDir = new THREE.Vector3();
      moveDir.addScaledVector(forward, input.moveDirection.y);
      moveDir.addScaledVector(right, input.moveDirection.x);

      character.move(moveDir, input.sprinting);
      character.update(delta);

      // Camera
      thirdPersonCam.applyGamepadInput(
        input.cameraInput.x,
        input.cameraInput.y,
        delta,
      );
      thirdPersonCam.update(delta);
    }
  });

  engine.start();
  console.log('Plasma Game started — WASD to move, mouse drag to orbit camera, Shift to sprint');
}

main().catch(console.error);

import * as THREE from 'three';
import type { Updatable } from '../core/GameEngine.ts';
import type { InputManager } from '../core/InputManager.ts';
import { createCelMaterial } from '../shaders/cel-shader.ts';

const MOVE_SPEED = 8;
const MOUSE_SENSITIVITY = 0.002;
const CAMERA_DISTANCE = 5;
const CAMERA_HEIGHT = 2.5;
const PITCH_MIN = -Math.PI / 6; // ~30 deg down
const PITCH_MAX = Math.PI / 3; // ~60 deg up

export class PlayerController implements Updatable {
  readonly mesh: THREE.Mesh;
  private yaw = 0;
  private pitch = 0.3; // slight downward look initially

  constructor(
    scene: THREE.Scene,
    private camera: THREE.PerspectiveCamera,
    private input: InputManager,
  ) {
    const geometry = new THREE.CapsuleGeometry(0.4, 1.0, 8, 16);
    const material = createCelMaterial({ color: 0x4488ff });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.position.set(0, 1.0, 0); // half-height above ground
    this.mesh.castShadow = true;
    scene.add(this.mesh);
  }

  update(dt: number): void {
    // -- Camera orbit from mouse --
    const mouseDelta = this.input.consumeMouseDelta();
    this.yaw -= mouseDelta.x * MOUSE_SENSITIVITY;
    this.pitch -= mouseDelta.y * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, PITCH_MIN, PITCH_MAX);

    // -- Movement relative to camera yaw --
    const forward = new THREE.Vector3(0, 0, -1);
    const right = new THREE.Vector3(1, 0, 0);
    const yawQuat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      this.yaw,
    );
    forward.applyQuaternion(yawQuat);
    right.applyQuaternion(yawQuat);

    const moveDir = new THREE.Vector3();
    if (this.input.isKeyDown('w')) moveDir.add(forward);
    if (this.input.isKeyDown('s')) moveDir.sub(forward);
    if (this.input.isKeyDown('a')) moveDir.sub(right);
    if (this.input.isKeyDown('d')) moveDir.add(right);

    if (moveDir.lengthSq() > 0) {
      moveDir.normalize();
      this.mesh.position.addScaledVector(moveDir, MOVE_SPEED * dt);

      // Rotate capsule to face movement direction
      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      this.mesh.rotation.y = targetAngle;
    }

    // -- Position camera behind player --
    const cameraOffset = new THREE.Vector3(0, 0, CAMERA_DISTANCE);
    cameraOffset.applyAxisAngle(new THREE.Vector3(1, 0, 0), -this.pitch);
    cameraOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

    this.camera.position.copy(this.mesh.position).add(cameraOffset);
    this.camera.position.y += CAMERA_HEIGHT;
    this.camera.lookAt(
      this.mesh.position.x,
      this.mesh.position.y + 1.0, // look at chest height
      this.mesh.position.z,
    );
  }
}

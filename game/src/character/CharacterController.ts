import * as THREE from 'three';
import type { LoadedCharacter } from '../engine/AssetLoader.js';
import { AnimationFSM } from './AnimationFSM.js';

const WALK_SPEED = 1.5;
const RUN_SPEED = 3.0;
const SPRINT_SPEED = 5.0;
const ROTATION_SPEED = 10.0;

export class CharacterController {
  readonly group: THREE.Group;
  private animFSM: AnimationFSM;
  private velocity = new THREE.Vector3();
  private currentSpeed = 0;

  constructor(character: LoadedCharacter) {
    this.group = character.group;

    const mixer = new THREE.AnimationMixer(this.group);
    this.animFSM = new AnimationFSM(mixer, character.clips, character.manifest);
  }

  /**
   * Move the character based on input direction (relative to camera).
   * @param direction - Normalized XZ direction vector (world space)
   * @param sprinting - Whether the sprint button is held
   */
  move(direction: THREE.Vector3, sprinting: boolean): void {
    const inputMagnitude = direction.length();

    if (inputMagnitude < 0.01) {
      this.currentSpeed = 0;
      this.velocity.set(0, 0, 0);
      return;
    }

    // Determine target speed based on input magnitude and sprint
    let targetSpeed: number;
    if (sprinting) {
      targetSpeed = SPRINT_SPEED;
    } else if (inputMagnitude > 0.7) {
      targetSpeed = RUN_SPEED;
    } else {
      targetSpeed = WALK_SPEED;
    }

    this.currentSpeed = targetSpeed;
    this.velocity.copy(direction).normalize().multiplyScalar(targetSpeed);
  }

  update(delta: number): void {
    // Apply movement
    if (this.velocity.lengthSq() > 0.001) {
      this.group.position.addScaledVector(this.velocity, delta);

      // Rotate toward movement direction
      const targetAngle = Math.atan2(this.velocity.x, this.velocity.z);
      const currentAngle = this.group.rotation.y;

      // Shortest angle difference
      let angleDiff = targetAngle - currentAngle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

      this.group.rotation.y += angleDiff * Math.min(1, ROTATION_SPEED * delta);
    }

    // Update animation based on speed
    this.animFSM.updateFromSpeed(this.currentSpeed);
    this.animFSM.update(delta);
  }

  get position(): THREE.Vector3 {
    return this.group.position;
  }
}

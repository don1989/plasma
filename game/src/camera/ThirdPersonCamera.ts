import * as THREE from 'three';

const DEFAULT_DISTANCE = 8;
const DEFAULT_HEIGHT = 4;
const DEFAULT_LOOK_AT_HEIGHT = 1.5;
const MOUSE_SENSITIVITY = 0.003;
const GAMEPAD_SENSITIVITY = 2.0;
const CAMERA_LERP_SPEED = 5.0;
const MIN_PITCH = -0.3; // Don't look too far down
const MAX_PITCH = 1.2; // Don't look too far up

export class ThirdPersonCamera {
  private camera: THREE.PerspectiveCamera;
  private target: THREE.Object3D;

  private yaw = 0; // Horizontal angle
  private pitch = 0.3; // Vertical angle
  private distance = DEFAULT_DISTANCE;

  private currentPosition = new THREE.Vector3();
  private currentLookAt = new THREE.Vector3();

  // Mouse drag state
  private isDragging = false;
  private previousMouse = new THREE.Vector2();

  constructor(camera: THREE.PerspectiveCamera, target: THREE.Object3D) {
    this.camera = camera;
    this.target = target;

    // Initialize position
    this.currentPosition.copy(this.calculateIdealPosition());
    this.camera.position.copy(this.currentPosition);

    // Mouse controls
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('wheel', this.onWheel);

    // Prevent context menu on right-click
    window.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button === 0 || e.button === 2) {
      this.isDragging = true;
      this.previousMouse.set(e.clientX, e.clientY);
    }
  };

  private onMouseUp = (_e: MouseEvent): void => {
    this.isDragging = false;
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this.isDragging) return;

    const dx = e.clientX - this.previousMouse.x;
    const dy = e.clientY - this.previousMouse.y;
    this.previousMouse.set(e.clientX, e.clientY);

    this.yaw -= dx * MOUSE_SENSITIVITY;
    this.pitch += dy * MOUSE_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(this.pitch, MIN_PITCH, MAX_PITCH);
  };

  private onWheel = (e: WheelEvent): void => {
    this.distance += e.deltaY * 0.01;
    this.distance = THREE.MathUtils.clamp(this.distance, 3, 20);
  };

  /**
   * Apply gamepad right stick input for camera orbit.
   */
  applyGamepadInput(x: number, y: number, delta: number): void {
    if (Math.abs(x) < 0.01 && Math.abs(y) < 0.01) return;
    this.yaw -= x * GAMEPAD_SENSITIVITY * delta;
    this.pitch += y * GAMEPAD_SENSITIVITY * delta;
    this.pitch = THREE.MathUtils.clamp(this.pitch, MIN_PITCH, MAX_PITCH);
  }

  private calculateIdealPosition(): THREE.Vector3 {
    const targetPos = this.target.position;

    const offset = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch) * this.distance,
      Math.sin(this.pitch) * this.distance + DEFAULT_HEIGHT,
      Math.cos(this.yaw) * Math.cos(this.pitch) * this.distance,
    );

    return targetPos.clone().add(offset);
  }

  private calculateLookAt(): THREE.Vector3 {
    return this.target.position.clone().add(new THREE.Vector3(0, DEFAULT_LOOK_AT_HEIGHT, 0));
  }

  /**
   * Get the camera's forward direction projected onto the XZ plane (for movement).
   */
  getForwardDirection(): THREE.Vector3 {
    const forward = new THREE.Vector3(
      -Math.sin(this.yaw),
      0,
      -Math.cos(this.yaw),
    );
    return forward.normalize();
  }

  /**
   * Get the camera's right direction on the XZ plane.
   */
  getRightDirection(): THREE.Vector3 {
    const forward = this.getForwardDirection();
    return new THREE.Vector3(-forward.z, 0, forward.x);
  }

  update(delta: number): void {
    const idealPosition = this.calculateIdealPosition();
    const idealLookAt = this.calculateLookAt();

    // Smooth interpolation
    const t = 1 - Math.exp(-CAMERA_LERP_SPEED * delta);
    this.currentPosition.lerp(idealPosition, t);
    this.currentLookAt.lerp(idealLookAt, t);

    this.camera.position.copy(this.currentPosition);
    this.camera.lookAt(this.currentLookAt);
  }

  dispose(): void {
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('wheel', this.onWheel);
  }
}

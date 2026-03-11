import * as THREE from 'three';

export class InputManager {
  private keysDown = new Set<string>();
  private mouseDelta = new THREE.Vector2();
  private _isPointerLocked = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    canvas.addEventListener('click', this.requestPointerLock);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key.toLowerCase());
  }

  /** Returns accumulated mouse delta since last call, then resets it. */
  consumeMouseDelta(): THREE.Vector2 {
    const delta = this.mouseDelta.clone();
    this.mouseDelta.set(0, 0);
    return delta;
  }

  isPointerLocked(): boolean {
    return this._isPointerLocked;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.key.toLowerCase());
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key.toLowerCase());
  };

  private onMouseMove = (e: MouseEvent): void => {
    if (!this._isPointerLocked) return;
    this.mouseDelta.x += e.movementX;
    this.mouseDelta.y += e.movementY;
  };

  private requestPointerLock = (): void => {
    this.canvas.requestPointerLock();
  };

  private onPointerLockChange = (): void => {
    this._isPointerLocked = document.pointerLockElement === this.canvas;
  };
}

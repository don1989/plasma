import * as THREE from 'three';

export class InputManager {
  // Movement input (normalized -1 to 1)
  readonly moveDirection = new THREE.Vector2();
  // Camera input (normalized -1 to 1)
  readonly cameraInput = new THREE.Vector2();

  sprinting = false;

  private keys = new Set<string>();
  private gamepadIndex: number | null = null;

  private static readonly DEADZONE = 0.15;

  constructor() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('gamepadconnected', this.onGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onGamepadConnected = (e: GamepadEvent): void => {
    console.log(`Gamepad connected: ${e.gamepad.id}`);
    this.gamepadIndex = e.gamepad.index;
  };

  private onGamepadDisconnected = (_e: GamepadEvent): void => {
    console.log('Gamepad disconnected');
    this.gamepadIndex = null;
  };

  update(): void {
    // Reset
    this.moveDirection.set(0, 0);
    this.cameraInput.set(0, 0);
    this.sprinting = false;

    // Keyboard input
    this.readKeyboard();

    // Gamepad input (overrides keyboard if active)
    this.readGamepad();
  }

  private readKeyboard(): void {
    // WASD / Arrow keys
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.moveDirection.y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.moveDirection.y -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.moveDirection.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.moveDirection.x += 1;

    // Normalize diagonal movement
    if (this.moveDirection.lengthSq() > 1) {
      this.moveDirection.normalize();
    }

    // Sprint
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) {
      this.sprinting = true;
    }
  }

  private readGamepad(): void {
    if (this.gamepadIndex === null) return;

    const gamepads = navigator.getGamepads();
    const gp = gamepads[this.gamepadIndex];
    if (!gp) return;

    // Left stick — movement
    const lx = this.applyDeadzone(gp.axes[0] ?? 0);
    const ly = this.applyDeadzone(gp.axes[1] ?? 0);
    if (Math.abs(lx) > 0.01 || Math.abs(ly) > 0.01) {
      this.moveDirection.set(lx, -ly); // Invert Y (stick down = negative)
    }

    // Right stick — camera
    const rx = this.applyDeadzone(gp.axes[2] ?? 0);
    const ry = this.applyDeadzone(gp.axes[3] ?? 0);
    if (Math.abs(rx) > 0.01 || Math.abs(ry) > 0.01) {
      this.cameraInput.set(rx, ry);
    }

    // Sprint — left trigger or button
    const leftTrigger = gp.buttons[6]?.value ?? 0;
    if (leftTrigger > 0.5 || gp.buttons[10]?.pressed) {
      this.sprinting = true;
    }
  }

  private applyDeadzone(value: number): number {
    if (Math.abs(value) < InputManager.DEADZONE) return 0;
    // Remap from deadzone-1 to 0-1
    const sign = Math.sign(value);
    return sign * ((Math.abs(value) - InputManager.DEADZONE) / (1 - InputManager.DEADZONE));
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('gamepadconnected', this.onGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }
}

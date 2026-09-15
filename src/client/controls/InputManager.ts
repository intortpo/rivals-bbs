import { TouchControls } from './TouchControls.js';

export class InputManager {
  public touch: TouchControls;
  private keys: Record<string, boolean> = {};
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private isMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;
  private isPointerLocked: boolean = false;

  constructor(container: HTMLElement) {
    this.touch = new TouchControls(container);
    this.setupDesktopControls();
  }

  private setupDesktopControls(): void {
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;
      if (['Digit1', 'Digit2', 'Digit3', 'Digit4'].includes(e.code)) {
        const index = parseInt(e.code.replace('Digit', ''), 10) - 1;
        this.touch.state.switchWeaponIndex = index;
        this.touch.setActiveWeaponUI(index);
      }
      if (e.code === 'KeyR') {
        this.touch.state.reloadRequested = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer lock for desktop mouse aiming
    window.addEventListener('mousedown', (e) => {
      // Don't lock if clicking UI modals
      if ((e.target as HTMLElement).closest('.modal') || (e.target as HTMLElement).closest('#lobby-screen')) {
        return;
      }

      if (e.button === 0) {
        this.isMouseDown = true;
      } else if (e.button === 2) {
        this.isRightMouseDown = true;
      }

      if (!this.isPointerLocked && !('ontouchstart' in window)) {
        document.body.requestPointerLock?.();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.isMouseDown = false;
      if (e.button === 2) this.isRightMouseDown = false;
    });

    window.addEventListener('contextmenu', (e) => {
      e.preventDefault(); // Prevent right-click context menu in game
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === document.body;
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        const sensitivity = 0.0022 * this.touch.sensitivity;
        this.mouseDeltaX += e.movementX * sensitivity;
        this.mouseDeltaY += e.movementY * sensitivity;
      }
    });
  }

  public getMoveVector(): { x: number; z: number } {
    // Touch joystick takes precedence if active
    if (this.touch.state.moveX !== 0 || this.touch.state.moveZ !== 0) {
      return { x: this.touch.state.moveX, z: this.touch.state.moveZ };
    }

    // Keyboard WASD / Arrow keys
    let x = 0;
    let z = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) z -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) z += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) x -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) x += 1;

    if (x !== 0 && z !== 0) {
      const len = Math.hypot(x, z);
      x /= len;
      z /= len;
    }

    return { x, z };
  }

  public getLookDeltas(): { yaw: number; pitch: number } {
    const touchDeltas = this.touch.consumeLookDeltas();
    const yaw = touchDeltas.yaw + this.mouseDeltaX;
    const pitch = touchDeltas.pitch + this.mouseDeltaY;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    return { yaw, pitch };
  }

  public isFiring(): boolean {
    return this.touch.state.isFiring || this.isMouseDown;
  }

  public isAiming(): boolean {
    return this.touch.state.isAiming || this.isRightMouseDown;
  }

  public isJumping(): boolean {
    return this.touch.state.isJumping || Boolean(this.keys['Space']);
  }

  public isSliding(): boolean {
    return (
      this.touch.state.isSliding ||
      Boolean(this.keys['KeyC']) ||
      Boolean(this.keys['ShiftLeft'])
    );
  }

  public consumeWeaponSwitch(): number | undefined {
    const idx = this.touch.state.switchWeaponIndex;
    this.touch.state.switchWeaponIndex = undefined;
    return idx;
  }

  public consumeReload(): boolean {
    const r = this.touch.state.reloadRequested;
    this.touch.state.reloadRequested = false;
    return r;
  }
}

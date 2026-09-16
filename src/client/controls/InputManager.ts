import { TouchControls } from './TouchControls.js';

export class InputManager {
  public touch: TouchControls;
  public powerupRequested: boolean = false;
  private keys: Record<string, boolean> = {};
  private mouseDeltaX: number = 0;
  private mouseDeltaY: number = 0;
  private isMouseDown: boolean = false;
  private isRightMouseDown: boolean = false;
  private isPointerLocked: boolean = false;
  private _moveVector = { forward: 0, right: 0 };
  private _lookDeltas = { yaw: 0, pitch: 0 };

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
      if (['KeyQ', 'KeyE', 'Digit5'].includes(e.code)) {
        this.powerupRequested = true;
      }
      if (e.code === 'Escape' || e.code === 'KeyP') {
        this.unlockCursor();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Pointer lock for desktop mouse aiming
    window.addEventListener('mousedown', (e) => {
      // If any modal is open, ensure mouse cursor is free and never fire weapons
      if (this.isAnyModalOpen()) {
        this.isMouseDown = false;
        this.isRightMouseDown = false;
        this.unlockCursor();
        return;
      }

      // Don't lock if clicking UI modals, controls, or HUD buttons
      const target = e.target as HTMLElement;
      if (
        target.closest('.modal') ||
        target.closest('.modal-backdrop') ||
        target.closest('#lobby-screen') ||
        target.closest('#settings-modal') ||
        target.closest('#dashboard-modal') ||
        target.closest('#grammar-reload-overlay') ||
        target.closest('#hud-game-over') ||
        target.closest('#character-builder-modal') ||
        target.closest('.touch-btn') ||
        target.closest('.icon-btn') ||
        target.closest('button') ||
        target.closest('input') ||
        target.closest('select')
      ) {
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
      if (this.isAnyModalOpen()) {
        this.mouseDeltaX = 0;
        this.mouseDeltaY = 0;
        return;
      }
      if (this.isPointerLocked) {
        const sensitivity = 0.0022 * this.touch.sensitivity;
        this.mouseDeltaX += e.movementX * sensitivity;
        this.mouseDeltaY += e.movementY * sensitivity;
      }
    });
  }

  public isAnyModalOpen(): boolean {
    const modalSelectors = [
      '#grammar-reload-overlay',
      '#hud-game-over',
      '#settings-modal',
      '#dashboard-modal',
      '#character-builder-modal',
      '#qr-modal',
      '#scanner-modal',
      '#auth-modal',
      '.modal-backdrop',
      '.modal'
    ];

    for (const sel of modalSelectors) {
      const elements = document.querySelectorAll(sel);
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i] as HTMLElement;
        if (
          el &&
          el.style.display !== 'none' &&
          window.getComputedStyle(el).display !== 'none'
        ) {
          return true;
        }
      }
    }
    return false;
  }

  public getMoveVector(): { forward: number; right: number } {
    // Touch joystick takes precedence if active
    if (this.touch.state.forward !== 0 || this.touch.state.right !== 0) {
      this._moveVector.forward = this.touch.state.forward;
      this._moveVector.right = this.touch.state.right;
      return this._moveVector;
    }

    // Keyboard WASD / Arrow keys: W/Up = forward (+1), S/Down = backward (-1), D/Right = right (+1), A/Left = left (-1)
    let forward = 0;
    let right = 0;
    if (this.keys['KeyW'] || this.keys['ArrowUp']) forward += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) forward -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) right += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) right -= 1;

    if (forward !== 0 && right !== 0) {
      const len = Math.hypot(forward, right);
      forward /= len;
      right /= len;
    }

    this._moveVector.forward = forward;
    this._moveVector.right = right;
    return this._moveVector;
  }

  public getLookDeltas(): { yaw: number; pitch: number } {
    const touchDeltas = this.touch.consumeLookDeltas();
    this._lookDeltas.yaw = touchDeltas.yaw + this.mouseDeltaX;
    this._lookDeltas.pitch = touchDeltas.pitch + this.mouseDeltaY;

    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;

    return this._lookDeltas;
  }

  public isFiring(): boolean {
    if (this.isAnyModalOpen()) return false;
    return this.touch.state.isFiring || this.isMouseDown;
  }

  public isAiming(): boolean {
    if (this.isAnyModalOpen()) return false;
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

  public consumePowerup(): boolean {
    const p = this.powerupRequested;
    this.powerupRequested = false;
    return p;
  }

  public unlockCursor(): void {
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }

  public lockCursor(): void {
    if (!('ontouchstart' in window) && !document.pointerLockElement) {
      document.body.requestPointerLock?.();
    }
  }
}

export interface TouchInputState {
  moveX: number; // -1 to 1
  moveZ: number; // -1 to 1
  lookDeltaYaw: number;
  lookDeltaPitch: number;
  isFiring: boolean;
  isAiming: boolean;
  isJumping: boolean;
  isSliding: boolean;
  switchWeaponIndex?: number;
  reloadRequested: boolean;
}

export class TouchControls {
  public state: TouchInputState = {
    moveX: 0,
    moveZ: 0,
    lookDeltaYaw: 0,
    lookDeltaPitch: 0,
    isFiring: false,
    isAiming: false,
    isJumping: false,
    isSliding: false,
    reloadRequested: false
  };

  public sensitivity: number = 1.0;
  public autoFireEnabled: boolean = false;

  private container: HTMLElement;
  private joystickBaseEl!: HTMLElement;
  private joystickThumbEl!: HTMLElement;

  // Touch tracking IDs
  private joystickTouchId: number | null = null;
  private joystickStartPos = { x: 0, y: 0 };
  private joystickMaxRadius = 55;

  private lookTouchId: number | null = null;
  private lookLastPos = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDOM();
    this.attachEvents();
  }

  private setupDOM(): void {
    // Floating Joystick container
    this.joystickBaseEl = document.createElement('div');
    this.joystickBaseEl.id = 'touch-joystick-base';
    this.joystickBaseEl.style.cssText = `
      position: absolute;
      width: 110px;
      height: 110px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 210, 255, 0.2) 0%, rgba(20, 25, 40, 0.45) 80%);
      border: 2px solid rgba(0, 210, 255, 0.6);
      box-shadow: 0 0 15px rgba(0, 210, 255, 0.3);
      display: none;
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 500;
    `;

    this.joystickThumbEl = document.createElement('div');
    this.joystickThumbEl.id = 'touch-joystick-thumb';
    this.joystickThumbEl.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: #00d2ff;
      box-shadow: 0 0 12px #00d2ff;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    this.joystickBaseEl.appendChild(this.joystickThumbEl);
    this.container.appendChild(this.joystickBaseEl);

    // Build Touch Action Buttons Overlay
    const actionsOverlay = document.createElement('div');
    actionsOverlay.id = 'touch-actions-overlay';
    actionsOverlay.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 600;
      user-select: none;
      -webkit-user-select: none;
    `;

    actionsOverlay.innerHTML = `
      <!-- Right Action Cluster -->
      <div id="btn-fire" class="touch-btn touch-btn-primary" style="bottom: 75px; right: 85px; width: 88px; height: 88px;">
        <span style="font-size: 28px;">🔥</span>
        <span style="font-size: 11px; font-weight: bold; letter-spacing: 1px;">FIRE</span>
      </div>

      <div id="btn-ads" class="touch-btn" style="bottom: 185px; right: 40px; width: 66px; height: 66px;">
        <span style="font-size: 22px;">🎯</span>
        <span style="font-size: 10px; font-weight: bold;">ADS</span>
      </div>

      <div id="btn-jump" class="touch-btn" style="bottom: 185px; right: 125px; width: 66px; height: 66px;">
        <span style="font-size: 22px;">🦘</span>
        <span style="font-size: 10px; font-weight: bold;">JUMP</span>
      </div>

      <div id="btn-slide" class="touch-btn" style="bottom: 25px; right: 195px; width: 66px; height: 66px;">
        <span style="font-size: 22px;">⚡</span>
        <span style="font-size: 10px; font-weight: bold;">SLIDE</span>
      </div>

      <div id="btn-reload" class="touch-btn" style="bottom: 100px; right: 205px; width: 56px; height: 56px;">
        <span style="font-size: 20px;">🔄</span>
        <span style="font-size: 9px; font-weight: bold;">RELOAD</span>
      </div>

      <!-- Quick Weapon Bar (Bottom Center) -->
      <div id="weapon-switcher-bar" style="position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 10px; pointer-events: auto;">
        <div class="weapon-slot active" data-index="0"><span>🔫</span><small>RIFLE</small></div>
        <div class="weapon-slot" data-index="1"><span>💥</span><small>SHOTGUN</small></div>
        <div class="weapon-slot" data-index="2"><span>🎯</span><small>SNIPER</small></div>
        <div class="weapon-slot" data-index="3"><span>⚔️</span><small>KATANA</small></div>
      </div>

      <!-- Settings & Fullscreen buttons (Top Right) -->
      <div style="position: absolute; top: 18px; right: 18px; display: flex; gap: 10px; pointer-events: auto;">
        <button id="btn-fullscreen" class="icon-btn" title="Toggle Fullscreen">⛶</button>
        <button id="btn-touch-settings" class="icon-btn" title="Controls Settings">⚙️</button>
      </div>
    `;

    this.container.appendChild(actionsOverlay);

    // Apply inline styles for buttons
    const style = document.createElement('style');
    style.textContent = `
      .touch-btn {
        position: absolute;
        border-radius: 50%;
        background: rgba(26, 32, 50, 0.75);
        border: 2px solid rgba(255, 255, 255, 0.25);
        backdrop-filter: blur(8px);
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        touch-action: none;
        transition: transform 0.05s ease, background 0.1s ease, border-color 0.1s ease;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.4);
      }
      .touch-btn:active, .touch-btn.active {
        transform: scale(0.92);
        background: rgba(0, 210, 255, 0.4);
        border-color: #00d2ff;
        box-shadow: 0 0 16px rgba(0, 210, 255, 0.6);
      }
      .touch-btn-primary {
        background: rgba(255, 42, 85, 0.85);
        border: 2px solid #ff5577;
        box-shadow: 0 0 18px rgba(255, 42, 85, 0.5);
      }
      .touch-btn-primary:active, .touch-btn-primary.active {
        background: #ff2a55;
        border-color: #ffffff;
        box-shadow: 0 0 25px rgba(255, 42, 85, 0.8);
      }
      .weapon-slot {
        background: rgba(20, 25, 40, 0.8);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 6px 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        color: white;
        cursor: pointer;
        backdrop-filter: blur(6px);
        transition: all 0.15s ease;
      }
      .weapon-slot span { font-size: 20px; }
      .weapon-slot small { font-size: 9px; font-weight: bold; opacity: 0.8; }
      .weapon-slot.active {
        background: rgba(0, 210, 255, 0.25);
        border-color: #00d2ff;
        box-shadow: 0 0 12px rgba(0, 210, 255, 0.5);
        transform: translateY(-4px);
      }
      .icon-btn {
        background: rgba(20, 25, 40, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(5px);
      }
      .icon-btn:active { background: rgba(0, 210, 255, 0.3); }
    `;
    document.head.appendChild(style);
  }

  private attachEvents(): void {
    // Multi-touch listener on entire screen
    window.addEventListener('touchstart', this.onTouchStart.bind(this), { passive: false });
    window.addEventListener('touchmove', this.onTouchMove.bind(this), { passive: false });
    window.addEventListener('touchend', this.onTouchEnd.bind(this), { passive: false });
    window.addEventListener('touchcancel', this.onTouchEnd.bind(this), { passive: false });

    // Action button listeners
    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.isFiring = true;
        fireBtn.classList.add('active');
      });
      const stopFire = (e: Event) => {
        e.preventDefault();
        this.state.isFiring = false;
        fireBtn.classList.remove('active');
      };
      fireBtn.addEventListener('touchend', stopFire);
      fireBtn.addEventListener('touchcancel', stopFire);
    }

    const adsBtn = document.getElementById('btn-ads');
    if (adsBtn) {
      adsBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.isAiming = !this.state.isAiming;
        adsBtn.classList.toggle('active', this.state.isAiming);
      });
    }

    const jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.isJumping = true;
        jumpBtn.classList.add('active');
      });
      const stopJump = (e: Event) => {
        e.preventDefault();
        this.state.isJumping = false;
        jumpBtn.classList.remove('active');
      };
      jumpBtn.addEventListener('touchend', stopJump);
      jumpBtn.addEventListener('touchcancel', stopJump);
    }

    const slideBtn = document.getElementById('btn-slide');
    if (slideBtn) {
      slideBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.isSliding = true;
        slideBtn.classList.add('active');
      });
      const stopSlide = (e: Event) => {
        e.preventDefault();
        this.state.isSliding = false;
        slideBtn.classList.remove('active');
      };
      slideBtn.addEventListener('touchend', stopSlide);
      slideBtn.addEventListener('touchcancel', stopSlide);
    }

    const reloadBtn = document.getElementById('btn-reload');
    if (reloadBtn) {
      reloadBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.reloadRequested = true;
      });
    }

    // Weapon slots
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach(slot => {
      slot.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const index = parseInt(slot.getAttribute('data-index') || '0', 10);
        this.setActiveWeaponUI(index);
        this.state.switchWeaponIndex = index;
      });
    });

    // Fullscreen toggle
    const fsBtn = document.getElementById('btn-fullscreen');
    if (fsBtn) {
      fsBtn.addEventListener('click', () => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      });
    }
  }

  public setActiveWeaponUI(index: number): void {
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach((s, i) => s.classList.toggle('active', i === index));
  }

  private onTouchStart(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const target = touch.target as HTMLElement;

      // Ignore touches on UI buttons or forms
      if (target.closest('.touch-btn') || target.closest('.weapon-slot') || target.closest('.modal') || target.closest('.icon-btn')) {
        continue;
      }

      const isLeftSide = touch.clientX < window.innerWidth * 0.48;

      if (isLeftSide && this.joystickTouchId === null) {
        // Anchor dynamic joystick
        this.joystickTouchId = touch.identifier;
        this.joystickStartPos = { x: touch.clientX, y: touch.clientY };

        this.joystickBaseEl.style.left = `${touch.clientX}px`;
        this.joystickBaseEl.style.top = `${touch.clientY}px`;
        this.joystickBaseEl.style.display = 'block';

        this.joystickThumbEl.style.transform = 'translate(-50%, -50%)';
        this.state.moveX = 0;
        this.state.moveZ = 0;
      } else if (!isLeftSide && this.lookTouchId === null) {
        // Start look drag
        this.lookTouchId = touch.identifier;
        this.lookLastPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.joystickTouchId) {
        const dx = touch.clientX - this.joystickStartPos.x;
        const dy = touch.clientY - this.joystickStartPos.y;
        const dist = Math.hypot(dx, dy);
        const clampedDist = Math.min(dist, this.joystickMaxRadius);

        const angle = Math.atan2(dy, dx);
        const thumbX = Math.cos(angle) * clampedDist;
        const thumbY = Math.sin(angle) * clampedDist;

        this.joystickThumbEl.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

        // Normalize movement vector
        this.state.moveX = clampedDist > 8 ? (thumbX / this.joystickMaxRadius) : 0;
        this.state.moveZ = clampedDist > 8 ? (thumbY / this.joystickMaxRadius) : 0;
      } else if (touch.identifier === this.lookTouchId) {
        const dx = touch.clientX - this.lookLastPos.x;
        const dy = touch.clientY - this.lookLastPos.y;

        const adsScale = this.state.isAiming ? 0.5 : 1.0;
        const factor = 0.0035 * this.sensitivity * adsScale;

        this.state.lookDeltaYaw += dx * factor;
        this.state.lookDeltaPitch += dy * factor;

        this.lookLastPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickBaseEl.style.display = 'none';
        this.state.moveX = 0;
        this.state.moveZ = 0;
      } else if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      }
    }
  }

  public consumeLookDeltas(): { yaw: number; pitch: number } {
    const deltas = {
      yaw: this.state.lookDeltaYaw,
      pitch: this.state.lookDeltaPitch
    };
    this.state.lookDeltaYaw = 0;
    this.state.lookDeltaPitch = 0;
    return deltas;
  }
}

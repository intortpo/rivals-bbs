export interface TouchInputState {
  forward: number; // +1 = forward (thumb up), -1 = backward (thumb down)
  right: number;   // +1 = right, -1 = left
  moveX: number; // legacy compatibility
  moveZ: number; // legacy compatibility
  lookDeltaYaw: number;
  lookDeltaPitch: number;
  isFiring: boolean;
  isAiming: boolean;
  isJumping: boolean;
  isSliding: boolean;
  switchWeaponIndex?: number;
  reloadRequested: boolean;
}

export function isTouchDevice(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('ontouchstart' in window ||
      (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches))
  );
}

export class TouchControls {
  public state: TouchInputState = {
    forward: 0,
    right: 0,
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
  public invertY: boolean = false;
  public autoFireEnabled: boolean = false;
  public onOpenSettings?: () => void;
  public currentCategory: 'tactical' | 'experimental' = 'tactical';
  public currentActiveGlobalIndex: number = 0;

  private static readonly LOADOUT_SLOTS = {
    tactical: [
      { index: 0, icon: '🔫', label: 'RIFLE' },
      { index: 1, icon: '💥', label: 'SHOTGUN' },
      { index: 2, icon: '🎯', label: 'SNIPER' },
      { index: 3, icon: '⚔️', label: 'KATANA' }
    ],
    experimental: [
      { index: 4, icon: '💎', label: 'NEEDLER' },
      { index: 5, icon: '🔮', label: 'PLASMA' },
      { index: 6, icon: '⚡', label: 'RAILGUN' },
      { index: 7, icon: '🔌', label: 'TESLA' }
    ]
  };

  private container: HTMLElement;
  private joystickBaseEl!: HTMLElement;
  private joystickThumbEl!: HTMLElement;

  // Touch tracking IDs
  private joystickTouchId: number | null = null;
  private joystickStartPos = { x: 0, y: 0 };
  private joystickMaxRadius = 60;

  // Look tracking
  private lookTouchId: number | null = null;
  private lookLastPos = { x: 0, y: 0 };
  private _lookDeltas = { yaw: 0, pitch: 0 };

  // Fire-Button Aim Dragging (crucial for fluid tablet / 2-thumb play)
  private fireTouchId: number | null = null;
  private fireLastPos = { x: 0, y: 0 };

  constructor(container: HTMLElement) {
    this.container = container;
    this.setupDOM();
    this.attachEvents();
  }

  private triggerHaptic(durationMs: number = 12): void {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate?.(durationMs);
      } catch {
        // Ignored if browser restricts vibration
      }
    }
  }

  private setupDOM(): void {
    // Floating Joystick container
    this.joystickBaseEl = document.createElement('div');
    this.joystickBaseEl.id = 'touch-joystick-base';
    this.joystickBaseEl.style.cssText = `
      position: absolute;
      width: 120px;
      height: 120px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(0, 210, 255, 0.25) 0%, rgba(20, 25, 40, 0.55) 80%);
      border: 2px solid rgba(0, 210, 255, 0.7);
      box-shadow: 0 0 18px rgba(0, 210, 255, 0.35);
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
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: #00d2ff;
      box-shadow: 0 0 15px #00d2ff;
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
      touch-action: none;
    `;

    // Only display actions overlay on touch-capable devices, or show subtle indicators
    if (!isTouchDevice()) {
      actionsOverlay.style.display = 'none';
    }

    actionsOverlay.innerHTML = `
      <!-- Right Action Cluster with Tablet-Optimized Proportions -->
      <div id="btn-fire" class="touch-btn touch-btn-primary" style="bottom: max(65px, env(safe-area-inset-bottom, 20px)); right: max(75px, env(safe-area-inset-right, 20px));">
        <span class="touch-icon">🔥</span>
        <span class="touch-label">FIRE</span>
      </div>

      <div id="btn-ads" class="touch-btn touch-btn-secondary" style="bottom: max(180px, calc(env(safe-area-inset-bottom, 20px) + 115px)); right: max(25px, env(safe-area-inset-right, 20px));">
        <span class="touch-icon">🎯</span>
        <span class="touch-label">ADS</span>
      </div>

      <div id="btn-jump" class="touch-btn touch-btn-secondary" style="bottom: max(180px, calc(env(safe-area-inset-bottom, 20px) + 115px)); right: max(115px, calc(env(safe-area-inset-right, 20px) + 90px));">
        <span class="touch-icon">🦘</span>
        <span class="touch-label">JUMP</span>
      </div>

      <div id="btn-slide" class="touch-btn touch-btn-secondary" style="bottom: max(20px, env(safe-area-inset-bottom, 20px)); right: max(180px, calc(env(safe-area-inset-right, 20px) + 155px));">
        <span class="touch-icon">⚡</span>
        <span class="touch-label">SLIDE</span>
      </div>

      <div id="btn-reload" class="touch-btn touch-btn-secondary" style="bottom: max(95px, calc(env(safe-area-inset-bottom, 20px) + 75px)); right: max(190px, calc(env(safe-area-inset-right, 20px) + 165px));">
        <span class="touch-icon">🔄</span>
        <span class="touch-label">RELOAD</span>
      </div>

      <!-- Quick Weapon Bar (Bottom Center) -->
      <div id="weapon-switcher-bar" style="position: absolute; bottom: max(16px, env(safe-area-inset-bottom, 16px)); left: 50%; transform: translateX(-50%); display: flex; align-items: center; gap: 8px; pointer-events: auto;">
        <button id="btn-loadout-toggle" class="icon-btn" style="width: auto; padding: 0 12px; height: 48px; border-radius: 12px; font-size: 11px; font-weight: 900; background: rgba(168, 85, 247, 0.25); border: 1.5px solid #a855f7; color: #e9d5ff; box-shadow: 0 0 10px rgba(168, 85, 247, 0.4);" title="Toggle Arsenal">⚡ EXP</button>
        <div id="weapon-slot-dock" style="display: flex; gap: 8px;">
          <div class="weapon-slot active" data-slot="0" data-index="0"><span>🔫</span><small>RIFLE</small></div>
          <div class="weapon-slot" data-slot="1" data-index="1"><span>💥</span><small>SHOTGUN</small></div>
          <div class="weapon-slot" data-slot="2" data-index="2"><span>🎯</span><small>SNIPER</small></div>
          <div class="weapon-slot" data-slot="3" data-index="3"><span>⚔️</span><small>KATANA</small></div>
        </div>
      </div>

      <!-- Settings & Fullscreen buttons (Top Right) -->
      <div style="position: absolute; top: max(18px, env(safe-area-inset-top, 18px)); right: max(18px, env(safe-area-inset-right, 18px)); display: flex; gap: 10px; pointer-events: auto;">
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
        background: rgba(26, 32, 50, 0.82);
        border: 2px solid rgba(255, 255, 255, 0.28);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        color: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        pointer-events: auto;
        touch-action: none;
        user-select: none;
        -webkit-user-select: none;
        transition: transform 0.05s ease, background 0.1s ease, border-color 0.1s ease;
        box-shadow: 0 4px 18px rgba(0, 0, 0, 0.45);
      }
      .touch-btn-primary {
        width: clamp(80px, 9.5vw, 104px);
        height: clamp(80px, 9.5vw, 104px);
        background: rgba(255, 42, 85, 0.88);
        border: 2px solid #ff5577;
        box-shadow: 0 0 20px rgba(255, 42, 85, 0.55);
      }
      .touch-btn-primary .touch-icon { font-size: clamp(26px, 3.2vw, 36px); }
      .touch-btn-primary .touch-label { font-size: clamp(10px, 1.2vw, 13px); font-weight: 900; letter-spacing: 1px; }

      .touch-btn-secondary {
        width: clamp(62px, 7.2vw, 82px);
        height: clamp(62px, 7.2vw, 82px);
      }
      .touch-btn-secondary .touch-icon { font-size: clamp(20px, 2.4vw, 28px); }
      .touch-btn-secondary .touch-label { font-size: clamp(9px, 1.1vw, 11px); font-weight: 800; }

      .touch-btn:active, .touch-btn.active {
        transform: scale(0.92);
        background: rgba(0, 210, 255, 0.45);
        border-color: #00d2ff;
        box-shadow: 0 0 20px rgba(0, 210, 255, 0.7);
      }
      .touch-btn-primary:active, .touch-btn-primary.active {
        background: #ff2a55;
        border-color: #ffffff;
        box-shadow: 0 0 30px rgba(255, 42, 85, 0.9);
      }
      .weapon-slot {
        background: rgba(20, 25, 40, 0.85);
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-radius: 12px;
        padding: 6px 14px;
        display: flex;
        flex-direction: column;
        align-items: center;
        color: white;
        cursor: pointer;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
        transition: all 0.15s ease;
        touch-action: none;
      }
      .weapon-slot span { font-size: 20px; }
      .weapon-slot small { font-size: 9px; font-weight: bold; opacity: 0.85; }
      .weapon-slot.active {
        background: rgba(0, 210, 255, 0.28);
        border-color: #00d2ff;
        box-shadow: 0 0 14px rgba(0, 210, 255, 0.55);
        transform: translateY(-4px);
      }
      .icon-btn {
        background: rgba(20, 25, 40, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.25);
        color: white;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        touch-action: none;
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

    // Action button listeners with Fire-Aim-Drag support
    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const touch = e.changedTouches[0];
        if (touch) {
          this.fireTouchId = touch.identifier;
          this.fireLastPos = { x: touch.clientX, y: touch.clientY };
        }
        this.state.isFiring = true;
        fireBtn.classList.add('active');
        this.triggerHaptic(14);
      }, { passive: false });

      const stopFire = (e: Event) => {
        e.preventDefault();
        this.state.isFiring = false;
        this.fireTouchId = null;
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
        this.triggerHaptic(12);
      }, { passive: false });
    }

    const jumpBtn = document.getElementById('btn-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.state.isJumping = true;
        jumpBtn.classList.add('active');
        this.triggerHaptic(12);
      }, { passive: false });
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
        this.triggerHaptic(12);
      }, { passive: false });
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
        this.triggerHaptic(15);
      }, { passive: false });
    }

    // Loadout toggle button
    const toggleBtn = document.getElementById('btn-loadout-toggle');
    if (toggleBtn) {
      const handleToggle = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleLoadoutCategory();
        this.triggerHaptic(10);
      };
      toggleBtn.addEventListener('touchstart', handleToggle);
      toggleBtn.addEventListener('click', handleToggle);
    }

    // Weapon slots
    const slots = document.querySelectorAll('.weapon-slot');
    slots.forEach((slot, slotIdx) => {
      const handleSlot = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        const globalIndex = this.getGlobalIndexForSlot(slotIdx);
        this.setActiveWeaponUI(globalIndex);
        this.state.switchWeaponIndex = globalIndex;
        this.triggerHaptic(12);
      };
      slot.addEventListener('touchstart', handleSlot);
      slot.addEventListener('click', handleSlot);
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

    // In-game Settings button
    const settingsBtn = document.getElementById('btn-touch-settings');
    if (settingsBtn) {
      const handleSettings = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerHaptic(15);
        this.onOpenSettings?.();
      };
      settingsBtn.addEventListener('touchstart', handleSettings);
      settingsBtn.addEventListener('click', handleSettings);
    }
  }

  public getGlobalIndexForSlot(slot: number): number {
    return this.currentCategory === 'tactical' ? slot : slot + 4;
  }

  public setLoadoutCategory(cat: 'tactical' | 'experimental'): void {
    this.currentCategory = cat;
    const toggleBtn = document.getElementById('btn-loadout-toggle');
    if (toggleBtn) {
      if (cat === 'tactical') {
        toggleBtn.textContent = '⚡ EXP';
        toggleBtn.style.borderColor = '#a855f7';
        toggleBtn.style.color = '#e9d5ff';
        toggleBtn.style.background = 'rgba(168, 85, 247, 0.25)';
      } else {
        toggleBtn.textContent = '🔫 TAC';
        toggleBtn.style.borderColor = '#00d2ff';
        toggleBtn.style.color = '#00d2ff';
        toggleBtn.style.background = 'rgba(0, 210, 255, 0.25)';
      }
    }

    const slots = document.querySelectorAll('.weapon-slot');
    const defs = TouchControls.LOADOUT_SLOTS[cat];
    slots.forEach((s, idx) => {
      if (defs[idx]) {
        s.setAttribute('data-index', `${defs[idx].index}`);
        s.innerHTML = `<span>${defs[idx].icon}</span><small>${defs[idx].label}</small>`;
      }
    });

    this.updateActiveSlotHighlight();
  }

  public toggleLoadoutCategory(): void {
    const nextCat = this.currentCategory === 'tactical' ? 'experimental' : 'tactical';
    this.setLoadoutCategory(nextCat);
    const targetIndex = nextCat === 'tactical' ? 0 : 4;
    this.setActiveWeaponUI(targetIndex);
    this.state.switchWeaponIndex = targetIndex;
  }

  public setActiveWeaponUI(globalIndex: number): void {
    this.currentActiveGlobalIndex = globalIndex;
    const expectedCat = globalIndex >= 4 ? 'experimental' : 'tactical';
    if (this.currentCategory !== expectedCat) {
      this.setLoadoutCategory(expectedCat);
    } else {
      this.updateActiveSlotHighlight();
    }
  }

  private updateActiveSlotHighlight(): void {
    const slots = document.querySelectorAll('.weapon-slot');
    const slotIdx = this.currentActiveGlobalIndex % 4;
    const isMatchingCategory = (this.currentActiveGlobalIndex >= 4 && this.currentCategory === 'experimental') ||
                               (this.currentActiveGlobalIndex < 4 && this.currentCategory === 'tactical');
    slots.forEach((s, i) => {
      s.classList.toggle('active', isMatchingCategory && i === slotIdx);
    });
  }

  public cycleWeapon(direction: 1 | -1): void {
    const nextIndex = (this.currentActiveGlobalIndex + direction + 8) % 8;
    this.setActiveWeaponUI(nextIndex);
    this.state.switchWeaponIndex = nextIndex;
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
        this.state.forward = 0;
        this.state.right = 0;
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
        const deadzone = 8;

        const clampedDist = Math.min(dist, this.joystickMaxRadius);
        const angle = Math.atan2(dy, dx);
        const thumbX = Math.cos(angle) * clampedDist;
        const thumbY = Math.sin(angle) * clampedDist;

        this.joystickThumbEl.style.transform = `translate(calc(-50% + ${thumbX}px), calc(-50% + ${thumbY}px))`;

        if (dist > deadzone) {
          const normalized = Math.min((dist - deadzone) / (this.joystickMaxRadius - deadzone), 1.0);
          const curved = Math.pow(normalized, 1.2); // Exponential response curve
          const forwardVal = -Math.sin(angle) * curved;
          const rightVal = Math.cos(angle) * curved;
          this.state.forward = forwardVal;
          this.state.right = rightVal;
          this.state.moveX = rightVal;
          this.state.moveZ = -forwardVal;
        } else {
          this.state.forward = 0;
          this.state.right = 0;
          this.state.moveX = 0;
          this.state.moveZ = 0;
        }
      } else if (touch.identifier === this.lookTouchId) {
        const dx = touch.clientX - this.lookLastPos.x;
        const dy = touch.clientY - this.lookLastPos.y;

        const adsScale = this.state.isAiming ? 0.5 : 1.0;
        const factor = 0.0035 * this.sensitivity * adsScale;

        this.state.lookDeltaYaw += dx * factor;
        this.state.lookDeltaPitch += dy * factor;

        this.lookLastPos = { x: touch.clientX, y: touch.clientY };
      } else if (touch.identifier === this.fireTouchId) {
        // Fire-button aim dragging: steer camera while shooting
        const dx = touch.clientX - this.fireLastPos.x;
        const dy = touch.clientY - this.fireLastPos.y;

        const adsScale = this.state.isAiming ? 0.5 : 1.0;
        const factor = 0.0035 * this.sensitivity * adsScale;

        this.state.lookDeltaYaw += dx * factor;
        this.state.lookDeltaPitch += dy * factor;

        this.fireLastPos = { x: touch.clientX, y: touch.clientY };
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];

      if (touch.identifier === this.joystickTouchId) {
        this.joystickTouchId = null;
        this.joystickBaseEl.style.display = 'none';
        this.state.forward = 0;
        this.state.right = 0;
        this.state.moveX = 0;
        this.state.moveZ = 0;
      } else if (touch.identifier === this.lookTouchId) {
        this.lookTouchId = null;
      } else if (touch.identifier === this.fireTouchId) {
        this.fireTouchId = null;
        this.state.isFiring = false;
        const fireBtn = document.getElementById('btn-fire');
        if (fireBtn) fireBtn.classList.remove('active');
      }
    }
  }

  public consumeLookDeltas(): { yaw: number; pitch: number } {
    this._lookDeltas.yaw = this.state.lookDeltaYaw;
    this._lookDeltas.pitch = (this.invertY ? -1 : 1) * this.state.lookDeltaPitch;
    this.state.lookDeltaYaw = 0;
    this.state.lookDeltaPitch = 0;
    return this._lookDeltas;
  }
}

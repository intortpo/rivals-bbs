import { BossStatePayload, GameOverPayload, PowerupType, WeaponStats, WeaponType } from '../../shared/types.js';
import { POWERUPS, WEAPONS } from '../../shared/constants.js';

export class TouchHUD {
  private container: HTMLElement;
  private hpFillEl!: HTMLElement;
  private hpTextEl!: HTMLElement;
  private ammoCurrentEl!: HTMLElement;
  private ammoMaxEl!: HTMLElement;
  private reloadRingEl!: HTMLElement;
  private crosshairEl!: HTMLElement;
  private adsScopeOverlay!: HTMLElement;
  private damageVignetteEl!: HTMLElement;
  private teleportVignetteEl!: HTMLElement;
  private killfeedEl!: HTMLElement;
  private countdownEl!: HTMLElement;
  private gameOverModalEl!: HTMLElement;

  private powerupBtnEl!: HTMLElement;
  private powerupIconEl!: HTMLElement;
  private powerupLabelEl!: HTMLElement;
  private powerupTimerBarEl!: HTMLElement;
  private shieldContainerEl!: HTMLElement;
  private shieldTextEl!: HTMLElement;
  private shieldFillEl!: HTMLElement;
  private btnDashboardEl!: HTMLElement;
  private btnSettingsEl!: HTMLElement;
  private waveBannerEl!: HTMLElement;
  private waveBannerTextEl!: HTMLElement;
  private bossBannerEl!: HTMLElement;
  private bossNameEl!: HTMLElement;
  private bossPhaseEl!: HTMLElement;
  private bossHpFillEl!: HTMLElement;
  private bossShieldFillEl!: HTMLElement;
  private modeEl: HTMLElement | null = null;
  private scoreEl: HTMLElement | null = null;
  private fragEl: HTMLElement | null = null;

  // Dirty checking state caches to eliminate DOM layout and style thrashing
  private lastHp: number = -1;
  private lastMaxHp: number = -1;
  private lastAmmoCurrent: number = -1;
  private lastAmmoReserve: number = -1;
  private lastWeaponType: WeaponType | '' = '';
  private lastIsReloading: boolean = false;
  private lastReloadPercent: number = -1;
  private lastCrosshairScale: number = -1;
  private lastAdsActive: boolean = false;
  private lastAdsWeaponType: WeaponType | '' = '';
  private lastShieldHp: number = -1;
  private lastMaxShield: number = -1;
  private lastPowerupType: PowerupType | null | undefined = undefined;
  private lastPowerupActive: boolean | undefined = undefined;
  private lastPowerupRemainingSec: number = -1;
  private lastPowerupPct: number = -1;
  private lastMatchMode: string = '';
  private lastScoreA: number = -1;
  private lastScoreB: number = -1;
  private lastGoal: number = -1;
  private lastTeamBlue: number = -1;
  private lastTeamRed: number = -1;
  private lastWaveNum: number = -1;
  private lastAliveBots: number = -1;

  public onPowerupClick?: () => void;
  public onOpenDashboard?: () => void;
  public onOpenSettings?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildHUD();
  }

  private buildHUD(): void {
    const hud = document.createElement('div');
    hud.id = 'touch-hud';
    hud.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 400;
      user-select: none;
      -webkit-user-select: none;
    `;

    hud.innerHTML = `
      <!-- Top Score / Objective Banner -->
      <div id="hud-top-banner" style="position: absolute; top: 16px; left: 50%; transform: translateX(-50%); background: rgba(15, 20, 32, 0.8); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 20px; padding: 6px 20px; display: flex; align-items: center; gap: 16px; backdrop-filter: blur(8px); color: white;">
        <div style="font-size: 13px; font-weight: bold; color: #8da2c0;" id="hud-match-mode">1v1 DUEL</div>
        <div style="font-size: 18px; font-weight: 900; color: #00d2ff;" id="hud-match-score">0 - 0</div>
        <div style="font-size: 13px; font-weight: bold; color: #ff2a55;" id="hud-frag-limit">GOAL: 5</div>
      </div>

      <!-- Wave Intermission / Cleared Banner -->
      <div id="hud-wave-banner" style="position: absolute; top: 68px; left: 50%; transform: translateX(-50%); background: linear-gradient(90deg, rgba(255, 170, 0, 0.92), rgba(0, 210, 255, 0.92)); border: 1px solid rgba(255, 255, 255, 0.4); border-radius: 14px; padding: 8px 24px; display: none; align-items: center; gap: 10px; box-shadow: 0 0 24px rgba(0, 210, 255, 0.6); backdrop-filter: blur(8px); pointer-events: none; z-index: 40;">
        <span id="hud-wave-banner-text" style="font-size: 16px; font-weight: 900; color: white; letter-spacing: 1px; text-shadow: 0 2px 6px rgba(0,0,0,0.8);">🎉 WAVE 1 CLEARED! NEXT WAVE IN 5s</span>
      </div>

      <!-- Inter-Level Boss Health Banner -->
      <div id="hud-boss-banner" style="position: absolute; top: 66px; left: 50%; transform: translateX(-50%); width: 340px; max-width: 90vw; background: rgba(10, 14, 24, 0.92); border: 2px solid #f43f5e; border-radius: 12px; padding: 6px 14px; display: none; flex-direction: column; gap: 4px; box-shadow: 0 0 22px rgba(244, 63, 94, 0.5); backdrop-filter: blur(8px); z-index: 50; pointer-events: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 13px; font-weight: 900; color: #ff6b8b; text-shadow: 0 1px 4px rgba(0,0,0,0.8);">
          <span id="hud-boss-name">👑 GEOMETRIC NEXUS</span>
          <span id="hud-boss-phase" style="font-size: 11px; color: #f59e0b; background: rgba(245, 158, 11, 0.2); padding: 2px 6px; border-radius: 4px;">PHASE 1</span>
        </div>
        <div style="width: 100%; height: 10px; background: rgba(255, 255, 255, 0.1); border-radius: 5px; overflow: hidden; position: relative;">
          <div id="hud-boss-hp-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #f43f5e, #ff8da1); transition: width 0.1s linear;"></div>
          <div id="hud-boss-shield-fill" style="position: absolute; top: 0; left: 0; width: 0%; height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); opacity: 0.85; transition: width 0.1s linear;"></div>
        </div>
      </div>

      <!-- Top Right Quick Buttons: Dashboard & Settings -->
      <div style="position: absolute; top: 16px; right: 16px; display: flex; gap: 8px; pointer-events: auto;">
        <button id="btn-hud-dashboard" class="icon-btn" title="Dashboard">📊</button>
        <button id="btn-hud-settings" class="icon-btn" title="Settings">⚙️</button>
      </div>

      <!-- Killfeed (Top Left below banner) -->
      <div id="hud-killfeed" style="position: absolute; top: 70px; left: 18px; display: flex; flex-direction: column; gap: 6px; pointer-events: none;"></div>

      <!-- Center Crosshair -->
      <div id="hud-crosshair" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 24px; height: 24px; pointer-events: none;">
        <div class="crosshair-dot" style="position: absolute; top: 50%; left: 50%; width: 4px; height: 4px; background: #00d2ff; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 6px #00d2ff;"></div>
        <div class="crosshair-line line-t" style="position: absolute; top: 0; left: 50%; width: 2px; height: 6px; background: white; transform: translateX(-50%);"></div>
        <div class="crosshair-line line-b" style="position: absolute; bottom: 0; left: 50%; width: 2px; height: 6px; background: white; transform: translateX(-50%);"></div>
        <div class="crosshair-line line-l" style="position: absolute; left: 0; top: 50%; width: 6px; height: 2px; background: white; transform: translateY(-50%);"></div>
        <div class="crosshair-line line-r" style="position: absolute; right: 0; top: 50%; width: 6px; height: 2px; background: white; transform: translateY(-50%);"></div>
      </div>

      <!-- ADS Scope Overlay (Active during sniper/rifle zoom) -->
      <div id="hud-ads-scope" style="position: absolute; inset: 0; background: radial-gradient(circle at center, transparent 35%, rgba(0,0,0,0.95) 75%); display: none; pointer-events: none;">
        <div style="position: absolute; top: 50%; left: 0; right: 0; height: 1px; background: rgba(0, 210, 255, 0.4);"></div>
        <div style="position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(0, 210, 255, 0.4);"></div>
      </div>

      <!-- Damage Vignette (Flashes red when hurt) -->
      <div id="hud-damage-vignette" style="position: absolute; inset: 0; box-shadow: inset 0 0 70px rgba(255, 42, 85, 0.7); opacity: 0; transition: opacity 0.1s ease; pointer-events: none;"></div>
      <!-- Teleport Warp Screen Flash -->
      <div id="hud-teleport-vignette" style="position: absolute; inset: 0; box-shadow: inset 0 0 90px rgba(0, 210, 255, 0.85); background: radial-gradient(circle, transparent 40%, rgba(0, 210, 255, 0.35) 90%); opacity: 0; transition: opacity 0.3s ease-out; pointer-events: none;"></div>

      <!-- Health & Shield Bar (Bottom Left) -->
      <div style="position: absolute; bottom: 22px; left: 20px; display: flex; flex-direction: column; gap: 6px; pointer-events: auto;">
        <!-- Shield Bar -->
        <div id="hud-shield-container" style="display: none; flex-direction: column; gap: 2px;">
          <div style="display: flex; justify-content: space-between; font-size: 11px; font-weight: 800; color: #00d2ff; text-shadow: 0 0 4px #00d2ff;">
            <span>⚡ SHIELD</span>
            <span id="hud-shield-text">50</span>
          </div>
          <div style="width: 160px; height: 8px; background: rgba(15, 20, 32, 0.8); border: 1px solid #00d2ff; border-radius: 4px; overflow: hidden;">
            <div id="hud-shield-fill" style="width: 100%; height: 100%; background: #00d2ff; box-shadow: 0 0 8px #00d2ff;"></div>
          </div>
        </div>

        <!-- Health Bar -->
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #fff; text-shadow: 0 1px 4px #000;">
          <span>HEALTH</span>
          <span id="hud-hp-text">100</span>
        </div>
        <div style="width: 160px; height: 14px; background: rgba(15, 20, 32, 0.8); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 7px; overflow: hidden; backdrop-filter: blur(5px);">
          <div id="hud-hp-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #00d2ff, #00ff88); transition: width 0.15s ease, background 0.2s ease;"></div>
        </div>
      </div>

      <!-- Powerup Button (Touch & Desktop interactive) -->
      <div id="btn-powerup" class="touch-btn" style="bottom: 95px; right: 280px; width: 68px; height: 68px; display: none; border-color: #ffbb00; box-shadow: 0 0 16px rgba(255, 187, 0, 0.4);">
        <span id="hud-powerup-icon" style="font-size: 26px;">⚡</span>
        <span id="hud-powerup-label" style="font-size: 9px; font-weight: 900; letter-spacing: 0.5px; color: #ffbb00;">READY</span>
        <div id="hud-powerup-timer-bar" style="position: absolute; bottom: -4px; left: 15%; width: 70%; height: 3px; background: #00d2ff; border-radius: 2px; display: none;"></div>
      </div>

      <!-- Ammo & Reload Counter (Bottom Right near action cluster) -->
      <div id="hud-ammo-container" style="position: absolute; bottom: 24px; right: 280px; display: flex; align-items: center; gap: 8px; background: rgba(15, 20, 32, 0.75); border: 1px solid rgba(255, 255, 255, 0.2); border-radius: 12px; padding: 6px 14px; backdrop-filter: blur(5px);">
        <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 36 36" width="28" height="28" style="transform: rotate(-90deg);">
            <path id="hud-reload-ring" stroke="#00d2ff" stroke-width="4" fill="none" stroke-dasharray="100, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
          <span style="position: absolute; font-size: 12px;">⚡</span>
        </div>
        <div style="color: white; font-weight: 900; font-size: 20px; letter-spacing: 1px;">
          <span id="hud-ammo-current">30</span>
          <span style="font-size: 14px; opacity: 0.6;">/</span>
          <span id="hud-ammo-max" style="font-size: 14px; opacity: 0.6;">30</span>
        </div>
      </div>

      <!-- Round Countdown (3, 2, 1, GO!) -->
      <div id="hud-countdown" style="position: absolute; top: 40%; left: 50%; transform: translate(-50%, -50%); font-size: 96px; font-weight: 900; color: #00d2ff; text-shadow: 0 0 30px #00d2ff; display: none;">3</div>

      <!-- Game Over Modal -->
      <div id="hud-game-over" class="modal-backdrop" style="display: none; pointer-events: auto !important; cursor: default;">
        <div class="modal-card" style="pointer-events: auto !important; cursor: default;">
          <h1 id="hud-winner-title" style="font-size: 32px; color: #ffbb00; margin: 0 0 10px 0;">VICTORY!</h1>
          <p id="hud-winner-desc" style="font-size: 16px; color: #8da2c0; margin-bottom: 20px;">Match Finished</p>

          <div id="hud-scoreboard-table" style="width: 100%; margin-bottom: 24px;"></div>

          <button id="btn-return-lobby" class="btn btn-primary" style="width: 100%; pointer-events: auto !important; cursor: pointer;">Return to Lobby</button>
          <button id="btn-delete-match-end" class="btn" style="width: 100%; margin-top: 10px; padding: 12px; font-size: 14px; font-weight: 800; background: rgba(255, 42, 85, 0.25); border: 1px solid #ff2a55; color: #ff2a55; border-radius: 10px; display: none; cursor: pointer; pointer-events: auto !important;">🗑️ Delete Room & Close Match</button>
        </div>
      </div>
    `;

    this.container.appendChild(hud);

    this.hpFillEl = hud.querySelector('#hud-hp-fill') as HTMLElement;
    this.hpTextEl = hud.querySelector('#hud-hp-text') as HTMLElement;
    this.ammoCurrentEl = hud.querySelector('#hud-ammo-current') as HTMLElement;
    this.ammoMaxEl = hud.querySelector('#hud-ammo-max') as HTMLElement;
    this.reloadRingEl = hud.querySelector('#hud-reload-ring') as HTMLElement;
    this.crosshairEl = hud.querySelector('#hud-crosshair') as HTMLElement;
    this.adsScopeOverlay = hud.querySelector('#hud-ads-scope') as HTMLElement;
    this.damageVignetteEl = hud.querySelector('#hud-damage-vignette') as HTMLElement;
    this.teleportVignetteEl = hud.querySelector('#hud-teleport-vignette') as HTMLElement;
    this.killfeedEl = hud.querySelector('#hud-killfeed') as HTMLElement;
    this.countdownEl = hud.querySelector('#hud-countdown') as HTMLElement;
    this.gameOverModalEl = hud.querySelector('#hud-game-over') as HTMLElement;

    this.powerupBtnEl = hud.querySelector('#btn-powerup') as HTMLElement;
    this.powerupIconEl = hud.querySelector('#hud-powerup-icon') as HTMLElement;
    this.powerupLabelEl = hud.querySelector('#hud-powerup-label') as HTMLElement;
    this.powerupTimerBarEl = hud.querySelector('#hud-powerup-timer-bar') as HTMLElement;
    this.shieldContainerEl = hud.querySelector('#hud-shield-container') as HTMLElement;
    this.shieldTextEl = hud.querySelector('#hud-shield-text') as HTMLElement;
    this.shieldFillEl = hud.querySelector('#hud-shield-fill') as HTMLElement;
    this.btnDashboardEl = hud.querySelector('#btn-hud-dashboard') as HTMLElement;
    this.btnSettingsEl = hud.querySelector('#btn-hud-settings') as HTMLElement;
    this.waveBannerEl = hud.querySelector('#hud-wave-banner') as HTMLElement;
    this.waveBannerTextEl = hud.querySelector('#hud-wave-banner-text') as HTMLElement;
    this.bossBannerEl = hud.querySelector('#hud-boss-banner') as HTMLElement;
    this.bossNameEl = hud.querySelector('#hud-boss-name') as HTMLElement;
    this.bossPhaseEl = hud.querySelector('#hud-boss-phase') as HTMLElement;
    this.bossHpFillEl = hud.querySelector('#hud-boss-hp-fill') as HTMLElement;
    this.bossShieldFillEl = hud.querySelector('#hud-boss-shield-fill') as HTMLElement;
    this.modeEl = hud.querySelector('#hud-match-mode');
    this.scoreEl = hud.querySelector('#hud-match-score');
    this.fragEl = hud.querySelector('#hud-frag-limit');

    const bindAction = (el: HTMLElement, action: () => void) => {
      const handler = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        action();
      };
      el.addEventListener('click', handler);
      el.addEventListener('touchstart', handler, { passive: false });
    };

    if (this.powerupBtnEl) {
      bindAction(this.powerupBtnEl, () => this.onPowerupClick?.());
    }
    if (this.btnDashboardEl) {
      bindAction(this.btnDashboardEl, () => this.onOpenDashboard?.());
    }
    if (this.btnSettingsEl) {
      bindAction(this.btnSettingsEl, () => this.onOpenSettings?.());
    }
  }

  public updateBossState(payload: BossStatePayload): void {
    if (!this.bossBannerEl) return;
    if (!payload || payload.health <= 0 || !payload.bossId) {
      this.bossBannerEl.style.display = 'none';
      return;
    }

    this.bossBannerEl.style.display = 'flex';
    if (this.bossNameEl) this.bossNameEl.textContent = payload.name;
    if (this.bossPhaseEl) this.bossPhaseEl.textContent = `PHASE ${payload.phase}`;

    const maxHp = payload.maxHealth || 100;
    const hpPct = Math.max(0, Math.min(100, (payload.health / maxHp) * 100));
    if (this.bossHpFillEl) this.bossHpFillEl.style.width = `${hpPct}%`;

    if (payload.shield > 0 && this.bossShieldFillEl) {
      this.bossShieldFillEl.style.display = 'block';
      this.bossShieldFillEl.style.width = `${Math.min(100, (payload.shield / 100) * 100)}%`;
    } else if (this.bossShieldFillEl) {
      this.bossShieldFillEl.style.display = 'none';
    }
  }

  public setVisible(visible: boolean): void {
    const hud = document.getElementById('touch-hud');
    if (hud) hud.style.display = visible ? 'block' : 'none';
  }

  public updateHealth(hp: number, maxHp: number = 100): void {
    if (hp === this.lastHp && maxHp === this.lastMaxHp) return;
    this.lastHp = hp;
    this.lastMaxHp = maxHp;

    const percent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
    this.hpFillEl.style.width = `${percent}%`;
    this.hpTextEl.textContent = `${Math.round(hp)}`;

    if (percent < 30) {
      this.hpFillEl.style.background = '#ff2a55';
    } else if (percent < 60) {
      this.hpFillEl.style.background = '#ffbb00';
    } else {
      this.hpFillEl.style.background = 'linear-gradient(90deg, #00d2ff, #00ff88)';
    }
  }

  public flashDamage(): void {
    this.damageVignetteEl.style.opacity = '1';
    setTimeout(() => {
      this.damageVignetteEl.style.opacity = '0';
    }, 200);
  }

  public showTeleportEffect(): void {
    if (!this.teleportVignetteEl) return;
    this.teleportVignetteEl.style.transition = 'none';
    this.teleportVignetteEl.style.opacity = '1';
    requestAnimationFrame(() => {
      this.teleportVignetteEl.style.transition = 'opacity 0.4s ease-out';
      this.teleportVignetteEl.style.opacity = '0';
    });
  }

  public updateAmmo(
    current: number,
    stats: WeaponStats,
    isReloading: boolean,
    reloadProgress: number,
    reserve: number = 0
  ): void {
    const isKatana = stats.type === 'katana';
    if (isKatana) {
      if (this.lastWeaponType !== 'katana') {
        this.lastWeaponType = 'katana';
        this.ammoCurrentEl.textContent = '∞';
        this.ammoMaxEl.textContent = '∞';
        this.reloadRingEl.setAttribute('stroke-dasharray', '100, 100');
        this.reloadRingEl.setAttribute('stroke', '#00d2ff');
      }
      return;
    }
    this.lastWeaponType = stats.type;

    if (current !== this.lastAmmoCurrent) {
      this.lastAmmoCurrent = current;
      this.ammoCurrentEl.textContent = `${current}`;
    }
    if (reserve !== this.lastAmmoReserve) {
      this.lastAmmoReserve = reserve;
      this.ammoMaxEl.textContent = `${reserve}`;
    }

    if (isReloading) {
      const p = Math.round(reloadProgress * 100);
      if (!this.lastIsReloading || p !== this.lastReloadPercent) {
        this.lastIsReloading = true;
        this.lastReloadPercent = p;
        this.reloadRingEl.setAttribute('stroke-dasharray', `${p}, 100`);
        this.reloadRingEl.setAttribute('stroke', '#ffbb00');
      }
    } else {
      const magPercent = Math.round((current / stats.magazineSize) * 100);
      if (this.lastIsReloading || magPercent !== this.lastReloadPercent) {
        this.lastIsReloading = false;
        this.lastReloadPercent = magPercent;
        this.reloadRingEl.setAttribute('stroke-dasharray', `${magPercent}, 100`);
        this.reloadRingEl.setAttribute('stroke', current <= 3 ? '#ff2a55' : '#00d2ff');
      }
    }
  }

  public setAdsScope(active: boolean, weaponType: WeaponType): void {
    if (active === this.lastAdsActive && weaponType === this.lastAdsWeaponType) return;
    this.lastAdsActive = active;
    this.lastAdsWeaponType = weaponType;
    this.adsScopeOverlay.style.display = active ? 'block' : 'none';
    this.crosshairEl.style.display = active && (weaponType === 'sniper' || weaponType === 'railgun') ? 'none' : 'block';
  }

  public updateCrosshairSpread(moving: boolean, sliding: boolean, recoilKick: number = 0): void {
    const baseScale = sliding ? 1.5 : moving ? 1.25 : 1.0;
    const scale = Math.min(2.2, baseScale + recoilKick);
    if (Math.abs(scale - this.lastCrosshairScale) < 0.01) return;
    this.lastCrosshairScale = scale;
    this.crosshairEl.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(3)})`;
  }

  public showCountdown(count: number): void {
    this.countdownEl.style.display = 'block';
    if (count > 0) {
      this.countdownEl.textContent = `${count}`;
      this.countdownEl.style.color = '#00d2ff';
    } else {
      this.countdownEl.textContent = 'GO!';
      this.countdownEl.style.color = '#00ff88';
      setTimeout(() => {
        this.countdownEl.style.display = 'none';
      }, 700);
    }
  }

  public addKillfeed(killerName: string, victimName: string, weapon: string, isHeadshot: boolean): void {
    const item = document.createElement('div');
    item.style.cssText = `
      background: rgba(15, 20, 32, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 8px;
      padding: 4px 12px;
      color: white;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      gap: 6px;
      backdrop-filter: blur(4px);
      animation: fadeIn 0.15s ease-out;
    `;

    const icon = WEAPONS[weapon as WeaponType]?.icon || (weapon === 'void' ? '💀' : '🔫');
    const hs = isHeadshot ? '<span style="color: #ff2a55; font-size: 10px;">[HEADSHOT]</span>' : '';

    if (weapon === 'void' || killerName === victimName) {
      item.innerHTML = `
        <span style="color: #ff5577;">💀 ${victimName}</span>
        <span style="color: #8da2c0; font-size: 11px;">fell into the void</span>
      `;
    } else {
      item.innerHTML = `
        <span style="color: #00d2ff;">${killerName}</span>
        <span>${icon}</span>
        ${hs}
        <span style="color: #ff5577;">${victimName}</span>
      `;
    }

    this.killfeedEl.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  public updatePowerupSlot(type: PowerupType | null, active: boolean, remainingSec: number): void {
    if (!this.powerupBtnEl) return;

    if (!type) {
      if (this.lastPowerupType !== null) {
        this.lastPowerupType = null;
        this.lastPowerupActive = false;
        this.powerupBtnEl.style.display = 'none';
      }
      return;
    }

    if (this.lastPowerupType !== type) {
      this.lastPowerupType = type;
      this.powerupBtnEl.style.display = 'flex';
      const def = POWERUPS[type];
      if (this.powerupIconEl && def) {
        this.powerupIconEl.textContent = def.icon;
      }
    }

    const def = POWERUPS[type];
    if (active) {
      const roundedSec = Math.ceil(remainingSec);
      if (!this.lastPowerupActive || roundedSec !== this.lastPowerupRemainingSec) {
        this.lastPowerupActive = true;
        this.lastPowerupRemainingSec = roundedSec;
        if (this.powerupLabelEl) {
          this.powerupLabelEl.textContent = `${roundedSec}s`;
          this.powerupLabelEl.style.color = '#00ff88';
        }
      }
      if (def) {
        const pct = Math.round(Math.max(0, Math.min(100, (remainingSec / def.durationSec) * 100)));
        if (pct !== this.lastPowerupPct) {
          this.lastPowerupPct = pct;
          if (this.powerupTimerBarEl) {
            this.powerupTimerBarEl.style.display = 'block';
            this.powerupTimerBarEl.style.width = `${pct}%`;
          }
        }
      }
    } else {
      if (this.lastPowerupActive !== false) {
        this.lastPowerupActive = false;
        if (this.powerupLabelEl) {
          this.powerupLabelEl.textContent = 'USE [Q]';
          this.powerupLabelEl.style.color = '#ffbb00';
        }
        if (this.powerupTimerBarEl) {
          this.powerupTimerBarEl.style.display = 'none';
        }
      }
    }
  }

  public updateShield(shieldHp: number, maxShield: number = 50): void {
    if (!this.shieldContainerEl) return;
    if (shieldHp === this.lastShieldHp && maxShield === this.lastMaxShield) return;
    this.lastShieldHp = shieldHp;
    this.lastMaxShield = maxShield;

    if (shieldHp <= 0) {
      this.shieldContainerEl.style.display = 'none';
      return;
    }

    this.shieldContainerEl.style.display = 'flex';
    if (this.shieldTextEl) {
      this.shieldTextEl.textContent = `${Math.round(shieldHp)}`;
    }
    if (this.shieldFillEl) {
      const pct = Math.max(0, Math.min(100, (shieldHp / maxShield) * 100));
      this.shieldFillEl.style.width = `${pct}%`;
    }
  }

  public updateMatchHeader(
    mode: string,
    scoreA: number,
    scoreB: number,
    goal: number,
    teamScores?: { blue: number; red: number },
    waveState?: any
  ): void {
    const modeEl = this.modeEl || document.getElementById('hud-match-mode');
    const scoreEl = this.scoreEl || document.getElementById('hud-match-score');
    const fragEl = this.fragEl || document.getElementById('hud-frag-limit');

    if (mode === 'wave') {
      const waveNum = waveState?.currentWave || 1;
      const aliveBots = waveState?.aliveBotsCount ?? 0;
      if (
        this.lastMatchMode !== 'wave' ||
        this.lastWaveNum !== waveNum ||
        this.lastAliveBots !== aliveBots
      ) {
        this.lastMatchMode = 'wave';
        this.lastWaveNum = waveNum;
        this.lastAliveBots = aliveBots;
        if (modeEl) modeEl.textContent = '🧟 WAVE SURVIVAL';
        if (scoreEl) scoreEl.textContent = `WAVE ${waveNum}`;
        if (fragEl) fragEl.textContent = `🤖 BOTS: ${aliveBots}`;
      }
      return;
    }

    const teamBlue = teamScores?.blue ?? -1;
    const teamRed = teamScores?.red ?? -1;

    if (
      this.lastMatchMode !== mode ||
      this.lastScoreA !== scoreA ||
      this.lastScoreB !== scoreB ||
      this.lastGoal !== goal ||
      this.lastTeamBlue !== teamBlue ||
      this.lastTeamRed !== teamRed
    ) {
      this.lastMatchMode = mode;
      this.lastScoreA = scoreA;
      this.lastScoreB = scoreB;
      this.lastGoal = goal;
      this.lastTeamBlue = teamBlue;
      this.lastTeamRed = teamRed;

      if (modeEl) modeEl.textContent = mode.toUpperCase();
      if (fragEl) fragEl.textContent = `GOAL: ${goal}`;

      if (mode === '4v4' && teamScores) {
        if (scoreEl) {
          scoreEl.innerHTML = `<span style="color: #00d2ff;">BLU ${teamScores.blue}</span> - <span style="color: #ff2a55;">RED ${teamScores.red}</span>`;
        }
      } else {
        if (scoreEl) scoreEl.textContent = `${scoreA} - ${scoreB}`;
      }
    }
  }

  public showWaveCleared(waveNum: number, nextInSec: number): void {
    if (!this.waveBannerEl || !this.waveBannerTextEl) return;
    this.waveBannerTextEl.textContent = `🎉 WAVE ${waveNum} CLEARED! NEXT IN ${nextInSec}s`;
    this.waveBannerEl.style.display = 'flex';
  }

  public updateWaveCountdown(nextInSec: number): void {
    if (!this.waveBannerEl || !this.waveBannerTextEl) return;
    if (nextInSec > 0) {
      this.waveBannerTextEl.textContent = `⏳ PREPARE! NEXT WAVE IN ${nextInSec}s`;
      this.waveBannerEl.style.display = 'flex';
    } else {
      this.waveBannerEl.style.display = 'none';
    }
  }

  public hideWaveBanner(): void {
    if (this.waveBannerEl) {
      this.waveBannerEl.style.display = 'none';
    }
  }

  public showGameOver(
    payload: GameOverPayload,
    myId: string,
    onReturnToLobby: () => void,
    mode?: string,
    currentWave?: number,
    isHost?: boolean,
    onDeleteRoom?: () => void
  ): void {
    const titleEl = document.getElementById('hud-winner-title');
    const descEl = document.getElementById('hud-winner-desc');
    const tableEl = document.getElementById('hud-scoreboard-table');

    this.hideWaveBanner();

    if (mode === 'wave') {
      const victory = payload.winningTeam === 'blue';
      if (titleEl) {
        titleEl.textContent = victory ? '🏆 SECTOR DEFENDED! VICTORY!' : '💀 SQUAD WIPED! DEFEAT';
        titleEl.style.color = victory ? '#00ff88' : '#ff2a55';
      }
      if (descEl) {
        descEl.textContent = victory
          ? 'All enemy waves defeated! Outstanding teamwork, pilots!'
          : `Squad fell at Wave ${currentWave || 1}. Answer grammar questions to gear up and try again!`;
      }
    } else if (payload.winningTeam && payload.winningTeam !== 'none') {
      if (titleEl) {
        titleEl.textContent = `${payload.winningTeam.toUpperCase()} TEAM VICTORIOUS!`;
        titleEl.style.color = payload.winningTeam === 'blue' ? '#00d2ff' : '#ff2a55';
      }
      if (descEl) {
        descEl.textContent = `${payload.winnerName} and team conquered the match!`;
      }
    } else {
      const isWinner = payload.winnerId === myId;
      if (titleEl) {
        titleEl.textContent = isWinner ? '🏆 VICTORY!' : '💀 DEFEAT';
        titleEl.style.color = isWinner ? '#ffbb00' : '#ff2a55';
      }
      if (descEl) {
        descEl.textContent = `${payload.winnerName} won the match!`;
      }
    }

    if (tableEl) {
      let rows = `
        <div style="display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #334; font-size: 11px; color: #8da2c0;">
          <span>PLAYER</span>
          <span>KILLS</span>
          <span>DEATHS</span>
          <span>SCORE</span>
        </div>
      `;
      for (const p of payload.scores) {
        const isMe = p.id === myId;
        rows += `
          <div style="display: flex; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid #223; font-weight: bold; font-size: 14px; color: ${isMe ? '#00d2ff' : '#fff'};">
            <span>${p.name} ${isMe ? '(YOU)' : ''}</span>
            <span>${p.kills}</span>
            <span>${p.deaths}</span>
            <span style="color: #ffbb00;">${p.score}</span>
          </div>
        `;
      }
      tableEl.innerHTML = rows;
    }

    const returnBtn = document.getElementById('btn-return-lobby');
    if (returnBtn) {
      returnBtn.onclick = () => {
        this.gameOverModalEl.style.display = 'none';
        onReturnToLobby();
      };
    }

    const deleteBtn = document.getElementById('btn-delete-match-end');
    if (deleteBtn) {
      if (isHost && onDeleteRoom) {
        deleteBtn.style.display = 'block';
        deleteBtn.onclick = () => {
          if (confirm('Delete this game room? All players will be returned to the lobby.')) {
            this.gameOverModalEl.style.display = 'none';
            onDeleteRoom();
          }
        };
      } else {
        deleteBtn.style.display = 'none';
      }
    }

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    this.gameOverModalEl.style.display = 'flex';
  }
}

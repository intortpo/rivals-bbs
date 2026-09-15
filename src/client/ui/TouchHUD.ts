import { GameOverPayload, WeaponStats, WeaponType } from '../../shared/types.js';

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
  private killfeedEl!: HTMLElement;
  private countdownEl!: HTMLElement;
  private gameOverModalEl!: HTMLElement;

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

      <!-- Health Bar (Bottom Left) -->
      <div style="position: absolute; bottom: 22px; left: 20px; display: flex; flex-direction: column; gap: 4px; pointer-events: auto;">
        <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: 800; color: #fff; text-shadow: 0 1px 4px #000;">
          <span>HEALTH</span>
          <span id="hud-hp-text">100</span>
        </div>
        <div style="width: 160px; height: 14px; background: rgba(15, 20, 32, 0.8); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 7px; overflow: hidden; backdrop-filter: blur(5px);">
          <div id="hud-hp-fill" style="width: 100%; height: 100%; background: linear-gradient(90deg, #00d2ff, #00ff88); transition: width 0.15s ease, background 0.2s ease;"></div>
        </div>
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
      <div id="hud-game-over" class="modal-backdrop" style="display: none;">
        <div class="modal-card">
          <h1 id="hud-winner-title" style="font-size: 32px; color: #ffbb00; margin: 0 0 10px 0;">VICTORY!</h1>
          <p id="hud-winner-desc" style="font-size: 16px; color: #8da2c0; margin-bottom: 20px;">Match Finished</p>

          <div id="hud-scoreboard-table" style="width: 100%; margin-bottom: 24px;"></div>

          <button id="btn-return-lobby" class="btn btn-primary" style="width: 100%;">Return to Lobby</button>
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
    this.killfeedEl = hud.querySelector('#hud-killfeed') as HTMLElement;
    this.countdownEl = hud.querySelector('#hud-countdown') as HTMLElement;
    this.gameOverModalEl = hud.querySelector('#hud-game-over') as HTMLElement;
  }

  public setVisible(visible: boolean): void {
    const hud = document.getElementById('touch-hud');
    if (hud) hud.style.display = visible ? 'block' : 'none';
  }

  public updateHealth(hp: number, maxHp: number = 100): void {
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

  public updateAmmo(current: number, stats: WeaponStats, isReloading: boolean, reloadProgress: number): void {
    if (stats.type === 'katana') {
      this.ammoCurrentEl.textContent = '∞';
      this.ammoMaxEl.textContent = '∞';
      this.reloadRingEl.setAttribute('stroke-dasharray', '100, 100');
      return;
    }

    this.ammoCurrentEl.textContent = `${current}`;
    this.ammoMaxEl.textContent = `${stats.magazineSize}`;

    if (isReloading) {
      const p = Math.round(reloadProgress * 100);
      this.reloadRingEl.setAttribute('stroke-dasharray', `${p}, 100`);
      this.reloadRingEl.setAttribute('stroke', '#ffbb00');
    } else {
      const magPercent = (current / stats.magazineSize) * 100;
      this.reloadRingEl.setAttribute('stroke-dasharray', `${magPercent}, 100`);
      this.reloadRingEl.setAttribute('stroke', current <= 3 ? '#ff2a55' : '#00d2ff');
    }
  }

  public setAdsScope(active: boolean, weaponType: WeaponType): void {
    this.adsScopeOverlay.style.display = active ? 'block' : 'none';
    this.crosshairEl.style.display = active && weaponType === 'sniper' ? 'none' : 'block';
  }

  public updateCrosshairSpread(moving: boolean, sliding: boolean): void {
    const scale = sliding ? 1.6 : moving ? 1.3 : 1.0;
    this.crosshairEl.style.transform = `translate(-50%, -50%) scale(${scale})`;
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

    const icon = weapon === 'sniper' ? '🎯' : weapon === 'shotgun' ? '💥' : weapon === 'katana' ? '⚔️' : '🔫';
    const hs = isHeadshot ? '<span style="color: #ff2a55; font-size: 10px;">[HEADSHOT]</span>' : '';

    item.innerHTML = `
      <span style="color: #00d2ff;">${killerName}</span>
      <span>${icon}</span>
      ${hs}
      <span style="color: #ff5577;">${victimName}</span>
    `;

    this.killfeedEl.appendChild(item);
    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  public updateMatchHeader(mode: string, scoreA: number, scoreB: number, goal: number): void {
    const modeEl = document.getElementById('hud-match-mode');
    const scoreEl = document.getElementById('hud-match-score');
    const fragEl = document.getElementById('hud-frag-limit');
    if (modeEl) modeEl.textContent = mode.toUpperCase();
    if (scoreEl) scoreEl.textContent = `${scoreA} - ${scoreB}`;
    if (fragEl) fragEl.textContent = `GOAL: ${goal}`;
  }

  public showGameOver(payload: GameOverPayload, myId: string, onReturnToLobby: () => void): void {
    const isWinner = payload.winnerId === myId;
    const titleEl = document.getElementById('hud-winner-title');
    const descEl = document.getElementById('hud-winner-desc');
    const tableEl = document.getElementById('hud-scoreboard-table');

    if (titleEl) {
      titleEl.textContent = isWinner ? '🏆 VICTORY!' : '💀 DEFEAT';
      titleEl.style.color = isWinner ? '#ffbb00' : '#ff2a55';
    }
    if (descEl) {
      descEl.textContent = `${payload.winnerName} won the match!`;
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

    this.gameOverModalEl.style.display = 'flex';
  }
}

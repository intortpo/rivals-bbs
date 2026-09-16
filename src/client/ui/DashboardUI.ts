import { PublicUserProfile } from '../../server/auth/UserManager.js';

export class DashboardUI {
  private container: HTMLElement;
  private modalEl!: HTMLElement;
  private currentUser: PublicUserProfile | null = null;
  private onCloseCb?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildDOM();
  }

  public isOpen(): boolean {
    return this.modalEl.style.display === 'flex';
  }

  public open(user: PublicUserProfile | null, onClose?: () => void): void {
    this.currentUser = user;
    this.onCloseCb = onClose;

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    this.renderData();
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    if (this.onCloseCb) this.onCloseCb();
  }

  private buildDOM(): void {
    const modal = document.createElement('div');
    modal.id = 'dashboard-modal';
    modal.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(8, 12, 22, 0.9);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 960;
      padding: 16px;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    modal.innerHTML = `
      <div style="
        width: 100%;
        max-width: 580px;
        background: #14192b;
        border: 2px solid #00d2ff;
        border-radius: 20px;
        box-shadow: 0 0 40px rgba(0, 210, 255, 0.35);
        color: white;
        padding: 22px;
        max-height: 92vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      ">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #232c49; padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px;">📊</span>
            <div>
              <div style="font-size: 19px; font-weight: 900; letter-spacing: 1px; color: #00d2ff;">
                PILOT CAREER DASHBOARD
              </div>
              <div id="dash-pilot-rank" style="font-size: 11px; font-weight: 800; color: #ffbb00; letter-spacing: 0.5px;">
                RANK: CADET RECRUIT
              </div>
            </div>
          </div>
          <button id="btn-close-dashboard" style="
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
            border-radius: 50%;
            width: 34px;
            height: 34px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          ">✕</button>
        </div>

        <!-- Pilot Identity Bar -->
        <div style="display: flex; align-items: center; gap: 14px; background: #0e1220; border: 1px solid #252e4d; border-radius: 14px; padding: 12px 16px;">
          <div style="font-size: 32px; width: 50px; height: 50px; background: rgba(0, 210, 255, 0.15); border: 2px solid #00d2ff; border-radius: 12px; display: flex; align-items: center; justify-content: center;">
            👨‍✈️
          </div>
          <div style="flex: 1;">
            <div id="dash-username" style="font-size: 18px; font-weight: 900; color: white;">Guest Pilot</div>
            <div id="dash-email" style="font-size: 12px; color: #8da2c0;">Not signed in with @bbs.ac.th</div>
          </div>
        </div>

        <!-- Career Combat Overview Grid -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;">
          <div class="dash-stat-box">
            <div class="dash-stat-title">WIN RATE</div>
            <div id="dash-win-rate" class="dash-stat-value" style="color: #00ff88;">0%</div>
            <div id="dash-matches-count" class="dash-stat-sub">0 Matches</div>
          </div>
          <div class="dash-stat-box">
            <div class="dash-stat-title">K / D RATIO</div>
            <div id="dash-kd-ratio" class="dash-stat-value" style="color: #00d2ff;">0.00</div>
            <div id="dash-kills-deaths" class="dash-stat-sub">0 Kills / 0 Deaths</div>
          </div>
          <div class="dash-stat-box">
            <div class="dash-stat-title">VICTORIES</div>
            <div id="dash-wins-count" class="dash-stat-value" style="color: #ffbb00;">0</div>
            <div class="dash-stat-sub">Total Wins</div>
          </div>
        </div>

        <!-- BBS Grammar Mastery Grid -->
        <div style="background: #0e1220; border: 1px solid #252e4d; border-radius: 14px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 800; color: #00d2ff; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
            <span>📚</span> BBS PRESENT CONTINUOUS MASTERY
          </div>
          <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; text-align: center;">
            <div style="background: #14192b; border-radius: 10px; padding: 8px 4px;">
              <div style="font-size: 10px; color: #8da2c0; font-weight: bold;">ACCURACY</div>
              <div id="dash-grammar-accuracy" style="font-size: 16px; font-weight: 900; color: #00ff88; margin-top: 2px;">0%</div>
            </div>
            <div style="background: #14192b; border-radius: 10px; padding: 8px 4px;">
              <div style="font-size: 10px; color: #8da2c0; font-weight: bold;">MAX STREAK</div>
              <div id="dash-grammar-streak" style="font-size: 16px; font-weight: 900; color: #ff2a55; margin-top: 2px;">0</div>
            </div>
            <div style="background: #14192b; border-radius: 10px; padding: 8px 4px;">
              <div style="font-size: 10px; color: #8da2c0; font-weight: bold;">DRILLS SOLVED</div>
              <div id="dash-grammar-solved" style="font-size: 16px; font-weight: 900; color: #ffbb00; margin-top: 2px;">0</div>
            </div>
            <div style="background: #14192b; border-radius: 10px; padding: 8px 4px;">
              <div style="font-size: 10px; color: #8da2c0; font-weight: bold;">AMMO EARNED</div>
              <div id="dash-ammo-earned" style="font-size: 16px; font-weight: 900; color: #00d2ff; margin-top: 2px;">+0</div>
            </div>
          </div>
        </div>

        <!-- Recent Match History Table -->
        <div style="background: #0e1220; border: 1px solid #252e4d; border-radius: 14px; padding: 14px;">
          <div style="font-size: 13px; font-weight: 800; color: #8da2c0; margin-bottom: 8px;">
            🕒 RECENT MATCH HISTORY
          </div>
          <div id="dash-match-history-table" style="max-height: 180px; overflow-y: auto; display: flex; flex-direction: column; gap: 6px;">
            <div style="color: #61738d; font-size: 12px; text-align: center; padding: 16px;">
              No match history recorded yet. Complete a 1v1 or 4v4 match!
            </div>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.modalEl = modal;

    this.injectStyles();
    this.attachEvents();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .dash-stat-box {
        background: #0e1220;
        border: 1px solid #252e4d;
        border-radius: 14px;
        padding: 12px;
        text-align: center;
      }
      .dash-stat-title {
        font-size: 11px;
        font-weight: 800;
        color: #8da2c0;
        letter-spacing: 0.8px;
      }
      .dash-stat-value {
        font-size: 26px;
        font-weight: 900;
        margin: 4px 0 2px 0;
      }
      .dash-stat-sub {
        font-size: 10px;
        color: #8da2c0;
      }
    `;
    document.head.appendChild(style);
  }

  private renderData(): void {
    const u = this.currentUser;
    const stats = u?.stats;

    const rankEl = document.getElementById('dash-pilot-rank');
    const userEl = document.getElementById('dash-username');
    const emailEl = document.getElementById('dash-email');

    const winRateEl = document.getElementById('dash-win-rate');
    const matchesEl = document.getElementById('dash-matches-count');
    const kdEl = document.getElementById('dash-kd-ratio');
    const killsDeathsEl = document.getElementById('dash-kills-deaths');
    const winsEl = document.getElementById('dash-wins-count');

    const accuracyEl = document.getElementById('dash-grammar-accuracy');
    const streakEl = document.getElementById('dash-grammar-streak');
    const solvedEl = document.getElementById('dash-grammar-solved');
    const ammoEl = document.getElementById('dash-ammo-earned');
    const historyTable = document.getElementById('dash-match-history-table');

    if (u) {
      if (userEl) userEl.textContent = u.username;
      if (emailEl) emailEl.textContent = u.email;

      const games = stats?.gamesPlayed || 0;
      const wins = stats?.wins || 0;
      const kills = stats?.kills || 0;
      const deaths = stats?.deaths || 0;
      const winRate = games > 0 ? Math.round((wins / games) * 100) : 0;
      const kd = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);

      if (winRateEl) winRateEl.textContent = `${winRate}%`;
      if (matchesEl) matchesEl.textContent = `${games} Matches (${games - wins} Defeats)`;
      if (kdEl) kdEl.textContent = `${kd}`;
      if (killsDeathsEl) killsDeathsEl.textContent = `${kills} Kills / ${deaths} Deaths`;
      if (winsEl) winsEl.textContent = `${wins}`;

      // Grammar stats
      const answered = stats?.grammarAnswered || 0;
      const correct = stats?.grammarCorrect || 0;
      const acc = answered > 0 ? Math.round((correct / answered) * 100) : 0;
      const streak = stats?.highestGrammarStreak || 0;
      const ammo = stats?.ammoEarned || 0;

      if (accuracyEl) accuracyEl.textContent = `${acc}%`;
      if (streakEl) streakEl.textContent = `🔥 ${streak}`;
      if (solvedEl) solvedEl.textContent = `${correct}`;
      if (ammoEl) ammoEl.textContent = `+${ammo}`;

      // Calculate title rank
      if (rankEl) {
        if (correct >= 50 && kills >= 30) {
          rankEl.textContent = 'RANK: 🌟 BBS CYBER ACE';
        } else if (correct >= 20 && kills >= 15) {
          rankEl.textContent = 'RANK: ⚡ TACTICAL STRIKER';
        } else if (correct >= 6 || kills >= 5) {
          rankEl.textContent = 'RANK: 🎯 COMBAT SCOUT';
        } else {
          rankEl.textContent = 'RANK: 🔰 CADET RECRUIT';
        }
      }

      // Render Match History Table
      if (historyTable && stats?.matchHistory && stats.matchHistory.length > 0) {
        let rows = '';
        for (const m of stats.matchHistory) {
          const outcomeColor = m.won ? '#00ff88' : '#ff2a55';
          const outcomeText = m.won ? 'VICTORY' : 'DEFEAT';
          const dateStr = new Date(m.date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
          rows += `
            <div style="display: flex; justify-content: space-between; align-items: center; background: #14192b; border: 1px solid #20273f; border-radius: 8px; padding: 6px 12px; font-size: 12px;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="color: ${outcomeColor}; font-weight: 900;">${outcomeText}</span>
                <span style="color: #00d2ff; font-weight: bold;">${m.mode.toUpperCase()}</span>
                <span style="color: #8da2c0;">${m.map}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; font-weight: bold;">
                <span style="color: white;">⚡ ${m.kills} K / ${m.deaths} D</span>
                <span style="color: #8da2c0; font-size: 10px;">${dateStr}</span>
              </div>
            </div>
          `;
        }
        historyTable.innerHTML = rows;
      }
    } else {
      if (userEl) userEl.textContent = '👤 Guest Pilot';
      if (emailEl) emailEl.textContent = 'Sign in with @bbs.ac.th to save progress';
      if (rankEl) rankEl.textContent = 'RANK: 🔰 GUEST PILOT';
      if (winRateEl) winRateEl.textContent = '0%';
      if (matchesEl) matchesEl.textContent = '0 Matches';
      if (kdEl) kdEl.textContent = '0.00';
      if (killsDeathsEl) killsDeathsEl.textContent = '0 Kills / 0 Deaths';
      if (winsEl) winsEl.textContent = '0';
      if (accuracyEl) accuracyEl.textContent = '0%';
      if (streakEl) streakEl.textContent = '0';
      if (solvedEl) solvedEl.textContent = '0';
      if (ammoEl) ammoEl.textContent = '+0';
    }
  }

  private attachEvents(): void {
    document.getElementById('btn-close-dashboard')?.addEventListener('click', () => {
      this.close();
    });
  }
}

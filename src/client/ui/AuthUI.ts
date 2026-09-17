import { PublicUserProfile } from '../../server/auth/UserManager.js';
export type { PublicUserProfile };

export class AuthUI {
  private container: HTMLElement;
  public currentUser: PublicUserProfile | null = null;
  private modalEl!: HTMLElement;
  private onUserChangedCb?: (user: PublicUserProfile | null) => void;
  public onOpenDashboardCb?: () => void;

  constructor(
    container: HTMLElement,
    onUserChanged?: (user: PublicUserProfile | null) => void,
    onOpenDashboard?: () => void
  ) {
    this.container = container;
    this.onUserChangedCb = onUserChanged;
    this.onOpenDashboardCb = onOpenDashboard;
    this.buildAuthModal();
    this.restoreSession();
  }

  public getCurrentUser(): PublicUserProfile | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return localStorage.getItem('rivals_auth_token');
  }

  public openModal(initialTab?: 'login' | 'register' | 'account'): void {
    this.modalEl.style.display = 'flex';
    if (this.currentUser && initialTab !== 'login' && initialTab !== 'register') {
      this.showAccountView();
    } else {
      this.switchTab(initialTab === 'register' ? 'register' : 'login');
    }
  }

  public closeModal(): void {
    this.modalEl.style.display = 'none';
  }

  public signOut(): void {
    localStorage.removeItem('rivals_auth_token');
    this.currentUser = null;
    if (this.onUserChangedCb) {
      this.onUserChangedCb(null);
    }
    this.switchTab('login');
  }

  private async restoreSession(): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        this.currentUser = data.user;
        if (this.onUserChangedCb) {
          this.onUserChangedCb(this.currentUser);
        }
      } else {
        localStorage.removeItem('rivals_auth_token');
      }
    } catch (err) {
      console.warn('[AuthUI] Session restoration failed:', err);
    }
  }

  public async recordGrammarStats(
    questionsAnswered: number = 2,
    correctCount: number = 2,
    ammoAwarded: number = 60
  ): Promise<void> {
    const token = this.getToken();
    if (!token) return;

    try {
      const res = await fetch('/api/stats/grammar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ questionsAnswered, correctCount, ammoAwarded })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.user) {
          this.currentUser = data.user;
          if (this.onUserChangedCb) {
            this.onUserChangedCb(this.currentUser);
          }
        }
      }
    } catch (err) {
      console.warn('[AuthUI] Failed to sync grammar stats:', err);
    }
  }

  private showAccountView(): void {
    const secAuthForms = document.getElementById('auth-section-forms');
    const secAccount = document.getElementById('auth-section-account');
    if (secAuthForms) secAuthForms.style.display = 'none';
    if (secAccount) secAccount.style.display = 'flex';

    const u = this.currentUser;
    if (!u) return;

    const userTitleEl = document.getElementById('auth-acc-username');
    const statsEl = document.getElementById('auth-acc-stats-summary');
    if (userTitleEl) userTitleEl.textContent = `⭐ ${u.displayName || u.username}`;

    const answered = u.stats?.grammarAnswered || 0;
    const correct = u.stats?.grammarCorrect || 0;
    const pct = answered > 0 ? Math.round((correct / answered) * 100) : 0;
    const ammo = u.stats?.ammoEarned || 0;
    const wins = u.stats?.wins || 0;
    const games = u.stats?.gamesPlayed || 0;

    if (statsEl) {
      statsEl.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 10px; font-size: 12px; text-align: left;">
          <div style="background: #0d1222; padding: 8px 10px; border-radius: 8px; border: 1px solid #232d4b;">
            <div style="color: #8da2c0; font-size: 10px;">GRAMMAR ACCURACY</div>
            <div style="font-weight: 800; color: #00ff88; font-size: 15px; margin-top: 2px;">${correct}/${answered} (${pct}%)</div>
          </div>
          <div style="background: #0d1222; padding: 8px 10px; border-radius: 8px; border: 1px solid #232d4b;">
            <div style="color: #8da2c0; font-size: 10px;">AMMO EARNED</div>
            <div style="font-weight: 800; color: #00d2ff; font-size: 15px; margin-top: 2px;">+${ammo} ⚡</div>
          </div>
          <div style="background: #0d1222; padding: 8px 10px; border-radius: 8px; border: 1px solid #232d4b;">
            <div style="color: #8da2c0; font-size: 10px;">CAREER VICTORIES</div>
            <div style="font-weight: 800; color: #ffbb00; font-size: 15px; margin-top: 2px;">${wins} Wins</div>
          </div>
          <div style="background: #0d1222; padding: 8px 10px; border-radius: 8px; border: 1px solid #232d4b;">
            <div style="color: #8da2c0; font-size: 10px;">TOTAL MATCHES</div>
            <div style="font-weight: 800; color: #ffffff; font-size: 15px; margin-top: 2px;">${games} Played</div>
          </div>
        </div>
      `;
    }
  }

  private switchTab(tab: 'login' | 'register'): void {
    const secAuthForms = document.getElementById('auth-section-forms');
    const secAccount = document.getElementById('auth-section-account');
    if (secAuthForms) secAuthForms.style.display = 'block';
    if (secAccount) secAccount.style.display = 'none';

    const tabLogin = document.getElementById('auth-tab-login');
    const tabRegister = document.getElementById('auth-tab-register');
    const formLogin = document.getElementById('auth-form-login');
    const formRegister = document.getElementById('auth-form-register');
    const errorEl = document.getElementById('auth-modal-error');
    if (errorEl) errorEl.textContent = '';

    if (tab === 'login') {
      tabLogin?.classList.add('active');
      tabRegister?.classList.remove('active');
      if (formLogin) formLogin.style.display = 'flex';
      if (formRegister) formRegister.style.display = 'none';
    } else {
      tabRegister?.classList.add('active');
      tabLogin?.classList.remove('active');
      if (formRegister) formRegister.style.display = 'flex';
      if (formLogin) formLogin.style.display = 'none';
    }
  }

  private buildAuthModal(): void {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-backdrop';
    modal.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(8, 12, 22, 0.88);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 950;
      padding: 16px;
      box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div class="modal-card" style="width: 100%; max-width: 400px; background: #151b2e; border: 1px solid #00d2ff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 35px rgba(0, 210, 255, 0.25); text-align: center; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <h2 style="font-size: 20px; font-weight: 900; margin: 0; color: #00d2ff; letter-spacing: 1px;">
            🎯 AIRSOFT PILOT ID
          </h2>
          <button id="btn-close-auth" style="background: transparent; border: none; color: #8da2c0; font-size: 22px; cursor: pointer;">✕</button>
        </div>

        <!-- Section 1: When user is already logged in (Account View) -->
        <div id="auth-section-account" style="display: none; flex-direction: column; gap: 12px;">
          <div style="background: #0e1322; border: 1px solid #00d2ff; border-radius: 12px; padding: 14px; text-align: center;">
            <div style="font-size: 30px; margin-bottom: 4px;">👨‍✈️</div>
            <div id="auth-acc-username" style="font-size: 18px; font-weight: 900; color: #00d2ff;">Pilot</div>
            <div style="font-size: 11px; color: #00ff88; font-weight: bold; margin-top: 2px;">● REGISTERED PILOT ACTIVE</div>
            <div id="auth-acc-stats-summary"></div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 6px;">
            <button id="btn-auth-view-dash" class="btn btn-primary" style="padding: 10px; font-size: 14px; background: linear-gradient(135deg, #00d2ff, #0077ff); color: white;">
              📊 Open Career Dashboard
            </button>
            <div style="display: flex; gap: 8px;">
              <button id="btn-auth-switch-acc" class="btn btn-secondary" style="flex: 1; padding: 9px; font-size: 12px; color: #8da2c0; border-color: #2a3556;">
                🔁 Switch Account
              </button>
              <button id="btn-auth-signout" class="btn btn-secondary" style="flex: 1; padding: 9px; font-size: 12px; color: #ff2a55; border-color: rgba(255, 42, 85, 0.4);">
                🚪 Sign Out
              </button>
            </div>
          </div>
        </div>

        <!-- Section 2: When user is logged out (Login & Register Forms) -->
        <div id="auth-section-forms" style="display: block;">
          <p style="font-size: 12px; color: #8da2c0; margin: 0 0 14px 0;">
            Sign in or create an account with just a username and password to track your progress & combat stats!
          </p>

          <!-- Tabs -->
          <div style="display: flex; gap: 8px; margin-bottom: 16px; background: #0f1422; padding: 4px; border-radius: 10px;">
            <button id="auth-tab-login" class="auth-tab-btn active" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer;">Sign In</button>
            <button id="auth-tab-register" class="auth-tab-btn" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer;">Create Account</button>
          </div>

          <div id="auth-modal-error" style="color: #ff2a55; font-size: 12px; font-weight: bold; margin-bottom: 12px; min-height: 18px;"></div>

          <!-- Login Form -->
          <form id="auth-form-login" style="display: flex; flex-direction: column; gap: 12px;">
            <input type="text" id="login-username" class="lobby-input" placeholder="Username" autocomplete="username" required>
            <input type="password" id="login-password" class="lobby-input" placeholder="Password" autocomplete="current-password" required>
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-size: 15px; margin-top: 4px;">Sign In</button>
            <div style="font-size: 11px; color: #8da2c0; margin-top: 2px;">
              Don't have an account? <span id="auth-link-to-reg" style="color: #00d2ff; cursor: pointer; text-decoration: underline;">Create one here</span>
            </div>
          </form>

          <!-- Register Form -->
          <form id="auth-form-register" style="display: none; flex-direction: column; gap: 12px;">
            <input type="text" id="reg-username" class="lobby-input" placeholder="Choose Username (3-20 chars)" autocomplete="username" required>
            <input type="password" id="reg-password" class="lobby-input" placeholder="Password (min 4 chars)" autocomplete="new-password" required>
            <button type="submit" class="btn btn-primary" style="padding: 12px; font-size: 15px; margin-top: 4px; background: linear-gradient(135deg, #00ff88, #00d2ff); color: #000;">Create Account</button>
            <div style="font-size: 11px; color: #8da2c0; margin-top: 2px;">
              Already have an account? <span id="auth-link-to-login" style="color: #00d2ff; cursor: pointer; text-decoration: underline;">Sign In</span>
            </div>
          </form>

          <div style="margin-top: 16px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px;">
            <button id="btn-guest-play" class="btn btn-secondary" style="width: 100%; font-size: 13px; color: #8da2c0;">
              Continue as Guest (No Save)
            </button>
          </div>
        </div>
      </div>
    `;

    this.container.appendChild(modal);
    this.modalEl = modal;

    // Add styles for tabs
    const style = document.createElement('style');
    style.textContent = `
      .auth-tab-btn {
        background: transparent;
        color: #8da2c0;
        transition: background 0.15s ease, color 0.15s ease;
      }
      .auth-tab-btn.active {
        background: #00d2ff;
        color: #0b0f19;
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    document.getElementById('btn-close-auth')?.addEventListener('click', () => this.closeModal());
    document.getElementById('btn-guest-play')?.addEventListener('click', () => this.closeModal());

    document.getElementById('auth-tab-login')?.addEventListener('click', () => this.switchTab('login'));
    document.getElementById('auth-tab-register')?.addEventListener('click', () => this.switchTab('register'));
    document.getElementById('auth-link-to-reg')?.addEventListener('click', () => this.switchTab('register'));
    document.getElementById('auth-link-to-login')?.addEventListener('click', () => this.switchTab('login'));

    // Account panel buttons
    document.getElementById('btn-auth-view-dash')?.addEventListener('click', () => {
      this.closeModal();
      if (this.onOpenDashboardCb) {
        this.onOpenDashboardCb();
      }
    });

    document.getElementById('btn-auth-switch-acc')?.addEventListener('click', () => {
      this.switchTab('login');
    });

    document.getElementById('btn-auth-signout')?.addEventListener('click', () => {
      this.signOut();
    });

    // Submit Login
    document.getElementById('auth-form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = (document.getElementById('login-username') as HTMLInputElement)?.value?.trim();
      const passwordInput = (document.getElementById('login-password') as HTMLInputElement)?.value;
      const errEl = document.getElementById('auth-modal-error');
      if (errEl) errEl.textContent = '';

      if (!usernameInput || !passwordInput) {
        if (errEl) errEl.textContent = 'Please enter both username and password.';
        return;
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        const data = await res.json();
        if (!res.ok) {
          if (errEl) errEl.textContent = data.error || 'Login failed. Check your username and password.';
          return;
        }

        localStorage.setItem('rivals_auth_token', data.token);
        localStorage.setItem('rivals_player_name', data.user.displayName || data.user.username);
        this.currentUser = data.user;
        if (this.onUserChangedCb) this.onUserChangedCb(this.currentUser);
        this.closeModal();
      } catch (err) {
        if (errEl) errEl.textContent = 'Server connection error. Please try again.';
      }
    });

    // Submit Register
    document.getElementById('auth-form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const usernameInput = (document.getElementById('reg-username') as HTMLInputElement)?.value?.trim();
      const passwordInput = (document.getElementById('reg-password') as HTMLInputElement)?.value;
      const errEl = document.getElementById('auth-modal-error');
      if (errEl) errEl.textContent = '';

      if (!usernameInput || usernameInput.length < 3) {
        if (errEl) errEl.textContent = 'Username must be at least 3 characters long.';
        return;
      }

      if (!passwordInput || passwordInput.length < 4) {
        if (errEl) errEl.textContent = 'Password must be at least 4 characters long.';
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: usernameInput, password: passwordInput })
        });
        const data = await res.json();
        if (!res.ok) {
          if (errEl) errEl.textContent = data.error || 'Registration failed.';
          return;
        }

        localStorage.setItem('rivals_auth_token', data.token);
        localStorage.setItem('rivals_player_name', data.user.displayName || data.user.username);
        this.currentUser = data.user;
        if (this.onUserChangedCb) this.onUserChangedCb(this.currentUser);
        this.closeModal();
      } catch (err) {
        if (errEl) errEl.textContent = 'Server connection error. Please try again.';
      }
    });
  }
}

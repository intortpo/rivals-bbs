import { PublicUserProfile } from '../../server/auth/UserManager.js';
export type { PublicUserProfile };

export class AuthUI {
  private container: HTMLElement;
  public currentUser: PublicUserProfile | null = null;
  private modalEl!: HTMLElement;
  private onUserChangedCb?: (user: PublicUserProfile | null) => void;

  constructor(container: HTMLElement, onUserChanged?: (user: PublicUserProfile | null) => void) {
    this.container = container;
    this.onUserChangedCb = onUserChanged;
    this.buildAuthModal();
    this.restoreSession();
  }

  public getCurrentUser(): PublicUserProfile | null {
    return this.currentUser;
  }

  public getToken(): string | null {
    return localStorage.getItem('rivals_auth_token');
  }

  public openModal(initialTab: 'login' | 'register' = 'login'): void {
    this.modalEl.style.display = 'flex';
    this.switchTab(initialTab);
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

  private switchTab(tab: 'login' | 'register'): void {
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
      <div class="modal-card" style="width: 100%; max-width: 380px; background: #151b2e; border: 1px solid #00d2ff; border-radius: 16px; padding: 24px; box-shadow: 0 10px 35px rgba(0, 210, 255, 0.25); text-align: center; color: white;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="font-size: 22px; font-weight: 900; margin: 0; color: #00d2ff; letter-spacing: 1px;">
            🎯 AIRSOFT PILOT ID
          </h2>
          <button id="btn-close-auth" style="background: transparent; border: none; color: #8da2c0; font-size: 22px; cursor: pointer;">✕</button>
        </div>

        <p style="font-size: 12px; color: #8da2c0; margin: 0 0 16px 0;">
          BBS School Portal (<strong style="color: #00d2ff;">@bbs.ac.th</strong>) — Track grammar mastery & combat stats!
        </p>

        <!-- Tabs -->
        <div style="display: flex; gap: 8px; margin-bottom: 20px; background: #0f1422; padding: 4px; border-radius: 10px;">
          <button id="auth-tab-login" class="auth-tab-btn active" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer;">Sign In</button>
          <button id="auth-tab-register" class="auth-tab-btn" style="flex: 1; padding: 10px; border-radius: 8px; border: none; font-weight: bold; cursor: pointer;">Create Account</button>
        </div>

        <div id="auth-modal-error" style="color: #ff2a55; font-size: 13px; font-weight: bold; margin-bottom: 12px; min-height: 18px;"></div>

        <!-- Login Form -->
        <form id="auth-form-login" style="display: flex; flex-direction: column; gap: 12px;">
          <input type="text" id="login-identifier" class="lobby-input" placeholder="BBS Email (@bbs.ac.th) or Username" autocomplete="username" required>
          <input type="password" id="login-password" class="lobby-input" placeholder="Password" autocomplete="current-password" required>
          <button type="submit" class="btn btn-primary" style="padding: 12px; font-size: 16px; margin-top: 6px;">Sign In</button>
        </form>

        <!-- Register Form -->
        <form id="auth-form-register" style="display: none; flex-direction: column; gap: 12px;">
          <input type="email" id="reg-email" class="lobby-input" placeholder="Email: student@bbs.ac.th" autocomplete="email" required>
          <input type="text" id="reg-username" class="lobby-input" placeholder="Pilot Name (e.g. Alex_BBS)" autocomplete="username" required>
          <input type="password" id="reg-password" class="lobby-input" placeholder="Password (min 4 chars)" autocomplete="new-password" required>
          <button type="submit" class="btn btn-primary" style="padding: 12px; font-size: 16px; margin-top: 6px; background: linear-gradient(135deg, #00ff88, #00d2ff); color: #000;">Register @bbs.ac.th</button>
        </form>

        <div style="margin-top: 18px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 14px;">
          <button id="btn-guest-play" class="btn btn-secondary" style="width: 100%; font-size: 14px; color: #8da2c0;">
            Continue as Guest (No Save)
          </button>
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

    // Submit Login
    document.getElementById('auth-form-login')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const identifierInput = (document.getElementById('login-identifier') as HTMLInputElement)?.value;
      const passwordInput = (document.getElementById('login-password') as HTMLInputElement)?.value;
      const errEl = document.getElementById('auth-modal-error');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: identifierInput, password: passwordInput })
        });
        const data = await res.json();
        if (!res.ok) {
          if (errEl) errEl.textContent = data.error || 'Login failed.';
          return;
        }

        localStorage.setItem('rivals_auth_token', data.token);
        this.currentUser = data.user;
        if (this.onUserChangedCb) this.onUserChangedCb(this.currentUser);
        this.closeModal();
      } catch (err) {
        if (errEl) errEl.textContent = 'Server connection error.';
      }
    });

    // Submit Register
    document.getElementById('auth-form-register')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const emailInput = (document.getElementById('reg-email') as HTMLInputElement)?.value?.trim().toLowerCase();
      const usernameInput = (document.getElementById('reg-username') as HTMLInputElement)?.value?.trim();
      const passwordInput = (document.getElementById('reg-password') as HTMLInputElement)?.value;
      const errEl = document.getElementById('auth-modal-error');

      if (!emailInput || !emailInput.endsWith('@bbs.ac.th')) {
        if (errEl) errEl.textContent = 'Registration requires a valid BBS email ending with @bbs.ac.th.';
        return;
      }

      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailInput, username: usernameInput, password: passwordInput })
        });
        const data = await res.json();
        if (!res.ok) {
          if (errEl) errEl.textContent = data.error || 'Registration failed.';
          return;
        }

        localStorage.setItem('rivals_auth_token', data.token);
        this.currentUser = data.user;
        if (this.onUserChangedCb) this.onUserChangedCb(this.currentUser);
        this.closeModal();
      } catch (err) {
        if (errEl) errEl.textContent = 'Server connection error.';
      }
    });
  }
}

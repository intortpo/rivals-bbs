import { GrammarQuestion, getRandomGrammarQuestions, evaluateAnswer } from '../../shared/grammar.js';
import { POWERUPS } from '../../shared/constants.js';
import { PowerupType } from '../../shared/types.js';

export class GrammarReloadUI {
  private container: HTMLElement;
  private overlayEl!: HTMLElement;
  private currentQuestions: GrammarQuestion[] = [];
  private currentQuestionIndex: number = 0;
  private isBusy: boolean = false;
  public currentStreak: number = 0;
  private onCompleteCb?: (grantedAmmo: number, powerup?: PowerupType, streak?: number) => void;
  private onCancelCb?: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.buildDOM();
  }

  public isOpen(): boolean {
    return this.overlayEl.style.display === 'flex';
  }

  public open(
    onComplete: (grantedAmmo: number, powerup?: PowerupType, streak?: number) => void,
    onCancel: () => void
  ): void {
    this.onCompleteCb = onComplete;
    this.onCancelCb = onCancel;
    this.currentQuestions = getRandomGrammarQuestions(2);
    this.currentQuestionIndex = 0;
    this.isBusy = false;

    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }

    this.overlayEl.style.display = 'flex';
    this.updateStreakBadge();
    this.renderCurrentQuestion();
  }

  public close(): void {
    this.overlayEl.style.display = 'none';
    this.isBusy = false;
  }

  private buildDOM(): void {
    const overlay = document.createElement('div');
    overlay.id = 'grammar-reload-overlay';
    overlay.className = 'modal-backdrop';
    overlay.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, rgba(13, 19, 33, 0.82) 0%, rgba(6, 9, 17, 0.92) 100%);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 600;
      padding: 16px;
      box-sizing: border-box;
      pointer-events: auto !important;
      cursor: default;
      user-select: none;
      -webkit-user-select: none;
    `;

    overlay.innerHTML = `
      <div id="grammar-card" style="
        width: 100%;
        max-width: 480px;
        background: rgba(22, 29, 49, 0.95);
        border: 2px solid #00d2ff;
        border-radius: 18px;
        padding: 20px;
        box-shadow: 0 0 35px rgba(0, 210, 255, 0.35);
        color: white;
        text-align: center;
        position: relative;
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">⚡</span>
            <span style="font-size: 18px; font-weight: 900; letter-spacing: 1.5px; color: #00d2ff;">
              GRAMMAR RELOAD
            </span>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span id="grammar-streak-badge" style="
              font-size: 12px;
              font-weight: 900;
              color: #ffbb00;
              background: rgba(255, 187, 0, 0.15);
              border: 1px solid rgba(255, 187, 0, 0.4);
              border-radius: 12px;
              padding: 4px 10px;
              letter-spacing: 0.5px;
            ">🔥 STREAK: 0</span>
            <button id="btn-cancel-grammar" style="
              background: rgba(255, 42, 85, 0.2);
              border: 1px solid #ff2a55;
              color: #ff2a55;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              font-size: 16px;
              font-weight: bold;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
            ">✕</button>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: bold; color: #8da2c0; margin-bottom: 14px; letter-spacing: 0.5px;">
          🎯 ANSWER 2 QUESTIONS FOR 60 AMMO • BUILD STREAKS FOR POWERUPS!
        </div>

        <!-- Progress Indicator -->
        <div style="display: flex; justify-content: center; align-items: center; gap: 12px; margin-bottom: 16px;">
          <div id="grammar-step-1" class="grammar-step-pill active">QUESTION 1</div>
          <div style="width: 24px; height: 2px; background: rgba(255,255,255,0.2);"></div>
          <div id="grammar-step-2" class="grammar-step-pill">QUESTION 2</div>
        </div>

        <!-- Question Prompt Area -->
        <div id="grammar-prompt-box" style="
          background: #0d1220;
          border: 1px solid rgba(0, 210, 255, 0.3);
          border-radius: 12px;
          padding: 16px 14px;
          font-size: 17px;
          font-weight: 700;
          color: #ffffff;
          line-height: 1.4;
          margin-bottom: 16px;
          min-height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          Prompt goes here...
        </div>

        <!-- Explanatory Feedback / Hint -->
        <div id="grammar-feedback" style="
          font-size: 13px;
          color: #00ff88;
          font-weight: 600;
          margin-bottom: 14px;
          min-height: 20px;
          opacity: 0;
          transition: opacity 0.15s ease;
        "></div>

        <!-- 4 Options (Touch friendly buttons) -->
        <div id="grammar-options-grid" style="
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        ">
        </div>
      </div>
    `;

    this.container.appendChild(overlay);
    this.overlayEl = overlay;

    // Inject css for pills & option buttons
    const style = document.createElement('style');
    style.textContent = `
      .grammar-step-pill {
        padding: 5px 14px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.8px;
        background: rgba(255, 255, 255, 0.1);
        color: #8da2c0;
        border: 1px solid rgba(255, 255, 255, 0.15);
        transition: all 0.2s ease;
      }
      .grammar-step-pill.active {
        background: #00d2ff;
        color: #0b0f19;
        border-color: #00d2ff;
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.5);
      }
      .grammar-step-pill.done {
        background: #00ff88;
        color: #0b0f19;
        border-color: #00ff88;
      }
      .grammar-opt-btn {
        background: #182035;
        border: 2px solid rgba(0, 210, 255, 0.35);
        border-radius: 12px;
        padding: 14px 8px;
        color: white;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
        outline: none;
        touch-action: manipulation;
        transition: transform 0.08s ease, background 0.12s ease, border-color 0.12s ease;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
      }
      .grammar-opt-btn:active {
        transform: scale(0.96);
      }
      .grammar-opt-btn.correct {
        background: #00ff88 !important;
        color: #0b0f19 !important;
        border-color: #00ff88 !important;
        box-shadow: 0 0 16px #00ff88 !important;
      }
      .grammar-opt-btn.wrong {
        background: #ff2a55 !important;
        color: white !important;
        border-color: #ff2a55 !important;
        animation: grammar-shake 0.3s ease;
      }
      @keyframes grammar-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-6px); }
        75% { transform: translateX(6px); }
      }
    `;
    document.head.appendChild(style);

    document.getElementById('btn-cancel-grammar')?.addEventListener('click', () => {
      this.close();
      if (this.onCancelCb) this.onCancelCb();
    });
  }

  private renderCurrentQuestion(): void {
    const q = this.currentQuestions[this.currentQuestionIndex];
    if (!q) return;

    const pill1 = document.getElementById('grammar-step-1');
    const pill2 = document.getElementById('grammar-step-2');
    if (this.currentQuestionIndex === 0) {
      pill1?.classList.add('active');
      pill1?.classList.remove('done');
      pill2?.classList.remove('active', 'done');
    } else {
      pill1?.classList.remove('active');
      pill1?.classList.add('done');
      pill2?.classList.add('active');
      pill2?.classList.remove('done');
    }

    const promptEl = document.getElementById('grammar-prompt-box');
    if (promptEl) {
      // Highlight "___" with neon color
      promptEl.innerHTML = q.prompt.replace(
        /___/g,
        `<span style="color: #00d2ff; text-decoration: underline; font-weight: 900;">___</span>`
      );
    }

    const feedbackEl = document.getElementById('grammar-feedback');
    if (feedbackEl) {
      feedbackEl.style.opacity = '0';
      feedbackEl.textContent = '';
    }

    const grid = document.getElementById('grammar-options-grid');
    if (!grid) return;
    grid.innerHTML = '';

    q.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.className = 'grammar-opt-btn';
      btn.textContent = optText;
      btn.addEventListener('click', () => this.handleOptionClick(idx, btn));
      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
      });
      grid.appendChild(btn);
    });
  }

  public updateStreakBadge(): void {
    const badge = document.getElementById('grammar-streak-badge');
    if (badge) {
      badge.textContent = `🔥 STREAK: ${this.currentStreak}`;
      if (this.currentStreak >= 6) {
        badge.style.color = '#ff2a55';
        badge.style.borderColor = '#ff2a55';
        badge.style.background = 'rgba(255,42,85,0.2)';
      } else if (this.currentStreak >= 4) {
        badge.style.color = '#a855f7';
        badge.style.borderColor = '#a855f7';
        badge.style.background = 'rgba(168,85,247,0.2)';
      } else if (this.currentStreak >= 2) {
        badge.style.color = '#00d2ff';
        badge.style.borderColor = '#00d2ff';
        badge.style.background = 'rgba(0,210,255,0.2)';
      } else {
        badge.style.color = '#ffbb00';
        badge.style.borderColor = 'rgba(255,187,0,0.4)';
        badge.style.background = 'rgba(255,187,0,0.15)';
      }
    }
  }

  private handleOptionClick(selectedIndex: number, btn: HTMLElement): void {
    if (this.isBusy) return;

    const q = this.currentQuestions[this.currentQuestionIndex];
    if (!q) return;

    const evalResult = evaluateAnswer(q.id, selectedIndex);
    const feedbackEl = document.getElementById('grammar-feedback');

    if (evalResult.isCorrect) {
      this.isBusy = true;
      this.currentStreak++;
      this.updateStreakBadge();

      btn.classList.add('correct');
      if (feedbackEl) {
        feedbackEl.style.color = '#00ff88';
        feedbackEl.textContent = '✓ Correct! ' + evalResult.explanation;
        feedbackEl.style.opacity = '1';
      }

      setTimeout(() => {
        if (this.currentQuestionIndex === 0) {
          // Advance to Question 2
          this.currentQuestionIndex = 1;
          this.isBusy = false;
          this.renderCurrentQuestion();
        } else {
          // Both questions answered correctly!
          const pill2 = document.getElementById('grammar-step-2');
          pill2?.classList.remove('active');
          pill2?.classList.add('done');

          // Pick powerup based on streak tier
          let awardedPowerup: PowerupType | undefined;
          if (this.currentStreak >= 6) {
            const tier3: PowerupType[] = ['radar', 'phase_shift', 'airstrike'];
            awardedPowerup = tier3[Math.floor(Math.random() * tier3.length)];
          } else if (this.currentStreak >= 4) {
            const tier2: PowerupType[] = ['quad_damage', 'rapid_mag'];
            awardedPowerup = tier2[Math.floor(Math.random() * tier2.length)];
          } else if (this.currentStreak >= 2) {
            const tier1: PowerupType[] = ['shield', 'speed'];
            awardedPowerup = tier1[Math.floor(Math.random() * tier1.length)];
          }

          if (feedbackEl) {
            feedbackEl.style.color = '#ffbb00';
            if (awardedPowerup) {
              const def = POWERUPS[awardedPowerup];
              feedbackEl.innerHTML = `🎉 STREAK ${this.currentStreak}! <strong>+60 AMMO</strong> + <span style="color:#00d2ff;">${def.icon} ${def.name}</span> UNLOCKED! ⚡`;
            } else {
              feedbackEl.innerHTML = '🎉 EXCELLENT! <strong>+60 AMMO GRANTED!</strong> ⚡';
            }
          }

          setTimeout(() => {
            this.close();
            if (this.onCompleteCb) {
              this.onCompleteCb(60, awardedPowerup, this.currentStreak);
            }
          }, 900);
        }
      }, 550);
    } else {
      // Incorrect answer: reset streak, feedback and substitute fresh question
      this.isBusy = true;
      this.currentStreak = 0;
      this.updateStreakBadge();

      btn.classList.add('wrong');
      if (feedbackEl) {
        feedbackEl.style.color = '#ff6b81';
        feedbackEl.textContent = '💡 Rule Hint: ' + evalResult.explanation;
        feedbackEl.style.opacity = '1';
      }

      setTimeout(() => {
        btn.classList.remove('wrong');
        // Pick a replacement question so student masters it
        const newQs = getRandomGrammarQuestions(1);
        if (newQs.length > 0) {
          this.currentQuestions[this.currentQuestionIndex] = newQs[0];
        }
        this.isBusy = false;
        this.renderCurrentQuestion();
      }, 1200);
    }
  }
}

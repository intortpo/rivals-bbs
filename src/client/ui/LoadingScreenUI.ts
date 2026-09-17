import { AudioManager } from '../engine/AudioManager.js';
import { PCGLBLoader } from '../engine/playcanvas/PCGLBLoader.js';
export class LoadingScreenUI {
  private container: HTMLElement;
  private overlay: HTMLDivElement;
  private progressBarFill: HTMLDivElement;
  private percentLabel: HTMLDivElement;
  private statusLabel: HTMLDivElement;
  private isVisible: boolean = false;

  public get visible(): boolean {
    return this.isVisible;
  }

  constructor(container: HTMLElement = document.body) {
    this.container = container;

    this.overlay = document.createElement('div');
    this.overlay.id = 'loading-screen-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 99999;
      background: radial-gradient(circle at center, #0e1726 0%, #050811 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Rajdhani', 'Segoe UI', sans-serif;
      color: #ffffff;
      transition: opacity 0.45s ease, visibility 0.45s ease;
      opacity: 0;
      visibility: hidden;
      pointer-events: none;
      user-select: none;
    `;

    this.overlay.innerHTML = `
      <div style="
        position: absolute;
        inset: 0;
        background-image: linear-gradient(rgba(0, 210, 255, 0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(0, 210, 255, 0.03) 1px, transparent 1px);
        background-size: 32px 32px;
        pointer-events: none;
      "></div>

      <div style="position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; max-width: 480px; width: 88%;">
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="
            width: 44px;
            height: 44px;
            border-radius: 10px;
            background: linear-gradient(135deg, #00d2ff, #ff2a55);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 22px;
            box-shadow: 0 0 24px rgba(0, 210, 255, 0.5);
          ">⚡</div>
          <div>
            <div style="font-size: 24px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; background: linear-gradient(90deg, #00d2ff, #ffffff); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
              Rivals BBS
            </div>
            <div style="font-size: 11px; font-weight: 600; letter-spacing: 1.5px; color: #64748b; text-transform: uppercase;">
              Tactical Arena Asset Engine
            </div>
          </div>
        </div>

        <!-- Spinner & Percentage Ring -->
        <div style="position: relative; width: 80px; height: 80px; margin-bottom: 28px;">
          <svg style="width: 100%; height: 100%; transform: rotate(-90deg);" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" stroke="#1e293b" stroke-width="6" fill="none" />
            <circle id="loading-circle-progress" cx="40" cy="40" r="34" stroke="#00d2ff" stroke-width="6" fill="none"
              stroke-dasharray="213.6" stroke-dashoffset="213.6" stroke-linecap="round"
              style="transition: stroke-dashoffset 0.25s ease;" />
          </svg>
          <div id="loading-percent-label" style="
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 800;
            color: #00d2ff;
            text-shadow: 0 0 10px rgba(0, 210, 255, 0.6);
          ">0%</div>
        </div>

        <!-- Progress Bar -->
        <div style="
          width: 100%;
          height: 8px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(0, 210, 255, 0.25);
          border-radius: 999px;
          overflow: hidden;
          margin-bottom: 16px;
          box-shadow: inset 0 1px 4px rgba(0,0,0,0.6);
        ">
          <div id="loading-progress-bar-fill" style="
            width: 0%;
            height: 100%;
            background: linear-gradient(90deg, #00d2ff, #38bdf8, #ff2a55);
            border-radius: 999px;
            transition: width 0.25s ease;
            box-shadow: 0 0 14px rgba(0, 210, 255, 0.8);
          "></div>
        </div>

        <!-- Dynamic Status Message -->
        <div id="loading-status-label" style="
          font-size: 13px;
          font-weight: 600;
          color: #94a3b8;
          letter-spacing: 0.8px;
          text-align: center;
          min-height: 20px;
        ">
          Initializing Asset Subsystems...
        </div>
      </div>
    `;

    this.container.appendChild(this.overlay);

    this.progressBarFill = this.overlay.querySelector('#loading-progress-bar-fill') as HTMLDivElement;
    this.percentLabel = this.overlay.querySelector('#loading-percent-label') as HTMLDivElement;
    this.statusLabel = this.overlay.querySelector('#loading-status-label') as HTMLDivElement;
  }

  public show(initialStatus: string = 'Preloading Match Assets...'): void {
    this.statusLabel.textContent = initialStatus;
    this.setProgress(0, initialStatus);
    this.overlay.style.visibility = 'visible';
    this.overlay.style.opacity = '1';
    this.overlay.style.pointerEvents = 'all';
    this.isVisible = true;
  }

  public setProgress(progress: number, statusText?: string): void {
    const clamped = Math.max(0, Math.min(1, progress));
    const percent = Math.round(clamped * 100);

    if (this.progressBarFill) {
      this.progressBarFill.style.width = `${percent}%`;
    }
    if (this.percentLabel) {
      this.percentLabel.textContent = `${percent}%`;
    }

    const circle = this.overlay.querySelector('#loading-circle-progress') as SVGCircleElement | null;
    if (circle) {
      const circumference = 213.6;
      circle.style.strokeDashoffset = `${circumference * (1 - clamped)}`;
    }

    if (statusText && this.statusLabel) {
      this.statusLabel.textContent = statusText;
    }
  }

  public hide(delayMs: number = 300): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.overlay.style.opacity = '0';
        this.overlay.style.pointerEvents = 'none';
        setTimeout(() => {
          this.overlay.style.visibility = 'hidden';
          this.isVisible = false;
          resolve();
        }, 450);
      }, delayMs);
    });
  }

  /**
   * Comprehensive Asset Preloader:
   * 1. 3D GLB Character Models
   * 2. High-Precision Weapon GLBs
   * 3. Audio Buffers
   * 4. Three.js Scene Shaders
   */
  public async preloadGameAssets(
    audio?: AudioManager,
    glbLoader?: PCGLBLoader
  ): Promise<void> {
    this.show('Connecting to BBS Asset Matrix...');

    // 1. Audio buffers warmup
    this.setProgress(0.3, 'Preloading Audio & Weapon Buffers...');
    if (audio) {
      try {
        audio.touchUnlock();
      } catch {}
    }

    // 2. Preload 3D Character & Blaster Kit Armory
    if (glbLoader) {
      this.setProgress(0.5, 'Loading 3D Animated Arena Characters...');
      try {
        await Promise.all([
          glbLoader.load('/models/characters/kenney/kenney_character.glb').catch(() => null),
          glbLoader.load('/models/characters/arena_character.glb').catch(() => null)
        ]);
      } catch (err) {
        console.warn('[LoadingScreenUI] Failed to preload character models:', err);
      }

      this.setProgress(0.75, 'Loading 3D Blaster Armory & Platformer Assets...');
      const blasterUrls = [
        '/models/blasters/blaster-a.glb',
        '/models/blasters/blaster-b.glb',
        '/models/blasters/blaster-c.glb',
        '/models/blasters/blaster-e.glb',
        '/models/blasters/blaster-g.glb',
        '/models/blasters/blaster-j.glb',
        '/models/blasters/blaster-m.glb',
        '/models/blasters/blaster-o.glb'
      ];
      await Promise.all(blasterUrls.map((u) => glbLoader.load(u).catch(() => null)));
    }

    // 3. PlayCanvas WebGL pipelines ready
    this.setProgress(1.0, 'Match Ready. Engaging Arena...');
    await this.hide(350);
  }
}

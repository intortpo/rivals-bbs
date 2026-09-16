export interface GameSettings {
  masterVolume: number; // 0..1
  sfxVolume: number;    // 0..1
  voiceVolume: number;  // 0..1
  isMuted: boolean;
  mouseSensitivity: number; // 0.2..3.0
  touchSensitivity: number; // 0.2..3.0
  invertY: boolean;
  autoFire: boolean;
  graphicsQuality: 'low' | 'medium' | 'high';
  fov: number; // 60..100
  hudOpacity: number; // 0.3..1.0
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.8,
  voiceVolume: 0.8,
  isMuted: false,
  mouseSensitivity: 1.0,
  touchSensitivity: 1.0,
  invertY: false,
  autoFire: false,
  graphicsQuality: 'high',
  fov: 75,
  hudOpacity: 0.95
};

export class SettingsUI {
  private container: HTMLElement;
  private modalEl!: HTMLElement;
  public settings: GameSettings;
  private onSettingsChangeCb?: (settings: GameSettings) => void;
  private onCloseCb?: () => void;

  constructor(container: HTMLElement, onSettingsChange?: (settings: GameSettings) => void) {
    this.container = container;
    this.onSettingsChangeCb = onSettingsChange;
    this.settings = this.loadSettings();
    this.buildDOM();
  }

  public loadSettings(): GameSettings {
    try {
      const raw = localStorage.getItem('rivals_settings');
      if (raw) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
      }
    } catch {}
    return { ...DEFAULT_SETTINGS };
  }

  public saveSettings(): void {
    try {
      localStorage.setItem('rivals_settings', JSON.stringify(this.settings));
    } catch {}
    if (this.onSettingsChangeCb) {
      this.onSettingsChangeCb(this.settings);
    }
  }

  public isOpen(): boolean {
    return this.modalEl.style.display === 'flex';
  }

  public open(onClose?: () => void): void {
    this.onCloseCb = onClose;
    // Release desktop pointer lock so user can click sliders
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    this.updateDOMValues();
    this.modalEl.style.display = 'flex';
  }

  public close(): void {
    this.modalEl.style.display = 'none';
    if (this.onCloseCb) this.onCloseCb();
  }

  private buildDOM(): void {
    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.style.cssText = `
      position: absolute;
      inset: 0;
      background: rgba(10, 14, 26, 0.88);
      backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      z-index: 950;
      padding: 16px;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    modal.innerHTML = `
      <div style="
        width: 100%;
        max-width: 480px;
        background: #14192b;
        border: 2px solid #00d2ff;
        border-radius: 18px;
        box-shadow: 0 0 35px rgba(0, 210, 255, 0.35);
        color: white;
        padding: 20px;
        max-height: 90vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        gap: 16px;
      ">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #222b45; padding-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 22px;">⚙️</span>
            <span style="font-size: 19px; font-weight: 900; letter-spacing: 1px; color: #00d2ff;">SETTINGS</span>
          </div>
          <button id="btn-close-settings" style="
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
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

        <!-- Audio Settings Group -->
        <div class="settings-group">
          <div class="settings-group-title">🔊 AUDIO & VOICE</div>
          <div class="settings-row">
            <label>Master Volume: <span id="val-master-vol">80%</span></label>
            <input type="range" id="input-master-vol" min="0" max="100" step="5" class="settings-slider">
          </div>
          <div class="settings-row">
            <label>Sound Effects (SFX): <span id="val-sfx-vol">80%</span></label>
            <input type="range" id="input-sfx-vol" min="0" max="100" step="5" class="settings-slider">
          </div>
          <div class="settings-row">
            <label>Mute All Audio</label>
            <input type="checkbox" id="check-mute-audio" class="settings-toggle">
          </div>
        </div>

        <!-- Controls Settings Group -->
        <div class="settings-group">
          <div class="settings-group-title">🎮 CONTROLS & SENSITIVITY</div>
          <div class="settings-row">
            <label>Mouse Sensitivity: <span id="val-mouse-sens">1.0x</span></label>
            <input type="range" id="input-mouse-sens" min="20" max="300" step="10" class="settings-slider">
          </div>
          <div class="settings-row">
            <label>Touch Look Sensitivity: <span id="val-touch-sens">1.0x</span></label>
            <input type="range" id="input-touch-sens" min="20" max="300" step="10" class="settings-slider">
          </div>
          <div class="settings-row">
            <label>Invert Y-Axis (Pitch)</label>
            <input type="checkbox" id="check-invert-y" class="settings-toggle">
          </div>
          <div class="settings-row">
            <label>Auto-Fire on Target (Touch Assist)</label>
            <input type="checkbox" id="check-auto-fire" class="settings-toggle">
          </div>
        </div>

        <!-- Graphics & Display Group -->
        <div class="settings-group">
          <div class="settings-group-title">🖥️ DISPLAY & GRAPHICS</div>
          <div class="settings-row">
            <label>Graphics Quality</label>
            <select id="select-graphics-quality" class="settings-select">
              <option value="high">🌟 High (Full Lighting & FX)</option>
              <option value="medium">⚡ Medium (Balanced)</option>
              <option value="low">🚀 Low (Maximum Performance)</option>
            </select>
          </div>
          <div class="settings-row">
            <label>Camera FOV: <span id="val-fov">75°</span></label>
            <input type="range" id="input-fov" min="60" max="100" step="1" class="settings-slider">
          </div>
          <div class="settings-row">
            <label>Touch HUD Opacity: <span id="val-hud-opacity">95%</span></label>
            <input type="range" id="input-hud-opacity" min="30" max="100" step="5" class="settings-slider">
          </div>
        </div>

        <button id="btn-save-settings" class="btn btn-primary" style="padding: 14px; font-size: 16px; width: 100%;">
          ✓ Save & Close
        </button>
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
      .settings-group {
        background: #0f1322;
        border: 1px solid #232d4b;
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .settings-group-title {
        font-size: 12px;
        font-weight: 800;
        color: #8da2c0;
        letter-spacing: 0.8px;
      }
      .settings-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 14px;
        font-weight: 600;
      }
      .settings-slider {
        width: 140px;
        accent-color: #00d2ff;
        cursor: pointer;
      }
      .settings-toggle {
        width: 22px;
        height: 22px;
        accent-color: #00d2ff;
        cursor: pointer;
      }
      .settings-select {
        background: #192036;
        color: white;
        border: 1px solid #2e3856;
        border-radius: 8px;
        padding: 6px 10px;
        font-size: 13px;
        font-weight: bold;
        outline: none;
      }
    `;
    document.head.appendChild(style);
  }

  private updateDOMValues(): void {
    const s = this.settings;

    const masterVol = document.getElementById('input-master-vol') as HTMLInputElement;
    const sfxVol = document.getElementById('input-sfx-vol') as HTMLInputElement;
    const muteCheck = document.getElementById('check-mute-audio') as HTMLInputElement;

    const mouseSens = document.getElementById('input-mouse-sens') as HTMLInputElement;
    const touchSens = document.getElementById('input-touch-sens') as HTMLInputElement;
    const invertCheck = document.getElementById('check-invert-y') as HTMLInputElement;
    const autoFireCheck = document.getElementById('check-auto-fire') as HTMLInputElement;

    const graphicsSel = document.getElementById('select-graphics-quality') as HTMLSelectElement;
    const fovInput = document.getElementById('input-fov') as HTMLInputElement;
    const hudOpacityInput = document.getElementById('input-hud-opacity') as HTMLInputElement;

    if (masterVol) masterVol.value = `${Math.round(s.masterVolume * 100)}`;
    if (sfxVol) sfxVol.value = `${Math.round(s.sfxVolume * 100)}`;
    if (muteCheck) muteCheck.checked = s.isMuted;

    if (mouseSens) mouseSens.value = `${Math.round(s.mouseSensitivity * 100)}`;
    if (touchSens) touchSens.value = `${Math.round(s.touchSensitivity * 100)}`;
    if (invertCheck) invertCheck.checked = s.invertY;
    if (autoFireCheck) autoFireCheck.checked = s.autoFire;

    if (graphicsSel) graphicsSel.value = s.graphicsQuality;
    if (fovInput) fovInput.value = `${s.fov}`;
    if (hudOpacityInput) hudOpacityInput.value = `${Math.round(s.hudOpacity * 100)}`;

    this.updateLabels();
  }

  private updateLabels(): void {
    const s = this.settings;
    const lMaster = document.getElementById('val-master-vol');
    const lSfx = document.getElementById('val-sfx-vol');
    const lMouse = document.getElementById('val-mouse-sens');
    const lTouch = document.getElementById('val-touch-sens');
    const lFov = document.getElementById('val-fov');
    const lOpacity = document.getElementById('val-hud-opacity');

    if (lMaster) lMaster.textContent = `${Math.round(s.masterVolume * 100)}%`;
    if (lSfx) lSfx.textContent = `${Math.round(s.sfxVolume * 100)}%`;
    if (lMouse) lMouse.textContent = `${s.mouseSensitivity.toFixed(1)}x`;
    if (lTouch) lTouch.textContent = `${s.touchSensitivity.toFixed(1)}x`;
    if (lFov) lFov.textContent = `${s.fov}°`;
    if (lOpacity) lOpacity.textContent = `${Math.round(s.hudOpacity * 100)}%`;
  }

  private attachEvents(): void {
    document.getElementById('btn-close-settings')?.addEventListener('click', () => {
      this.close();
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', () => {
      this.saveSettings();
      this.close();
    });

    // Audio inputs
    document.getElementById('input-master-vol')?.addEventListener('input', (e) => {
      this.settings.masterVolume = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.updateLabels();
      this.saveSettings();
    });

    document.getElementById('input-sfx-vol')?.addEventListener('input', (e) => {
      this.settings.sfxVolume = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.updateLabels();
      this.saveSettings();
    });

    document.getElementById('check-mute-audio')?.addEventListener('change', (e) => {
      this.settings.isMuted = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    // Control inputs
    document.getElementById('input-mouse-sens')?.addEventListener('input', (e) => {
      this.settings.mouseSensitivity = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.updateLabels();
      this.saveSettings();
    });

    document.getElementById('input-touch-sens')?.addEventListener('input', (e) => {
      this.settings.touchSensitivity = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.updateLabels();
      this.saveSettings();
    });

    document.getElementById('check-invert-y')?.addEventListener('change', (e) => {
      this.settings.invertY = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    document.getElementById('check-auto-fire')?.addEventListener('change', (e) => {
      this.settings.autoFire = (e.target as HTMLInputElement).checked;
      this.saveSettings();
    });

    // Graphics
    document.getElementById('select-graphics-quality')?.addEventListener('change', (e) => {
      this.settings.graphicsQuality = (e.target as HTMLSelectElement).value as any;
      this.saveSettings();
    });

    document.getElementById('input-fov')?.addEventListener('input', (e) => {
      this.settings.fov = parseInt((e.target as HTMLInputElement).value, 10);
      this.updateLabels();
      this.saveSettings();
    });

    document.getElementById('input-hud-opacity')?.addEventListener('input', (e) => {
      this.settings.hudOpacity = parseInt((e.target as HTMLInputElement).value, 10) / 100;
      this.updateLabels();
      this.saveSettings();
    });
  }
}

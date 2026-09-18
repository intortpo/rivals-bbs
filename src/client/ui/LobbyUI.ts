import { GameMode, OpenRoomSummary, RoomNetworkState, CharacterCustomization } from '../../shared/types.js';
import { PLAYER_COLORS } from '../../shared/constants.js';

export interface LobbyCallbacks {
  onCreateRoom: (
    playerName: string,
    mode: GameMode,
    fragLimit: number,
    mapName: string,
    skyTheme?: string,
    outfitIndex?: number,
    customization?: CharacterCustomization
  ) => void;
  onJoinRoom: (
    roomId: string,
    playerName: string,
    outfitIndex?: number,
    customization?: CharacterCustomization
  ) => void;
  onOpenQRScanner: () => void;
  onGlobalMatch?: (playerName: string, customization?: CharacterCustomization) => void;
  onOpenQRDisplay: (roomId: string) => void;
  onStartMatch: () => void;
  onAuthClick?: () => void;
  onOpenDashboard?: () => void;
  onOpenSettings?: () => void;
  onRefreshRooms?: () => void;
  onLeaveRoom?: () => void;
  onDeleteRoom?: (roomId: string) => void;
  isHostOfRoom?: (roomId: string) => boolean;
}

export class LobbyUI {
  public container: HTMLElement;
  public callbacks: LobbyCallbacks;
  public selectedColor: string = PLAYER_COLORS[0];
  public selectedOutfit: number = 0;
  public selectedSky: string = 'twilight';
  public autoStartSolo: boolean = false;
  private currentOpenRooms: OpenRoomSummary[] = [];

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.buildLobbyDOM();
  }

  public getSelectedColor(): string {
    return this.selectedColor;
  }

  private buildLobbyDOM(): void {
    const savedName = localStorage.getItem('rivals_player_name') || `Arena_${Math.floor(100 + Math.random() * 900)}`;

    const screen = document.createElement('div');
    screen.id = 'lobby-screen';
    screen.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, #1b2138 0%, #0d0f18 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      z-index: 800;
      color: white;
      padding: 18px 12px;
      overflow-y: auto;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    screen.innerHTML = `
      <!-- Top Navigation Tabs Bar -->
      <div style="width: 100%; max-width: 460px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; background: rgba(18, 24, 40, 0.85); border: 1px solid rgba(255,255,255,0.15); border-radius: 16px; padding: 6px; backdrop-filter: blur(8px);">
        <button id="tab-play" class="lobby-nav-tab active">🎮 Play</button>
        <button id="tab-open-rooms" class="lobby-nav-tab">
          🌐 Open Games <span id="open-rooms-badge" class="nav-count-badge">0</span>
        </button>
        <button id="tab-dashboard" class="lobby-nav-tab">📊 Dashboard</button>
        <button id="tab-settings" class="lobby-nav-tab">⚙️ Settings</button>
      </div>

      <!-- Main Play Section -->
      <div id="section-main-menu" style="width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: 12px; text-align: center;">
        <div style="margin-bottom: 2px;">
          <h1 style="font-size: 34px; font-weight: 900; margin: 0; background: linear-gradient(135deg, #00d2ff, #ff2a55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px;">
            🎯 ARENA BBS
          </h1>
          <p style="font-size: 12px; color: #8da2c0; margin: 2px 0 0 0; letter-spacing: 1px;">
            TACTICAL 3D MULTIPLAYER & WAVE SURVIVAL
          </p>
        </div>

        <!-- Pilot Account & Grammar Mastery Bar -->
        <div id="lobby-account-bar" class="lobby-card" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; background: rgba(18, 24, 40, 0.85); border: 1px solid rgba(0, 210, 255, 0.3); border-radius: 12px;">
          <div style="text-align: left;">
            <div id="account-user-title" style="font-size: 14px; font-weight: 800; color: #00d2ff;">👤 Guest Pilot</div>
            <div id="account-grammar-stats" style="font-size: 11px; color: #8da2c0;">📚 Grammar: 0 solved (0%)</div>
          </div>
          <button id="btn-open-auth" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px; border-color: #00d2ff; color: #00d2ff;">
            Sign In
          </button>
        </div>

        <!-- Player Profile Card -->
        <div class="lobby-card">
          <label style="font-size: 12px; font-weight: bold; color: #8da2c0; display: block; text-align: left; margin-bottom: 6px;">PLAYER NAME</label>
          <input type="text" id="input-player-name" value="${savedName}" maxlength="16" placeholder="Enter name" class="lobby-input">

          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <div style="flex: 1; text-align: left;">
              <label style="font-size: 11px; font-weight: bold; color: #8da2c0;">OUTFIT</label>
              <select id="select-character-outfit" class="lobby-select">
                <option value="0" selected>⚡ Cyber Scout</option>
                <option value="1">🛡️ Tactical Agent</option>
                <option value="2">🏃 Urban Runner</option>
                <option value="3">🎯 Beanie Merc</option>
                <option value="custom">✨ Custom Studio Outfit</option>
              </select>
            </div>
            <div style="flex: 1; text-align: left;">
              <label style="font-size: 11px; font-weight: bold; color: #8da2c0;">SKYDROP</label>
              <select id="select-sky-theme" class="lobby-select">
                <option value="twilight" selected>🌆 Cyber Twilight</option>
                <option value="sunset">🌇 Golden Sunset</option>
                <option value="sage">🏙️ Emerald Sage</option>
              </select>
            </div>
          </div>

          <label style="font-size: 12px; font-weight: bold; color: #8da2c0; display: block; text-align: left; margin: 12px 0 6px 0;">AVATAR ACCENT COLOR</label>
          <div id="color-picker-row" style="display: flex; gap: 8px; justify-content: center;">
            ${PLAYER_COLORS.map((c, i) => `
              <div class="color-swatch ${i === 0 ? 'active' : ''}" data-color="${c}" style="background: ${c};"></div>
            `).join('')}
          </div>
        </div>

        <!-- Match Options -->
        <div class="lobby-card">
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1; text-align: left;">
              <label style="font-size: 11px; font-weight: bold; color: #8da2c0;">GAME MODE</label>
              <select id="select-game-mode" class="lobby-select" style="display: none;">
                <option value="wave" selected>🧟 Wave Survival</option>
              </select>
              <div style="margin-top: 5px; padding: 8px 10px; background: rgba(0, 210, 255, 0.12); border: 1px solid rgba(0, 210, 255, 0.35); border-radius: 8px; font-size: 12px; font-weight: 700; color: #00e5ff; display: flex; align-items: center; gap: 6px;">
                <span>🧟</span>
                <span>Wave Survival</span>
              </div>
            </div>
            <div style="flex: 1; text-align: left;">
              <label style="font-size: 11px; font-weight: bold; color: #8da2c0;">MAP</label>
              <select id="select-map-name" class="lobby-select">
                <option value="Cyber Spire" selected>🌆 Cyber Spire (Vertical Ascent)</option>
                <option value="Skyline Penthouse">🍸 Skyline Penthouse (Vertigo Lounge)</option>
                <option value="Sky Sanctuary">⛩️ Sky Sanctuary (Celestial Pagoda)</option>
                <option value="Solar Relay">☀️ Solar Relay (Helios Array)</option>
                <option value="Orbital Station">🛰️ Orbital Station (Zero-G Spire)</option>
                <option value="Arena TDM">🎯 Arena TDM (Tactical Urban)</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-global-match" class="btn" style="padding: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(135deg, #ff0055, #a200ff); color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(255, 0, 85, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <span>🌍</span> JOIN GLOBAL BULLET HELL
          </button>

          <button id="btn-play-solo" class="btn" style="padding: 14px; font-size: 16px; font-weight: 900; letter-spacing: 1px; background: linear-gradient(135deg, #00d2ff, #2563eb); color: #ffffff; border: none; border-radius: 12px; cursor: pointer; box-shadow: 0 4px 15px rgba(0, 210, 255, 0.4); display: flex; align-items: center; justify-content: center; gap: 8px; transition: all 0.2s;">
            <span>⚡</span> PLAY SOLO WAVE (INSTANT ACTION)
          </button>

          <button id="btn-create-room" class="btn btn-primary" style="padding: 14px; font-size: 17px; letter-spacing: 1px;">
            🎮 CREATE MATCH
          </button>

          <button id="btn-scan-qr" class="btn btn-secondary" style="padding: 12px; font-size: 14px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #252b44; border: 2px solid #00d2ff; color: #00d2ff;">
            <span>📷</span> SCAN QR CODE TO JOIN
          </button>

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <input type="text" id="input-room-code" placeholder="Enter Room Code (RV-XXXX)" maxlength="8" class="lobby-input" style="flex: 1; text-transform: uppercase;">
            <button id="btn-join-code" class="btn btn-secondary" style="width: 80px;">Join</button>
          </div>
        </div>
      </div>

      <!-- Open Public Games Browser Section -->
      <div id="section-open-rooms" style="width: 100%; max-width: 480px; display: none; flex-direction: column; gap: 12px; text-align: center;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="font-size: 18px; font-weight: 900; color: #00d2ff; display: flex; align-items: center; gap: 8px;">
            <span>🌐</span> PUBLIC MATCHES
          </div>
          <button id="btn-refresh-rooms" class="btn btn-secondary" style="padding: 6px 12px; font-size: 12px;">
            🔄 Refresh
          </button>
        </div>

        <div id="open-rooms-container" style="display: flex; flex-direction: column; gap: 8px; max-height: 60vh; overflow-y: auto;">
          <div style="color: #8da2c0; font-size: 13px; padding: 24px; text-align: center;">
            Searching for active rooms...
          </div>
        </div>
      </div>

      <!-- In-Room Lobby Section (Visible when waiting for players) -->
      <div id="section-in-room" style="width: 100%; max-width: 460px; display: none; flex-direction: column; gap: 14px; text-align: center;">
        <div class="lobby-card">
          <div style="font-size: 11px; color: #8da2c0; font-weight: bold;">ROOM CODE</div>
          <div id="in-room-code-badge" style="font-size: 32px; font-weight: 900; color: #00d2ff; letter-spacing: 3px; margin: 2px 0;">RV-XXXX</div>
          <div id="in-room-mode-badge" style="font-size: 13px; color: #ffbb00; font-weight: bold;">1v1 Duel • Goal 5 Kills</div>

          <button id="btn-show-room-qr" class="btn btn-secondary" style="margin-top: 12px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border-color: #00d2ff; color: #00d2ff;">
            <span>📱</span> Show QR Code for Players to Scan
          </button>
        </div>

        <!-- 4v4 Team Display Container (shown if 4v4 mode) -->
        <div id="in-room-teams-container" style="display: none; grid-template-columns: 1fr 1fr; gap: 10px;">
          <!-- Blue Team -->
          <div style="background: rgba(0, 210, 255, 0.1); border: 2px solid #00d2ff; border-radius: 14px; padding: 10px; text-align: left;">
            <div style="font-size: 12px; font-weight: 900; color: #00d2ff; margin-bottom: 6px;">
              🛡️ BLUE TEAM (<span id="in-room-blue-count">0</span>/4)
            </div>
            <div id="in-room-blue-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
          </div>
          <!-- Red Team -->
          <div style="background: rgba(255, 42, 85, 0.1); border: 2px solid #ff2a55; border-radius: 14px; padding: 10px; text-align: left;">
            <div style="font-size: 12px; font-weight: 900; color: #ff2a55; margin-bottom: 6px;">
              ⚔️ RED TEAM (<span id="in-room-red-count">0</span>/4)
            </div>
            <div id="in-room-red-list" style="display: flex; flex-direction: column; gap: 4px;"></div>
          </div>
        </div>

        <!-- Default Single Players List (shown if 1v1 or FFA) -->
        <div id="in-room-single-container" class="lobby-card" style="text-align: left;">
          <div style="font-size: 12px; color: #8da2c0; font-weight: bold; margin-bottom: 8px;">PLAYERS IN LOBBY (<span id="in-room-count">1</span>/2)</div>
          <div id="in-room-player-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>

        <!-- Host Start Button & Leave Room -->
        <div id="in-room-controls">
          <button id="btn-start-match" class="btn btn-primary" style="width: 100%; padding: 14px; font-size: 17px;">
            🚀 START MATCH
          </button>
          <div id="in-room-waiting-msg" style="font-size: 13px; color: #8da2c0; margin-top: 8px; display: none;">
            Waiting for host to start match...
          </div>
          <button id="btn-leave-room" class="btn btn-secondary" style="width: 100%; margin-top: 10px; padding: 10px; font-size: 14px;">
            ← Leave Room
          </button>
          <button id="btn-delete-room" class="btn" style="width: 100%; margin-top: 10px; padding: 11px; font-size: 14px; background: rgba(255, 42, 85, 0.2); border: 1px solid #ff2a55; color: #ff2a55; border-radius: 10px; font-weight: 800; cursor: pointer; display: none; transition: all 0.15s ease;">
            🗑️ Cancel & Delete Game
          </button>
        </div>
      </div>
    `;

    this.container.appendChild(screen);
    this.injectStyles();
    this.attachEvents();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .lobby-nav-tab {
        background: transparent;
        border: none;
        color: #8da2c0;
        font-size: 13px;
        font-weight: 800;
        padding: 8px 12px;
        border-radius: 10px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .lobby-nav-tab.active {
        background: #00d2ff;
        color: #0b0f19;
        box-shadow: 0 0 12px rgba(0, 210, 255, 0.4);
      }
      .nav-count-badge {
        background: rgba(0, 0, 0, 0.35);
        color: inherit;
        border-radius: 8px;
        padding: 1px 6px;
        font-size: 10px;
        font-weight: 900;
      }
      .lobby-card {
        background: rgba(22, 27, 43, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 14px;
        backdrop-filter: blur(8px);
      }
      .lobby-input, .lobby-select {
        width: 100%;
        padding: 11px 13px;
        background: #111422;
        border: 1px solid #2e3856;
        border-radius: 10px;
        color: white;
        font-size: 14px;
        font-weight: bold;
        box-sizing: border-box;
      }
      .lobby-input:focus, .lobby-select:focus {
        border-color: #00d2ff;
        outline: none;
        box-shadow: 0 0 10px rgba(0, 210, 255, 0.3);
      }
      .color-swatch {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        cursor: pointer;
        border: 2px solid transparent;
        transition: transform 0.1s ease, border-color 0.1s ease;
      }
      .color-swatch.active {
        transform: scale(1.18);
        border-color: #ffffff;
        box-shadow: 0 0 10px currentColor;
      }
      .player-badge {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #111422;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #28314e;
      }
      .room-browser-card {
        background: #111524;
        border: 1px solid #263152;
        border-radius: 12px;
        padding: 12px 14px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        transition: border-color 0.15s ease;
      }
      .room-browser-card:hover {
        border-color: #00d2ff;
      }
    `;
    document.head.appendChild(style);
  }

  private attachEvents(): void {
    const nameInput = document.getElementById('input-player-name') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
      if (nameInput.value) {
        localStorage.setItem('rivals_player_name', nameInput.value.trim());
      }
    });

    // Navigation Tabs
    const tabPlay = document.getElementById('tab-play');
    const tabOpenRooms = document.getElementById('tab-open-rooms');
    const tabDashboard = document.getElementById('tab-dashboard');
    const tabSettings = document.getElementById('tab-settings');

    const secPlay = document.getElementById('section-main-menu');
    const secRooms = document.getElementById('section-open-rooms');

    tabPlay?.addEventListener('click', () => {
      tabPlay.classList.add('active');
      tabOpenRooms?.classList.remove('active');
      if (secPlay) secPlay.style.display = 'flex';
      if (secRooms) secRooms.style.display = 'none';
    });

    tabOpenRooms?.addEventListener('click', () => {
      tabOpenRooms.classList.add('active');
      tabPlay?.classList.remove('active');
      if (secPlay) secPlay.style.display = 'none';
      if (secRooms) secRooms.style.display = 'flex';
      if (this.callbacks.onRefreshRooms) this.callbacks.onRefreshRooms();
    });

    tabDashboard?.addEventListener('click', () => {
      if (this.callbacks.onOpenDashboard) this.callbacks.onOpenDashboard();
    });

    tabSettings?.addEventListener('click', () => {
      if (this.callbacks.onOpenSettings) this.callbacks.onOpenSettings();
    });

    document.getElementById('btn-refresh-rooms')?.addEventListener('click', () => {
      if (this.callbacks.onRefreshRooms) this.callbacks.onRefreshRooms();
    });

    // Color swatches
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(sw => {
      sw.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        this.selectedColor = sw.getAttribute('data-color') || PLAYER_COLORS[0];
      });
    });

    // Auth button
    const authBtn = document.getElementById('btn-open-auth');
    authBtn?.addEventListener('click', () => {
      if (this.callbacks.onAuthClick) {
        this.callbacks.onAuthClick();
      }
    });

    // Global Match (Join or Create)
    const globalBtn = document.getElementById('btn-global-match');
    globalBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim() || 'Rival';
      this.callbacks.onGlobalMatch?.(name);
    });

    // Play Solo Wave (Instant Match Start)
    const soloBtn = document.getElementById('btn-play-solo');
    soloBtn?.addEventListener('click', () => {
      this.autoStartSolo = true;
      const name = nameInput?.value.trim() || 'Rival';
      const mapSelect = document.getElementById('select-map-name') as HTMLSelectElement;
      const outfitSelect = document.getElementById('select-character-outfit') as HTMLSelectElement;
      const skySelect = document.getElementById('select-sky-theme') as HTMLSelectElement;

      const outfitIdx = parseInt(outfitSelect?.value || '0', 10) || 0;
      const skyTheme = skySelect?.value || 'twilight';

      this.selectedOutfit = outfitIdx;
      this.selectedSky = skyTheme;

      this.callbacks.onCreateRoom(
        name,
        'wave',
        10,
        mapSelect?.value || 'Cyber Spire',
        skyTheme,
        outfitIdx
      );
    });

    // Create room
    const createBtn = document.getElementById('btn-create-room');
    createBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim() || 'Rival';
      const modeSelect = document.getElementById('select-game-mode') as HTMLSelectElement;
      const mapSelect = document.getElementById('select-map-name') as HTMLSelectElement;
      const outfitSelect = document.getElementById('select-character-outfit') as HTMLSelectElement;
      const skySelect = document.getElementById('select-sky-theme') as HTMLSelectElement;

      const outfitIdx = parseInt(outfitSelect?.value || '0', 10) || 0;
      const skyTheme = skySelect?.value || 'twilight';
      const mode: GameMode = (modeSelect?.value as GameMode) || 'wave';
      const fragGoal = mode === 'wave' ? 10 : 5;

      this.selectedOutfit = outfitIdx;
      this.selectedSky = skyTheme;

      this.callbacks.onCreateRoom(
        name,
        mode,
        fragGoal,
        mapSelect?.value || 'Cyber Spire',
        skyTheme,
        outfitIdx
      );
    });

    // Scan QR
    document.getElementById('btn-scan-qr')?.addEventListener('click', () => {
      this.callbacks.onOpenQRScanner();
    });

    // Join via manual code
    const joinCodeBtn = document.getElementById('btn-join-code');
    const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
    const triggerJoin = () => {
      const code = codeInput?.value.trim().toUpperCase();
      const name = nameInput?.value.trim() || 'Rival';
      const outfitSelect = document.getElementById('select-character-outfit') as HTMLSelectElement;
      const isCustom = outfitSelect?.value === 'custom';
      const outfitIdx = isCustom ? 0 : parseInt(outfitSelect?.value || '0', 10);
      this.selectedOutfit = outfitIdx;
      if (code) {
        this.callbacks.onJoinRoom(
          code,
          name,
          outfitIdx
        );
      }
    };
    joinCodeBtn?.addEventListener('click', triggerJoin);
    codeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerJoin();
    });

    // Start match button in room
    document.getElementById('btn-start-match')?.addEventListener('click', () => {
      this.callbacks.onStartMatch();
    });

    // Show QR modal in room
    document.getElementById('btn-show-room-qr')?.addEventListener('click', () => {
      const roomBadge = document.getElementById('in-room-code-badge');
      if (roomBadge?.textContent) {
        this.callbacks.onOpenQRDisplay(roomBadge.textContent);
      }
    });

    // Leave room button
    document.getElementById('btn-leave-room')?.addEventListener('click', () => {
      if (this.callbacks.onLeaveRoom) {
        this.callbacks.onLeaveRoom();
      }
    });

    // Delete room button (Host)
    document.getElementById('btn-delete-room')?.addEventListener('click', () => {
      const roomBadge = document.getElementById('in-room-code-badge');
      const roomId = roomBadge?.textContent?.trim();
      if (roomId && this.callbacks.onDeleteRoom) {
        if (confirm(`Are you sure you want to delete room ${roomId}? This will close the match for all players.`)) {
          this.callbacks.onDeleteRoom(roomId);
        }
      }
    });
  }

  public updateOpenRooms(rooms: OpenRoomSummary[]): void {
    // Only show active joinable matches with open slots; never show ended games
    this.currentOpenRooms = (rooms || []).filter(
      (r) => r.status !== 'game_over' && r.playerCount < r.maxPlayers
    );
    const badge = document.getElementById('open-rooms-badge');
    if (badge) badge.textContent = `${this.currentOpenRooms.length}`;

    const container = document.getElementById('open-rooms-container');
    if (!container) return;

    if (this.currentOpenRooms.length === 0) {
      container.innerHTML = `
        <div style="background: rgba(22, 27, 43, 0.7); border: 1px dashed #2e3856; border-radius: 14px; padding: 32px 16px; color: #8da2c0; font-size: 13px;">
          <div style="font-size: 32px; margin-bottom: 8px;">🎮</div>
          No public games open right now.<br>Tap <strong>"Play"</strong> to create a match!
        </div>
      `;
      return;
    }

    const nameInput = document.getElementById('input-player-name') as HTMLInputElement;

    container.innerHTML = this.currentOpenRooms.map(r => {
      const isFull = r.playerCount >= r.maxPlayers;
      const isHostedByMe = this.callbacks.isHostOfRoom ? this.callbacks.isHostOfRoom(r.roomId) : false;
      const modeLabel = r.mode === '4v4' ? '🛡️ 4v4 Team DM' : r.mode === 'wave' ? '🧟 Wave Survival' : '⚔️ 1v1 Duel';
      const statusColor = r.status === 'playing' ? '#ffbb00' : '#00ff88';
      const statusLabel = r.status === 'playing' ? 'In Match' : 'In Lobby';

      return `
        <div class="room-browser-card" style="${isHostedByMe ? 'border: 1px solid rgba(255, 42, 85, 0.45); box-shadow: 0 0 10px rgba(255, 42, 85, 0.15);' : ''}">
          <div style="text-align: left;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 16px; font-weight: 900; color: #00d2ff; letter-spacing: 1px;">${r.roomId}</span>
              <span style="font-size: 11px; background: #1c243a; padding: 2px 6px; border-radius: 6px; color: white;">${modeLabel}</span>
              ${isHostedByMe ? `<span style="font-size: 9px; background: rgba(255, 42, 85, 0.25); border: 1px solid #ff2a55; color: #ff2a55; padding: 2px 6px; border-radius: 5px; font-weight: 900;">👑 YOUR GAME</span>` : ''}
            </div>
            <div style="font-size: 11px; color: #8da2c0; margin-top: 3px;">
              Host: <strong>${r.hostName}</strong> • ${r.mapName}
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="text-align: right;">
              <div style="font-size: 13px; font-weight: 900; color: white;">${r.playerCount}/${r.maxPlayers}</div>
              <div style="font-size: 10px; color: ${statusColor}; font-weight: bold;">● ${statusLabel}</div>
            </div>
            ${isHostedByMe ? `
              <button class="btn btn-delete-room-card" data-room="${r.roomId}" title="Delete hosted game" style="background: rgba(255, 42, 85, 0.25); border: 1px solid #ff2a55; color: #ff2a55; padding: 8px 10px; font-size: 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">
                🗑️
              </button>
            ` : ''}
            <button class="btn ${isFull ? 'btn-secondary' : 'btn-primary'} btn-join-room-card" data-room="${r.roomId}" ${isFull ? 'disabled' : ''} style="padding: 8px 14px; font-size: 12px;">
              ${isFull ? 'Full' : 'Join'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach delete listeners to room cards
    container.querySelectorAll('.btn-delete-room-card').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const roomId = btn.getAttribute('data-room');
        if (roomId && this.callbacks.onDeleteRoom) {
          if (confirm(`Delete your game room ${roomId}? This will close the match for all players.`)) {
            this.callbacks.onDeleteRoom(roomId);
          }
        }
      });
    });

    // Attach join listeners to room cards
    container.querySelectorAll('.btn-join-room-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const roomId = btn.getAttribute('data-room');
        const name = nameInput?.value.trim() || 'Rival';
        const outfitSelect = document.getElementById('select-character-outfit') as HTMLSelectElement;
        const outfitIdx = parseInt(outfitSelect?.value || '0', 10) || 0;
        if (roomId) {
          this.callbacks.onJoinRoom(
            roomId,
            name,
            outfitIdx
          );
        }
      });
    });
  }

  public showInRoomLobby(state: RoomNetworkState, isHost: boolean): void {
    if (this.autoStartSolo && isHost) {
      this.autoStartSolo = false;
      this.hideLobby();
      this.callbacks.onStartMatch();
      return;
    }

    const mainMenu = document.getElementById('section-main-menu');
    const openRoomsSec = document.getElementById('section-open-rooms');
    const inRoom = document.getElementById('section-in-room');
    const screen = document.getElementById('lobby-screen');

    if (mainMenu) mainMenu.style.display = 'none';
    if (openRoomsSec) openRoomsSec.style.display = 'none';
    if (inRoom) inRoom.style.display = 'flex';
    if (screen) screen.style.display = 'flex';

    const codeBadge = document.getElementById('in-room-code-badge');
    const modeBadge = document.getElementById('in-room-mode-badge');
    const startBtn = document.getElementById('btn-start-match') as HTMLButtonElement;
    const waitMsg = document.getElementById('in-room-waiting-msg');

    if (codeBadge) codeBadge.textContent = state.roomId;

    const modeText = state.mode === '4v4'
      ? '4v4 Team Deathmatch • Goal: 20 Kills'
      : state.mode === 'wave'
      ? `Wave Survival • Target: ${state.fragLimit} Waves`
      : '1v1 Duel • Goal: 5 Kills';
    if (modeBadge) modeBadge.textContent = `${modeText} • ${state.mapName}`;

    const players = Object.values(state.players);
    const humanPlayers = players.filter(p => !p.isBot);

    // 4v4 Team view vs Single list
    const teamsContainer = document.getElementById('in-room-teams-container');
    const singleContainer = document.getElementById('in-room-single-container');

    if (state.mode === '4v4') {
      if (teamsContainer) teamsContainer.style.display = 'grid';
      if (singleContainer) singleContainer.style.display = 'none';

      const bluePlayers = humanPlayers.filter(p => p.team === 'blue');
      const redPlayers = humanPlayers.filter(p => p.team === 'red');

      const blueCount = document.getElementById('in-room-blue-count');
      const redCount = document.getElementById('in-room-red-count');
      if (blueCount) blueCount.textContent = `${bluePlayers.length}`;
      if (redCount) redCount.textContent = `${redPlayers.length}`;

      const blueList = document.getElementById('in-room-blue-list');
      const redList = document.getElementById('in-room-red-list');

      if (blueList) {
        blueList.innerHTML = bluePlayers.map(p => `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(0, 210, 255, 0.15); padding: 6px 10px; border-radius: 8px; font-size: 13px;">
            <span>🛡️ ${p.name}</span>
            <span style="font-size: 10px; color: ${p.isHost ? '#ffbb00' : '#00d2ff'};">${p.isHost ? 'HOST' : 'READY'}</span>
          </div>
        `).join('');
      }

      if (redList) {
        redList.innerHTML = redPlayers.map(p => `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(255, 42, 85, 0.15); padding: 6px 10px; border-radius: 8px; font-size: 13px;">
            <span>⚔️ ${p.name}</span>
            <span style="font-size: 10px; color: ${p.isHost ? '#ffbb00' : '#ff2a55'};">${p.isHost ? 'HOST' : 'READY'}</span>
          </div>
        `).join('');
      }
    } else {
      if (teamsContainer) teamsContainer.style.display = 'none';
      if (singleContainer) singleContainer.style.display = 'block';

      const countEl = document.getElementById('in-room-count');
      if (countEl) countEl.textContent = `${humanPlayers.length}`;

      const listEl = document.getElementById('in-room-player-list');
      if (listEl) {
        listEl.innerHTML = humanPlayers.map(p => `
          <div class="player-badge">
            <div style="display: flex; align-items: center; gap: 8px;">
              <div style="width: 14px; height: 14px; border-radius: 4px; background: ${p.color};"></div>
              <strong>${p.name}</strong>
            </div>
            <span style="font-size: 11px; color: ${p.isHost ? '#00d2ff' : '#00ff88'};">
              ${p.isHost ? '👑 HOST' : 'READY'}
            </span>
          </div>
        `).join('');
      }
    }

    const deleteBtn = document.getElementById('btn-delete-room') as HTMLButtonElement;
    const leaveBtn = document.getElementById('btn-leave-room') as HTMLButtonElement;

    if (startBtn && waitMsg) {
      if (isHost) {
        startBtn.style.display = 'block';
        if (deleteBtn) deleteBtn.style.display = 'block';
        if (leaveBtn) leaveBtn.style.display = 'none';
        waitMsg.style.display = 'none';
      } else {
        startBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (leaveBtn) leaveBtn.style.display = 'block';
        waitMsg.style.display = 'block';
      }
    }
  }

  public showToast(message: string, isError: boolean = false): void {
    let toast = document.getElementById('lobby-toast-notification');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'lobby-toast-notification';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        z-index: 9999;
        padding: 10px 22px;
        border-radius: 12px;
        font-size: 13px;
        font-weight: 800;
        letter-spacing: 0.5px;
        box-shadow: 0 6px 25px rgba(0, 0, 0, 0.75);
        pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(toast);
    }

    toast.style.background = isError ? 'rgba(255, 42, 85, 0.95)' : 'rgba(0, 210, 255, 0.95)';
    toast.style.border = isError ? '1px solid #ff2a55' : '1px solid #00d2ff';
    toast.style.color = isError ? '#ffffff' : '#080c18';
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    setTimeout(() => {
      if (toast) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(-10px)';
      }
    }, 3500);
  }

  public hideLobby(): void {
    const screen = document.getElementById('lobby-screen');
    if (screen) screen.style.display = 'none';
  }

  public showMainMenu(): void {
    const mainMenu = document.getElementById('section-main-menu');
    const inRoom = document.getElementById('section-in-room');
    const openRoomsSec = document.getElementById('section-open-rooms');
    const screen = document.getElementById('lobby-screen');

    if (mainMenu) mainMenu.style.display = 'flex';
    if (inRoom) inRoom.style.display = 'none';
    if (openRoomsSec) openRoomsSec.style.display = 'none';
    if (screen) screen.style.display = 'flex';
  }

  public updateAccountDisplay(user: any): void {
    const titleEl = document.getElementById('account-user-title');
    const statsEl = document.getElementById('account-grammar-stats');
    const btnEl = document.getElementById('btn-open-auth');
    const nameInput = document.getElementById('input-player-name') as HTMLInputElement;

    if (user) {
      if (titleEl) titleEl.textContent = `⭐ ${user.displayName || user.username}`;
      const total = user.stats?.grammarAnswered || 0;
      const correct = user.stats?.grammarCorrect || 0;
      const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
      const ammo = user.stats?.ammoEarned || 0;
      if (statsEl) {
        statsEl.textContent = `📚 Grammar: ${correct} solved (${pct}%) • ⚡ +${ammo} ammo`;
      }
      if (btnEl) btnEl.textContent = 'Account';
      if (nameInput) {
        nameInput.value = user.displayName || user.username;
        localStorage.setItem('rivals_player_name', nameInput.value);
      }
    } else {
      if (titleEl) titleEl.textContent = '👤 Guest Pilot';
      if (statsEl) statsEl.textContent = '📚 Grammar: 0 solved (0%)';
      if (btnEl) btnEl.textContent = 'Sign In';
    }
  }
}

import { GameMode, RoomNetworkState } from '../../shared/types.js';
import { PLAYER_COLORS } from '../../shared/constants.js';

export interface LobbyCallbacks {
  onCreateRoom: (playerName: string, mode: GameMode, fragLimit: number, mapName: string) => void;
  onJoinRoom: (roomId: string, playerName: string) => void;
  onOpenQRScanner: () => void;
  onOpenQRDisplay: (roomId: string) => void;
  onStartMatch: () => void;
}

export class LobbyUI {
  public container: HTMLElement;
  public callbacks: LobbyCallbacks;
  public selectedColor: string = PLAYER_COLORS[0];

  constructor(container: HTMLElement, callbacks: LobbyCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.buildLobbyDOM();
  }

  public getSelectedColor(): string {
    return this.selectedColor;
  }

  private buildLobbyDOM(): void {
    const savedName = localStorage.getItem('rivals_player_name') || `Rival_${Math.floor(100 + Math.random() * 900)}`;

    const screen = document.createElement('div');
    screen.id = 'lobby-screen';
    screen.style.cssText = `
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, #1b2138 0%, #0d0f18 100%);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 800;
      color: white;
      padding: 18px;
      overflow-y: auto;
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    `;

    screen.innerHTML = `
      <!-- Main Menu Section -->
      <div id="section-main-menu" style="width: 100%; max-width: 420px; display: flex; flex-direction: column; gap: 14px; text-align: center;">
        <div style="margin-bottom: 8px;">
          <h1 style="font-size: 38px; font-weight: 900; margin: 0; background: linear-gradient(135deg, #00d2ff, #ff2a55); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px;">
            ⚡ RIVALS BBS
          </h1>
          <p style="font-size: 13px; color: #8da2c0; margin: 4px 0 0 0; letter-spacing: 1px;">
            TOUCH-FIRST 3D MULTIPLAYER ARENA
          </p>
        </div>

        <!-- Player Profile Card -->
        <div class="lobby-card">
          <label style="font-size: 12px; font-weight: bold; color: #8da2c0; display: block; text-align: left; margin-bottom: 6px;">PLAYER NAME</label>
          <input type="text" id="input-player-name" value="${savedName}" maxlength="16" placeholder="Enter name" class="lobby-input">

          <label style="font-size: 12px; font-weight: bold; color: #8da2c0; display: block; text-align: left; margin: 12px 0 6px 0;">AVATAR COLOR</label>
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
              <select id="select-game-mode" class="lobby-select">
                <option value="1v1">1v1 Duel (First to 5)</option>
                <option value="ffa">Free For All (Arena)</option>
              </select>
            </div>
            <div style="flex: 1; text-align: left;">
              <label style="font-size: 11px; font-weight: bold; color: #8da2c0;">MAP</label>
              <select id="select-map-name" class="lobby-select">
                <option value="Arena Classic">Arena Classic</option>
                <option value="Neon Warehouse">Neon Warehouse</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <button id="btn-create-room" class="btn btn-primary" style="padding: 15px; font-size: 17px; letter-spacing: 1px;">
            🎮 CREATE MATCH
          </button>

          <button id="btn-scan-qr" class="btn btn-secondary" style="padding: 13px; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; background: #252b44; border: 2px solid #00d2ff; color: #00d2ff;">
            <span>📷</span> SCAN QR CODE TO JOIN
          </button>

          <div style="display: flex; gap: 8px; margin-top: 4px;">
            <input type="text" id="input-room-code" placeholder="Enter Room Code (RV-XXXX)" maxlength="8" class="lobby-input" style="flex: 1; text-transform: uppercase;">
            <button id="btn-join-code" class="btn btn-secondary" style="width: 80px;">Join</button>
          </div>
        </div>
      </div>

      <!-- In-Room Lobby Section (Visible when waiting for players) -->
      <div id="section-in-room" style="width: 100%; max-width: 440px; display: none; flex-direction: column; gap: 16px; text-align: center;">
        <div class="lobby-card">
          <div style="font-size: 12px; color: #8da2c0; font-weight: bold;">ROOM CODE</div>
          <div id="in-room-code-badge" style="font-size: 32px; font-weight: 900; color: #00d2ff; letter-spacing: 3px; margin: 4px 0;">RV-XXXX</div>
          <div id="in-room-mode-badge" style="font-size: 13px; color: #ffbb00;">1v1 Duel • Goal 5 Kills</div>

          <button id="btn-show-room-qr" class="btn btn-secondary" style="margin-top: 14px; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; border-color: #00d2ff; color: #00d2ff;">
            <span>📱</span> Show QR Code for Players to Scan
          </button>
        </div>

        <!-- Players List -->
        <div class="lobby-card" style="text-align: left;">
          <div style="font-size: 12px; color: #8da2c0; font-weight: bold; margin-bottom: 8px;">PLAYERS IN LOBBY (<span id="in-room-count">1</span>/2)</div>
          <div id="in-room-player-list" style="display: flex; flex-direction: column; gap: 6px;"></div>
        </div>

        <!-- Host Start Button -->
        <div id="in-room-controls">
          <button id="btn-start-match" class="btn btn-primary" style="width: 100%; padding: 15px; font-size: 17px;">
            🚀 START MATCH
          </button>
          <div id="in-room-waiting-msg" style="font-size: 13px; color: #8da2c0; margin-top: 8px; display: none;">
            Waiting for host to start match...
          </div>
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
      .lobby-card {
        background: rgba(22, 27, 43, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 16px;
        padding: 16px;
        backdrop-filter: blur(8px);
      }
      .lobby-input, .lobby-select {
        width: 100%;
        padding: 12px 14px;
        background: #111422;
        border: 1px solid #2e3856;
        border-radius: 10px;
        color: white;
        font-size: 15px;
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
    `;
    document.head.appendChild(style);
  }

  private attachEvents(): void {
    // Player name save
    const nameInput = document.getElementById('input-player-name') as HTMLInputElement;
    nameInput?.addEventListener('input', () => {
      if (nameInput.value) {
        localStorage.setItem('rivals_player_name', nameInput.value.trim());
      }
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

    // Create room
    const createBtn = document.getElementById('btn-create-room');
    createBtn?.addEventListener('click', () => {
      const name = nameInput?.value.trim() || 'Rival';
      const modeSelect = document.getElementById('select-game-mode') as HTMLSelectElement;
      const mapSelect = document.getElementById('select-map-name') as HTMLSelectElement;
      this.callbacks.onCreateRoom(name, (modeSelect?.value as GameMode) || '1v1', 5, mapSelect?.value || 'Arena Classic');
    });

    // Scan QR
    const scanBtn = document.getElementById('btn-scan-qr');
    scanBtn?.addEventListener('click', () => {
      this.callbacks.onOpenQRScanner();
    });

    // Join via manual code
    const joinCodeBtn = document.getElementById('btn-join-code');
    const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
    const triggerJoin = () => {
      const code = codeInput?.value.trim().toUpperCase();
      const name = nameInput?.value.trim() || 'Rival';
      if (code) {
        this.callbacks.onJoinRoom(code, name);
      }
    };
    joinCodeBtn?.addEventListener('click', triggerJoin);
    codeInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') triggerJoin();
    });

    // Start match button in room
    const startBtn = document.getElementById('btn-start-match');
    startBtn?.addEventListener('click', () => {
      this.callbacks.onStartMatch();
    });

    // Show QR modal in room
    const showQrBtn = document.getElementById('btn-show-room-qr');
    showQrBtn?.addEventListener('click', () => {
      const roomBadge = document.getElementById('in-room-code-badge');
      if (roomBadge?.textContent) {
        this.callbacks.onOpenQRDisplay(roomBadge.textContent);
      }
    });
  }

  public showInRoomLobby(state: RoomNetworkState, isHost: boolean): void {
    const mainMenu = document.getElementById('section-main-menu');
    const inRoom = document.getElementById('section-in-room');
    const screen = document.getElementById('lobby-screen');

    if (mainMenu) mainMenu.style.display = 'none';
    if (inRoom) inRoom.style.display = 'flex';
    if (screen) screen.style.display = 'flex';

    const codeBadge = document.getElementById('in-room-code-badge');
    const modeBadge = document.getElementById('in-room-mode-badge');
    const countEl = document.getElementById('in-room-count');
    const startBtn = document.getElementById('btn-start-match') as HTMLButtonElement;
    const waitMsg = document.getElementById('in-room-waiting-msg');
    const listEl = document.getElementById('in-room-player-list');

    if (codeBadge) codeBadge.textContent = state.roomId;
    if (modeBadge) modeBadge.textContent = `${state.mode === '1v1' ? '1v1 Duel' : 'Free For All'} • ${state.mapName}`;

    const players = Object.values(state.players);
    if (countEl) countEl.textContent = `${players.length}`;

    if (listEl) {
      listEl.innerHTML = players.map(p => `
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

    if (startBtn && waitMsg) {
      if (isHost) {
        startBtn.style.display = 'block';
        waitMsg.style.display = 'none';
      } else {
        startBtn.style.display = 'none';
        waitMsg.style.display = 'block';
      }
    }
  }

  public hideLobby(): void {
    const screen = document.getElementById('lobby-screen');
    if (screen) screen.style.display = 'none';
  }

  public showMainMenu(): void {
    const mainMenu = document.getElementById('section-main-menu');
    const inRoom = document.getElementById('section-in-room');
    const screen = document.getElementById('lobby-screen');

    if (mainMenu) mainMenu.style.display = 'flex';
    if (inRoom) inRoom.style.display = 'none';
    if (screen) screen.style.display = 'flex';
  }
}

import QRCode from 'qrcode';
import { Html5Qrcode } from 'html5-qrcode';

export class QRManager {
  private qrModalEl!: HTMLElement;
  private scannerModalEl!: HTMLElement;
  private html5QrCode: Html5Qrcode | null = null;
  private isScanning: boolean = false;
  private onRoomCodeScanned?: (roomCode: string) => void;

  constructor() {
    this.createQRDisplayModal();
    this.createQRScannerModal();
  }

  private createQRDisplayModal(): void {
    this.qrModalEl = document.createElement('div');
    this.qrModalEl.id = 'qr-display-modal';
    this.qrModalEl.className = 'modal-backdrop';
    this.qrModalEl.style.display = 'none';

    this.qrModalEl.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>📱 SCAN TO JOIN ROOM</h2>
          <button id="btn-close-qr-modal" class="modal-close-btn">&times;</button>
        </div>
        <p class="modal-desc">Point another phone's camera or Arena scanner at this code to join instantly!</p>

        <div class="qr-canvas-wrapper">
          <canvas id="qr-code-canvas"></canvas>
        </div>

        <div class="room-code-badge">
          <span>ROOM CODE:</span>
          <strong id="qr-room-code-text">RV-XXXX</strong>
        </div>

        <div class="modal-actions">
          <button id="btn-copy-room-link" class="btn btn-secondary">📋 Copy Join Link</button>
          <button id="btn-done-qr-modal" class="btn btn-primary">Done</button>
        </div>
      </div>
    `;

    document.body.appendChild(this.qrModalEl);

    // Event listeners
    this.qrModalEl.querySelector('#btn-close-qr-modal')?.addEventListener('click', () => this.hideQRModal());
    this.qrModalEl.querySelector('#btn-done-qr-modal')?.addEventListener('click', () => this.hideQRModal());
    this.qrModalEl.addEventListener('click', (e) => {
      if (e.target === this.qrModalEl) this.hideQRModal();
    });
  }

  private createQRScannerModal(): void {
    this.scannerModalEl = document.createElement('div');
    this.scannerModalEl.id = 'qr-scanner-modal';
    this.scannerModalEl.className = 'modal-backdrop';
    this.scannerModalEl.style.display = 'none';

    this.scannerModalEl.innerHTML = `
      <div class="modal-card">
        <div class="modal-header">
          <h2>📷 SCAN ROOM QR CODE</h2>
          <button id="btn-close-scanner-modal" class="modal-close-btn">&times;</button>
        </div>
        <p class="modal-desc">Align the host's QR code within the viewfinder frame.</p>

        <div id="qr-reader-container">
          <div id="qr-reader"></div>
          <div class="scanner-laser"></div>
        </div>

        <div id="scanner-status" class="scanner-status">Starting camera...</div>

        <!-- Manual fallback input -->
        <div class="manual-code-section">
          <label>Or enter room code manually:</label>
          <div style="display: flex; gap: 8px; margin-top: 6px;">
            <input type="text" id="manual-room-input" placeholder="RV-XXXX" maxlength="8" style="text-transform: uppercase;">
            <button id="btn-manual-join" class="btn btn-primary">Join</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.scannerModalEl);

    this.scannerModalEl.querySelector('#btn-close-scanner-modal')?.addEventListener('click', () => this.stopScanner());
    this.scannerModalEl.addEventListener('click', (e) => {
      if (e.target === this.scannerModalEl) this.stopScanner();
    });

    const manualJoinBtn = this.scannerModalEl.querySelector('#btn-manual-join');
    const manualInput = this.scannerModalEl.querySelector('#manual-room-input') as HTMLInputElement;

    manualJoinBtn?.addEventListener('click', () => {
      const code = manualInput?.value?.trim().toUpperCase();
      if (code && this.onRoomCodeScanned) {
        this.stopScanner();
        this.onRoomCodeScanned(code);
      }
    });

    manualInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const code = manualInput.value?.trim().toUpperCase();
        if (code && this.onRoomCodeScanned) {
          this.stopScanner();
          this.onRoomCodeScanned(code);
        }
      }
    });

    this.injectStyles();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(10, 12, 20, 0.85);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
        animation: fadeIn 0.2s ease-out;
      }
      .modal-card {
        background: #1a1d2e;
        border: 2px solid #2e3856;
        border-radius: 20px;
        width: 100%;
        max-width: 440px;
        padding: 24px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.6);
        color: #ffffff;
        text-align: center;
        box-sizing: border-box;
      }
      .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }
      .modal-header h2 {
        margin: 0;
        font-size: 20px;
        font-weight: 900;
        color: #00d2ff;
        letter-spacing: 0.5px;
      }
      .modal-close-btn {
        background: transparent;
        border: none;
        color: #8892b0;
        font-size: 28px;
        cursor: pointer;
        padding: 0 8px;
      }
      .modal-desc {
        font-size: 13px;
        color: #8da2c0;
        margin-bottom: 18px;
      }
      .qr-canvas-wrapper {
        background: white;
        padding: 16px;
        border-radius: 16px;
        display: inline-block;
        margin: 10px auto;
        box-shadow: 0 4px 20px rgba(0, 210, 255, 0.25);
      }
      #qr-code-canvas {
        display: block;
        width: 210px !important;
        height: 210px !important;
      }
      .room-code-badge {
        margin: 14px auto;
        padding: 8px 18px;
        background: #111422;
        border-radius: 30px;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border: 1px solid #323d60;
      }
      .room-code-badge span { font-size: 11px; color: #8da2c0; }
      .room-code-badge strong { font-size: 18px; color: #ff2a55; letter-spacing: 2px; }
      .modal-actions {
        display: flex;
        gap: 12px;
        margin-top: 18px;
      }
      .btn {
        flex: 1;
        padding: 12px 18px;
        border-radius: 12px;
        font-size: 15px;
        font-weight: bold;
        cursor: pointer;
        border: none;
        transition: transform 0.1s ease, filter 0.15s ease;
      }
      .btn:active { transform: scale(0.96); }
      .btn-primary {
        background: #00d2ff;
        color: #0c101d;
        box-shadow: 0 0 15px rgba(0, 210, 255, 0.4);
      }
      .btn-secondary {
        background: #252c42;
        color: #ffffff;
        border: 1px solid #3e4b70;
      }
      #qr-reader-container {
        position: relative;
        width: 100%;
        max-width: 320px;
        height: 260px;
        margin: 0 auto;
        border-radius: 14px;
        overflow: hidden;
        border: 2px solid #00d2ff;
        background: #0a0d17;
      }
      #qr-reader {
        width: 100%;
        height: 100%;
      }
      .scanner-laser {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: #ff2a55;
        box-shadow: 0 0 10px #ff2a55;
        animation: scanAnim 2s infinite alternate ease-in-out;
        pointer-events: none;
      }
      @keyframes scanAnim {
        0% { top: 5%; }
        100% { top: 95%; }
      }
      .scanner-status {
        margin-top: 12px;
        font-size: 13px;
        color: #ffbb00;
      }
      .manual-code-section {
        margin-top: 18px;
        padding-top: 14px;
        border-top: 1px solid #28314e;
        text-align: left;
      }
      .manual-code-section label { font-size: 12px; color: #8da2c0; }
      .manual-code-section input {
        flex: 1;
        padding: 10px 14px;
        border-radius: 10px;
        border: 1px solid #384568;
        background: #111422;
        color: white;
        font-size: 16px;
        font-weight: bold;
        letter-spacing: 1px;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.96); }
        to { opacity: 1; transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  public async showQRModal(roomId: string): Promise<void> {
    const canvas = document.getElementById('qr-code-canvas') as HTMLCanvasElement;
    const codeText = document.getElementById('qr-room-code-text');
    if (codeText) codeText.textContent = roomId;

    // Determine host URL for joining
    let joinUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

    try {
      // Check if server exposes LAN IP so phone on same Wi-Fi can join
      const res = await fetch('/api/network-info');
      if (res.ok) {
        const info = await res.json();
        if (info.ip && info.ip !== 'localhost' && window.location.hostname === 'localhost') {
          const port = window.location.port || '5173';
          joinUrl = `http://${info.ip}:${port}/?room=${encodeURIComponent(roomId)}`;
        }
      }
    } catch {
      // Use current window origin
    }

    if (canvas) {
      await QRCode.toCanvas(canvas, joinUrl, {
        width: 220,
        margin: 1,
        color: {
          dark: '#0c101d',
          light: '#ffffff'
        }
      });
    }

    const copyBtn = document.getElementById('btn-copy-room-link');
    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(joinUrl).then(() => {
          copyBtn.textContent = '✅ Copied to Clipboard!';
          setTimeout(() => {
            copyBtn.textContent = '📋 Copy Join Link';
          }, 2000);
        }).catch(() => {
          copyBtn.textContent = 'Link: ' + roomId;
        });
      };
    }

    this.qrModalEl.style.display = 'flex';
  }

  public hideQRModal(): void {
    this.qrModalEl.style.display = 'none';
  }

  public startScanner(onScanned: (roomCode: string) => void): void {
    this.onRoomCodeScanned = onScanned;
    this.scannerModalEl.style.display = 'flex';
    const statusEl = document.getElementById('scanner-status');
    if (statusEl) statusEl.textContent = 'Requesting camera access...';

    if (this.html5QrCode) {
      this.stopScanner();
    }

    this.html5QrCode = new Html5Qrcode('qr-reader');
    this.isScanning = true;

    this.html5QrCode.start(
      { facingMode: 'environment' }, // Rear camera
      {
        fps: 15,
        qrbox: { width: 220, height: 220 }
      },
      (decodedText) => {
        this.handleScanResult(decodedText);
      },
      (_errorMessage) => {
        // Continuous scan error (no QR in frame yet), safe to ignore
      }
    ).then(() => {
      if (statusEl) statusEl.textContent = '🟢 Camera ready - align QR code';
    }).catch((err) => {
      console.warn('Camera scan failed to start:', err);
      if (statusEl) {
        statusEl.innerHTML = `⚠️ Camera access error (${err.message || 'Permission denied'}).<br>Please enter code below.`;
      }
    });
  }

  private handleScanResult(text: string): void {
    let roomCode = text.trim();

    // Check if scanned text is a full URL like http://.../?room=RV-XXXX
    try {
      if (text.includes('room=')) {
        const url = new URL(text);
        const param = url.searchParams.get('room');
        if (param) roomCode = param;
      }
    } catch {
      // Raw string fallback
    }

    if (roomCode.startsWith('RV-') || roomCode.length >= 4) {
      // Haptic feedback if supported on mobile
      if ('vibrate' in navigator) {
        navigator.vibrate(100);
      }

      this.stopScanner();
      if (this.onRoomCodeScanned) {
        this.onRoomCodeScanned(roomCode.toUpperCase());
      }
    }
  }

  public stopScanner(): void {
    if (this.html5QrCode && this.isScanning) {
      this.html5QrCode.stop().catch(() => {}).then(() => {
        this.html5QrCode = null;
      });
    }
    this.isScanning = false;
    this.scannerModalEl.style.display = 'none';
  }
}

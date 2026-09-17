import * as pc from 'playcanvas';
import { PCRenderer } from './engine/playcanvas/PCRenderer.js';
import { PCMapBuilder } from './engine/playcanvas/PCMapBuilder.js';
import { AudioManager } from './engine/AudioManager.js';
import { PCFXManager } from './engine/playcanvas/PCFXManager.js';
import { PCWeaponManager } from './engine/playcanvas/PCWeaponManager.js';
import { PCPowerupManager } from './engine/playcanvas/PCPowerupManager.js';
import { InputManager } from './controls/InputManager.js';
import { TouchHUD } from './ui/TouchHUD.js';
import { QRManager } from './ui/QRManager.js';
import { LobbyUI } from './ui/LobbyUI.js';
import { AuthUI } from './ui/AuthUI.js';
import { GrammarReloadUI } from './ui/GrammarReloadUI.js';
import { SettingsUI, GameSettings } from './ui/SettingsUI.js';
import { DashboardUI } from './ui/DashboardUI.js';
import { LoadingScreenUI } from './ui/LoadingScreenUI.js';
import { PCNetworkClient } from './network/PCNetworkClient.js';
import { PCProjectileManager } from './engine/playcanvas/PCProjectileManager.js';
import { PCGLBLoader } from './engine/playcanvas/PCGLBLoader.js';
import { MOVEMENT, NETWORK, WEAPON_ORDER, getMapSpawns } from '../shared/constants.js';
import { TeamColor, RemoteFirePayload } from '../shared/types.js';

function damp(current: number, target: number, lambda: number, dt: number): number {
  return pc.math.lerp(current, target, 1 - Math.exp(-lambda * dt));
}

class GameApp {
  private appContainer: HTMLElement;
  private renderer!: PCRenderer;
  private audio!: AudioManager;
  private fx!: PCFXManager;
  private projectileManager!: PCProjectileManager;
  private powerupManager!: PCPowerupManager;
  private weaponManager!: PCWeaponManager;
  private input!: InputManager;
  private hud!: TouchHUD;
  private settingsUI!: SettingsUI;
  private dashboardUI!: DashboardUI;
  private loadingScreenUI!: LoadingScreenUI;
  private qrManager!: QRManager;
  private lobbyUI!: LobbyUI;
  private authUI!: AuthUI;
  private grammarReloadUI!: GrammarReloadUI;
  private networkClient!: PCNetworkClient;
  private mapBuilder!: PCMapBuilder;
  private glbLoader!: PCGLBLoader;

  // Local player physics state
  private playerPos = new pc.Vec3(0, 0, 0);
  private playerVel = new pc.Vec3(0, 0, 0);
  private playerYaw: number = 0;
  private playerPitch: number = 0;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private slideDirection = new pc.Vec3();
  private currentHp: number = 100;
  private currentShield: number = 0;
  private myTeam: TeamColor = 'none';
  private isDead: boolean = false;

  // Grappling Hook State & Physics
  private isGrappling: boolean = false;
  private grappleAnchor = new pc.Vec3();
  private grappleCooldownTimer: number = 0;

  // Movement feel & responsive input enhancements
  private jumpBufferTimer: number = 0;
  private coyoteTimer: number = 0;
  private hasJumpedThisAirtime: boolean = false;
  private lastTeleportTime: number = 0;

  // Camera & viewmodel feel
  private cameraRoll: number = 0;
  private bobTimer: number = 0;
  private swayOffsetX: number = 0;
  private swayOffsetY: number = 0;

  // Pre-allocated scratch vectors to prevent GC spikes in tick loop
  private _scratchForward = new pc.Vec3();
  private _scratchRight = new pc.Vec3();
  private _scratchMoveDir = new pc.Vec3();

  private lastTime: number = performance.now();
  private inputSendTimer: number = 0;

  constructor() {
    this.appContainer = document.getElementById('app') || document.body;
    this.init();
  }

  public getPlayerHp(): number {
    return this.currentHp;
  }

  public getCurrentShield(): number {
    return this.currentShield;
  }

  private async init(): Promise<void> {
    // 1. Core systems
    this.renderer = new PCRenderer(this.appContainer);
    this.audio = new AudioManager();
    this.fx = new PCFXManager(this.renderer.app);
    this.projectileManager = new PCProjectileManager(this.renderer.app, this.fx);
    this.powerupManager = new PCPowerupManager(this.renderer.app, this.audio);
    this.weaponManager = new PCWeaponManager(this.renderer.app, this.renderer.cameraEntity, this.fx, this.audio);
    this.input = new InputManager(this.appContainer);
    this.hud = new TouchHUD(this.appContainer);
    this.settingsUI = new SettingsUI(this.appContainer, (settings) => {
      this.applySettings(settings);
    });
    this.applySettings(this.settingsUI.settings);

    this.dashboardUI = new DashboardUI(this.appContainer);
    this.loadingScreenUI = new LoadingScreenUI(this.appContainer);
    this.glbLoader = new PCGLBLoader(this.renderer.app);
    this.qrManager = new QRManager();
    this.mapBuilder = new PCMapBuilder(this.renderer.app, 'Facility', 'twilight');
    this.powerupManager.spawnWorldPickups(this.mapBuilder.mapName);

    // Wire HUD top-right quick access and powerup buttons
    this.hud.onPowerupClick = () => {
      this.activateCurrentPowerup();
    };
    this.hud.onOpenDashboard = () => {
      this.input.unlockCursor();
      this.dashboardUI.open(this.authUI?.currentUser || null);
    };
    this.hud.onOpenSettings = () => {
      this.input.unlockCursor();
      this.settingsUI.open();
    };
    this.input.touch.onOpenSettings = () => {
      this.input.unlockCursor();
      this.settingsUI.open();
    };

    // 2. Network Client
    this.networkClient = new PCNetworkClient(
      this.renderer.app,
      this.audio,
      this.fx,
      this.weaponManager
    );

    // 3. Lobby UI
    this.lobbyUI = new LobbyUI(this.appContainer, {
      onCreateRoom: async (name, mode, fragLimit, mapName, skyTheme = 'twilight', outfitIndex = 0, customization) => {
        this.audio.touchUnlock();
        if (this.mapBuilder.mapName !== mapName || this.mapBuilder.skyTheme !== skyTheme) {
          this.mapBuilder.dispose();
          this.mapBuilder = new PCMapBuilder(this.renderer.app, mapName, skyTheme);
          this.powerupManager.spawnWorldPickups(mapName);
        }
        const isSolo = this.lobbyUI.autoStartSolo;
        const res = await this.networkClient.createRoom(name, mode, fragLimit, mapName, outfitIndex, customization);
        if (res.success && res.roomId) {
          if (this.networkClient.currentRoomState) {
            this.lobbyUI.showInRoomLobby(this.networkClient.currentRoomState, true);
            if (!isSolo) {
              this.qrManager.showQRModal(res.roomId);
            }
          }
        } else {
          alert(res.error || 'Failed to create room');
        }
      },
      onJoinRoom: async (roomId, name, outfitIndex = 0, customization) => {
        this.audio.touchUnlock();
        const res = await this.networkClient.joinRoom(roomId, name, outfitIndex, customization);
        if (res.success && this.networkClient.currentRoomState) {
          const state = this.networkClient.currentRoomState;
          if (state.status === 'playing') {
            this.startLocalMatch(state);
          } else if (state.status === 'countdown') {
            this.lobbyUI.hideLobby();
            this.hud.setVisible(true);
          } else {
            this.lobbyUI.showInRoomLobby(state, false);
          }
        } else {
          alert(res.error || 'Failed to join room');
        }
      },
      onLeaveRoom: () => {
        this.networkClient.leaveRoom();
        this.lobbyUI.showMainMenu();
      },
      onDeleteRoom: async (roomId: string) => {
        const res = await this.networkClient.deleteRoom(roomId);
        if (res.success) {
          this.lobbyUI.showToast(`Room ${roomId} deleted.`, false);
          this.lobbyUI.showMainMenu();
          this.networkClient.requestRooms();
        } else {
          this.lobbyUI.showToast(res.error || 'Failed to delete room.', true);
        }
      },
      isHostOfRoom: (roomId: string) => {
        return this.networkClient.isHostOf(roomId);
      },
      onOpenQRScanner: () => {
        this.audio.touchUnlock();
        this.qrManager.startScanner((scannedCode) => {
          const nameInput = document.getElementById('input-player-name') as HTMLInputElement;
          const name = nameInput?.value?.trim() || 'Rival';
          this.lobbyUI.callbacks.onJoinRoom(scannedCode, name);
        });
      },
      onOpenQRDisplay: (roomId) => {
        this.qrManager.showQRModal(roomId);
      },
      onStartMatch: () => {
        this.networkClient.startCountdown();
      },
      onAuthClick: () => {
        this.audio.touchUnlock();
        this.authUI.openModal();
      },
      onOpenDashboard: () => {
        this.input.unlockCursor();
        this.dashboardUI.open(this.authUI?.currentUser || null);
      },
      onOpenSettings: () => {
        this.input.unlockCursor();
        this.settingsUI.open();
      },
      onRefreshRooms: async () => {
        try {
          const res = await fetch('/api/rooms');
          const data = await res.json();
          if (data?.rooms) {
            this.lobbyUI.updateOpenRooms(data.rooms);
          }
        } catch (e) {
          console.error('Failed to fetch rooms:', e);
        }
      }
    });

    // Initial fetch of public rooms
    fetch('/api/rooms')
      .then((r) => r.json())
      .then((data) => {
        if (data?.rooms) this.lobbyUI.updateOpenRooms(data.rooms);
      })
      .catch(() => {});

    // 4. Initialize Auth & Grammar Reload UI
    this.authUI = new AuthUI(
      this.appContainer,
      (user) => {
        this.lobbyUI.updateAccountDisplay(user);
      },
      () => {
        this.input.unlockCursor();
        this.dashboardUI.open(this.authUI?.currentUser || null);
      }
    );
    this.grammarReloadUI = new GrammarReloadUI(this.appContainer);

    // 5. Hook Network Callbacks
    this.setupNetworkCallbacks();

    // 6. Check URL parameters for direct join
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
      if (codeInput) codeInput.value = roomParam.toUpperCase();
    }

    // 7. Interactive Asset Loading Screen
    await this.loadingScreenUI.preloadGameAssets(this.audio, this.glbLoader);
    const charContainer = this.glbLoader.get('/models/characters/arena_character.glb');
    if (charContainer) {
      this.networkClient.characterContainer = charContainer;
    }

    // 8. Start Render & Game Loop
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  private applySettings(settings: GameSettings): void {
    this.audio.setMasterVolume(settings.masterVolume);
    this.audio.setSfxVolume(settings.sfxVolume);
    this.audio.setVoiceVolume(settings.voiceVolume);
    this.audio.setMuted(settings.isMuted);
    this.input.mouseSensitivity = settings.mouseSensitivity;
    this.input.invertY = settings.invertY;
    this.input.touch.sensitivity = settings.touchSensitivity;
    this.input.touch.invertY = settings.invertY;
    this.input.touch.autoFireEnabled = settings.autoFire;
    this.renderer.applyGraphicsQuality(settings.graphicsQuality);
    this.renderer.setFov(settings.fov);

    const hudEl = document.getElementById('touch-hud');
    if (hudEl) hudEl.style.opacity = `${settings.hudOpacity}`;
    const actionsEl = document.getElementById('touch-actions-overlay');
    if (actionsEl) actionsEl.style.opacity = `${settings.hudOpacity}`;
  }

  private checkAutoFireTarget(): boolean {
    if (!this.renderer.cameraEntity) return false;
    const targetables = this.networkClient.getTargetables();
    if (!targetables || targetables.length === 0) return false;
    const camPos = this.renderer.cameraEntity.getPosition();
    const camDir = this.renderer.cameraEntity.forward;
    const maxRange = this.weaponManager.currentStats.range || 50;

    for (const t of targetables) {
      if (t.isDead) continue;
      const hitboxes = t.getHitboxes();
      for (const hb of hitboxes) {
        const c = hb.box.center;
        const dx = c.x - camPos.x;
        const dy = c.y - camPos.y;
        const dz = c.z - camPos.z;
        const dist = Math.hypot(dx, dy, dz);
        if (dist > maxRange || dist < 0.5) continue;
        const dot = (dx * camDir.x + dy * camDir.y + dz * camDir.z) / dist;
        if (dot > 0.985) return true;
      }
    }
    return false;
  }

  private setupNetworkCallbacks(): void {
    this.networkClient.onRoomStateChange = (state) => {
      const isHost = state.hostId === this.networkClient.myId;
      if (state.status === 'lobby') {
        this.lobbyUI.showInRoomLobby(state, isHost);
        this.hud.setVisible(false);
      } else if (state.status === 'playing') {
        this.lobbyUI.hideLobby();
        this.hud.setVisible(true);
        this.updateHUDMatchStats(state);

        const myState = state.players[this.networkClient.myId];
        if (myState && this.isDead && !myState.isDead) {
          this.isDead = false;
          this.currentHp = myState.health;
          this.currentShield = myState.shieldHp;
          this.playerPos.set(myState.x, myState.y, myState.z);
          if (this.mapBuilder) {
            const gLevel = this.mapBuilder.getGroundLevel(this.playerPos);
            if (gLevel <= -3.0) {
              const safeSpawns = getMapSpawns(this.mapBuilder.mapName);
              const anchor = safeSpawns[0] || { x: 0, y: 0.0, z: 0, yaw: 0 };
              this.playerPos.set(anchor.x, anchor.y, anchor.z);
              this.playerYaw = anchor.yaw;
            } else {
              this.playerYaw = myState.yaw;
            }
          } else {
            this.playerYaw = myState.yaw;
          }
          this.playerVel.set(0, 0, 0);
          this.hud.updateHealth(myState.health);
          this.hud.updateShield(myState.shieldHp);
        }
      }
    };

    this.networkClient.onCountdown = (count) => {
      this.lobbyUI.hideLobby();
      this.hud.setVisible(true);
      this.hud.showCountdown(count);
    };

    this.networkClient.onGameStart = () => {
      if (this.networkClient.currentRoomState) {
        this.startLocalMatch(this.networkClient.currentRoomState);
      }
    };

    this.networkClient.onLocalPlayerDamaged = (remainingHp, _maxHp, remainingShield) => {
      this.audio.playHit(false);
      this.currentHp = remainingHp;
      if (remainingShield !== undefined) {
        this.currentShield = remainingShield;
        this.hud.updateShield(remainingShield);
      }
      this.hud.updateHealth(remainingHp);
      this.hud.flashDamage();

      if (remainingHp <= 0) {
        this.isDead = true;
        this.audio.playOofDeath();
      }
    };

    this.networkClient.onPowerupActivated = (payload) => {
      if (payload.playerId === this.networkClient.myId) {
        this.powerupManager.applyActivePowerup(payload.powerup, payload.durationSec);
      } else {
        this.powerupManager.triggerRemoteAura(payload.powerup);
      }
    };

    this.networkClient.onOpenRoomsList = (rooms) => {
      this.lobbyUI.updateOpenRooms(rooms);
    };

    this.networkClient.onRoomDeleted = (payload) => {
      this.isDead = false;
      this.projectileManager.clear();
      this.hud.setVisible(false);
      this.hud.hideWaveBanner();
      this.lobbyUI.showMainMenu();
      this.lobbyUI.showToast(payload.reason || `Room ${payload.roomId} was cancelled and deleted.`, true);
      if (document.pointerLockElement) {
        document.exitPointerLock?.();
      }
    };

    this.networkClient.onWaveCleared = (payload) => {
      this.audio.playWaveClear();
      this.projectileManager.clear();
      this.hud.showWaveCleared(payload.waveNumber, payload.nextWaveInSec);

      this.weaponManager.grantAmmo(35);

      this.currentShield = Math.min(50, this.currentShield + 25);
      this.hud.updateShield(this.currentShield);

      if (this.isDead) {
        this.isDead = false;
        this.currentHp = 100;
        this.hud.updateHealth(100);
      }
    };

    this.networkClient.onWaveStart = (_payload) => {
      this.audio.playWaveStart();
      this.projectileManager.clear();
      this.hud.hideWaveBanner();
      if (this.networkClient.currentRoomState) {
        this.updateHUDMatchStats(this.networkClient.currentRoomState);
      }
    };

    this.networkClient.onRemotePlayerFired = (payload: RemoteFirePayload) => {
      this.audio.playShoot(payload.weaponType);
      if (!payload.hitPoint) return;
      const originVec = new pc.Vec3(...payload.origin);
      const hitVec = new pc.Vec3(...payload.hitPoint);

      if (payload.weaponType === 'plasma_launcher') {
        this.fx.spawnPlasmaExplosion(hitVec);
      } else if (payload.weaponType === 'railgun') {
        this.fx.spawnRailgunTracer(originVec, hitVec);
      } else if (payload.weaponType === 'arc_disruptor') {
        this.fx.spawnTeslaArc(originVec, hitVec);
      } else {
        this.fx.spawnHitSparks(hitVec, undefined, false);
      }
    };

    this.networkClient.onBotProjectileSpawn = (payload) => {
      this.projectileManager.onProjectileSpawn(payload);
      if (payload.pattern === 'ring' || payload.pattern === 'spiral') {
        this.audio.playPlasmaExplosion();
      } else {
        this.audio.playShoot('plasma_launcher');
      }
    };

    this.networkClient.onBotProjectileImpact = (payload) => {
      this.projectileManager.onProjectileImpact(payload);
      if (payload.hitPlayerId === this.networkClient.myId) {
        this.audio.playHit(false);
      }
    };

    this.networkClient.onBossState = (payload) => {
      this.hud.updateBossState(payload);
    };

    this.networkClient.onPlayerEliminated = (payload) => {
      this.hud.addKillfeed(
        payload.killerName,
        payload.victimName,
        payload.weapon,
        payload.isHeadshot
      );

      if (payload.victimId === this.networkClient.myId) {
        this.isDead = true;
        if (this.networkClient.currentRoomState?.mode !== 'wave') {
          setTimeout(() => {
            this.currentHp = 100;
            this.currentShield = 0;
            this.isDead = false;
            this.hud.updateHealth(100);
            this.hud.updateShield(0);
          }, NETWORK.RESPAWN_DELAY_SEC * 1000);
        }
      }

      if (this.networkClient.currentRoomState) {
        this.updateHUDMatchStats(this.networkClient.currentRoomState);
      }
    };

    this.networkClient.onGameOver = async (payload) => {
      this.projectileManager.clear();
      const mode = this.networkClient.currentRoomState?.mode;
      const currentWave = this.networkClient.currentRoomState?.waveState?.currentWave;
      const roomId = this.networkClient.currentRoomState?.roomId;
      const isHost = roomId ? this.networkClient.isHostOf(roomId) : false;

      this.hud.showGameOver(
        payload,
        this.networkClient.myId,
        () => {
          this.networkClient.leaveRoom();
          this.lobbyUI.showMainMenu();
          this.hud.setVisible(false);
        },
        mode,
        currentWave,
        isHost,
        roomId ? async () => {
          const res = await this.networkClient.deleteRoom(roomId);
          if (res.success) {
            this.lobbyUI.showToast(`Room ${roomId} closed and deleted.`, false);
          }
          this.lobbyUI.showMainMenu();
          this.hud.setVisible(false);
        } : undefined
      );

      try {
        const token = this.authUI.getToken();
        if (token) {
          const myScoreEntry = payload.scores.find((s) => s.id === this.networkClient.myId);
          const won =
            payload.winnerId === this.networkClient.myId ||
            (payload.winningTeam && payload.winningTeam === this.myTeam);
          const res = await fetch('/api/stats/match', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              mode: this.networkClient.currentRoomState?.mode || '1v1',
              mapName: this.networkClient.currentRoomState?.mapName || 'Arena Classic',
              kills: myScoreEntry?.kills || 0,
              deaths: myScoreEntry?.deaths || 0,
              won: Boolean(won),
              score: myScoreEntry?.score || (myScoreEntry?.kills || 0) * 100,
              powerupsUsed: this.powerupManager.powerupsUsedInMatch
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.user) {
              this.authUI.currentUser = data.user;
              this.lobbyUI.updateAccountDisplay(data.user);
            }
          }
        }
      } catch (err) {
        console.error('Failed to log match result:', err);
      }
    };
  }

  private startLocalMatch(state: any): void {
    this.networkClient.isInGame = true;
    this.currentHp = 100;
    this.currentShield = 0;
    this.isDead = false;
    this.powerupManager.reset();
    this.hud.updateHealth(100);
    this.hud.updateShield(0);
    this.hud.updatePowerupSlot(null, false, 0);
    this.hud.setVisible(true);
    this.lobbyUI.hideLobby();

    const chosenMap = state.mapName || 'Facility';
    if (this.mapBuilder.mapName !== chosenMap) {
      this.mapBuilder.dispose();
      this.mapBuilder = new PCMapBuilder(this.renderer.app, chosenMap);
      this.powerupManager.spawnWorldPickups(chosenMap);
    }

    const myState = state.players[this.networkClient.myId];
    if (myState) {
      this.myTeam = myState.team || 'none';
      this.playerPos.set(myState.x, myState.y, myState.z);
      if (this.mapBuilder) {
        const gLevel = this.mapBuilder.getGroundLevel(this.playerPos);
        if (gLevel <= -3.0) {
          const safeSpawns = getMapSpawns(this.mapBuilder.mapName);
          const anchor = safeSpawns[0] || { x: 0, y: 0.0, z: 0, yaw: 0 };
          this.playerPos.set(anchor.x, anchor.y, anchor.z);
          this.playerYaw = anchor.yaw;
        } else {
          this.playerYaw = myState.yaw;
        }
      } else {
        this.playerYaw = myState.yaw;
      }
      this.playerVel.set(0, 0, 0);
    }

    this.updateHUDMatchStats(state);
  }

  private updateHUDMatchStats(state: any): void {
    const players = Object.values(state.players) as any[];
    const scoreA = players[0]?.score || 0;
    const scoreB = players[1]?.score || 0;

    let nearestBotDist: number | undefined;
    if (state.mode === 'wave') {
      const myPos = this.playerPos;
      let minDist = Infinity;
      for (const remote of (this.networkClient as any).remotePlayers.values()) {
        if (!remote.isDead) {
          const d = myPos.distance(remote.targetPos);
          if (d < minDist) minDist = d;
        }
      }
      if (minDist !== Infinity) nearestBotDist = minDist;
    }

    this.hud.updateMatchHeader(
      state.mode,
      scoreA,
      scoreB,
      state.fragLimit,
      state.teamScores,
      state.waveState,
      nearestBotDist
    );
  }

  private gameLoop(currentTime: number): void {
    requestAnimationFrame(this.gameLoop.bind(this));

    const delta = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    if (this.networkClient.isInGame && !this.isDead) {
      this.updatePlayerMovement(delta);
      this.updateCombat(delta);
      this.sendNetworkInput(delta);
    }

    const move = this.input.getMoveVector();
    const isMovingInput = Math.abs(move.forward) > 0.05 || Math.abs(move.right) > 0.05;
    const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);

    // Engine updates
    this.powerupManager.update(delta, this.playerPos);
    this.hud.updatePowerupSlot(
      this.powerupManager.storedPowerup || this.powerupManager.activePowerup,
      this.powerupManager.hasActivePowerup(),
      this.powerupManager.remainingActiveSec
    );
    this.networkClient.update(delta);
    this.projectileManager.update(delta);
    this.weaponManager.update(delta, isMovingInput, currentSpeed);
    this.fx.update(delta);

    // Render PlayCanvas Scene
    if (this.renderer.app) {
      this.renderer.app.render();
    }
  }

  private updatePlayerMovement(delta: number): void {
    // 1. Look rotation & Viewmodel sway
    const look = this.input.getLookDeltas();
    this.playerYaw -= look.yaw;
    this.playerPitch = Math.max(-1.4, Math.min(1.4, this.playerPitch - look.pitch));

    this.swayOffsetX = pc.math.lerp(this.swayOffsetX, Math.max(-0.06, Math.min(0.06, -look.yaw * 0.8)), delta * 15);
    this.swayOffsetY = pc.math.lerp(this.swayOffsetY, Math.max(-0.05, Math.min(0.05, -look.pitch * 0.8)), delta * 15);
    if (this.weaponManager.viewModelContainer) {
      this.weaponManager.viewModelContainer.setLocalPosition(this.swayOffsetX, this.swayOffsetY, 0);
    }

    // 2. Input movement vector
    const move = this.input.getMoveVector();
    const isMovingInput = Math.abs(move.forward) > 0.05 || Math.abs(move.right) > 0.05;

    this._scratchForward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    this._scratchRight.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    // Jump buffering & coyote timing
    if (this.input.isJumping()) {
      this.jumpBufferTimer = 0.12;
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    if (this.isGrounded) {
      this.coyoteTimer = 0.10;
      this.hasJumpedThisAirtime = false;
    } else {
      this.coyoteTimer -= delta;
    }

    // 2.5 Grappling Hook cooldown & input trigger
    if (this.grappleCooldownTimer > 0) {
      this.grappleCooldownTimer = Math.max(0, this.grappleCooldownTimer - delta);
    }

    const grappleRequested = this.input.consumeGrapple();
    if (grappleRequested) {
      if (this.isGrappling) {
        this.detachGrapple(false);
      } else if (this.grappleCooldownTimer <= 0 && !this.isDead) {
        this.fireGrappleHook();
      }
    }

    // 3. Sliding mechanic
    const slideRequested = this.input.isSliding();
    if (slideRequested && this.isGrounded && !this.isSliding && isMovingInput) {
      this.isSliding = true;
      this.slideTimer = MOVEMENT.SLIDE_DURATION_MAX;
      this.slideDirection.set(
        this._scratchForward.x * move.forward + this._scratchRight.x * move.right,
        0,
        this._scratchForward.z * move.forward + this._scratchRight.z * move.right
      ).normalize();
      this.playerVel.x = this.slideDirection.x * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.playerVel.z = this.slideDirection.z * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.audio.playSlide();
    }

    const canJump = (this.isGrounded || (this.coyoteTimer > 0 && !this.hasJumpedThisAirtime)) && this.jumpBufferTimer > 0;

    if (this.isSliding) {
      this.slideTimer -= delta;
      const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const newSpeed = Math.max(MOVEMENT.SLIDE_MIN_SPEED, currentSpeed - MOVEMENT.SLIDE_FRICTION * delta);
      const ratio = newSpeed / (currentSpeed || 1);
      this.playerVel.x *= ratio;
      this.playerVel.z *= ratio;

      this.fx.spawnSlideDust(this.playerPos);

      if (canJump) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY * MOVEMENT.SLIDE_JUMP_BOOST;
        this.isGrounded = false;
        this.isSliding = false;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }

      if (this.slideTimer <= 0 || !slideRequested) {
        this.isSliding = false;
      }
    } else if (this.isGrounded) {
      const speedMult = this.powerupManager.getSpeedMultiplier();
      const targetSpeed = MOVEMENT.WALK_SPEED * speedMult;
      this._scratchMoveDir.set(
        this._scratchForward.x * move.forward + this._scratchRight.x * move.right,
        0,
        this._scratchForward.z * move.forward + this._scratchRight.z * move.right
      );
      this.playerVel.x = this._scratchMoveDir.x * targetSpeed;
      this.playerVel.z = this._scratchMoveDir.z * targetSpeed;

      if (canJump) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY;
        this.isGrounded = false;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }
    } else {
      if (canJump) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }

      if (isMovingInput) {
        const speedMult = this.powerupManager.getSpeedMultiplier();
        const targetSpeed = MOVEMENT.AIR_MAX_SPEED * speedMult;
        this._scratchMoveDir.set(
          this._scratchForward.x * move.forward + this._scratchRight.x * move.right,
          0,
          this._scratchForward.z * move.forward + this._scratchRight.z * move.right
        ).normalize();
        const desiredX = this._scratchMoveDir.x * targetSpeed;
        const desiredZ = this._scratchMoveDir.z * targetSpeed;

        const currentHorizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);

        if (currentHorizSpeed <= targetSpeed) {
          const steerRate = MOVEMENT.AIR_ACCEL * delta;
          this.playerVel.x = damp(this.playerVel.x, desiredX, steerRate, delta);
          this.playerVel.z = damp(this.playerVel.z, desiredZ, steerRate, delta);
        } else {
          const steerAngle = Math.atan2(desiredZ, desiredX);
          const currentAngle = Math.atan2(this.playerVel.z, this.playerVel.x);
          let angleDiff = steerAngle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          const maxAngleChange = 4.5 * delta;
          const newAngle = currentAngle + Math.max(-maxAngleChange, Math.min(maxAngleChange, angleDiff));
          const retainedSpeed = currentHorizSpeed * MOVEMENT.AIR_DRAG;
          this.playerVel.x = Math.cos(newAngle) * retainedSpeed;
          this.playerVel.z = Math.sin(newAngle) * retainedSpeed;
        }
      }
    }

    // 3.3 Active Grappling Hook Physics & Swing Dynamics
    if (this.isGrappling) {
      const toAnchor = new pc.Vec3().sub2(this.grappleAnchor, this.playerPos);
      const dist = toAnchor.length();

      if (dist <= MOVEMENT.GRAPPLE_DETACH_DIST) {
        this.detachGrapple(true);
      } else {
        const pullDir = toAnchor.clone().normalize();
        const accel = MOVEMENT.GRAPPLE_PULL_ACCEL * delta;
        this.playerVel.x += pullDir.x * accel;
        this.playerVel.y += pullDir.y * accel;
        this.playerVel.z += pullDir.z * accel;

        if (isMovingInput) {
          const steerRate = MOVEMENT.AIR_ACCEL * 0.8 * delta;
          this.playerVel.x += this._scratchMoveDir.x * steerRate;
          this.playerVel.z += this._scratchMoveDir.z * steerRate;
        }

        const currentGrappleSpeed = this.playerVel.length();
        if (currentGrappleSpeed > MOVEMENT.GRAPPLE_PULL_SPEED) {
          this.playerVel.mulScalar(MOVEMENT.GRAPPLE_PULL_SPEED / currentGrappleSpeed);
        }

        if (canJump || this.input.isJumping()) {
          this.detachGrapple(true);
          this.jumpBufferTimer = 0;
          this.hasJumpedThisAirtime = true;
          this.audio.playJump();
        }
      }
    }

    // 3.5 Ladder Climbing Physics
    const ladderBox = this.mapBuilder.checkLadders(this.playerPos);
    const isClimbing = ladderBox !== null;

    if (isClimbing && ladderBox) {
      this.isSliding = false;
      this.isGrounded = false;
      const ladderMax = ladderBox.getMax();

      if (move.forward > 0 || this.input.isJumping()) {
        this.playerVel.y = MOVEMENT.CLIMB_SPEED;
      } else if (move.forward < 0) {
        this.playerVel.y = -MOVEMENT.CLIMB_SPEED;
      } else {
        this.playerVel.y = 0;
      }

      this.playerVel.x *= 0.25;
      this.playerVel.z *= 0.25;

      if ((this.jumpBufferTimer > 0 || this.input.isJumping()) && (move.forward < 0 || Math.abs(move.right) > 0.2)) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY * 0.85;
        this.playerVel.x += (this._scratchRight.x * move.right - this._scratchForward.x * 0.8) * 6.0;
        this.playerVel.z += (this._scratchRight.z * move.right - this._scratchForward.z * 0.8) * 6.0;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }

      if (this.playerPos.y >= ladderMax.y - 0.35 && move.forward > 0) {
        this.playerPos.y = ladderMax.y + 0.05;
        this.playerVel.x += this._scratchForward.x * 4.0;
        this.playerVel.z += this._scratchForward.z * 4.0;
      }
    }

    // 4. Gravity & Vertical motion
    if (!isClimbing) {
      this.playerVel.y -= MOVEMENT.GRAVITY * delta;
    }
    this.playerPos.x += this.playerVel.x * delta;
    this.playerPos.y += this.playerVel.y * delta;
    this.playerPos.z += this.playerVel.z * delta;

    // Floor collision & Jump pads
    const groundLevel = this.mapBuilder.getGroundLevel(this.playerPos);
    if (this.playerPos.y <= groundLevel) {
      this.playerPos.y = groundLevel;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    const pad = this.mapBuilder.checkJumpPads(this.playerPos);
    if (pad !== null && this.playerVel.y <= 2.5) {
      this.playerVel.y = Math.max(pad.impulseY, this.playerVel.y + pad.impulseY * 0.5);
      if (pad.impulseX !== 0 || pad.impulseZ !== 0) {
        const currentHorizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
        const padSpeed = Math.hypot(pad.impulseX, pad.impulseZ);
        const launchSpeed = Math.max(currentHorizSpeed, padSpeed);
        const padDirX = pad.impulseX / padSpeed;
        const padDirZ = pad.impulseZ / padSpeed;
        this.playerVel.x = padDirX * launchSpeed;
        this.playerVel.z = padDirZ * launchSpeed;
      }
      this.isGrounded = false;
      this.hasJumpedThisAirtime = true;
      this.audio.playJump();
    }

    const hitPort = this.mapBuilder.checkTeleportPorts(this.playerPos, this.lastTeleportTime);
    if (hitPort) {
      this.lastTeleportTime = performance.now();
      this.playerPos.copy(hitPort.exitPos);
      this.playerYaw = hitPort.exitYaw;

      const inSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const exitSpeed = Math.max(inSpeed, 14.0);
      this.playerVel.x = Math.sin(hitPort.exitYaw) * exitSpeed;
      this.playerVel.z = Math.cos(hitPort.exitYaw) * exitSpeed;
      this.playerVel.y = Math.max(this.playerVel.y, 3.5);
      this.isGrounded = false;
      this.hasJumpedThisAirtime = true;

      this.audio.playTeleport();
      this.hud.showTeleportEffect();
    }

    if (this.playerPos.y < -3.0 && this.networkClient.isInGame && !this.isDead) {
      this.isDead = true;
      this.currentHp = 0;
      this.currentShield = 0;
      this.hud.updateHealth(0);
      this.audio.playOofDeath();
      this.networkClient.sendVoidFall();
      this.detachGrapple(false);
      this.playerVel.set(0, 0, 0);
    }

    this.resolveArenaCollisions();

    // 5. Update Camera
    const targetRoll = this.isSliding ? -0.05 : -move.right * 0.025;
    this.cameraRoll = pc.math.lerp(this.cameraRoll, targetRoll, delta * 14);

    if (this.isGrounded && isMovingInput) {
      this.bobTimer += delta * (this.isSliding ? 14 : 10);
    } else {
      this.bobTimer = 0;
    }
    const bobOffset = this.isGrounded && isMovingInput ? Math.sin(this.bobTimer) * 0.035 : 0;

    const eyeHeight = (this.isSliding ? MOVEMENT.SLIDE_EYE_HEIGHT : MOVEMENT.EYE_HEIGHT) + bobOffset;
    if (this.renderer.playerEntity && this.renderer.cameraPitchEntity) {
      this.renderer.setPlayerTransform(
        this.playerPos.x,
        this.playerPos.y,
        this.playerPos.z,
        (this.playerYaw * 180) / Math.PI
      );
      this.renderer.setEyeHeight(eyeHeight);
      this.renderer.setCameraPitch((this.playerPitch * 180) / Math.PI);
    } else if (this.renderer.cameraEntity) {
      this.renderer.cameraEntity.setPosition(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
      this.renderer.cameraEntity.setEulerAngles(
        (this.playerPitch * 180) / Math.PI,
        (this.playerYaw * 180) / Math.PI,
        (this.cameraRoll * 180) / Math.PI
      );
    }

    const recoilSpread = Math.abs(this.weaponManager.recoilRotation.x) * 0.04;
    this.hud.updateCrosshairSpread(isMovingInput, this.isSliding, recoilSpread);

    // 6. Update Grappling Hook Cable & HUD
    if (this.isGrappling) {
      const muzzlePos = new pc.Vec3(
        this.playerPos.x + this._scratchRight.x * 0.22,
        this.playerPos.y + eyeHeight - 0.18,
        this.playerPos.z + this._scratchRight.z * 0.22
      );
      this.fx.updateGrappleCable(muzzlePos, this.grappleAnchor, delta);
    } else {
      this.fx.hideGrappleCable();
    }

    this.hud.updateGrappleState(this.isGrappling, this.grappleCooldownTimer);
    this.input.touch.setGrappleCooldown(this.grappleCooldownTimer);
  }

  private fireGrappleHook(): void {
    const eyeHeight = this.isSliding ? MOVEMENT.SLIDE_EYE_HEIGHT : MOVEMENT.EYE_HEIGHT;
    const camPos = new pc.Vec3(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
    const forwardX = -Math.sin(this.playerYaw) * Math.cos(this.playerPitch);
    const forwardY = Math.sin(this.playerPitch);
    const forwardZ = -Math.cos(this.playerYaw) * Math.cos(this.playerPitch);
    const camDir = new pc.Vec3(forwardX, forwardY, forwardZ).normalize();

    const ray = new pc.Ray(camPos, camDir);
    let closestDist = MOVEMENT.GRAPPLE_MAX_DIST;
    let hitPoint: pc.Vec3 | null = null;
    const testPt = new pc.Vec3();

    for (const box of this.mapBuilder.collisionBoxes) {
      if (box.intersectsRay(ray, testPt)) {
        const d = camPos.distance(testPt);
        if (d < closestDist && d > 1.8) {
          closestDist = d;
          if (!hitPoint) hitPoint = new pc.Vec3();
          hitPoint.copy(testPt);
        }
      }
    }

    this.audio.playGrappleShoot();

    if (hitPoint) {
      this.isGrappling = true;
      this.grappleAnchor.copy(hitPoint);
      this.isGrounded = false;
      this.isSliding = false;
      this.hasJumpedThisAirtime = true;
      this.audio.playGrappleLatch();
      this.fx.spawnGrappleImpact(hitPoint);
    } else {
      // Whiff penalty cooldown
      this.grappleCooldownTimer = 0.6;
    }
  }

  private detachGrapple(withBoost: boolean): void {
    if (!this.isGrappling) return;
    this.isGrappling = false;
    this.grappleCooldownTimer = MOVEMENT.GRAPPLE_COOLDOWN_SEC;
    this.fx.hideGrappleCable();
    this.audio.playGrappleRelease();

    if (withBoost) {
      this.playerVel.x *= MOVEMENT.GRAPPLE_SLINGSHOT_BOOST;
      this.playerVel.z *= MOVEMENT.GRAPPLE_SLINGSHOT_BOOST;
      this.playerVel.y = Math.max(MOVEMENT.JUMP_VELOCITY * 0.75, this.playerVel.y * 1.15 + 3.0);
      this.isGrounded = false;
      this.hasJumpedThisAirtime = true;
    }
  }

  private resolveArenaCollisions(): void {
    const b = this.mapBuilder.bounds;
    this.playerPos.x = Math.max(b.minX, Math.min(b.maxX, this.playerPos.x));
    this.playerPos.z = Math.max(b.minZ, Math.min(b.maxZ, this.playerPos.z));

    const playerRadius = MOVEMENT.PLAYER_RADIUS;
    const playerFeet = this.playerPos.y;
    const playerHead = this.playerPos.y + (this.isSliding ? MOVEMENT.PLAYER_SLIDE_HEIGHT : MOVEMENT.PLAYER_HEIGHT);

    for (const box of this.mapBuilder.collisionBoxes) {
      const min = box.getMin();
      const max = box.getMax();

      if (
        this.playerPos.x < min.x - 6 ||
        this.playerPos.x > max.x + 6 ||
        this.playerPos.z < min.z - 6 ||
        this.playerPos.z > max.z + 6
      ) {
        continue;
      }

      if (playerFeet >= max.y - 0.2) continue;
      if (playerHead <= min.y + 0.1) continue;

      if (
        this.playerPos.x + playerRadius > min.x &&
        this.playerPos.x - playerRadius < max.x &&
        this.playerPos.z + playerRadius > min.z &&
        this.playerPos.z - playerRadius < max.z
      ) {
        const dx1 = Math.abs(this.playerPos.x + playerRadius - min.x);
        const dx2 = Math.abs(max.x - (this.playerPos.x - playerRadius));
        const dz1 = Math.abs(this.playerPos.z + playerRadius - min.z);
        const dz2 = Math.abs(max.z - (this.playerPos.z - playerRadius));

        const minDiff = Math.min(dx1, dx2, dz1, dz2);
        if (minDiff === dx1) {
          this.playerPos.x = min.x - playerRadius;
          if (this.playerVel.x > 0) this.playerVel.x = 0;
        } else if (minDiff === dx2) {
          this.playerPos.x = max.x + playerRadius;
          if (this.playerVel.x < 0) this.playerVel.x = 0;
        } else if (minDiff === dz1) {
          this.playerPos.z = min.z - playerRadius;
          if (this.playerVel.z > 0) this.playerVel.z = 0;
        } else if (minDiff === dz2) {
          this.playerPos.z = max.z + playerRadius;
          if (this.playerVel.z < 0) this.playerVel.z = 0;
        }
      }
    }
  }

  private updateCombat(_delta: number): void {
    const switchIdx = this.input.consumeWeaponSwitch();
    if (switchIdx !== undefined && switchIdx >= 0 && switchIdx < WEAPON_ORDER.length) {
      const type = WEAPON_ORDER[switchIdx];
      this.weaponManager.selectWeapon(type);
      this.networkClient.sendWeaponSwitch(switchIdx);
    }

    if (this.input.consumeReload()) {
      this.triggerReloadFlow();
    }

    if (this.input.consumePowerup()) {
      this.activateCurrentPowerup();
    }

    const baseFov = this.settingsUI?.settings?.fov || 75;
    const isAiming = this.input.isAiming();
    const targetFov = isAiming ? this.weaponManager.currentStats.adsZoomFov : baseFov;
    this.renderer.setFov(pc.math.lerp(this.renderer.cameraEntity?.camera?.fov || baseFov, targetFov, 0.2));
    this.hud.setAdsScope(isAiming, this.weaponManager.currentWeaponType);

    const isAutoFiring = Boolean(
      this.settingsUI?.settings?.autoFire &&
      !this.input.isAnyModalOpen() &&
      this.checkAutoFireTarget()
    );

    if (this.input.isFiring() || isAutoFiring) {
      if (
        this.weaponManager.ammoInMag[this.weaponManager.currentWeaponType] <= 0 &&
        this.weaponManager.currentStats.type !== 'katana'
      ) {
        this.triggerReloadFlow();
      } else {
        const targetables = this.networkClient.getTargetables();
        const obstacles = this.mapBuilder.collisionBoxes;
        const fireRes = this.weaponManager.fire(
          this.renderer.cameraEntity,
          targetables,
          obstacles,
          isAiming
        );

        if (fireRes.fired) {
          this.audio.playShoot(this.weaponManager.currentWeaponType);

          const camPos = this.renderer.cameraEntity.getPosition();
          const camDir = this.renderer.cameraEntity.forward;

          const currentW = this.weaponManager.currentWeaponType;
          const recoilKick = currentW === 'sniper' || currentW === 'railgun' ? 0.034
            : currentW === 'plasma_launcher' ? 0.026
            : currentW === 'shotgun' ? 0.024 : 0.012;
          this.playerPitch = Math.min(1.4, this.playerPitch + recoilKick);

          this.networkClient.sendFire({
            weaponType: this.weaponManager.currentWeaponType,
            origin: [camPos.x, camPos.y, camPos.z],
            direction: [camDir.x, camDir.y, camDir.z],
            targetPlayerId: fireRes.hitPlayerId,
            isHeadshot: fireRes.isHeadshot,
            hitPoint: fireRes.hitPoint
          });
        }
      }
    }

    this.hud.updateAmmo(
      this.weaponManager.ammoInMag[this.weaponManager.currentWeaponType],
      this.weaponManager.currentStats,
      this.weaponManager.isReloading,
      this.weaponManager.reloadProgress,
      this.weaponManager.ammoReserve[this.weaponManager.currentWeaponType]
    );
  }

  private activateCurrentPowerup(): void {
    const pType = this.powerupManager.storedPowerup;
    if (!pType) return;

    let targetPoint: [number, number, number] | undefined;
    if (pType === 'airstrike') {
      const forwardX = -Math.sin(this.playerYaw);
      const forwardZ = -Math.cos(this.playerYaw);
      targetPoint = [
        this.playerPos.x + forwardX * 20,
        this.playerPos.y,
        this.playerPos.z + forwardZ * 20
      ];
    }

    this.networkClient.sendInput({
      x: this.playerPos.x,
      y: this.playerPos.y,
      z: this.playerPos.z,
      vx: this.playerVel.x,
      vy: this.playerVel.y,
      vz: this.playerVel.z,
      yaw: this.playerYaw,
      pitch: this.playerPitch,
      isSliding: this.isSliding,
      isJumping: !this.isGrounded,
      isGrounded: this.isGrounded,
      isGrappling: this.isGrappling,
      grappleAnchor: this.isGrappling ? [this.grappleAnchor.x, this.grappleAnchor.y, this.grappleAnchor.z] : undefined,
      timestamp: Date.now()
    });
    this.powerupManager.activatePowerup(pType, targetPoint);
    if (pType === 'shield') {
      this.currentShield = 50;
      this.hud.updateShield(50);
    }
  }

  private triggerReloadFlow(): void {
    if (this.weaponManager.currentStats.type === 'katana') return;
    if (this.grammarReloadUI.isOpen()) return;

    this.input.unlockCursor();
    this.grammarReloadUI.open(
      async (grantedAmmo, awardedPowerup, _streak) => {
        this.weaponManager.grantAmmo(grantedAmmo);
        this.audio.playGrammarSuccess();
        this.audio.playReload();

        if (awardedPowerup) {
          this.powerupManager.storePowerup(awardedPowerup);
          this.hud.updatePowerupSlot(
            this.powerupManager.storedPowerup,
            this.powerupManager.hasActivePowerup(),
            this.powerupManager.remainingActiveSec
          );
        }

        await this.authUI.recordGrammarStats(2, 2, grantedAmmo);
      },
      () => {}
    );
  }

  private sendNetworkInput(delta: number): void {
    this.inputSendTimer += delta;
    if (this.inputSendTimer >= 1 / NETWORK.SERVER_TICK_RATE) {
      this.inputSendTimer = 0;
      this.networkClient.sendInput({
        x: this.playerPos.x,
        y: this.playerPos.y,
        z: this.playerPos.z,
        vx: this.playerVel.x,
        vy: this.playerVel.y,
        vz: this.playerVel.z,
        yaw: this.playerYaw,
        pitch: this.playerPitch,
        isSliding: this.isSliding,
        isJumping: !this.isGrounded,
        isGrounded: this.isGrounded,
        isGrappling: this.isGrappling,
        grappleAnchor: this.isGrappling ? [this.grappleAnchor.x, this.grappleAnchor.y, this.grappleAnchor.z] : undefined,
        timestamp: Date.now()
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});

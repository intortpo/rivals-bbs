import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js';
import { MapBuilder } from './engine/MapBuilder.js';
import { AudioManager } from './engine/AudioManager.js';
import { FXManager } from './engine/FXManager.js';
import { WeaponManager } from './engine/WeaponManager.js';
import { CharacterModel } from './engine/CharacterModel.js';
import { PowerupManager } from './engine/PowerupManager.js';
import { InputManager } from './controls/InputManager.js';
import { TouchHUD } from './ui/TouchHUD.js';
import { QRManager } from './ui/QRManager.js';
import { LobbyUI } from './ui/LobbyUI.js';
import { AuthUI } from './ui/AuthUI.js';
import { GrammarReloadUI } from './ui/GrammarReloadUI.js';
import { SettingsUI } from './ui/SettingsUI.js';
import { DashboardUI } from './ui/DashboardUI.js';
import { CharacterBuilderUI } from './ui/CharacterBuilderUI.js';
import { LoadingScreenUI } from './ui/LoadingScreenUI.js';
import { NetworkClient } from './network/NetworkClient.js';
import { ProjectileManager } from './engine/ProjectileManager.js';
import { MOVEMENT, NETWORK, WEAPON_ORDER, getMapSpawns } from '../shared/constants.js';
import { TeamColor } from '../shared/types.js';

class GameApp {
  private appContainer: HTMLElement;
  private renderer!: Renderer;
  private audio!: AudioManager;
  private fx!: FXManager;
  private projectileManager!: ProjectileManager;
  private powerupManager!: PowerupManager;
  private weaponManager!: WeaponManager;
  private input!: InputManager;
  private hud!: TouchHUD;
  private settingsUI!: SettingsUI;
  private dashboardUI!: DashboardUI;
  private characterBuilderUI!: CharacterBuilderUI;
  private loadingScreenUI!: LoadingScreenUI;
  private qrManager!: QRManager;
  private lobbyUI!: LobbyUI;
  private authUI!: AuthUI;
  private grammarReloadUI!: GrammarReloadUI;
  private networkClient!: NetworkClient;
  private mapBuilder!: MapBuilder;

  // Local player physics state
  private playerPos = new THREE.Vector3(0, 0, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw: number = 0;
  private playerPitch: number = 0;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private slideDirection = new THREE.Vector3();
  private currentHp: number = 100;
  private currentShield: number = 0;
  private myTeam: TeamColor = 'none';
  private isDead: boolean = false;

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
  private _scratchForward = new THREE.Vector3();
  private _scratchRight = new THREE.Vector3();
  private _scratchMoveDir = new THREE.Vector3();
  private _scratchCamPos = new THREE.Vector3();
  private _scratchCamDir = new THREE.Vector3();

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
    this.renderer = new Renderer(this.appContainer);
    this.audio = new AudioManager();
    this.fx = new FXManager(this.renderer.scene);
    this.projectileManager = new ProjectileManager(this.renderer.scene, this.fx);
    this.powerupManager = new PowerupManager(this.renderer.scene, this.audio);
    this.weaponManager = new WeaponManager(this.renderer.scene, this.renderer.camera, this.fx, this.audio);
    this.input = new InputManager(this.appContainer);
    this.hud = new TouchHUD(this.appContainer);
    this.settingsUI = new SettingsUI(this.appContainer, (settings) => {
      this.audio.setMasterVolume(settings.masterVolume);
      this.audio.setSfxVolume(settings.sfxVolume);
      this.audio.setVoiceVolume(settings.voiceVolume);
      this.audio.setMuted(settings.isMuted);
      this.input.touch.sensitivity = settings.touchSensitivity;
      this.renderer.applyGraphicsQuality(settings.graphicsQuality);
    });
    this.renderer.applyGraphicsQuality(this.settingsUI.settings.graphicsQuality);
    this.dashboardUI = new DashboardUI(this.appContainer);
    this.loadingScreenUI = new LoadingScreenUI(this.appContainer);
    this.qrManager = new QRManager();
    this.mapBuilder = new MapBuilder(this.renderer.scene, 'Cartoon City', 'twilight');

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

    // 2. Network Client
    this.networkClient = new NetworkClient(
      this.renderer.scene,
      this.audio,
      this.fx,
      this.weaponManager
    );

    // 3. Lobby UI
    this.lobbyUI = new LobbyUI(this.appContainer, {
      onCreateRoom: async (name, mode, fragLimit, mapName, skyTheme = 'twilight', outfitIndex = 0, customization) => {
        this.audio.touchUnlock();
        // Rebuild map or sky if different
        if (this.mapBuilder.mapName !== mapName || this.mapBuilder.skyTheme !== skyTheme) {
          this.mapBuilder.dispose();
          this.mapBuilder = new MapBuilder(this.renderer.scene, mapName, skyTheme);
        }
        const res = await this.networkClient.createRoom(name, mode, fragLimit, mapName, outfitIndex, customization);
        if (res.success && res.roomId) {
          if (this.networkClient.currentRoomState) {
            this.lobbyUI.showInRoomLobby(this.networkClient.currentRoomState, true);
            // Automatically display QR code so host can easily show it to opponents
            this.qrManager.showQRModal(res.roomId);
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
      onOpenCharacterBuilder: () => {
        this.input.unlockCursor();
        this.characterBuilderUI.open(this.lobbyUI.customOutfit || undefined);
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

    // 4. Initialize Character Builder, Auth & Grammar Reload UI
    this.characterBuilderUI = new CharacterBuilderUI(this.appContainer, (custom) => {
      this.lobbyUI.setSelectedOutfitCustom(custom);
    });

    const savedCustom = localStorage.getItem('bbs_character_customization');
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom);
        this.lobbyUI.setSelectedOutfitCustom(parsed);
      } catch {}
    }

    this.authUI = new AuthUI(this.appContainer, (user) => {
      this.lobbyUI.updateAccountDisplay(user);
    });
    this.grammarReloadUI = new GrammarReloadUI(this.appContainer);

    // 5. Hook Network Callbacks
    this.setupNetworkCallbacks();

    // 6. Check URL parameters for direct join via QR scan or shared link (?room=RV-XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
      if (codeInput) codeInput.value = roomParam.toUpperCase();
    }

    // 7. Interactive Asset Loading Screen (Preload character models, weapon GLBs, audio buffers & warm up shaders)
    await this.loadingScreenUI.preloadGameAssets(
      this.renderer.scene,
      this.renderer.camera,
      this.renderer.renderer,
      this.audio
    );

    // 8. Start Render & Game Loop
    requestAnimationFrame(this.gameLoop.bind(this));
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
          // Local player respawned!
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
      this.currentHp = remainingHp;
      if (remainingShield !== undefined) {
        this.currentShield = remainingShield;
        this.hud.updateShield(remainingShield);
      }
      this.hud.updateHealth(remainingHp);
      this.hud.flashDamage();

      if (remainingHp <= 0) {
        this.isDead = true;
      }
    };

    this.networkClient.onPowerupActivated = (payload) => {
      if (payload.playerId === this.networkClient.myId) {
        this.powerupManager.applyActivePowerup(payload.powerup, payload.durationSec);
      } else {
        const remote = this.networkClient.remotePlayers.get(payload.playerId);
        if (remote) {
          this.powerupManager.triggerRemoteAura(remote.model.root, payload.powerup);
        }
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

      // Free ammo bonus
      this.weaponManager.grantAmmo(35);

      // Boost shield & revive local player if downed
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

    this.networkClient.onBotProjectileSpawn = (payload) => {
      this.projectileManager.onProjectileSpawn(payload);
    };

    this.networkClient.onBotProjectileImpact = (payload) => {
      this.projectileManager.onProjectileImpact(payload);
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
        // In wave mode, player waits for wave clear revive; in PvP auto-respawn after 3s
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

      // Record match result to dashboard if logged in
      try {
        const myScoreEntry = payload.scores.find((s) => s.id === this.networkClient.myId);
        const won =
          payload.winnerId === this.networkClient.myId ||
          (payload.winningTeam && payload.winningTeam === this.myTeam);
        await fetch('/api/stats/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: this.networkClient.currentRoomState?.mode || '1v1',
            kills: myScoreEntry?.kills || 0,
            deaths: myScoreEntry?.deaths || 0,
            won: Boolean(won),
            powerupsUsed: this.powerupManager.powerupsUsedInMatch
          })
        });
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

    // Ensure local client has loaded the room's selected map
    const chosenMap = state.mapName || 'Cartoon City';
    if (this.mapBuilder.mapName !== chosenMap) {
      this.mapBuilder.dispose();
      this.mapBuilder = new MapBuilder(this.renderer.scene, chosenMap);
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
    this.hud.updateMatchHeader(
      state.mode,
      scoreA,
      scoreB,
      state.fragLimit,
      state.teamScores,
      state.waveState
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

    // Engine updates
    this.powerupManager.update(delta, this.playerPos);
    this.hud.updatePowerupSlot(
      this.powerupManager.storedPowerup || this.powerupManager.activePowerup,
      this.powerupManager.hasActivePowerup(),
      this.powerupManager.remainingActiveSec
    );
    this.networkClient.update(delta);
    this.projectileManager.update(delta);
    this.weaponManager.update(delta, this.input.isFiring());
    this.fx.update(delta);
    CharacterModel.updateDebris(delta);

    // Render 3D Scene
    this.renderer.render();
  }

  private updatePlayerMovement(delta: number): void {
    // 1. Look rotation & Viewmodel sway
    const look = this.input.getLookDeltas();
    this.playerYaw -= look.yaw;
    this.playerPitch = Math.max(-1.4, Math.min(1.4, this.playerPitch - look.pitch));

    // Dynamic viewmodel sway: weapon lags slightly behind fast pans and smoothly catches up
    this.swayOffsetX = THREE.MathUtils.lerp(this.swayOffsetX, Math.max(-0.06, Math.min(0.06, -look.yaw * 0.8)), delta * 15);
    this.swayOffsetY = THREE.MathUtils.lerp(this.swayOffsetY, Math.max(-0.05, Math.min(0.05, -look.pitch * 0.8)), delta * 15);
    this.weaponManager.viewModelContainer.position.set(this.swayOffsetX, this.swayOffsetY, 0);

    // 2. Input movement vector
    const move = this.input.getMoveVector();
    const isMovingInput = Math.abs(move.forward) > 0.05 || Math.abs(move.right) > 0.05;

    // Movement forward/right relative to yaw using scratch vectors (no per-frame allocations)
    this._scratchForward.set(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    this._scratchRight.set(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    // Jump buffering & coyote timing
    if (this.input.isJumping()) {
      this.jumpBufferTimer = 0.12; // 120ms jump buffer
    } else if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
    }

    if (this.isGrounded) {
      this.coyoteTimer = 0.10; // 100ms coyote time
      this.hasJumpedThisAirtime = false;
    } else {
      this.coyoteTimer -= delta;
    }

    // 3. Sliding mechanic
    const slideRequested = this.input.isSliding();
    if (slideRequested && this.isGrounded && !this.isSliding && isMovingInput) {
      // Initiate slide boost
      this.isSliding = true;
      this.slideTimer = MOVEMENT.SLIDE_DURATION_MAX;
      this.slideDirection.copy(this._scratchForward).multiplyScalar(move.forward)
        .addScaledVector(this._scratchRight, move.right).normalize();
      this.playerVel.x = this.slideDirection.x * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.playerVel.z = this.slideDirection.z * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.audio.playSlide();
    }

    const canJump = (this.isGrounded || (this.coyoteTimer > 0 && !this.hasJumpedThisAirtime)) && this.jumpBufferTimer > 0;

    if (this.isSliding) {
      this.slideTimer -= delta;
      // Exponential friction
      const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const newSpeed = Math.max(MOVEMENT.SLIDE_MIN_SPEED, currentSpeed - MOVEMENT.SLIDE_FRICTION * delta);
      const ratio = newSpeed / (currentSpeed || 1);
      this.playerVel.x *= ratio;
      this.playerVel.z *= ratio;

      this.fx.spawnSlideDust(this.playerPos);

      // Slide-cancel jump with jump buffer
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
      // Normal walk / sprint with speed boost support
      const speedMult = this.powerupManager.getSpeedMultiplier();
      const targetSpeed = MOVEMENT.WALK_SPEED * speedMult;
      this._scratchMoveDir.copy(this._scratchForward).multiplyScalar(move.forward)
        .addScaledVector(this._scratchRight, move.right);
      this.playerVel.x = this._scratchMoveDir.x * targetSpeed;
      this.playerVel.z = this._scratchMoveDir.z * targetSpeed;

      // Regular jump with buffer & coyote
      if (canJump) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY;
        this.isGrounded = false;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }
    } else {
      // Mid-Air Control & Momentum Steering
      if (canJump) {
        // Coyote time jump after stepping off ledge
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }

      if (isMovingInput) {
        const speedMult = this.powerupManager.getSpeedMultiplier();
        const targetSpeed = MOVEMENT.AIR_MAX_SPEED * speedMult;
        this._scratchMoveDir.copy(this._scratchForward).multiplyScalar(move.forward)
          .addScaledVector(this._scratchRight, move.right).normalize();
        const desiredX = this._scratchMoveDir.x * targetSpeed;
        const desiredZ = this._scratchMoveDir.z * targetSpeed;

        const currentHorizSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);

        if (currentHorizSpeed <= targetSpeed) {
          // Accelerate smoothly towards desired input vector
          const steerRate = MOVEMENT.AIR_ACCEL * delta;
          this.playerVel.x = THREE.MathUtils.damp(this.playerVel.x, desiredX, steerRate, delta);
          this.playerVel.z = THREE.MathUtils.damp(this.playerVel.z, desiredZ, steerRate, delta);
        } else {
          // High-speed momentum (from jump pad or slide-jump):
          // Steer velocity vector direction towards input without abruptly clamping magnitude!
          const steerAngle = Math.atan2(desiredZ, desiredX);
          const currentAngle = Math.atan2(this.playerVel.z, this.playerVel.x);
          let angleDiff = steerAngle - currentAngle;
          while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
          while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

          const maxAngleChange = 4.5 * delta;
          const newAngle = currentAngle + Math.max(-maxAngleChange, Math.min(maxAngleChange, angleDiff));
          // Apply gentle air drag
          const retainedSpeed = currentHorizSpeed * MOVEMENT.AIR_DRAG;
          this.playerVel.x = Math.cos(newAngle) * retainedSpeed;
          this.playerVel.z = Math.sin(newAngle) * retainedSpeed;
        }
      }
    }

    // 3.5 Ladder Climbing Physics
    const ladderBox = this.mapBuilder.checkLadders(this.playerPos);
    const isClimbing = ladderBox !== null;

    if (isClimbing) {
      this.isSliding = false;
      this.isGrounded = false;

      // Climb controls: Forward (W) or Jump -> climb up, Backward (S) -> climb down
      if (move.forward > 0 || this.input.isJumping()) {
        this.playerVel.y = MOVEMENT.CLIMB_SPEED;
      } else if (move.forward < 0) {
        this.playerVel.y = -MOVEMENT.CLIMB_SPEED;
      } else {
        this.playerVel.y = 0; // Hold position on ladder
      }

      // Dampen horizontal drift while on ladder
      this.playerVel.x *= 0.25;
      this.playerVel.z *= 0.25;

      // Vault off ladder if pressing jump with directional impulse
      if ((this.jumpBufferTimer > 0 || this.input.isJumping()) && (move.forward < 0 || Math.abs(move.right) > 0.2)) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY * 0.85;
        this.playerVel.x += (this._scratchRight.x * move.right - this._scratchForward.x * 0.8) * 6.0;
        this.playerVel.z += (this._scratchRight.z * move.right - this._scratchForward.z * 0.8) * 6.0;
        this.jumpBufferTimer = 0;
        this.hasJumpedThisAirtime = true;
        this.audio.playJump();
      }

      // Reaching top of ladder: step up smoothly onto rooftop/landing
      if (this.playerPos.y >= ladderBox.max.y - 0.35 && move.forward > 0) {
        this.playerPos.y = ladderBox.max.y + 0.05;
        this.playerVel.x += this._scratchForward.x * 4.0;
        this.playerVel.z += this._scratchForward.z * 4.0;
      }
    }

    // 4. Gravity & Vertical motion (in-place math, no Vector3 allocation)
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

    // Check jump pads (Vertical Launchers and Directional Aerial Boosters)
    const pad = this.mapBuilder.checkJumpPads(this.playerPos);
    if (pad !== null && this.playerVel.y <= 0) {
      this.playerVel.y = pad.impulseY;
      if (pad.impulseX !== 0) this.playerVel.x = pad.impulseX;
      if (pad.impulseZ !== 0) this.playerVel.z = pad.impulseZ;
      this.isGrounded = false;
      this.audio.playJump();
    }

    // Check teleporters (Bidirectional paired portals with 1.5s cooldown)
    const hitPort = this.mapBuilder.checkTeleportPorts(this.playerPos, this.lastTeleportTime);
    if (hitPort) {
      this.lastTeleportTime = performance.now();
      this.playerPos.copy(hitPort.exitPos);
      this.playerYaw = hitPort.exitYaw;
      this.playerVel.set(0, 0, 0); // Cancel exit velocity
      this.audio.playTeleport();
      this.hud.showTeleportEffect();
    }

    // Environmental Void / Lava hazard check
    if (this.playerPos.y < -3.0 && this.networkClient.isInGame && !this.isDead) {
      this.isDead = true;
      this.currentHp = 0;
      this.currentShield = 0;
      this.hud.updateHealth(0);
      this.audio.playOofDeath();
      this.networkClient.sendVoidFall();
      this.playerVel.set(0, 0, 0);
    }

    // Boundary & obstacle collision clamping
    this.resolveArenaCollisions();

    // 5. Update Camera (Roll tilt, dynamic head bob, and position)
    const targetRoll = this.isSliding ? -0.05 : -move.right * 0.025;
    this.cameraRoll = THREE.MathUtils.lerp(this.cameraRoll, targetRoll, delta * 14);

    if (this.isGrounded && isMovingInput) {
      this.bobTimer += delta * (this.isSliding ? 14 : 10);
    } else {
      this.bobTimer = 0;
    }
    const bobOffset = this.isGrounded && isMovingInput ? Math.sin(this.bobTimer) * 0.035 : 0;

    const eyeHeight = (this.isSliding ? MOVEMENT.SLIDE_EYE_HEIGHT : MOVEMENT.EYE_HEIGHT) + bobOffset;
    this.renderer.camera.position.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
    this.renderer.camera.rotation.y = this.playerYaw;
    this.renderer.camera.rotation.x = this.playerPitch;
    this.renderer.camera.rotation.z = this.cameraRoll;

    // Crosshair dynamic spread
    this.hud.updateCrosshairSpread(isMovingInput, this.isSliding);
  }

  private resolveArenaCollisions(): void {
    // Keep within map boundaries
    const b = this.mapBuilder.bounds;
    this.playerPos.x = Math.max(b.minX, Math.min(b.maxX, this.playerPos.x));
    this.playerPos.z = Math.max(b.minZ, Math.min(b.maxZ, this.playerPos.z));

    // Check box obstacles with vertical clearance and tangential sliding
    const playerRadius = MOVEMENT.PLAYER_RADIUS;
    const playerFeet = this.playerPos.y;
    const playerHead = this.playerPos.y + (this.isSliding ? MOVEMENT.PLAYER_SLIDE_HEIGHT : MOVEMENT.PLAYER_HEIGHT);

    for (const box of this.mapBuilder.collisionBoxes) {
      // Spatial broadphase: discard boxes more than 6m away from player
      if (
        this.playerPos.x < box.min.x - 6 ||
        this.playerPos.x > box.max.x + 6 ||
        this.playerPos.z < box.min.z - 6 ||
        this.playerPos.z > box.max.z + 6
      ) {
        continue;
      }

      // If player's feet are above the obstacle surface, they are standing or landing on top
      if (playerFeet >= box.max.y - 0.2) {
        continue;
      }
      // If player's head is completely beneath an elevated obstacle
      if (playerHead <= box.min.y + 0.1) {
        continue;
      }

      // Horizontal cylinder vs AABB intersection
      if (
        this.playerPos.x + playerRadius > box.min.x &&
        this.playerPos.x - playerRadius < box.max.x &&
        this.playerPos.z + playerRadius > box.min.z &&
        this.playerPos.z - playerRadius < box.max.z
      ) {
        // Penetration depths from each boundary
        const dx1 = Math.abs(this.playerPos.x + playerRadius - box.min.x);
        const dx2 = Math.abs(box.max.x - (this.playerPos.x - playerRadius));
        const dz1 = Math.abs(this.playerPos.z + playerRadius - box.min.z);
        const dz2 = Math.abs(box.max.z - (this.playerPos.z - playerRadius));

        const min = Math.min(dx1, dx2, dz1, dz2);
        if (min === dx1) {
          this.playerPos.x = box.min.x - playerRadius;
          if (this.playerVel.x > 0) this.playerVel.x = 0; // zero penetration velocity, slide freely along Z
        } else if (min === dx2) {
          this.playerPos.x = box.max.x + playerRadius;
          if (this.playerVel.x < 0) this.playerVel.x = 0; // zero penetration velocity, slide freely along Z
        } else if (min === dz1) {
          this.playerPos.z = box.min.z - playerRadius;
          if (this.playerVel.z > 0) this.playerVel.z = 0; // zero penetration velocity, slide freely along X
        } else if (min === dz2) {
          this.playerPos.z = box.max.z + playerRadius;
          if (this.playerVel.z < 0) this.playerVel.z = 0; // zero penetration velocity, slide freely along X
        }
      }
    }
  }

  private updateCombat(_delta: number): void {
    // Weapon switch
    const switchIdx = this.input.consumeWeaponSwitch();
    if (switchIdx !== undefined && switchIdx >= 0 && switchIdx < WEAPON_ORDER.length) {
      const type = WEAPON_ORDER[switchIdx];
      this.weaponManager.selectWeapon(type);
      this.networkClient.sendWeaponSwitch(switchIdx);
    }

    // Reload
    if (this.input.consumeReload()) {
      this.triggerReloadFlow();
    }

    // Powerup trigger
    if (this.input.consumePowerup()) {
      this.activateCurrentPowerup();
    }

    // Aim down sights (ADS)
    const isAiming = this.input.isAiming();
    const targetFov = isAiming ? this.weaponManager.currentStats.adsZoomFov : 75;
    this.renderer.setFov(THREE.MathUtils.lerp(this.renderer.camera.fov, targetFov, 0.2));
    this.hud.setAdsScope(isAiming, this.weaponManager.currentWeaponType);

    // Shooting
    if (this.input.isFiring()) {
      if (
        this.weaponManager.ammoInMag[this.weaponManager.currentWeaponType] <= 0 &&
        this.weaponManager.currentStats.type !== 'katana'
      ) {
        this.triggerReloadFlow();
      } else {
        const targetMeshes = this.networkClient.getTargetableMeshes();
        const solidMeshes = this.mapBuilder.getSolidMeshes();
        const fireRes = this.weaponManager.fire(
          this.renderer.camera,
          targetMeshes,
          solidMeshes,
          this.input.isFiring(),
          isAiming
        );

        if (fireRes.fired) {
          this.audio.playShoot(this.weaponManager.currentWeaponType);

          this.renderer.camera.getWorldPosition(this._scratchCamPos);
          this.renderer.camera.getWorldDirection(this._scratchCamDir);

          // Subtle visceral camera recoil punch on fire
          const currentW = this.weaponManager.currentWeaponType;
          const recoilKick = currentW === 'sniper' || currentW === 'railgun' ? 0.034
            : currentW === 'plasma_launcher' ? 0.026
            : currentW === 'shotgun' ? 0.024 : 0.012;
          this.playerPitch = Math.min(1.4, this.playerPitch + recoilKick);

          this.networkClient.sendFire({
            weaponType: this.weaponManager.currentWeaponType,
            origin: [this._scratchCamPos.x, this._scratchCamPos.y, this._scratchCamPos.z],
            direction: [this._scratchCamDir.x, this._scratchCamDir.y, this._scratchCamDir.z],
            targetPlayerId: fireRes.hitPlayerId,
            isHeadshot: fireRes.isHeadshot,
            hitPoint: fireRes.hitPoint
          });
        }
      }
    }

    // Update ammo display
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
      const forward = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
      targetPoint = [
        this.playerPos.x + forward.x * 20,
        this.playerPos.y,
        this.playerPos.z + forward.z * 20
      ];
    }

    this.networkClient.activatePowerup(pType, targetPoint);
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
      () => {
        // Canceled reload
      }
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
        timestamp: Date.now()
      });
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  new GameApp();
});

import * as THREE from 'three';
import { Renderer } from './engine/Renderer.js';
import { MapBuilder } from './engine/MapBuilder.js';
import { AudioManager } from './engine/AudioManager.js';
import { FXManager } from './engine/FXManager.js';
import { WeaponManager } from './engine/WeaponManager.js';
import { CharacterModel } from './engine/CharacterModel.js';
import { InputManager } from './controls/InputManager.js';
import { TouchHUD } from './ui/TouchHUD.js';
import { QRManager } from './ui/QRManager.js';
import { LobbyUI } from './ui/LobbyUI.js';
import { NetworkClient } from './network/NetworkClient.js';
import { MOVEMENT, NETWORK, WEAPON_ORDER } from '../shared/constants.js';

class GameApp {
  private appContainer: HTMLElement;
  private renderer!: Renderer;
  private audio!: AudioManager;
  private fx!: FXManager;
  private weaponManager!: WeaponManager;
  private input!: InputManager;
  private hud!: TouchHUD;
  private qrManager!: QRManager;
  private lobbyUI!: LobbyUI;
  private networkClient!: NetworkClient;
  private mapBuilder!: MapBuilder;

  // Local player physics state
  private playerPos = new THREE.Vector3(0, 1.5, 0);
  private playerVel = new THREE.Vector3(0, 0, 0);
  private playerYaw: number = 0;
  private playerPitch: number = 0;
  private isGrounded: boolean = true;
  private isSliding: boolean = false;
  private slideTimer: number = 0;
  private slideDirection = new THREE.Vector3();
  private currentHp: number = 100;
  private isDead: boolean = false;

  private lastTime: number = performance.now();
  private inputSendTimer: number = 0;

  constructor() {
    this.appContainer = document.getElementById('app') || document.body;
    this.init();
  }

  public getPlayerHp(): number {
    return this.currentHp;
  }

  private async init(): Promise<void> {
    // 1. Core systems
    this.renderer = new Renderer(this.appContainer);
    this.audio = new AudioManager();
    this.fx = new FXManager(this.renderer.scene);
    this.weaponManager = new WeaponManager(this.renderer.scene, this.renderer.camera);
    this.input = new InputManager(this.appContainer);
    this.hud = new TouchHUD(this.appContainer);
    this.qrManager = new QRManager();
    this.mapBuilder = new MapBuilder(this.renderer.scene, 'Arena Classic');

    // 2. Network Client
    this.networkClient = new NetworkClient(
      this.renderer.scene,
      this.audio,
      this.fx,
      this.weaponManager
    );

    // 3. Lobby UI
    this.lobbyUI = new LobbyUI(this.appContainer, {
      onCreateRoom: async (name, mode, fragLimit, mapName) => {
        this.audio.touchUnlock();
        // Rebuild map if different
        this.mapBuilder = new MapBuilder(this.renderer.scene, mapName);
        const res = await this.networkClient.createRoom(name, mode, fragLimit, mapName);
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
      onJoinRoom: async (roomId, name) => {
        this.audio.touchUnlock();
        const res = await this.networkClient.joinRoom(roomId, name);
        if (res.success && this.networkClient.currentRoomState) {
          this.lobbyUI.showInRoomLobby(this.networkClient.currentRoomState, false);
        } else {
          alert(res.error || 'Failed to join room');
        }
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
      }
    });

    // 4. Hook Network Callbacks
    this.setupNetworkCallbacks();

    // 5. Check URL parameters for direct join via QR scan or shared link (?room=RV-XXXX)
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      const codeInput = document.getElementById('input-room-code') as HTMLInputElement;
      if (codeInput) codeInput.value = roomParam.toUpperCase();
    }

    // 6. Start Render & Game Loop
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
      }
    };

    this.networkClient.onCountdown = (count) => {
      this.lobbyUI.hideLobby();
      this.hud.setVisible(true);
      this.hud.showCountdown(count);
    };

    this.networkClient.onGameStart = () => {
      this.currentHp = 100;
      this.isDead = false;
      this.hud.updateHealth(100);
      this.hud.setVisible(true);
      this.lobbyUI.hideLobby();

      // Find local spawn from room state
      if (this.networkClient.currentRoomState) {
        const myState = this.networkClient.currentRoomState.players[this.networkClient.myId];
        if (myState) {
          this.playerPos.set(myState.x, myState.y, myState.z);
          this.playerYaw = myState.yaw;
          this.playerVel.set(0, 0, 0);
        }
      }
    };

    this.networkClient.onLocalPlayerDamaged = (remainingHp) => {
      this.currentHp = remainingHp;
      this.hud.updateHealth(remainingHp);
      this.hud.flashDamage();

      if (remainingHp <= 0) {
        this.isDead = true;
      }
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
        // Auto respawn after 3s
        setTimeout(() => {
          this.currentHp = 100;
          this.isDead = false;
          this.hud.updateHealth(100);
        }, NETWORK.RESPAWN_DELAY_SEC * 1000);
      }

      if (this.networkClient.currentRoomState) {
        this.updateHUDMatchStats(this.networkClient.currentRoomState);
      }
    };

    this.networkClient.onGameOver = (payload) => {
      this.hud.showGameOver(payload, this.networkClient.myId, () => {
        this.lobbyUI.showMainMenu();
        this.hud.setVisible(false);
      });
    };
  }

  private updateHUDMatchStats(state: any): void {
    const players = Object.values(state.players) as any[];
    const scoreA = players[0]?.score || 0;
    const scoreB = players[1]?.score || 0;
    this.hud.updateMatchHeader(state.mode, scoreA, scoreB, state.fragLimit);
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
    this.networkClient.update(delta);
    this.weaponManager.update(delta);
    this.fx.update(delta);
    CharacterModel.updateDebris(delta);

    // Render 3D Scene
    this.renderer.render();
  }

  private updatePlayerMovement(delta: number): void {
    // 1. Look rotation
    const look = this.input.getLookDeltas();
    this.playerYaw -= look.yaw;
    this.playerPitch = Math.max(-1.4, Math.min(1.4, this.playerPitch - look.pitch));

    // 2. Input movement vector
    const move = this.input.getMoveVector();
    const isMovingInput = Math.abs(move.x) > 0.05 || Math.abs(move.z) > 0.05;

    // Movement forward/right relative to yaw
    const forward = new THREE.Vector3(-Math.sin(this.playerYaw), 0, -Math.cos(this.playerYaw));
    const right = new THREE.Vector3(Math.cos(this.playerYaw), 0, -Math.sin(this.playerYaw));

    // 3. Sliding mechanic
    const slideRequested = this.input.isSliding();
    if (slideRequested && this.isGrounded && !this.isSliding && isMovingInput) {
      // Initiate slide boost
      this.isSliding = true;
      this.slideTimer = MOVEMENT.SLIDE_DURATION_MAX;
      this.slideDirection.copy(forward).multiplyScalar(move.z).add(right.clone().multiplyScalar(move.x)).normalize();
      this.playerVel.x = this.slideDirection.x * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.playerVel.z = this.slideDirection.z * MOVEMENT.SLIDE_INITIAL_SPEED;
      this.audio.playSlide();
    }

    if (this.isSliding) {
      this.slideTimer -= delta;
      // Exponential friction
      const currentSpeed = Math.hypot(this.playerVel.x, this.playerVel.z);
      const newSpeed = Math.max(MOVEMENT.SLIDE_MIN_SPEED, currentSpeed - MOVEMENT.SLIDE_FRICTION * delta);
      const ratio = newSpeed / (currentSpeed || 1);
      this.playerVel.x *= ratio;
      this.playerVel.z *= ratio;

      this.fx.spawnSlideDust(this.playerPos);

      // Slide-cancel jump!
      if (this.input.isJumping() && this.isGrounded) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY * MOVEMENT.SLIDE_JUMP_BOOST;
        this.isGrounded = false;
        this.isSliding = false;
        this.audio.playJump();
      }

      if (this.slideTimer <= 0 || !slideRequested) {
        this.isSliding = false;
      }
    } else if (this.isGrounded) {
      // Normal walk / sprint
      const targetSpeed = MOVEMENT.WALK_SPEED;
      const moveDir = forward.clone().multiplyScalar(move.z).add(right.clone().multiplyScalar(move.x));
      this.playerVel.x = moveDir.x * targetSpeed;
      this.playerVel.z = moveDir.z * targetSpeed;

      // Regular jump
      if (this.input.isJumping()) {
        this.playerVel.y = MOVEMENT.JUMP_VELOCITY;
        this.isGrounded = false;
        this.audio.playJump();
      }
    }

    // 4. Gravity & Vertical motion
    this.playerVel.y -= MOVEMENT.GRAVITY * delta;
    this.playerPos.add(this.playerVel.clone().multiplyScalar(delta));

    // Floor collision & Jump pads
    const groundLevel = 1.0;
    if (this.playerPos.y <= groundLevel) {
      this.playerPos.y = groundLevel;
      this.playerVel.y = 0;
      this.isGrounded = true;
    }

    // Check jump pads
    const padImpulse = this.mapBuilder.checkJumpPads(this.playerPos);
    if (padImpulse !== null && this.playerVel.y <= 0) {
      this.playerVel.y = padImpulse;
      this.isGrounded = false;
      this.audio.playJump();
    }

    // Simple boundary & obstacle collision clamping
    this.resolveArenaCollisions();

    // 5. Update Camera
    const eyeHeight = this.isSliding ? MOVEMENT.SLIDE_EYE_HEIGHT : MOVEMENT.EYE_HEIGHT;
    this.renderer.camera.position.set(this.playerPos.x, this.playerPos.y + eyeHeight, this.playerPos.z);
    this.renderer.camera.rotation.y = this.playerYaw;
    this.renderer.camera.rotation.x = this.playerPitch;

    // Crosshair dynamic spread
    this.hud.updateCrosshairSpread(isMovingInput, this.isSliding);
  }

  private resolveArenaCollisions(): void {
    // Keep within outer boundary [-28, 28]
    const bound = 28;
    this.playerPos.x = Math.max(-bound, Math.min(bound, this.playerPos.x));
    this.playerPos.z = Math.max(-bound, Math.min(bound, this.playerPos.z));

    // Check box obstacles
    const playerRadius = MOVEMENT.PLAYER_RADIUS;
    for (const box of this.mapBuilder.collisionBoxes) {
      if (
        this.playerPos.x + playerRadius > box.min.x &&
        this.playerPos.x - playerRadius < box.max.x &&
        this.playerPos.z + playerRadius > box.min.z &&
        this.playerPos.z - playerRadius < box.max.z &&
        this.playerPos.y < box.max.y
      ) {
        // Simple push-out along smallest penetration axis
        const dx1 = Math.abs(this.playerPos.x + playerRadius - box.min.x);
        const dx2 = Math.abs(box.max.x - (this.playerPos.x - playerRadius));
        const dz1 = Math.abs(this.playerPos.z + playerRadius - box.min.z);
        const dz2 = Math.abs(box.max.z - (this.playerPos.z - playerRadius));

        const min = Math.min(dx1, dx2, dz1, dz2);
        if (min === dx1) this.playerPos.x = box.min.x - playerRadius;
        else if (min === dx2) this.playerPos.x = box.max.x + playerRadius;
        else if (min === dz1) this.playerPos.z = box.min.z - playerRadius;
        else if (min === dz2) this.playerPos.z = box.max.z + playerRadius;
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
      if (this.weaponManager.startReload()) {
        this.audio.playReload();
      }
    }

    // Aim down sights (ADS)
    const isAiming = this.input.isAiming();
    const targetFov = isAiming ? this.weaponManager.currentStats.adsZoomFov : 75;
    this.renderer.setFov(THREE.MathUtils.lerp(this.renderer.camera.fov, targetFov, 0.2));
    this.hud.setAdsScope(isAiming, this.weaponManager.currentWeaponType);

    // Shooting
    if (this.input.isFiring()) {
      const targetMeshes = this.networkClient.getTargetableMeshes();
      const fireRes = this.weaponManager.fire(this.renderer.camera, targetMeshes);

      if (fireRes.fired) {
        this.audio.playShoot(this.weaponManager.currentWeaponType);

        const camPos = new THREE.Vector3();
        this.renderer.camera.getWorldPosition(camPos);
        const camDir = new THREE.Vector3();
        this.renderer.camera.getWorldDirection(camDir);

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

    // Update ammo display
    this.hud.updateAmmo(
      this.weaponManager.ammoInMag[this.weaponManager.currentWeaponType],
      this.weaponManager.currentStats,
      this.weaponManager.isReloading,
      this.weaponManager.reloadProgress
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

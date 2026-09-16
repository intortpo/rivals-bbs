import { io, Socket } from 'socket.io-client';
import * as THREE from 'three';
import {
  BossStatePayload,
  BotProjectilePayload,
  CharacterCustomization,
  EliminationPayload,
  FireWeaponPayload,
  GameOverPayload,
  GameMode,
  HitNotificationPayload,
  OpenRoomSummary,
  PlayerInputPayload,
  PowerupActivatedPayload,
  PowerupType,
  ProjectileImpactPayload,
  RemoteFirePayload,
  RoomNetworkState,
  WorldSnapshot
} from '../../shared/types.js';
import { CharacterModel } from '../engine/CharacterModel.js';
import { GeometricBossModel } from '../engine/GeometricBossModel.js';
import { AudioManager } from '../engine/AudioManager.js';
import { FXManager } from '../engine/FXManager.js';
import { WeaponManager } from '../engine/WeaponManager.js';

interface RemotePlayerEntry {
  model: CharacterModel | GeometricBossModel;
  targetPos: THREE.Vector3;
  prevPos: THREE.Vector3;
  targetYaw: number;
  targetPitch: number;
  isSliding: boolean;
  isJumping: boolean;
  isDead: boolean;
  moveSpeedSmoothed: number;
}

export class NetworkClient {
  public socket: Socket;
  public myId: string = '';
  public myName: string = '';
  public currentRoomState: RoomNetworkState | null = null;
  public isInGame: boolean = false;

  private scene: THREE.Scene;
  private audio: AudioManager;
  private fx: FXManager;
  private weaponManager: WeaponManager;

  public remotePlayers: Map<string, RemotePlayerEntry> = new Map();

  // Callbacks for UI updates
  public onRoomStateChange?: (state: RoomNetworkState) => void;
  public onCountdown?: (count: number) => void;
  public onGameStart?: () => void;
  public onPlayerEliminated?: (payload: EliminationPayload) => void;
  public onGameOver?: (payload: GameOverPayload) => void;
  public onLocalPlayerDamaged?: (hp: number, maxHp: number, shieldHp?: number) => void;
  public onPowerupActivated?: (payload: PowerupActivatedPayload) => void;
  public onOpenRoomsList?: (rooms: OpenRoomSummary[]) => void;
  public onWaveCleared?: (payload: { waveNumber: number; nextWaveInSec: number; totalWaves: number }) => void;
  public onWaveStart?: (payload: { waveNumber: number; totalBots: number }) => void;
  public onRoomDeleted?: (payload: { roomId: string; reason?: string }) => void;
  public onBotProjectileSpawn?: (payload: BotProjectilePayload) => void;
  public onBotProjectileImpact?: (payload: ProjectileImpactPayload) => void;
  public onBossState?: (payload: BossStatePayload) => void;

  constructor(
    scene: THREE.Scene,
    audio: AudioManager,
    fx: FXManager,
    weaponManager: WeaponManager
  ) {
    this.scene = scene;
    this.audio = audio;
    this.fx = fx;
    this.weaponManager = weaponManager;

    // Connect to current origin or proxy
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      this.myId = this.socket.id || '';
      console.log(`[NetworkClient] Connected as ${this.myId}`);
    });

    this.socket.on('room_state_update', (state: RoomNetworkState) => {
      this.currentRoomState = state;
      this.syncRemotePlayerModels(state);
      this.onRoomStateChange?.(state);
    });

    this.socket.on('game_countdown', (count: number) => {
      this.audio.playCountdownTick(count);
      this.onCountdown?.(count);
    });

    this.socket.on('game_start', () => {
      this.isInGame = true;
      this.audio.playCountdownTick(0);
      this.onGameStart?.();
    });

    this.socket.on('room_deleted', (payload: { roomId: string; reason?: string }) => {
      console.log('[NetworkClient] Room was deleted by host:', payload);
      this.isInGame = false;
      this.currentRoomState = null;
      for (const remote of this.remotePlayers.values()) {
        remote.model.dispose();
      }
      this.remotePlayers.clear();
      this.onRoomDeleted?.(payload);
    });

    this.socket.on('sync_snapshot', (snapshot: WorldSnapshot) => {
      this.handleSnapshot(snapshot);
    });

    this.socket.on('player_fired', (data: RemoteFirePayload) => {
      if (data.shooterId === this.myId) return; // Already rendered locally

      const remote = this.remotePlayers.get(data.shooterId);
      if (remote) {
        remote.model.triggerRecoil();
        this.audio.playShoot(data.weaponType);

        // Spawn remote bullet tracer from weapon muzzle
        if (data.weaponType !== 'katana') {
          const from = remote.model.getMuzzlePosition();
          const to = data.hitPoint
            ? new THREE.Vector3(...data.hitPoint)
            : from.clone().add(new THREE.Vector3(...data.direction).multiplyScalar(60));
          this.weaponManager.spawnTracer(from, to, data.weaponType);
        }
      }
    });

    this.socket.on('player_hit', (data: HitNotificationPayload) => {
      if (data.attackerId === this.myId) {
        // Local player landed a shot!
        this.fx.showHitmarker(data.isHeadshot);
        this.audio.playHit(data.isHeadshot);
        this.fx.spawnDamageNumber(data.hitPoint, data.damage, data.isHeadshot);
      }

      if (data.targetId === this.myId) {
        // Local player took damage
        this.onLocalPlayerDamaged?.(data.targetRemainingHp, 100, data.targetRemainingShield);
      } else {
        // Update remote player nameplate health bar
        const target = this.remotePlayers.get(data.targetId);
        if (target) {
          target.model.updateNameplate(data.targetRemainingHp);
        }
      }
    });

    this.socket.on('player_eliminated', (payload: EliminationPayload) => {
      if (payload.victimId === this.myId) {
        this.audio.playOofDeath();
      } else {
        const victim = this.remotePlayers.get(payload.victimId);
        if (victim) {
          victim.model.shatterIntoBricks();
          this.audio.playOofDeath();
        }
      }

      this.onPlayerEliminated?.(payload);
    });

    this.socket.on('powerup_activated', (payload: PowerupActivatedPayload) => {
      this.onPowerupActivated?.(payload);
    });

    const handleRoomsList = (rooms: OpenRoomSummary[]) => {
      this.onOpenRoomsList?.(rooms);
    };
    this.socket.on('open_rooms_update', handleRoomsList);
    this.socket.on('wave_cleared', (payload: any) => {
      this.onWaveCleared?.(payload);
    });

    this.socket.on('wave_start', (payload: any) => {
      this.onWaveStart?.(payload);
    });

    this.socket.on('bot_projectile_spawn', (payload: BotProjectilePayload) => {
      this.onBotProjectileSpawn?.(payload);
    });

    this.socket.on('bot_projectile_impact', (payload: ProjectileImpactPayload) => {
      this.onBotProjectileImpact?.(payload);
    });

    this.socket.on('boss_state', (payload: BossStatePayload) => {
      this.onBossState?.(payload);
    });

    this.socket.on('game_over', (payload: GameOverPayload) => {
      this.isInGame = false;
      this.onGameOver?.(payload);
    });
  }

  public leaveRoom(): void {
    this.socket.emit('leave_room');
    this.isInGame = false;
    this.currentRoomState = null;
    for (const remote of this.remotePlayers.values()) {
      remote.model.dispose();
    }
    this.remotePlayers.clear();
  }

  public activatePowerup(powerup: PowerupType, targetPoint?: [number, number, number]): void {
    this.socket.emit('activate_powerup', { powerup, targetPoint });
  }

  public createRoom(
    playerName: string,
    mode: GameMode = '1v1',
    fragLimit: number = 5,
    mapName: string = 'Arena Classic',
    outfitIndex: number = 0,
    customization?: CharacterCustomization
  ): Promise<{ success: boolean; roomId?: string; error?: string }> {
    this.myName = playerName;
    return new Promise((resolve) => {
      this.socket.emit(
        'create_room',
        { playerName, mode, fragLimit, mapName, outfitIndex, customization },
        (response: any) => {
          if (response?.success) {
            this.currentRoomState = response.roomState;
            this.myId = response.playerId || this.socket.id || '';
            if (response.roomId && response.hostSecret) {
              this.saveHostedRoom(response.roomId, response.hostSecret);
            }
            resolve({ success: true, roomId: response.roomId });
          } else {
            resolve({ success: false, error: response?.error || 'Create room failed' });
          }
        }
      );
    });
  }

  public saveHostedRoom(roomId: string, hostSecret: string): void {
    try {
      const raw = localStorage.getItem('airsoft_hosted_rooms');
      const records = raw ? JSON.parse(raw) : {};
      records[roomId.toUpperCase()] = { hostSecret, createdAt: Date.now() };
      localStorage.setItem('airsoft_hosted_rooms', JSON.stringify(records));
    } catch (e) {
      console.warn('Failed to save hosted room:', e);
    }
  }

  public getHostSecret(roomId: string): string | undefined {
    try {
      const raw = localStorage.getItem('airsoft_hosted_rooms');
      if (!raw) return undefined;
      const records = JSON.parse(raw);
      return records[roomId.toUpperCase()]?.hostSecret;
    } catch {
      return undefined;
    }
  }

  public removeHostedRoom(roomId: string): void {
    try {
      const raw = localStorage.getItem('airsoft_hosted_rooms');
      if (!raw) return;
      const records = JSON.parse(raw);
      delete records[roomId.toUpperCase()];
      localStorage.setItem('airsoft_hosted_rooms', JSON.stringify(records));
    } catch {}
  }

  public isHostOf(roomId: string): boolean {
    const norm = (roomId || '').toUpperCase();
    if (this.currentRoomState?.roomId.toUpperCase() === norm) {
      const myPlayer = this.currentRoomState.players[this.myId];
      if (myPlayer?.isHost) return true;
    }
    return Boolean(this.getHostSecret(norm));
  }

  public deleteRoom(roomId: string, explicitSecret?: string): Promise<{ success: boolean; error?: string }> {
    const norm = (roomId || '').toUpperCase();
    const secret = explicitSecret || this.getHostSecret(norm);
    return new Promise((resolve) => {
      this.socket.emit('delete_room', { roomId: norm, hostSecret: secret }, (res: any) => {
        if (res?.success) {
          this.removeHostedRoom(norm);
          if (this.currentRoomState?.roomId.toUpperCase() === norm) {
            this.currentRoomState = null;
            this.isInGame = false;
          }
          resolve({ success: true });
        } else {
          resolve({ success: false, error: res?.error || 'Failed to delete room.' });
        }
      });
    });
  }

  public joinRoom(
    roomId: string,
    playerName: string,
    outfitIndex: number = 0,
    customization?: CharacterCustomization
  ): Promise<{ success: boolean; roomId?: string; error?: string }> {
    this.myName = playerName;
    return new Promise((resolve) => {
      this.socket.emit(
        'join_room',
        { roomId: roomId.trim().toUpperCase(), playerName, outfitIndex, customization },
        (response: any) => {
          if (response?.success) {
            this.currentRoomState = response.roomState;
            this.myId = response.playerId || this.socket.id || '';
            if (this.currentRoomState?.status === 'playing') {
              this.isInGame = true;
            }
            this.syncRemotePlayerModels(response.roomState);
            resolve({ success: true, roomId: response.roomId });
          } else {
            resolve({ success: false, error: response?.error || 'Join room failed' });
          }
        }
      );
    });
  }

  public startCountdown(): void {
    this.socket.emit('start_countdown');
  }

  public requestRooms(): void {
    this.socket.emit('request_rooms');
  }

  public sendInput(input: PlayerInputPayload): void {
    this.socket.emit('player_input', input);
  }

  public sendFire(payload: FireWeaponPayload): void {
    this.socket.emit('fire_weapon', payload);
  }

  public sendWeaponSwitch(index: number): void {
    this.socket.emit('switch_weapon', { weaponIndex: index });
  }

  public sendVoidFall(): void {
    this.socket.emit('player_void_fall');
  }

  private syncRemotePlayerModels(state: RoomNetworkState): void {
    const activePlayerIds = new Set(Object.keys(state.players));

    // Remove disconnected remote players
    for (const [id, entry] of this.remotePlayers.entries()) {
      if (!activePlayerIds.has(id)) {
        entry.model.dispose();
        this.remotePlayers.delete(id);
      }
    }

    // Add new remote players
    for (const [id, pState] of Object.entries(state.players)) {
      if (id === this.myId) continue; // Skip local player model
      if (!this.remotePlayers.has(id)) {
        let model: CharacterModel | GeometricBossModel;
        if (pState.isBot && pState.botRole === 'boss') {
          model = new GeometricBossModel(
            this.scene,
            id,
            pState.name,
            pState.color || '#f43f5e'
          );
        } else {
          let outfitIndex = 0;
          if (pState.isBot && pState.botRole) {
            outfitIndex = pState.botRole === 'heavy' ? 1 : pState.botRole === 'rusher' ? 2 : pState.botRole === 'sniper' ? 3 : 0;
          }
          model = new CharacterModel(
            this.scene,
            id,
            pState.name,
            pState.color,
            false,
            pState.outfitIndex ?? outfitIndex,
            pState.customization
          );
        }
        model.root.position.set(pState.x, pState.y, pState.z);
        model.root.rotation.y = pState.yaw;

        this.remotePlayers.set(id, {
          model,
          targetPos: new THREE.Vector3(pState.x, pState.y, pState.z),
          prevPos: new THREE.Vector3(pState.x, pState.y, pState.z),
          targetYaw: pState.yaw,
          targetPitch: pState.pitch,
          isSliding: pState.isSliding,
          isJumping: pState.isJumping,
          isDead: pState.isDead,
          moveSpeedSmoothed: 0
        });
      }
    }
  }

  private handleSnapshot(snapshot: WorldSnapshot): void {
    for (const [id, data] of Object.entries(snapshot.players)) {
      if (id === this.myId) continue;

      let remote = this.remotePlayers.get(id);
      if (!remote) {
        // Fallback: spawn remote model if snapshot references new entity
        let model: CharacterModel | GeometricBossModel;
        if (data.isBot && (data as any).botRole === 'boss') {
          model = new GeometricBossModel(this.scene, id, 'Boss', '#f43f5e');
        } else {
          model = new CharacterModel(
            this.scene,
            id,
            data.isBot ? 'Hostile Unit' : 'Pilot',
            '#ff2a55',
            false,
            0
          );
        }
        model.root.position.set(data.x, data.y, data.z);
        model.root.rotation.y = data.yaw;
        remote = {
          model,
          targetPos: new THREE.Vector3(data.x, data.y, data.z),
          prevPos: new THREE.Vector3(data.x, data.y, data.z),
          targetYaw: data.yaw,
          targetPitch: data.pitch,
          isSliding: data.isSliding,
          isJumping: data.isJumping,
          isDead: data.isDead,
          moveSpeedSmoothed: 0
        };
        this.remotePlayers.set(id, remote);
      }

      remote.prevPos.copy(remote.targetPos);
      remote.targetPos.set(data.x, data.y, data.z);
      remote.targetYaw = data.yaw;
      remote.targetPitch = data.pitch;
      remote.isSliding = data.isSliding;
      remote.isJumping = data.isJumping;

      // Check if remote was dead and respawned
      if (remote.isDead && !data.isDead) {
        remote.isDead = false;
        remote.model.respawn(data.x, data.y, data.z, data.yaw);
      } else if (!remote.isDead && data.isDead) {
        remote.isDead = true;
        remote.model.shatterIntoBricks();
      }

      // Sync equipped weapon on remote avatar
      if (data.currentWeapon && remote.model.currentWeapon !== data.currentWeapon) {
        remote.model.setEquippedWeapon(data.currentWeapon);
      }
    }
  }

  public update(delta: number): void {
    // Interpolate remote players smoothly towards target positions
    for (const remote of this.remotePlayers.values()) {
      if (remote.isDead) continue;

      // Linear position lerp
      remote.model.root.position.lerp(remote.targetPos, delta * 18);

      // Rotation slerp
      const currentYaw = remote.model.root.rotation.y;
      remote.model.root.rotation.y = THREE.MathUtils.lerp(
        currentYaw,
        remote.targetYaw,
        delta * 18
      );

      // Smooth move speed tracking: decay smoothly instead of abrupt 1-frame cut
      const currentDist = remote.model.root.position.distanceTo(remote.targetPos);
      const targetSpeed = currentDist > 0.03 ? 1.0 : 0.0;
      remote.moveSpeedSmoothed = THREE.MathUtils.lerp(remote.moveSpeedSmoothed, targetSpeed, delta * 10);
      const isMoving = remote.moveSpeedSmoothed > 0.12;

      // Update procedural animation
      remote.model.update(
        delta,
        isMoving,
        remote.isSliding,
        remote.isJumping,
        remote.targetPitch
      );

      // CRITICAL: Synchronize world matrix immediately after interpolation so raycasting against child colliders evaluates current frame position!
      remote.model.root.updateMatrixWorld(true);
    }
  }

  public getTargetableMeshes(): THREE.Object3D[] {
    const meshes: THREE.Object3D[] = [];
    for (const remote of this.remotePlayers.values()) {
      if (!remote.isDead) {
        meshes.push(...remote.model.targetableColliders);
      }
    }
    return meshes;
  }
}

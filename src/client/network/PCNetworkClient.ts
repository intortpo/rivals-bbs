import { io, Socket } from 'socket.io-client';
import * as pc from 'playcanvas';
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
  ProjectileImpactPayload,
  RemoteFirePayload,
  RoomNetworkState,
  WorldSnapshot
} from '../../shared/types.js';
import { PCCharacterModel } from '../engine/playcanvas/PCCharacterModel.js';
import { PCGeometricBossModel } from '../engine/playcanvas/PCGeometricBossModel.js';
import { AudioManager } from '../engine/AudioManager.js';
import { PCFXManager } from '../engine/playcanvas/PCFXManager.js';
import { PCWeaponManager, PCTargetable } from '../engine/playcanvas/PCWeaponManager.js';

interface RemotePlayerEntry {
  model: PCCharacterModel | PCGeometricBossModel;
  targetPos: pc.Vec3;
  prevPos: pc.Vec3;
  targetYaw: number;
  targetPitch: number;
  isSliding: boolean;
  isJumping: boolean;
  isDead: boolean;
  moveSpeedSmoothed: number;
}

export class PCNetworkClient {
  public socket: Socket;
  public myId: string = '';
  public myName: string = '';
  public currentRoomState: RoomNetworkState | null = null;
  public isInGame: boolean = false;

  private app?: pc.Application;
  private audio: AudioManager;
  private fx: PCFXManager;
  public weaponManager?: PCWeaponManager;

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
    app: pc.Application | undefined,
    audio: AudioManager,
    fx: PCFXManager,
    weaponManager: PCWeaponManager
  ) {
    this.app = app;
    this.audio = audio;
    this.fx = fx;
    this.weaponManager = weaponManager;

    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5
    });

    this.setupListeners();
  }

  private setupListeners(): void {
    this.socket.on('connect', () => {
      this.myId = this.socket.id || '';
      console.log(`[PCNetworkClient] Connected as ${this.myId}`);
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
      this.isInGame = false;
      this.currentRoomState = null;
      for (const remote of this.remotePlayers.values()) {
        remote.model.destroy();
      }
      this.remotePlayers.clear();
      this.onRoomDeleted?.(payload);
    });

    this.socket.on('open_rooms_list', (data: { rooms: OpenRoomSummary[] }) => {
      this.onOpenRoomsList?.(data.rooms);
    });

    this.socket.on('player_fired', (payload: RemoteFirePayload) => {
      if (payload.shooterId === this.myId) return;
      this.audio.playShoot(payload.weaponType);
    });

    this.socket.on('player_hit', (payload: HitNotificationPayload) => {
      if (payload.targetId === this.myId) {
        this.audio.playHit(payload.isHeadshot);
        this.onLocalPlayerDamaged?.(payload.targetRemainingHp, 100, payload.targetRemainingShield);
      }
      if (payload.attackerId === this.myId) {
        this.audio.playHit(payload.isHeadshot);
        this.fx.showHitmarker(payload.isHeadshot);
      }
    });

    this.socket.on('player_eliminated', (payload: EliminationPayload) => {
      this.audio.playOofDeath();
      const remote = this.remotePlayers.get(payload.victimId);
      if (remote) {
        remote.isDead = true;
        remote.model.setVisible(false);
      }
      this.onPlayerEliminated?.(payload);
    });

    this.socket.on('game_over', (payload: GameOverPayload) => {
      this.isInGame = false;
      this.onGameOver?.(payload);
    });

    this.socket.on('powerup_activated', (payload: PowerupActivatedPayload) => {
      this.onPowerupActivated?.(payload);
    });

    this.socket.on('wave_cleared', (payload: { waveNumber: number; nextWaveInSec: number; totalWaves: number }) => {
      this.onWaveCleared?.(payload);
    });

    this.socket.on('wave_start', (payload: { waveNumber: number; totalBots: number }) => {
      this.onWaveStart?.(payload);
    });

    this.socket.on('bot_fire_projectile', (payload: BotProjectilePayload) => {
      this.onBotProjectileSpawn?.(payload);
    });

    this.socket.on('projectile_impact', (payload: ProjectileImpactPayload) => {
      this.onBotProjectileImpact?.(payload);
    });

    this.socket.on('boss_state', (payload: BossStatePayload) => {
      this.onBossState?.(payload);
    });

    this.socket.on('world_snapshot', (snapshot: WorldSnapshot) => {
      this.handleSnapshot(snapshot);
    });
  }

  public createRoom(
    playerName: string,
    mode: GameMode,
    fragLimit: number = 10,
    mapName: string = 'Facility',
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

  public leaveRoom(): void {
    this.socket.emit('leave_room');
    this.isInGame = false;
    this.currentRoomState = null;
    for (const remote of this.remotePlayers.values()) {
      remote.model.destroy();
    }
    this.remotePlayers.clear();
  }

  public startCountdown(): void {
    this.socket.emit('start_countdown');
  }

  public requestRooms(): void {
    this.socket.emit('request_rooms');
  }

  public setReady(isReady: boolean): void {
    this.socket.emit('set_ready', { isReady });
  }

  public startGame(): void {
    this.socket.emit('start_game');
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

    for (const [id, entry] of this.remotePlayers.entries()) {
      if (!activePlayerIds.has(id)) {
        entry.model.destroy();
        this.remotePlayers.delete(id);
      }
    }

    for (const [id, pState] of Object.entries(state.players)) {
      if (id === this.myId) continue;
      if (!this.remotePlayers.has(id)) {
        let model: PCCharacterModel | PCGeometricBossModel;
        if (pState.isBot && pState.botRole === 'boss') {
          model = new PCGeometricBossModel(this.app, id, pState.name, pState.color || '#f43f5e');
        } else {
          model = new PCCharacterModel(this.app, id, pState.team || 'blue', false);
        }

        model.setPosition(pState.x, pState.y, pState.z);
        model.setRotation((pState.yaw * 180) / Math.PI);

        this.remotePlayers.set(id, {
          model,
          targetPos: new pc.Vec3(pState.x, pState.y, pState.z),
          prevPos: new pc.Vec3(pState.x, pState.y, pState.z),
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
        let model: PCCharacterModel | PCGeometricBossModel;
        if (data.isBot && (data as any).botRole === 'boss') {
          model = new PCGeometricBossModel(this.app, id, 'Boss', '#f43f5e');
        } else {
          model = new PCCharacterModel(this.app, id, data.team || 'blue', false);
        }
        model.setPosition(data.x, data.y, data.z);
        model.setRotation((data.yaw * 180) / Math.PI);

        remote = {
          model,
          targetPos: new pc.Vec3(data.x, data.y, data.z),
          prevPos: new pc.Vec3(data.x, data.y, data.z),
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

      if (remote.isDead && !data.isDead) {
        remote.isDead = false;
        remote.model.setVisible(true);
        remote.model.setPosition(data.x, data.y, data.z);
      } else if (!remote.isDead && data.isDead) {
        remote.isDead = true;
        remote.model.setVisible(false);
      }

      if (data.currentWeapon) {
        remote.model.currentWeapon = data.currentWeapon;
      }
    }
  }

  public update(delta: number): void {
    for (const remote of this.remotePlayers.values()) {
      if (remote.isDead) continue;

      // Position interpolation
      const curPos = remote.model.root.getPosition();
      const nx = pc.math.lerp(curPos.x, remote.targetPos.x, delta * 18);
      const ny = pc.math.lerp(curPos.y, remote.targetPos.y, delta * 18);
      const nz = pc.math.lerp(curPos.z, remote.targetPos.z, delta * 18);
      remote.model.setPosition(nx, ny, nz);

      // Rotation interpolation
      const curYawRad = (remote.model.root.getEulerAngles().y * Math.PI) / 180;
      const newYawRad = pc.math.lerp(curYawRad, remote.targetYaw, delta * 18);
      remote.model.setRotation((newYawRad * 180) / Math.PI);

      // Distance and animation speed
      const dist = curPos.distance(remote.targetPos);
      const targetSpeed = dist > 0.03 ? 1.0 : 0.0;
      remote.moveSpeedSmoothed = pc.math.lerp(remote.moveSpeedSmoothed, targetSpeed, delta * 10);

      if (remote.model instanceof PCCharacterModel) {
        remote.model.setAimPitch((remote.targetPitch * 180) / Math.PI);
        remote.model.setSliding(remote.isSliding);
        remote.model.updateAnimation(remote.moveSpeedSmoothed, delta);
      } else if (remote.model instanceof PCGeometricBossModel) {
        remote.model.updateAnimation(delta);
      }
    }
  }

  public getTargetables(): PCTargetable[] {
    const targets: PCTargetable[] = [];
    for (const remote of this.remotePlayers.values()) {
      if (!remote.isDead) {
        targets.push(remote.model);
      }
    }
    return targets;
  }
}

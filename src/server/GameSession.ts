import { Server } from 'socket.io';
import {
  EliminationPayload,
  FireWeaponPayload,
  HitNotificationPayload,
  PlayerInputPayload,
  PlayerNetworkState,
  RoomNetworkState,
  WeaponType,
  WorldSnapshot
} from '../shared/types.js';
import {
  MAP_SPAWNS,
  NETWORK,
  WEAPONS
} from '../shared/constants.js';

export class GameSession {
  private io: Server;
  public roomState: RoomNetworkState;
  private intervalId: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private lastFireTimes: Map<string, number> = new Map();

  constructor(io: Server, roomState: RoomNetworkState) {
    this.io = io;
    this.roomState = roomState;
  }

  public get roomId(): string {
    return this.roomState.roomId;
  }

  public addPlayer(id: string, name: string, color: string, isHost: boolean): PlayerNetworkState {
    const spawnIndex = Object.keys(this.roomState.players).length % MAP_SPAWNS.length;
    const spawn = MAP_SPAWNS[spawnIndex];

    const player: PlayerNetworkState = {
      id,
      name,
      color,
      isHost,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: spawn.yaw,
      pitch: 0,
      health: 100,
      maxHealth: 100,
      currentWeapon: 'rifle',
      currentWeaponIndex: 0,
      isSliding: false,
      isJumping: false,
      isDead: false,
      score: 0,
      kills: 0,
      deaths: 0
    };

    this.roomState.players[id] = player;
    return player;
  }

  public removePlayer(id: string): void {
    delete this.roomState.players[id];
    this.lastFireTimes.delete(id);

    // If host left, assign new host
    const remaining = Object.values(this.roomState.players);
    if (this.roomState.hostId === id && remaining.length > 0) {
      this.roomState.hostId = remaining[0].id;
      remaining[0].isHost = true;
    }

    if (remaining.length === 0) {
      this.stop();
    } else {
      this.broadcastRoomState();
    }
  }

  public startCountdown(): void {
    if (this.roomState.status !== 'lobby') return;
    this.roomState.status = 'countdown';
    this.roomState.countdown = NETWORK.COUNTDOWN_SECONDS;
    this.broadcastRoomState();

    this.countdownTimer = setInterval(() => {
      this.roomState.countdown--;
      this.io.to(this.roomId).emit('game_countdown', this.roomState.countdown);

      if (this.roomState.countdown <= 0) {
        if (this.countdownTimer) clearInterval(this.countdownTimer);
        this.startGame();
      }
    }, 1000);
  }

  public startGame(): void {
    this.roomState.status = 'playing';
    
    // Reset players for new match
    let index = 0;
    for (const p of Object.values(this.roomState.players)) {
      const spawn = MAP_SPAWNS[index % MAP_SPAWNS.length];
      p.x = spawn.x;
      p.y = spawn.y;
      p.z = spawn.z;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.yaw = spawn.yaw;
      p.pitch = 0;
      p.health = 100;
      p.isDead = false;
      p.score = 0;
      p.kills = 0;
      p.deaths = 0;
      index++;
    }

    this.broadcastRoomState();
    this.io.to(this.roomId).emit('game_start');

    // Start 30Hz snapshot broadcast
    this.intervalId = setInterval(() => {
      this.tick();
    }, NETWORK.TICK_INTERVAL_MS);
  }

  public handlePlayerInput(playerId: string, input: PlayerInputPayload): void {
    const player = this.roomState.players[playerId];
    if (!player || player.isDead || this.roomState.status !== 'playing') return;

    player.x = input.x;
    player.y = input.y;
    player.z = input.z;
    player.vx = input.vx;
    player.vy = input.vy;
    player.vz = input.vz;
    player.yaw = input.yaw;
    player.pitch = input.pitch;
    player.isSliding = input.isSliding;
    player.isJumping = input.isJumping;
  }

  public handleWeaponSwitch(playerId: string, weaponIndex: number): void {
    const player = this.roomState.players[playerId];
    if (!player || player.isDead) return;

    const weapons: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'katana'];
    if (weaponIndex >= 0 && weaponIndex < weapons.length) {
      player.currentWeaponIndex = weaponIndex;
      player.currentWeapon = weapons[weaponIndex];
    }
  }

  public handleFireWeapon(playerId: string, payload: FireWeaponPayload): void {
    const shooter = this.roomState.players[playerId];
    if (!shooter || shooter.isDead || this.roomState.status !== 'playing') return;

    const stats = WEAPONS[payload.weaponType];
    if (!stats) return;

    const now = Date.now();
    const lastFire = this.lastFireTimes.get(playerId) || 0;
    // Allow slight network variance (75% of firerate)
    if (now - lastFire < (stats.fireRate * 1000 * 0.75)) {
      return;
    }
    this.lastFireTimes.set(playerId, now);

    // Broadcast to other players so they can render muzzle flash & tracers
    this.io.to(this.roomId).emit('player_fired', {
      shooterId: playerId,
      weaponType: payload.weaponType,
      origin: payload.origin,
      direction: payload.direction,
      hitPoint: payload.hitPoint
    });

    // Check hit registration if a target was designated
    if (payload.targetPlayerId) {
      this.resolveHit(shooter, payload);
    }
  }

  private resolveHit(shooter: PlayerNetworkState, payload: FireWeaponPayload): void {
    const target = this.roomState.players[payload.targetPlayerId!];
    if (!target || target.isDead) return;

    const stats = WEAPONS[payload.weaponType];
    const isHeadshot = Boolean(payload.isHeadshot);
    let damage = stats.damage;

    if (isHeadshot) {
      damage = Math.round(damage * stats.headshotMultiplier);
    }

    target.health = Math.max(0, target.health - damage);

    const hitNotification: HitNotificationPayload = {
      attackerId: shooter.id,
      targetId: target.id,
      damage,
      isHeadshot,
      hitPoint: payload.hitPoint || [target.x, target.y + 1, target.z],
      targetRemainingHp: target.health
    };

    this.io.to(this.roomId).emit('player_hit', hitNotification);

    if (target.health <= 0 && !target.isDead) {
      this.handlePlayerElimination(shooter, target, payload.weaponType, isHeadshot);
    }
  }

  private handlePlayerElimination(
    killer: PlayerNetworkState,
    victim: PlayerNetworkState,
    weapon: WeaponType,
    isHeadshot: boolean
  ): void {
    victim.isDead = true;
    victim.deaths++;
    killer.kills++;
    killer.score++;

    const payload: EliminationPayload = {
      killerId: killer.id,
      killerName: killer.name,
      victimId: victim.id,
      victimName: victim.name,
      weapon,
      isHeadshot,
      killerScore: killer.score
    };

    this.io.to(this.roomId).emit('player_eliminated', payload);

    // Check for match end condition
    if (killer.score >= this.roomState.fragLimit) {
      this.endGame(killer);
      return;
    }

    // Schedule respawn for victim
    setTimeout(() => {
      if (this.roomState.players[victim.id] && this.roomState.status === 'playing') {
        this.respawnPlayer(victim);
      }
    }, NETWORK.RESPAWN_DELAY_SEC * 1000);
  }

  private respawnPlayer(player: PlayerNetworkState): void {
    const randomSpawn = MAP_SPAWNS[Math.floor(Math.random() * MAP_SPAWNS.length)];
    player.x = randomSpawn.x;
    player.y = randomSpawn.y;
    player.z = randomSpawn.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.yaw = randomSpawn.yaw;
    player.health = 100;
    player.isDead = false;

    this.broadcastRoomState();
  }

  private endGame(winner: PlayerNetworkState): void {
    this.roomState.status = 'game_over';
    this.roomState.winnerName = winner.name;
    this.roomState.winnerScore = winner.score;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    const scores = Object.values(this.roomState.players).map(p => ({
      id: p.id,
      name: p.name,
      kills: p.kills,
      deaths: p.deaths,
      score: p.score
    })).sort((a, b) => b.score - a.score);

    this.io.to(this.roomId).emit('game_over', {
      winnerId: winner.id,
      winnerName: winner.name,
      scores
    });

    this.broadcastRoomState();
  }

  private tick(): void {
    if (this.roomState.status !== 'playing') return;

    const snapshot: WorldSnapshot = {
      timestamp: Date.now(),
      players: {}
    };

    for (const [id, p] of Object.entries(this.roomState.players)) {
      snapshot.players[id] = {
        x: p.x,
        y: p.y,
        z: p.z,
        vx: p.vx,
        vy: p.vy,
        vz: p.vz,
        yaw: p.yaw,
        pitch: p.pitch,
        isSliding: p.isSliding,
        isJumping: p.isJumping,
        health: p.health,
        isDead: p.isDead,
        currentWeapon: p.currentWeapon
      };
    }

    this.io.to(this.roomId).emit('sync_snapshot', snapshot);
  }

  public broadcastRoomState(): void {
    this.io.to(this.roomId).emit('room_state_update', this.roomState);
  }

  public stop(): void {
    if (this.intervalId) clearInterval(this.intervalId);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
  }
}

import { Server } from 'socket.io';
import {
  ActivatePowerupPayload,
  CharacterCustomization,
  EliminationPayload,
  FireWeaponPayload,
  HitNotificationPayload,
  PlayerInputPayload,
  PlayerNetworkState,
  PowerupActivatedPayload,
  RoomNetworkState,
  TeamColor,
  WeaponType,
  WorldSnapshot
} from '../shared/types.js';
import {
  NETWORK,
  POWERUPS,
  TEAM_COLORS,
  WEAPONS,
  WEAPON_ORDER,
  getMapSpawns,
  getTeamSpawn
} from '../shared/constants.js';
import {
  BoundingBox,
  getMapObstacles,
  hasLineOfSight
} from '../shared/mapObstacles.js';
import { WaveManager } from './ai/WaveManager.js';

export class GameSession {
  private io: Server;
  public roomState: RoomNetworkState;
  private intervalId: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private lastFireTimes: Map<string, number> = new Map();
  private needleHits: Map<string, { count: number; lastHitTime: number; attackerId: string }> = new Map();
  private onStateChange?: () => void;
  public waveManager: WaveManager | null = null;
  private mapObstacles: BoundingBox[] = [];
  public hostSecret: string = '';
  public hostName: string = '';
  public createdAt: number = Date.now();

  constructor(io: Server, roomState: RoomNetworkState, onStateChange?: () => void, hostSecret: string = '', hostName: string = '') {
    this.io = io;
    this.roomState = roomState;
    this.onStateChange = onStateChange;
    this.mapObstacles = getMapObstacles(roomState.mapName);
    this.hostSecret = hostSecret;
    this.hostName = hostName;
    this.createdAt = Date.now();
  }

  public get roomId(): string {
    return this.roomState.roomId;
  }

  public addPlayer(
    id: string,
    name: string,
    color: string,
    isHost: boolean,
    team: TeamColor = 'none',
    outfitIndex: number = 0,
    customization?: CharacterCustomization
  ): PlayerNetworkState {
    const is4v4 = this.roomState.mode === '4v4';
    const isWave = this.roomState.mode === 'wave';
    let spawn: { x: number; y: number; z: number; yaw: number };

    if ((is4v4 || isWave) && (team === 'blue' || team === 'red')) {
      const teamPlayers = Object.values(this.roomState.players).filter(p => !p.isBot && p.team === team);
      spawn = getTeamSpawn(team, teamPlayers.length);
    } else {
      const spawns = getMapSpawns(this.roomState.mapName);
      const spawnIndex = Object.keys(this.roomState.players).length % spawns.length;
      spawn = spawns[spawnIndex];
    }

    const assignedColor = (is4v4 || isWave) ? TEAM_COLORS[team] : color;

    const player: PlayerNetworkState = {
      id,
      name,
      color: assignedColor,
      team,
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
      shieldHp: 0,
      activePowerup: null,
      powerupExpiresAt: 0,
      currentWeapon: 'rifle',
      currentWeaponIndex: 0,
      isSliding: false,
      isJumping: false,
      isDead: false,
      score: 0,
      kills: 0,
      deaths: 0,
      outfitIndex,
      customization
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
    if (this.onStateChange) this.onStateChange();

    const is4v4 = this.roomState.mode === '4v4';
    const isWave = this.roomState.mode === 'wave';
    if (is4v4) {
      this.roomState.teamScores = { blue: 0, red: 0 };
    }

    const spawns = getMapSpawns(this.roomState.mapName);
    let index = 0;
    let blueIdx = 0;
    let redIdx = 0;
    for (const p of Object.values(this.roomState.players)) {
      if (p.isBot) continue;
      let spawn: { x: number; y: number; z: number; yaw: number };
      if ((is4v4 || isWave) && (p.team === 'blue' || p.team === 'red')) {
        spawn = p.team === 'blue' ? getTeamSpawn('blue', blueIdx++) : getTeamSpawn('red', redIdx++);
      } else {
        spawn = spawns[index % spawns.length];
      }
      p.x = spawn.x;
      p.y = spawn.y;
      p.z = spawn.z;
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.yaw = spawn.yaw;
      p.pitch = 0;
      p.health = 100;
      p.shieldHp = 0;
      p.activePowerup = null;
      p.powerupExpiresAt = 0;
      p.isDead = false;
      p.score = 0;
      p.kills = 0;
      p.deaths = 0;
      index++;
    }

    // Start WaveManager if wave mode
    if (isWave) {
      this.waveManager = new WaveManager(
        this.io,
        this.roomState,
        this.roomState.mapName,
        (winner, winningTeam) => this.endGame(winner, winningTeam),
        this.onStateChange
      );
      this.waveManager.start();
    }

    this.broadcastRoomState();
    this.io.to(this.roomId).emit('game_start');

    // Start 30Hz snapshot broadcast
    this.intervalId = setInterval(() => {
      this.tick();
    }, NETWORK.TICK_INTERVAL_MS);
  }

  public handleActivatePowerup(playerId: string, payload: ActivatePowerupPayload): void {
    const player = this.roomState.players[playerId];
    if (!player || player.isDead || this.roomState.status !== 'playing') return;

    const def = POWERUPS[payload.powerup];
    if (!def) return;

    player.activePowerup = payload.powerup;
    player.powerupExpiresAt = Date.now() + def.durationSec * 1000;

    if (payload.powerup === 'shield') {
      player.shieldHp = 50;
    }

    const broadcastPayload: PowerupActivatedPayload = {
      playerId,
      powerup: payload.powerup,
      durationSec: def.durationSec,
      targetPoint: payload.targetPoint
    };

    this.io.to(this.roomId).emit('powerup_activated', broadcastPayload);

    // If airstrike, detonate after 1.5s delay
    if (payload.powerup === 'airstrike' && payload.targetPoint) {
      setTimeout(() => {
        if (this.roomState.status !== 'playing') return;
        this.resolveKineticStrike(player, payload.targetPoint!);
      }, 1500);
    }
  }

  private resolveKineticStrike(caller: PlayerNetworkState, targetPoint: [number, number, number]): void {
    const [tx, , tz] = targetPoint;
    const blastRadius = 8.5;
    const blastDamage = 80;

    this.io.to(this.roomId).emit('kinetic_strike_exploded', {
      origin: targetPoint,
      damage: blastDamage,
      radius: blastRadius
    });

    for (const target of Object.values(this.roomState.players)) {
      if (target.isDead) continue;
      // Friendly fire check
      if (this.roomState.mode === '4v4' && caller.team !== 'none' && caller.team === target.team) {
        continue;
      }

      const dist = Math.hypot(target.x - tx, target.z - tz);
      if (dist <= blastRadius) {
        let dmg = Math.round(blastDamage * (1 - dist / (blastRadius * 1.3)));
        if (target.shieldHp > 0) {
          const absorbed = Math.min(target.shieldHp, dmg);
          target.shieldHp -= absorbed;
          dmg -= absorbed;
        }
        target.health = Math.max(0, target.health - dmg);

        const hitNotification: HitNotificationPayload = {
          attackerId: caller.id,
          targetId: target.id,
          damage: dmg,
          isHeadshot: false,
          hitPoint: [target.x, target.y + 1, target.z],
          targetRemainingHp: target.health,
          targetRemainingShield: target.shieldHp
        };
        this.io.to(this.roomId).emit('player_hit', hitNotification);

        if (target.health <= 0 && !target.isDead) {
          this.handlePlayerElimination(caller, target, 'rifle', false);
        }
      }
    }
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

    if (weaponIndex >= 0 && weaponIndex < WEAPON_ORDER.length) {
      player.currentWeaponIndex = weaponIndex;
      player.currentWeapon = WEAPON_ORDER[weaponIndex];
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

    // Special Resolution 1: Hyper-Velocity Railgun (Supersonic piercing beam)
    if (payload.weaponType === 'railgun') {
      this.resolveRailgunShot(shooter, payload);
      return;
    }

    // Special Resolution 2: Quantum Plasma Launcher (Direct hit + Splash explosion)
    if (payload.weaponType === 'plasma_launcher') {
      this.resolvePlasmaShot(shooter, payload);
      return;
    }

    // Default Hit Resolution (Rifle, Shotgun, Sniper, Katana, Arc Disruptor, Needler)
    if (payload.targetPlayerId) {
      this.resolveHit(shooter, payload);
    }
  }

  private applyDirectDamage(
    shooter: PlayerNetworkState,
    target: PlayerNetworkState,
    rawDamage: number,
    weapon: WeaponType,
    isHeadshot: boolean,
    _isSupercombine: boolean = false
  ): void {
    let damage = rawDamage;

    if (shooter.activePowerup === 'quad_damage' && Date.now() < (shooter.powerupExpiresAt || 0)) {
      damage = Math.round(damage * 2);
    }
    if (target.activePowerup === 'phase_shift' && Date.now() < (target.powerupExpiresAt || 0)) {
      damage = Math.round(damage * 0.5);
    }

    if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, damage);
      target.shieldHp -= absorbed;
      damage -= absorbed;
    }

    target.health = Math.max(0, target.health - damage);

    const hitNotification: HitNotificationPayload = {
      attackerId: shooter.id,
      targetId: target.id,
      damage,
      isHeadshot,
      hitPoint: [target.x, target.y + 1, target.z],
      targetRemainingHp: target.health,
      targetRemainingShield: target.shieldHp
    };

    this.io.to(this.roomId).emit('player_hit', hitNotification);

    if (target.health <= 0 && !target.isDead) {
      this.handlePlayerElimination(shooter, target, weapon, isHeadshot);
    }
  }

  private resolvePlasmaShot(shooter: PlayerNetworkState, payload: FireWeaponPayload): void {
    const stats = WEAPONS.plasma_launcher;
    let center: [number, number, number];

    // Direct hit
    if (payload.targetPlayerId && this.roomState.players[payload.targetPlayerId]) {
      const directTarget = this.roomState.players[payload.targetPlayerId];
      center = [directTarget.x, directTarget.y + 1.0, directTarget.z];
      this.resolveHit(shooter, payload);
    } else if (payload.hitPoint) {
      center = payload.hitPoint;
    } else {
      return;
    }

    // Splash damage
    const splashRadius = stats.splashRadius || 4.5;
    const baseSplash = stats.splashDamage || 40;
    const [cx, , cz] = center;

    for (const target of Object.values(this.roomState.players)) {
      if (target.isDead || target.id === shooter.id) continue;
      if (target.id === payload.targetPlayerId) continue; // Direct target already processed
      if ((this.roomState.mode === '4v4' || this.roomState.mode === 'wave') && shooter.team !== 'none' && shooter.team === target.team) {
        continue;
      }

      const dist = Math.hypot(target.x - cx, target.z - cz);
      if (dist <= splashRadius) {
        if (!hasLineOfSight(center, [target.x, target.y + 1.0, target.z], this.mapObstacles)) {
          continue;
        }
        const splashDmg = Math.max(5, Math.round(baseSplash * (1 - dist / splashRadius)));
        this.applyDirectDamage(shooter, target, splashDmg, 'plasma_launcher', false);
      }
    }
  }

  private resolveRailgunShot(shooter: PlayerNetworkState, payload: FireWeaponPayload): void {
    const stats = WEAPONS.railgun;
    const origin: [number, number, number] = payload.origin || [shooter.x, shooter.y + 1.2, shooter.z];
    const dir = payload.direction || [0, 0, -1];
    const dirLen = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    const ndx = dir[0] / dirLen;
    const ndy = dir[1] / dirLen;
    const ndz = dir[2] / dirLen;
    const range = stats.range;

    for (const target of Object.values(this.roomState.players)) {
      if (target.isDead || target.id === shooter.id) continue;
      if ((this.roomState.mode === '4v4' || this.roomState.mode === 'wave') && shooter.team !== 'none' && shooter.team === target.team) {
        continue;
      }

      const vx = target.x - origin[0];
      const vy = (target.y + 0.9) - origin[1];
      const vz = target.z - origin[2];

      const t = vx * ndx + vy * ndy + vz * ndz;
      if (t < 0.5 || t > range) continue;

      const px = origin[0] + ndx * t;
      const py = origin[1] + ndy * t;
      const pz = origin[2] + ndz * t;

      const distSq = (target.x - px) ** 2 + (target.y + 0.9 - py) ** 2 + (target.z - pz) ** 2;
      const hitboxRadius = 1.0;

      if (distSq <= hitboxRadius * hitboxRadius) {
        if (hasLineOfSight(origin, [target.x, target.y + 0.9, target.z], this.mapObstacles)) {
          const isHeadshot = Math.abs((target.y + 1.25) - py) < 0.35;
          const damage = isHeadshot ? Math.round(stats.damage * stats.headshotMultiplier) : stats.damage;
          this.applyDirectDamage(shooter, target, damage, 'railgun', isHeadshot);
        }
      }
    }
  }

  private resolveHit(shooter: PlayerNetworkState, payload: FireWeaponPayload): void {
    const target = this.roomState.players[payload.targetPlayerId!];
    if (!target || target.isDead) return;

    // Friendly fire check in 4v4 and wave mode
    if ((this.roomState.mode === '4v4' || this.roomState.mode === 'wave') && shooter.team !== 'none' && shooter.team === target.team) {
      return;
    }

    // Line-of-sight check: shots cannot penetrate solid buildings or vehicles
    const origin: [number, number, number] = payload.origin || [shooter.x, shooter.y + 1.2, shooter.z];
    const targetPoint: [number, number, number] = payload.hitPoint || [target.x, target.y + 1.0, target.z];
    if (!hasLineOfSight(origin, targetPoint, this.mapObstacles)) {
      return; // Shot blocked by building!
    }

    const stats = WEAPONS[payload.weaponType];
    const isHeadshot = Boolean(payload.isHeadshot);
    let damage = stats.damage;

    if (isHeadshot) {
      damage = Math.round(damage * stats.headshotMultiplier);
    }

    // Quad damage powerup multiplier
    if (shooter.activePowerup === 'quad_damage' && Date.now() < (shooter.powerupExpiresAt || 0)) {
      damage = Math.round(damage * 2);
    }

    // Phase shift damage resistance (50% reduction)
    if (target.activePowerup === 'phase_shift' && Date.now() < (target.powerupExpiresAt || 0)) {
      damage = Math.round(damage * 0.5);
    }

    // Arc Disruptor bonus damage against overshields (1.75x)
    if (payload.weaponType === 'arc_disruptor' && target.shieldHp > 0 && stats.shieldMultiplier) {
      const shieldDamage = Math.round(damage * stats.shieldMultiplier);
      const absorbed = Math.min(target.shieldHp, shieldDamage);
      target.shieldHp -= absorbed;
      damage = Math.max(0, damage - Math.round(absorbed / stats.shieldMultiplier));
    } else if (target.shieldHp > 0) {
      const absorbed = Math.min(target.shieldHp, damage);
      target.shieldHp -= absorbed;
      damage -= absorbed;
    }

    target.health = Math.max(0, target.health - damage);

    const hitNotification: HitNotificationPayload = {
      attackerId: shooter.id,
      targetId: target.id,
      damage,
      isHeadshot,
      hitPoint: payload.hitPoint || [target.x, target.y + 1, target.z],
      targetRemainingHp: target.health,
      targetRemainingShield: target.shieldHp
    };

    this.io.to(this.roomId).emit('player_hit', hitNotification);

    if (target.health <= 0 && !target.isDead) {
      this.handlePlayerElimination(shooter, target, payload.weaponType, isHeadshot);
    } else if (payload.weaponType === 'needle_carbine' && !target.isDead) {
      // Needler Supercombine tracking (5 hits within 2s triggers +35 bonus detonation)
      const now = Date.now();
      const existing = this.needleHits.get(target.id);
      if (existing && existing.attackerId === shooter.id && (now - existing.lastHitTime < 2000)) {
        existing.count++;
        existing.lastHitTime = now;
        if (existing.count >= (stats.supercombineCount || 5)) {
          this.needleHits.delete(target.id);
          const comboDmg = stats.supercombineDamage || 35;
          this.applyDirectDamage(shooter, target, comboDmg, 'needle_carbine', false, true);
        }
      } else {
        this.needleHits.set(target.id, { count: 1, lastHitTime: now, attackerId: shooter.id });
      }
    }
  }

  public handlePlayerVoidFall(playerId: string): void {
    const player = this.roomState.players[playerId];
    if (!player || player.isDead || this.roomState.status !== 'playing') return;
    player.health = 0;
    player.shieldHp = 0;
    this.handlePlayerElimination(player, player, 'void' as WeaponType, false);
  }

  private handlePlayerElimination(
    killer: PlayerNetworkState,
    victim: PlayerNetworkState,
    weapon: WeaponType,
    isHeadshot: boolean
  ): void {
    victim.isDead = true;
    victim.deaths++;
    if (killer.id !== victim.id) {
      killer.kills++;
      killer.score++;
    }

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

    // Wave Mode elimination handling
    if (this.roomState.mode === 'wave') {
      if (victim.isBot && this.waveManager) {
        this.waveManager.onBotEliminated(victim.id, killer);
      }
      return;
    }

    // 4v4 Team Scoring check
    if (this.roomState.mode === '4v4' && this.roomState.teamScores && killer.team !== 'none' && killer.id !== victim.id) {
      this.roomState.teamScores[killer.team]++;
      if (this.roomState.teamScores[killer.team] >= this.roomState.fragLimit) {
        this.endGame(killer, killer.team);
        return;
      }
    } else {
      // 1v1 / FFA match end condition
      if (killer.id !== victim.id && killer.score >= this.roomState.fragLimit) {
        this.endGame(killer);
        return;
      }
    }

    // Schedule respawn for victim
    setTimeout(() => {
      if (this.roomState.players[victim.id] && this.roomState.status === 'playing') {
        this.respawnPlayer(victim);
      }
    }, NETWORK.RESPAWN_DELAY_SEC * 1000);
  }

  private respawnPlayer(player: PlayerNetworkState): void {
    let spawn: { x: number; y: number; z: number; yaw: number };
    if (this.roomState.mode === '4v4' && (player.team === 'blue' || player.team === 'red')) {
      const idx = Math.floor(Math.random() * 4);
      spawn = getTeamSpawn(player.team, idx, this.roomState.mapName);
    } else {
      const spawns = getMapSpawns(this.roomState.mapName);
      spawn = spawns[Math.floor(Math.random() * spawns.length)];
    }

    player.x = spawn.x;
    player.y = spawn.y;
    player.z = spawn.z;
    player.vx = 0;
    player.vy = 0;
    player.vz = 0;
    player.yaw = spawn.yaw;
    player.health = 100;
    player.shieldHp = 0;
    player.activePowerup = null;
    player.powerupExpiresAt = 0;
    player.isDead = false;

    this.broadcastRoomState();
  }

  private endGame(winner: PlayerNetworkState, winningTeam?: TeamColor): void {
    this.roomState.status = 'game_over';
    this.roomState.winnerName = winner.name;
    this.roomState.winnerScore = winner.score;
    this.roomState.winningTeam = winningTeam;

    if (this.waveManager) {
      this.waveManager.dispose();
    }

    if (this.onStateChange) this.onStateChange();

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
      scores,
      winningTeam
    });

    this.broadcastRoomState();
  }

  private tick(): void {
    if (this.roomState.status !== 'playing') return;

    if (this.waveManager) {
      this.waveManager.tick(1 / NETWORK.SERVER_TICK_RATE);
    }

    // Authoritative check for void falls
    for (const [id, p] of Object.entries(this.roomState.players)) {
      if (!p.isDead && p.y < -3.0) {
        this.handlePlayerVoidFall(id);
      }
    }

    const snapshot: WorldSnapshot = {
      timestamp: Date.now(),
      players: {}
    };

    for (const [id, p] of Object.entries(this.roomState.players)) {
      snapshot.players[id] = {
        x: Math.round(p.x * 100) / 100,
        y: Math.round(p.y * 100) / 100,
        z: Math.round(p.z * 100) / 100,
        vx: Math.round(p.vx * 10) / 10,
        vy: Math.round(p.vy * 10) / 10,
        vz: Math.round(p.vz * 10) / 10,
        yaw: Math.round(p.yaw * 100) / 100,
        pitch: Math.round(p.pitch * 100) / 100,
        isSliding: p.isSliding,
        isJumping: p.isJumping,
        health: p.health,
        shieldHp: p.shieldHp,
        activePowerup: p.activePowerup,
        team: p.team,
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
    if (this.waveManager) this.waveManager.dispose();
  }
}

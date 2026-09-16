import { Server } from 'socket.io';
import {
  EliminationPayload,
  HitNotificationPayload,
  PlayerNetworkState,
  RoomNetworkState,
  TeamColor,
  WeaponType
} from '../../shared/types.js';
import {
  BOT_ARCHETYPES,
  BotArchetype,
  getMapSpawns,
  getWaveConfig,
  WAVE_INTERMISSION_SECONDS,
  WaveDefinition,
  WEAPONS
} from '../../shared/constants.js';
import {
  BoundingBox,
  getMapObstacles,
  hasLineOfSight
} from '../../shared/mapObstacles.js';

interface ActiveBot {
  bot: PlayerNetworkState;
  archetype: BotArchetype;
  lastFireTime: number;
  seed: number;
}

export class WaveManager {
  private io: Server;
  private roomState: RoomNetworkState;
  private mapName: string;
  private currentWave: number = 1;
  private maxWaves: number = 10;
  private status: 'preparing' | 'active' | 'cleared' | 'game_over' = 'preparing';
  private intermissionRemaining: number = 0;
  private intermissionTimer: NodeJS.Timeout | null = null;
  private activeBots: Map<string, ActiveBot> = new Map();
  private onEndGame: (winner: PlayerNetworkState, winningTeam?: TeamColor) => void;
  private onStateChange?: () => void;
  private mapObstacles: BoundingBox[] = [];

  constructor(
    io: Server,
    roomState: RoomNetworkState,
    mapName: string,
    onEndGame: (winner: PlayerNetworkState, winningTeam?: TeamColor) => void,
    onStateChange?: () => void
  ) {
    this.io = io;
    this.roomState = roomState;
    this.mapName = mapName;
    this.onEndGame = onEndGame;
    this.onStateChange = onStateChange;
    this.mapObstacles = getMapObstacles(mapName);

    // Default maxWaves from fragLimit (if fragLimit is 5 or 10 or 0 for endless)
    this.maxWaves = roomState.fragLimit > 0 ? roomState.fragLimit : 10;

    this.updateWaveState();
  }

  public get currentWaveNumber(): number {
    return this.currentWave;
  }

  public get activeBotCount(): number {
    return this.activeBots.size;
  }

  public start(): void {
    this.currentWave = 1;
    this.startWave(this.currentWave);
  }

  private updateWaveState(): void {
    this.roomState.waveState = {
      currentWave: this.currentWave,
      maxWaves: this.maxWaves,
      status: this.status,
      totalBotsInWave: this.activeBots.size,
      aliveBotsCount: this.activeBots.size,
      intermissionRemaining: this.intermissionRemaining
    };
  }

  public startWave(waveNum: number): void {
    this.currentWave = waveNum;
    this.status = 'active';
    this.intermissionRemaining = 0;
    if (this.intermissionTimer) {
      clearInterval(this.intermissionTimer);
      this.intermissionTimer = null;
    }

    // Clean up any old bot states in roomState.players
    for (const id of Object.keys(this.roomState.players)) {
      if (this.roomState.players[id].isBot) {
        delete this.roomState.players[id];
      }
    }
    this.activeBots.clear();

    const config: WaveDefinition = getWaveConfig(waveNum);
    const spawns = getMapSpawns(this.mapName);
    let botIndex = 1;

    for (const group of config.bots) {
      const arch = BOT_ARCHETYPES[group.role];
      if (!arch) continue;

      for (let i = 0; i < group.count; i++) {
        const botId = `bot_w${waveNum}_${botIndex++}`;
        const spawnPoint = spawns[(botIndex + 2) % spawns.length];

        // Offset spawn slightly to prevent bots overlapping
        const offsetX = (Math.random() - 0.5) * 4;
        const offsetZ = (Math.random() - 0.5) * 4;

        // Early wave grace period: Wave 1 gives 3.5s-5.0s, Wave 2 gives 3.0s-4.5s, Wave 3+ gives 2.5s-4.0s
        const spawnGraceBase = waveNum === 1 ? 3500 : waveNum === 2 ? 3000 : 2500;
        const botHp = (arch.role === 'boss' && waveNum < 10) ? 150 : arch.maxHp;
        const botShield = (arch.role === 'boss' && waveNum < 10) ? 25 : arch.shieldHp;

        const botPlayer: PlayerNetworkState = {
          id: botId,
          name: `${arch.namePrefix} #${i + 1}`,
          color: arch.color,
          team: 'red',
          isHost: false,
          isBot: true,
          botRole: arch.role,
          x: spawnPoint.x + offsetX,
          y: spawnPoint.y,
          z: spawnPoint.z + offsetZ,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: spawnPoint.yaw,
          pitch: 0,
          health: botHp,
          maxHealth: botHp,
          shieldHp: botShield,
          activePowerup: null,
          powerupExpiresAt: 0,
          currentWeapon: arch.weapon,
          currentWeaponIndex: 0,
          isSliding: false,
          isJumping: false,
          isDead: false,
          score: 0,
          kills: 0,
          deaths: 0
        };

        this.roomState.players[botId] = botPlayer;
        this.activeBots.set(botId, {
          bot: botPlayer,
          archetype: arch,
          lastFireTime: Date.now() + spawnGraceBase + Math.random() * 1500,
          seed: Math.random() * 100
        });
      }
    }

    this.updateWaveState();
    if (this.roomState.waveState) {
      this.roomState.waveState.totalBotsInWave = this.activeBots.size;
      this.roomState.waveState.aliveBotsCount = this.activeBots.size;
    }

    this.io.to(this.roomState.roomId).emit('wave_start', {
      waveNumber: this.currentWave,
      totalBots: this.activeBots.size
    });

    if (this.onStateChange) this.onStateChange();
  }

  public tick(dt: number): void {
    if (this.status !== 'active') return;

    // Get all living human blue team players
    const livingHumans = Object.values(this.roomState.players).filter(
      (p) => !p.isBot && !p.isDead && (p.team === 'blue' || this.roomState.mode === 'wave')
    );

    // If all human players are dead, defeat!
    if (livingHumans.length === 0) {
      const allHumans = Object.values(this.roomState.players).filter((p) => !p.isBot);
      if (allHumans.length > 0) {
        this.status = 'game_over';
        this.updateWaveState();
        // End match in defeat
        const pseudoWinner = allHumans[0];
        this.onEndGame(pseudoWinner, 'none');
        return;
      }
    }

    const now = Date.now();
    const isCity = this.mapName === 'Cartoon City';
    const boundX = isCity ? 50 : 25;
    const boundZ = isCity ? 62 : 25;

    // Process AI for each active bot
    for (const active of this.activeBots.values()) {
      const { bot, archetype, seed } = active;
      if (bot.isDead) continue;

      // 1. Target selection: nearest living human player
      let target: PlayerNetworkState | null = null;
      let minDistSq = Infinity;

      for (const human of livingHumans) {
        const dSq = (human.x - bot.x) ** 2 + (human.z - bot.z) ** 2;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          target = human;
        }
      }

      if (!target) continue;

      const dx = target.x - bot.x;
      const dz = target.z - bot.z;
      const dist = Math.sqrt(minDistSq);

      // Desired yaw to face target
      const targetYaw = Math.atan2(-dx, -dz);
      bot.yaw = targetYaw;

      // 2. Navigation & Steer
      if (dist > 0.1) {
        let dirX = dx / dist;
        let dirZ = dz / dist;

        // Add organic lateral strafing
        const strafeTime = (now / 1000) + seed;
        const strafeX = -dirZ * Math.sin(strafeTime * 2.5) * 0.4;
        const strafeZ = dirX * Math.sin(strafeTime * 2.5) * 0.4;

        let moveX = dirX + strafeX;
        let moveZ = dirZ + strafeZ;
        const moveMag = Math.hypot(moveX, moveZ);
        if (moveMag > 0) {
          moveX /= moveMag;
          moveZ /= moveMag;
        }

        const prefRange = archetype.preferredRange;

        if (dist > prefRange) {
          // Rush forward
          bot.x += moveX * archetype.speed * dt;
          bot.z += moveZ * archetype.speed * dt;
          bot.vx = moveX * archetype.speed;
          bot.vz = moveZ * archetype.speed;
        } else if (dist < prefRange - 2 && archetype.role !== 'rusher') {
          // Back up slightly if not a melee rusher
          bot.x -= dirX * archetype.speed * 0.4 * dt;
          bot.z -= dirZ * archetype.speed * 0.4 * dt;
          bot.vx = -dirX * archetype.speed * 0.4;
          bot.vz = -dirZ * archetype.speed * 0.4;
        } else {
          // Circle strafe
          bot.x += strafeX * archetype.speed * dt;
          bot.z += strafeZ * archetype.speed * dt;
          bot.vx = strafeX * archetype.speed;
          bot.vz = strafeZ * archetype.speed;
        }

        // Avoid central fountain collision (radius 4.5m at origin)
        if (isCity && (bot.x ** 2 + bot.z ** 2 < 25)) {
          const fDist = Math.hypot(bot.x, bot.z) || 1;
          bot.x += (bot.x / fDist) * 3.0 * dt;
          bot.z += (bot.z / fDist) * 3.0 * dt;
        }

        // Clamp to map boundaries
        bot.x = Math.max(-boundX, Math.min(boundX, bot.x));
        bot.z = Math.max(-boundZ, Math.min(boundZ, bot.z));
      }

      // Early wave scaling: gentler aim and longer cooldowns during introductory waves
      let waveAccuracyMult = 1.0;
      let waveCooldownMult = 1.0;
      if (this.currentWave === 1) {
        waveAccuracyMult = 0.65;
        waveCooldownMult = 1.3;
      } else if (this.currentWave === 2) {
        waveAccuracyMult = 0.75;
        waveCooldownMult = 1.2;
      } else if (this.currentWave === 3) {
        waveAccuracyMult = 0.85;
        waveCooldownMult = 1.1;
      }

      // 3. Combat & Firing
      const weaponStats = WEAPONS[archetype.weapon];
      const inRange = dist <= (weaponStats ? weaponStats.range : 30);
      const effectiveCooldown = archetype.fireCooldown * waveCooldownMult;

      if (inRange && now - active.lastFireTime >= effectiveCooldown * 1000) {
        // Melee check: Blade Rusher must be in close range to swing katana
        if (archetype.weapon === 'katana' && dist > 2.6) {
          continue;
        }

        // Line-of-Sight check: verify solid buildings or vehicles do not block line to target
        const botEye: [number, number, number] = [bot.x, bot.y + 1.2, bot.z];
        const targetBody: [number, number, number] = [target.x, target.y + 1.0, target.z];
        if (!hasLineOfSight(botEye, targetBody, this.mapObstacles)) {
          continue; // View blocked by building! Bot continues navigating towards target.
        }

        active.lastFireTime = now;

        // Emit visual fire event to room
        this.io.to(this.roomState.roomId).emit('player_fired', {
          shooterId: bot.id,
          weaponType: archetype.weapon,
          origin: [bot.x, bot.y + 1.2, bot.z],
          direction: [Math.sin(-bot.yaw), 0, Math.cos(bot.yaw)],
          hitPoint: [target.x, target.y + 1.2, target.z]
        });

        // Determine hit registration based on accuracy with distance falloff and wave scaling
        const distFalloff = Math.max(0.35, 1 - (dist / 35));
        const effectiveAccuracy = archetype.accuracy * waveAccuracyMult * distFalloff;
        const hitRoll = Math.random();

        if (hitRoll < effectiveAccuracy) {
          // Reduced bot headshot chance (5% instead of 12%) to eliminate random 1-shots
          const isHeadshot = Math.random() < 0.05;

          // Controlled, fair bot damage per archetype
          let damage: number;
          switch (archetype.role) {
            case 'rusher':
              damage = 30; // Down from 75 (gives player time to react and escape)
              break;
            case 'sniper':
              damage = 40; // Down from 95 (no instant wipe across map)
              break;
            case 'heavy':
              damage = 22; // Down from 26+
              break;
            case 'boss':
              damage = 24; // Standard rifle damage (no quad damage)
              break;
            case 'scout':
            default:
              damage = 18; // Down from 24
              break;
          }

          if (isHeadshot) {
            damage = Math.round(damage * 1.35); // Capped multiplier (1.35x instead of 2.0x)
          }

          this.applyDamageToPlayer(target, bot, damage, isHeadshot, archetype.weapon);
        }
      }
    }
  }

  private applyDamageToPlayer(
    target: PlayerNetworkState,
    shooter: PlayerNetworkState,
    damage: number,
    isHeadshot: boolean,
    weaponType: WeaponType
  ): void {
    if (target.isDead) return;

    // Shield absorption
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
      hitPoint: [target.x, target.y + 1.2, target.z],
      targetRemainingHp: target.health,
      targetRemainingShield: target.shieldHp
    };

    this.io.to(this.roomState.roomId).emit('player_hit', hitNotification);

    if (target.health <= 0 && !target.isDead) {
      target.isDead = true;
      target.deaths++;
      shooter.kills++;
      shooter.score++;

      const elimPayload: EliminationPayload = {
        killerId: shooter.id,
        killerName: shooter.name,
        victimId: target.id,
        victimName: target.name,
        weapon: weaponType,
        isHeadshot,
        killerScore: shooter.score
      };

      this.io.to(this.roomState.roomId).emit('player_eliminated', elimPayload);

      // Check if squad is completely eliminated
      const livingHumans = Object.values(this.roomState.players).filter(
        (p) => !p.isBot && !p.isDead
      );
      if (livingHumans.length === 0) {
        this.status = 'game_over';
        this.updateWaveState();
        this.onEndGame(shooter, 'none');
      }
    }
  }

  public onBotEliminated(botId: string, killer: PlayerNetworkState): void {
    const active = this.activeBots.get(botId);
    if (!active) return;

    const bot = active.bot;
    bot.isDead = true;
    this.activeBots.delete(botId);

    if (this.roomState.waveState) {
      this.roomState.waveState.aliveBotsCount = this.activeBots.size;
    }

    // Check for wave clear
    if (this.activeBots.size === 0) {
      this.handleWaveCleared(killer);
    }
  }

  private handleWaveCleared(lastKiller: PlayerNetworkState): void {
    this.status = 'cleared';
    this.intermissionRemaining = WAVE_INTERMISSION_SECONDS;
    this.updateWaveState();

    // Check if player cleared max waves for victory
    if (this.maxWaves > 0 && this.currentWave >= this.maxWaves) {
      this.status = 'game_over';
      this.updateWaveState();
      this.onEndGame(lastKiller, 'blue');
      return;
    }

    // Reward all living human players with full health recovery and shield boost
    for (const p of Object.values(this.roomState.players)) {
      if (!p.isBot) {
        // Full health recovery + bonus shield for completing the wave
        p.health = 100;
        p.shieldHp = Math.min(50, p.shieldHp + 25);

        // Revive dead teammates for next wave
        if (p.isDead) {
          p.isDead = false;
          p.health = 100;
          p.shieldHp = 25;
          const spawns = getMapSpawns(this.mapName);
          const sp = spawns[0] || { x: 0, y: 1.0, z: 0, yaw: 0 };
          p.x = sp.x;
          p.y = sp.y;
          p.z = sp.z;
        }
      }
    }

    this.io.to(this.roomState.roomId).emit('wave_cleared', {
      waveNumber: this.currentWave,
      nextWaveInSec: WAVE_INTERMISSION_SECONDS,
      totalWaves: this.maxWaves
    });

    if (this.onStateChange) this.onStateChange();

    // Start countdown to next wave
    this.intermissionTimer = setInterval(() => {
      this.intermissionRemaining--;
      if (this.roomState.waveState) {
        this.roomState.waveState.intermissionRemaining = this.intermissionRemaining;
      }

      if (this.intermissionRemaining <= 0) {
        if (this.intermissionTimer) {
          clearInterval(this.intermissionTimer);
          this.intermissionTimer = null;
        }
        this.startWave(this.currentWave + 1);
      }
    }, 1000);
  }

  public dispose(): void {
    if (this.intermissionTimer) {
      clearInterval(this.intermissionTimer);
      this.intermissionTimer = null;
    }
    this.activeBots.clear();
  }
}

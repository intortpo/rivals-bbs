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

export type BotAIState = 'patrol' | 'hunt' | 'take_cover' | 'telegraph' | 'attack';

export interface ActiveBot {
  bot: PlayerNetworkState;
  archetype: BotArchetype;
  lastFireTime: number;
  seed: number;
  aiState: BotAIState;
  stateTimer: number;
  lastSeenTargetPos: [number, number, number] | null;
  patrolNode: [number, number, number];
  telegraphUntil: number;
  coverPosition: [number, number, number] | null;
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

        let botWeapon: WeaponType = arch.weapon;
        let botNamePrefix = arch.namePrefix;

        if (waveNum >= 5 && arch.role === 'sniper' && i % 2 === 1) {
          botWeapon = 'railgun';
          botNamePrefix = '⚡ Railgun Sniper';
        } else if (waveNum >= 6 && arch.role === 'rusher' && i % 2 === 1) {
          botWeapon = 'arc_disruptor';
          botNamePrefix = '🔌 Tesla Stalker';
        } else if (waveNum >= 7 && arch.role === 'heavy' && i % 2 === 0) {
          botWeapon = 'plasma_launcher';
          botNamePrefix = '🔮 Plasma Juggernaut';
        } else if (waveNum >= 8 && arch.role === 'scout' && i % 2 === 1) {
          botWeapon = 'needle_carbine';
          botNamePrefix = '💎 Crystalline Merc';
        }

        const botPlayer: PlayerNetworkState = {
          id: botId,
          name: `${botNamePrefix} #${i + 1}`,
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
          currentWeapon: botWeapon,
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
          seed: Math.random() * 100,
          aiState: 'attack',
          stateTimer: 0,
          lastSeenTargetPos: null,
          patrolNode: [spawnPoint.x, spawnPoint.y, spawnPoint.z],
          telegraphUntil: 0,
          coverPosition: null
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


  private getTerrainHeight(x: number, z: number): number {
    let groundY = 0.0;
    const botRadius = 0.4;
    for (let i = 0; i < this.mapObstacles.length; i++) {
      const obs = this.mapObstacles[i];
      if (
        x + botRadius > obs.min[0] &&
        x - botRadius < obs.max[0] &&
        z + botRadius > obs.min[2] &&
        z - botRadius < obs.max[2]
      ) {
        if (obs.max[1] > groundY && obs.max[1] <= 12.0) {
          groundY = Math.max(groundY, obs.max[1]);
        }
      }
    }
    return groundY;
  }

  private findNearestCover(bot: PlayerNetworkState, target: PlayerNetworkState): [number, number, number] | null {
    let bestCover: [number, number, number] | null = null;
    let bestDistSq = Infinity;

    for (const obs of this.mapObstacles) {
      const centerX = (obs.min[0] + obs.max[0]) / 2;
      const centerZ = (obs.min[2] + obs.max[2]) / 2;
      const height = obs.max[1] - obs.min[1];
      if (height < 1.4) continue;

      const distSq = (centerX - bot.x) ** 2 + (centerZ - bot.z) ** 2;
      if (distSq > 28 * 28 || distSq < 1) continue;

      const sideX = centerX > target.x ? obs.max[0] + 0.8 : obs.min[0] - 0.8;
      const sideZ = centerZ > target.z ? obs.max[2] + 0.8 : obs.min[2] - 0.8;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        bestCover = [sideX, bot.y, sideZ];
      }
    }

    return bestCover;
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
        const pseudoWinner = allHumans[0];
        this.onEndGame(pseudoWinner, 'none');
        return;
      }
    }

    const now = Date.now();
    const isCity = this.mapName === 'Cartoon City';
    let boundX = 42;
    let boundZ = 42;
    if (isCity) {
      boundX = 76;
      boundZ = 95;
    } else if (this.mapName === 'Neon Warehouse') {
      boundX = 47;
      boundZ = 47;
    } else if (this.mapName === 'Cyber Spire') {
      boundX = 52;
      boundZ = 52;
    } else if (this.mapName === 'Quantum Lab') {
      boundX = 49;
      boundZ = 49;
    } else if (this.mapName === 'Magma Foundry') {
      boundX = 51;
      boundZ = 51;
    } else if (this.mapName === 'Subzero Station') {
      boundX = 49;
      boundZ = 49;
    } else if (this.mapName === 'Sky Sanctuary') {
      boundX = 61;
      boundZ = 61;
    }

    // Process AI for each active bot
    for (const active of this.activeBots.values()) {
      const { bot, archetype, seed } = active;
      if (bot.isDead) continue;
      if (bot.y < -3.0) {
        // Bot fell into void
        this.applyDamageToPlayer(bot, bot, 999, false, 'katana');
        this.onBotEliminated(bot.id, bot);
        continue;
      }

      // Ground clamping to floor / platforms
      bot.y = this.getTerrainHeight(bot.x, bot.z);

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

      if (!target) {
        active.aiState = 'patrol';
        continue;
      }

      const dx = target.x - bot.x;
      const dy = (target.y + 1.1) - (bot.y + 1.1);
      const dz = target.z - bot.z;
      const dist = Math.sqrt(minDistSq) || 0.01;
      const dist3D = Math.hypot(dx, dy, dz) || 0.01;

      // Desired 3D aim angles towards target
      const targetYaw = Math.atan2(-dx, -dz);
      const targetPitch = Math.asin(Math.max(-0.95, Math.min(0.95, dy / dist3D)));

      // Smooth turning towards target
      let yawDiff = targetYaw - bot.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      const maxTurn = 10.0 * dt;
      bot.yaw += Math.max(-maxTurn, Math.min(maxTurn, yawDiff));
      bot.pitch = targetPitch;

      // 2. Line of Sight & Sensory Perception
      const botEye: [number, number, number] = [bot.x, bot.y + 1.08, bot.z];
      const targetBody: [number, number, number] = [target.x, target.y + 0.8, target.z];
      const hasLOS = hasLineOfSight(botEye, targetBody, this.mapObstacles);

      const fwdX = -Math.sin(bot.yaw);
      const fwdZ = -Math.cos(bot.yaw);
      const dot = (fwdX * dx + fwdZ * dz) / dist;
      const inVisionCone = dot > 0.25 || dist < 14;
      const canSeeTarget = hasLOS && inVisionCone;

      // 3. State-Driven Goal Machine Transitions
      if (canSeeTarget) {
        active.lastSeenTargetPos = [target.x, target.y, target.z];
        if (bot.health < bot.maxHealth * 0.35 && active.aiState !== 'take_cover' && active.coverPosition === null) {
          const cover = this.findNearestCover(bot, target);
          if (cover) {
            active.aiState = 'take_cover';
            active.coverPosition = cover;
            active.stateTimer = 3.0;
          }
        } else if (active.aiState === 'patrol' || active.aiState === 'hunt') {
          active.aiState = 'attack';
        }
      } else {
        if (active.aiState === 'attack') {
          if (active.lastSeenTargetPos) {
            active.aiState = 'hunt';
            active.stateTimer = 4.0;
          } else {
            active.aiState = 'patrol';
          }
        } else if (active.aiState === 'hunt') {
          active.stateTimer -= dt;
          if (active.stateTimer <= 0) {
            active.aiState = 'patrol';
            active.lastSeenTargetPos = null;
          }
        }
      }

      // 4. Navigation & Steering
      if (active.aiState === 'take_cover' && active.coverPosition) {
        active.stateTimer -= dt;
        const cdx = active.coverPosition[0] - bot.x;
        const cdz = active.coverPosition[2] - bot.z;
        const cdist = Math.hypot(cdx, cdz);
        if (active.stateTimer <= 0 || cdist < 0.8) {
          active.aiState = 'attack';
          active.coverPosition = null;
        } else {
          bot.vx = (cdx / cdist) * archetype.speed * 1.1;
          bot.vz = (cdz / cdist) * archetype.speed * 1.1;
          bot.x += bot.vx * dt;
          bot.z += bot.vz * dt;
        }
      } else if (active.aiState === 'hunt' && active.lastSeenTargetPos) {
        const hdx = active.lastSeenTargetPos[0] - bot.x;
        const hdz = active.lastSeenTargetPos[2] - bot.z;
        const hdist = Math.hypot(hdx, hdz);
        if (hdist > 0.8) {
          bot.vx = (hdx / hdist) * archetype.speed;
          bot.vz = (hdz / hdist) * archetype.speed;
          bot.x += bot.vx * dt;
          bot.z += bot.vz * dt;
        } else {
          active.aiState = 'patrol';
        }
      } else if (active.aiState === 'telegraph') {
        // Bracing to fire: stop to aim and lock orientation directly onto target
        bot.vx = 0;
        bot.vz = 0;
        bot.yaw = targetYaw;
        bot.pitch = targetPitch;
      } else {
        // Default attack / patrol navigation towards target
        if (dist > 0.1) {
          let dirX = dx / dist;
          let dirZ = dz / dist;

          const strafeTime = (now / 1000) + seed;
          const strafeX = -dirZ * Math.sin(strafeTime * 2.5) * 0.4;
          const strafeZ = dirX * Math.sin(strafeTime * 2.5) * 0.4;

          let moveX = dirX + strafeX;
          let moveZ = dirZ + strafeZ;
          const moveMag = Math.hypot(moveX, moveZ) || 1;
          moveX /= moveMag;
          moveZ /= moveMag;

          const prefRange = archetype.preferredRange;

          if (dist > prefRange) {
            bot.x += moveX * archetype.speed * dt;
            bot.z += moveZ * archetype.speed * dt;
            bot.vx = moveX * archetype.speed;
            bot.vz = moveZ * archetype.speed;
          } else if (dist < prefRange - 2 && archetype.role !== 'rusher') {
            bot.x -= dirX * archetype.speed * 0.4 * dt;
            bot.z -= dirZ * archetype.speed * 0.4 * dt;
            bot.vx = -dirX * archetype.speed * 0.4;
            bot.vz = -dirZ * archetype.speed * 0.4;
          } else {
            bot.x += strafeX * archetype.speed * dt;
            bot.z += strafeZ * archetype.speed * dt;
            bot.vx = strafeX * archetype.speed;
            bot.vz = strafeZ * archetype.speed;
          }
        }
      }

      // Avoid central fountain collision (radius 4.5m at origin)
      if (isCity && (bot.x ** 2 + bot.z ** 2 < 25)) {
        const fDist = Math.hypot(bot.x, bot.z) || 1;
        bot.x += (bot.x / fDist) * 3.0 * dt;
        bot.z += (bot.z / fDist) * 3.0 * dt;
      }

      // Resolve solid building and cover collisions for bots with tangential sliding
      const botRadius = 0.6;
      for (let oIdx = 0; oIdx < this.mapObstacles.length; oIdx++) {
        const obs = this.mapObstacles[oIdx];
        if (
          bot.x + botRadius > obs.min[0] &&
          bot.x - botRadius < obs.max[0] &&
          bot.z + botRadius > obs.min[2] &&
          bot.z - botRadius < obs.max[2]
        ) {
          const botFeet = bot.y;
          const botHead = bot.y + 1.28;
          if (botFeet >= obs.max[1] - 0.2 || botHead <= obs.min[1] + 0.1) {
            continue;
          }

          const dx1 = Math.abs(bot.x + botRadius - obs.min[0]);
          const dx2 = Math.abs(obs.max[0] - (bot.x - botRadius));
          const dz1 = Math.abs(bot.z + botRadius - obs.min[2]);
          const dz2 = Math.abs(obs.max[2] - (bot.z - botRadius));

          const min = Math.min(dx1, dx2, dz1, dz2);
          if (min === dx1) {
            bot.x = obs.min[0] - botRadius;
            if (bot.vx > 0) bot.vx = 0;
          } else if (min === dx2) {
            bot.x = obs.max[0] + botRadius;
            if (bot.vx < 0) bot.vx = 0;
          } else if (min === dz1) {
            bot.z = obs.min[2] - botRadius;
            if (bot.vz > 0) bot.vz = 0;
          } else if (min === dz2) {
            bot.z = obs.max[2] + botRadius;
            if (bot.vz < 0) bot.vz = 0;
          }
        }
      }

      // Clamp to map boundaries
      bot.x = Math.max(-boundX, Math.min(boundX, bot.x));
      bot.z = Math.max(-boundZ, Math.min(boundZ, bot.z));

      // 5. Combat & Firing
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

      const weaponStats = WEAPONS[archetype.weapon];
      const inRange = dist <= (weaponStats ? weaponStats.range : 30);
      const effectiveCooldown = archetype.fireCooldown * waveCooldownMult;

      if (inRange && (archetype.weapon !== 'katana' || dist <= 2.6)) {
        if (hasLOS && active.aiState !== 'telegraph' && now - active.lastFireTime >= effectiveCooldown * 1000) {
          active.aiState = 'telegraph';
          active.telegraphUntil = now + (this.currentWave === 1 ? 280 : 200);
        }
      }

      if (active.aiState === 'telegraph' && now >= active.telegraphUntil) {
        active.aiState = 'attack';
        bot.yaw = targetYaw;
        bot.pitch = targetPitch;

        // Re-verify line of sight before pulling the trigger
        if (!hasLineOfSight(botEye, targetBody, this.mapObstacles)) {
          active.lastFireTime = now;
          continue;
        }

        active.lastFireTime = now;

        // True 3D forward direction from bot to target (NEVER shooting backward!)
        const dirX = dx / dist3D;
        const dirY = dy / dist3D;
        const dirZ = dz / dist3D;

        // Hit registration roll
        const distFalloff = Math.max(0.35, 1 - (dist / 35));
        const effectiveAccuracy = archetype.accuracy * waveAccuracyMult * distFalloff;
        const hitRoll = Math.random();
        const isHit = hitRoll < effectiveAccuracy;
        const isHeadshot = isHit && Math.random() < 0.05;

        let hitPoint: [number, number, number];
        if (isHit) {
          hitPoint = [target.x, target.y + (isHeadshot ? 1.4 : 1.0), target.z];
        } else {
          // Whiz-by tracer passing forward near player
          const missOffX = (Math.random() - 0.5) * 1.6;
          const missOffY = (Math.random() - 0.5) * 1.2;
          const missOffZ = (Math.random() - 0.5) * 1.6;
          hitPoint = [target.x + missOffX, target.y + 1.1 + missOffY, target.z + missOffZ];
        }

        // Emit visual fire event
        this.io.to(this.roomState.roomId).emit('player_fired', {
          shooterId: bot.id,
          weaponType: bot.currentWeapon,
          origin: [bot.x, bot.y + 1.1, bot.z],
          direction: [dirX, dirY, dirZ],
          hitPoint
        });

        if (isHit) {
          let damage: number;
          if (bot.currentWeapon === 'railgun') damage = 45;
          else if (bot.currentWeapon === 'plasma_launcher') damage = 35;
          else if (bot.currentWeapon === 'arc_disruptor') damage = 16;
          else if (bot.currentWeapon === 'needle_carbine') damage = 18;
          else {
            switch (archetype.role) {
              case 'rusher': damage = 30; break;
              case 'sniper': damage = 40; break;
              case 'heavy': damage = 22; break;
              case 'boss': damage = 24; break;
              case 'scout':
              default: damage = 18; break;
            }
          }

          if (isHeadshot) damage = Math.round(damage * 1.35);
          this.applyDamageToPlayer(target, bot, damage, isHeadshot, bot.currentWeapon);
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

    // Arc Disruptor bonus damage against player overshields (1.75x)
    if (weaponType === 'arc_disruptor' && target.shieldHp > 0) {
      const shieldDmg = Math.round(damage * 1.75);
      const absorbed = Math.min(target.shieldHp, shieldDmg);
      target.shieldHp -= absorbed;
      damage = Math.max(0, damage - Math.round(absorbed / 1.75));
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
      hitPoint: [target.x, target.y + 1.2, target.z],
      targetRemainingHp: target.health,
      targetRemainingShield: target.shieldHp
    };

    this.io.to(this.roomState.roomId).emit('player_hit', hitNotification);

    if (target.health <= 0 && !target.isDead) {
      target.isDead = true;
      target.deaths++;
      if (shooter.id !== target.id) {
        shooter.kills++;
        shooter.score++;
      }

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

import { Server } from 'socket.io';
import {
  BossStatePayload,
  BotProjectilePayload,
  EliminationPayload,
  HitNotificationPayload,
  PlayerNetworkState,
  ProjectileImpactPayload,
  ProjectilePattern,
  RoomNetworkState,
  TeamColor,
  WeaponType
} from '../../shared/types.js';
import {
  BOT_ARCHETYPES,
  BotArchetype,
  getMapSpawns,
  getWaveConfig,
  MOVEMENT,
  WAVE_INTERMISSION_SECONDS,
  WaveDefinition,
  WEAPONS
} from '../../shared/constants.js';
import {
  BoundingBox,
  getMapObstacles,
  hasLineOfSight
} from '../../shared/mapObstacles.js';

export type BotAIState =
  | 'patrol'
  | 'hunt'
  | 'take_cover'
  | 'telegraph'
  | 'attack'
  | 'flank'
  | 'rush_charge'
  | 'fortify'
  | 'sniper_perch'
  | 'boss_phase';

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
  // Attack cadence and burst state trackers
  burstQueue: number;
  burstTimer: number;
  bossPhase: number;
  bossAttackPattern: 'ring' | 'spiral' | 'tri_beam';
  bossSpiralAngle: number;
  bossSpiralShotsRemaining: number;
}

export interface ServerProjectile {
  id: string;
  botId: string;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  radius: number;
  damage: number;
  color: string;
  pattern: ProjectilePattern;
  spawnTime: number;
  maxLifeTime: number;
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
  private activeProjectiles: Map<string, ServerProjectile> = new Map();
  private projCounter: number = 0;
  private lastBossBroadcastTime: number = 0;
  private lastKnownBossHp: number = -1;
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
    this.activeProjectiles.clear();
    this.lastKnownBossHp = -1;

    const config: WaveDefinition = getWaveConfig(waveNum);
    const spawns = getMapSpawns(this.mapName);
    let botIndex = 1;

    for (const group of config.bots) {
      const arch = BOT_ARCHETYPES[group.role];
      if (!arch) continue;

      for (let i = 0; i < group.count; i++) {
        const botId = `bot_w${waveNum}_${botIndex++}`;
        const spawnPoint = spawns[(botIndex + 2) % spawns.length];

        // Offset spawn slightly to prevent bots overlapping; tightly bounded on void maps
        const isVoidMap = this.mapName === 'Cyber Spire' || this.mapName === 'Magma Foundry' || this.mapName === 'Sky Sanctuary';
        const jitterRange = arch.role === 'boss' ? 0 : (isVoidMap ? 0.6 : 2.0);
        const offsetX = (Math.random() - 0.5) * jitterRange;
        const offsetZ = (Math.random() - 0.5) * jitterRange;

        // Early wave grace period: Wave 1 gives 3.5s-5.0s, Wave 2 gives 3.0s-4.5s, Wave 3+ gives 2.5s-4.0s
        const spawnGraceBase = waveNum === 1 ? 3500 : waveNum === 2 ? 3000 : 2500;
        let botHp = arch.maxHp;
        let botShield = arch.shieldHp;
        let botWeapon: WeaponType = arch.weapon;
        let botNamePrefix = arch.namePrefix;

        if (arch.role === 'boss') {
          if (waveNum === 3) {
            botNamePrefix = '💠 PRISM CONSTRUCT';
            botHp = 260;
            botShield = 60;
          } else if (waveNum === 6) {
            botNamePrefix = '⭐ OCTAHEDRON OVERLORD';
            botHp = 360;
            botShield = 100;
          } else if (waveNum >= 10) {
            botNamePrefix = '🔮 APEX ICOSAHEDRON';
            botHp = 480;
            botShield = 150;
          }
        } else if (waveNum >= 5 && arch.role === 'sniper' && i % 2 === 1) {
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
          name: arch.role === 'boss' ? botNamePrefix : `${botNamePrefix} #${i + 1}`,
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
          aiState: arch.role === 'boss' ? 'boss_phase' : 'attack',
          stateTimer: 0,
          lastSeenTargetPos: null,
          patrolNode: [spawnPoint.x, spawnPoint.y, spawnPoint.z],
          telegraphUntil: 0,
          coverPosition: null,
          burstQueue: 0,
          burstTimer: 0,
          bossPhase: 1,
          bossAttackPattern: 'ring',
          bossSpiralAngle: 0,
          bossSpiralShotsRemaining: 0
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

    this.io.to(this.roomState.roomId).emit('room_state_update', this.roomState);

    if (this.onStateChange) this.onStateChange();
  }


  private getTerrainHeight(x: number, z: number, currentY: number = 0.0): number {
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
        const obsName = obs.name || '';
        const isWalkableStructure =
          obsName.includes('Catwalk') ||
          obsName.includes('Platform') ||
          obsName.includes('Ramp') ||
          obsName.includes('Bridge') ||
          obsName.includes('Walkway') ||
          (obs.max[1] - obs.min[1] <= 0.6);

        const isBlockingWallOrContainer =
          obsName.includes('Wall') ||
          obsName.includes('Pillar') ||
          obsName.includes('Container') ||
          obsName.includes('Crate') ||
          obsName.includes('Cover') ||
          obsName.includes('Rail');

        if (isWalkableStructure && !isBlockingWallOrContainer) {
          if (currentY >= obs.max[1] - 0.5) {
            if (obs.max[1] > groundY && obs.max[1] <= 12.0) {
              groundY = Math.max(groundY, obs.max[1]);
            }
          }
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
    if (this.mapName === 'Facility') {
      boundX = 30.5;
      boundZ = 30.5;
    } else if (isCity) {
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

      // Ground clamping or boss hover levitation
      if (archetype.role === 'boss') {
        const groundY = this.getTerrainHeight(bot.x, bot.z, bot.y);
        const hoverOffset = 1.6 + Math.sin((now / 1000) * 2.0 + seed) * 0.35;
        bot.y = groundY + hoverOffset;
      } else {
        const targetGroundY = this.getTerrainHeight(bot.x, bot.z, bot.y);
        if (bot.y > targetGroundY) {
          bot.y = Math.max(targetGroundY, bot.y - 14.0 * dt);
        } else {
          bot.y = targetGroundY;
        }
      }

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
      const maxTurn = (archetype.role === 'boss' ? 6.0 : 10.0) * dt;
      bot.yaw += Math.max(-maxTurn, Math.min(maxTurn, yawDiff));
      bot.pitch = targetPitch;

      // 2. Line of Sight & Sensory Perception
      const botEye: [number, number, number] = [bot.x, bot.y + 1.08, bot.z];
      const targetBody: [number, number, number] = [target.x, target.y + 0.8, target.z];
      const hasLOS = hasLineOfSight(botEye, targetBody, this.mapObstacles);

      const fwdX = -Math.sin(bot.yaw);
      const fwdZ = -Math.cos(bot.yaw);
      const dot = (fwdX * dx + fwdZ * dz) / dist;
      const inVisionCone = dot > 0.20 || dist < 14;
      const canSeeTarget = hasLOS && inVisionCone;

      // 3. State-Driven Goal Machine Transitions
      if (canSeeTarget) {
        active.lastSeenTargetPos = [target.x, target.y, target.z];
        if (bot.health < bot.maxHealth * 0.35 && active.aiState !== 'take_cover' && active.coverPosition === null && archetype.role !== 'boss') {
          const cover = this.findNearestCover(bot, target);
          if (cover) {
            active.aiState = 'take_cover';
            active.coverPosition = cover;
            active.stateTimer = 3.0;
          }
        } else if (active.aiState === 'patrol' || active.aiState === 'hunt') {
          active.aiState = archetype.role === 'boss' ? 'boss_phase' : 'attack';
        }
      } else {
        if (active.aiState === 'attack' || active.aiState === 'boss_phase') {
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

      // 4. Navigation & Steering by Archetype Variant
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
      } else if (dist > 0.1) {
        const dirX = dx / dist;
        const dirZ = dz / dist;
        const prefRange = archetype.preferredRange;

        if (archetype.role === 'rusher') {
          // Rusher: Relentless zig-zag sprint closing in
          const zigFreq = 7.0;
          const zigZag = Math.sin((now / 1000) * zigFreq + seed) * 0.55;
          const perpX = -dirZ;
          const perpZ = dirX;
          const moveX = dirX + perpX * zigZag;
          const moveZ = dirZ + perpZ * zigZag;
          const mag = Math.hypot(moveX, moveZ) || 1;
          bot.vx = (moveX / mag) * archetype.speed;
          bot.vz = (moveZ / mag) * archetype.speed;
          bot.x += bot.vx * dt;
          bot.z += bot.vz * dt;
        } else if (archetype.role === 'sniper') {
          // Sniper: Retreats if too close to maintain sniper range (> 18m)
          if (dist < 16) {
            bot.vx = -dirX * archetype.speed;
            bot.vz = -dirZ * archetype.speed;
            bot.x += bot.vx * dt;
            bot.z += bot.vz * dt;
          } else if (dist > prefRange + 4) {
            bot.vx = dirX * archetype.speed * 0.7;
            bot.vz = dirZ * archetype.speed * 0.7;
            bot.x += bot.vx * dt;
            bot.z += bot.vz * dt;
          } else {
            bot.vx = 0;
            bot.vz = 0;
          }
        } else if (archetype.role === 'boss') {
          // Boss: Orbiting hover drift
          const orbitAngle = (now / 1000) * 0.4 + seed;
          const orbitX = Math.cos(orbitAngle) * 0.6;
          const orbitZ = Math.sin(orbitAngle) * 0.6;
          if (dist > prefRange + 2) {
            bot.vx = (dirX + orbitX) * archetype.speed * 0.8;
            bot.vz = (dirZ + orbitZ) * archetype.speed * 0.8;
          } else if (dist < prefRange - 3) {
            bot.vx = (-dirX + orbitX) * archetype.speed * 0.6;
            bot.vz = (-dirZ + orbitZ) * archetype.speed * 0.6;
          } else {
            bot.vx = orbitX * archetype.speed;
            bot.vz = orbitZ * archetype.speed;
          }
          bot.x += bot.vx * dt;
          bot.z += bot.vz * dt;
        } else {
          // Scout & Heavy: Standard strafing advance / spacing
          const strafeTime = (now / 1000) + seed;
          const strafeX = -dirZ * Math.sin(strafeTime * 2.5) * 0.4;
          const strafeZ = dirX * Math.sin(strafeTime * 2.5) * 0.4;
          let moveX = dirX + strafeX;
          let moveZ = dirZ + strafeZ;
          const moveMag = Math.hypot(moveX, moveZ) || 1;
          moveX /= moveMag;
          moveZ /= moveMag;

          if (dist > prefRange) {
            bot.vx = moveX * archetype.speed;
            bot.vz = moveZ * archetype.speed;
          } else if (dist < prefRange - 2) {
            bot.vx = -dirX * archetype.speed * 0.5;
            bot.vz = -dirZ * archetype.speed * 0.5;
          } else {
            bot.vx = strafeX * archetype.speed;
            bot.vz = strafeZ * archetype.speed;
          }
          bot.x += bot.vx * dt;
          bot.z += bot.vz * dt;
        }
      }

      // Process queued burst shots
      if (active.burstQueue > 0) {
        active.burstTimer -= dt;
        if (active.burstTimer <= 0) {
          active.burstQueue--;
          active.burstTimer = 0.12;
          const bDir: [number, number, number] = [dx / dist3D, dy / dist3D, dz / dist3D];
          this.spawnProjectile(
            bot,
            [bot.x, bot.y + 1.1, bot.z],
            bDir,
            archetype.projectileSpeed || 22,
            archetype.projectileRadius || 0.20,
            archetype.projectileDamage || 16,
            archetype.projectileColor || '#00ffcc',
            'plasma'
          );
        }
      }

      // Process boss twin spiral barrage
      if (active.bossSpiralShotsRemaining > 0) {
        active.burstTimer -= dt;
        if (active.burstTimer <= 0) {
          active.bossSpiralShotsRemaining--;
          active.burstTimer = 0.08;
          const a1 = active.bossSpiralAngle;
          const a2 = active.bossSpiralAngle + Math.PI;
          active.bossSpiralAngle += 0.44; // ~25 deg rotation
          const spd = archetype.projectileSpeed || 18;
          const dmg = archetype.projectileDamage || 20;
          this.spawnProjectile(bot, [bot.x, bot.y + 1.1, bot.z], [Math.cos(a1), 0.04, Math.sin(a1)], spd, 0.24, dmg, '#ec4899', 'spiral', 5.0);
          this.spawnProjectile(bot, [bot.x, bot.y + 1.1, bot.z], [Math.cos(a2), 0.04, Math.sin(a2)], spd, 0.24, dmg, '#ec4899', 'spiral', 5.0);
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
            const zDir = dz !== 0 ? Math.sign(dz) : (bot.z >= (obs.min[2] + obs.max[2]) / 2 ? 1 : -1);
            bot.vz = zDir * archetype.speed;
            bot.z += bot.vz * dt;
          } else if (min === dx2) {
            bot.x = obs.max[0] + botRadius;
            if (bot.vx < 0) bot.vx = 0;
            const zDir = dz !== 0 ? Math.sign(dz) : (bot.z >= (obs.min[2] + obs.max[2]) / 2 ? 1 : -1);
            bot.vz = zDir * archetype.speed;
            bot.z += bot.vz * dt;
          } else if (min === dz1) {
            bot.z = obs.min[2] - botRadius;
            if (bot.vz > 0) bot.vz = 0;
            const xDir = dx !== 0 ? Math.sign(dx) : (bot.x >= (obs.min[0] + obs.max[0]) / 2 ? 1 : -1);
            bot.vx = xDir * archetype.speed;
            bot.x += bot.vx * dt;
          } else if (min === dz2) {
            bot.z = obs.max[2] + botRadius;
            if (bot.vz < 0) bot.vz = 0;
            const xDir = dx !== 0 ? Math.sign(dx) : (bot.x >= (obs.min[0] + obs.max[0]) / 2 ? 1 : -1);
            bot.vx = xDir * archetype.speed;
            bot.x += bot.vx * dt;
          }
        }
      }

      // Clamp to map boundaries
      bot.x = Math.max(-boundX, Math.min(boundX, bot.x));
      bot.z = Math.max(-boundZ, Math.min(boundZ, bot.z));

      // 5. Combat & Projectile Weapon Discharge
      let waveCooldownMult = 1.0;
      if (this.currentWave === 1) {
        waveCooldownMult = 1.3;
      } else if (this.currentWave === 2) {
        waveCooldownMult = 1.2;
      } else if (this.currentWave === 3) {
        waveCooldownMult = 1.1;
      }

      const weaponStats = WEAPONS[archetype.weapon];
      const inRange = dist <= (weaponStats ? weaponStats.range : 32);
      const effectiveCooldown = archetype.fireCooldown * waveCooldownMult;

      if (inRange && (archetype.weapon !== 'katana' || dist <= 3.2)) {
        if (hasLOS && active.aiState !== 'telegraph' && now - active.lastFireTime >= effectiveCooldown * 1000) {
          active.aiState = 'telegraph';
          const telegraphDuration = archetype.role === 'sniper' ? 700 : archetype.role === 'heavy' ? 400 : (this.currentWave === 1 ? 280 : 200);
          active.telegraphUntil = now + telegraphDuration;
        }
      }

      if (active.aiState === 'telegraph' && now >= active.telegraphUntil) {
        active.aiState = archetype.role === 'boss' ? 'boss_phase' : 'attack';
        bot.yaw = targetYaw;
        bot.pitch = targetPitch;

        // Re-verify line of sight before pulling the trigger
        if (!hasLineOfSight(botEye, targetBody, this.mapObstacles)) {
          active.lastFireTime = now;
          continue;
        }

        active.lastFireTime = now;

        // True 3D forward direction from bot to target
        const dirX = dx / dist3D;
        const dirY = dy / dist3D;
        const dirZ = dz / dist3D;

        this.fireBotProjectiles(active, target, [dirX, dirY, dirZ]);
      }
    }

    // Update and collide active server projectiles
    this.tickProjectiles(dt, livingHumans);

    // Sync boss state to HUD
    this.updateBossState(now);
  }

  private fireBotProjectiles(
    active: ActiveBot,
    target: PlayerNetworkState,
    direction: [number, number, number]
  ): void {
    const { bot, archetype } = active;
    const origin: [number, number, number] = [bot.x, bot.y + 1.1, bot.z];

    // Emit fire visual / audio cue
    this.io.to(this.roomState.roomId).emit('player_fired', {
      shooterId: bot.id,
      weaponType: bot.currentWeapon,
      origin,
      direction,
      hitPoint: [target.x, target.y + 1.0, target.z]
    });

    const speed = archetype.projectileSpeed || 22;
    const radius = archetype.projectileRadius || 0.22;
    const damage = archetype.projectileDamage || 18;
    const color = archetype.projectileColor || '#ffaa00';

    if (archetype.role === 'scout') {
      // 2-round burst
      this.spawnProjectile(bot, origin, direction, speed, radius, damage, color, 'plasma');
      active.burstQueue = 1;
      active.burstTimer = 0.12;
    } else if (archetype.role === 'rusher') {
      // 3-shard fan spread (center, -11°, +11°)
      const yaw = bot.yaw;
      const spreadAngles = [-0.19, 0, 0.19];
      for (const offset of spreadAngles) {
        const angle = yaw + offset;
        const sDir: [number, number, number] = [-Math.sin(angle), direction[1], -Math.cos(angle)];
        const mag = Math.hypot(sDir[0], sDir[1], sDir[2]) || 1;
        this.spawnProjectile(bot, origin, [sDir[0] / mag, sDir[1] / mag, sDir[2] / mag], speed, radius, damage, color, 'shard', 3.0);
      }
    } else if (archetype.role === 'heavy') {
      // 5-way shotgun scatter
      const yaw = bot.yaw;
      const offsets = [-0.28, -0.14, 0, 0.14, 0.28];
      for (let i = 0; i < offsets.length; i++) {
        const angle = yaw + offsets[i];
        const pitchJitter = (Math.random() - 0.5) * 0.08;
        const sDir: [number, number, number] = [-Math.sin(angle), direction[1] + pitchJitter, -Math.cos(angle)];
        const mag = Math.hypot(sDir[0], sDir[1], sDir[2]) || 1;
        this.spawnProjectile(bot, origin, [sDir[0] / mag, sDir[1] / mag, sDir[2] / mag], speed, radius, damage, color, 'plasma', 3.5);
      }
    } else if (archetype.role === 'sniper') {
      // Supersonic piercing beam
      this.spawnProjectile(bot, origin, direction, speed, radius, damage, color, 'beam', 5.0);
    } else if (archetype.role === 'boss') {
      // Inter-level Geometric Boss: Cycle through 3 bullet-hell patterns
      const currentPattern = active.bossPhase;
      active.bossPhase = (active.bossPhase % 3) + 1;

      if (currentPattern === 1) {
        // Pattern 1: 360-degree Nova Ring (16 projectiles in circle)
        const count = 32;
        for (let i = 0; i < count; i++) {
          const theta = (i / count) * Math.PI * 2;
          const ringDir: [number, number, number] = [Math.cos(theta), 0.02, Math.sin(theta)];
          this.spawnProjectile(bot, origin, ringDir, 14, 0.28, 22, '#f43f5e', 'ring', 5.0);
        }
      } else if (currentPattern === 2) {
        // Pattern 2: Twin Spiral Stream (12 shots over ~1 second)
        active.bossSpiralShotsRemaining = 12;
        active.burstTimer = 0.08;
        active.bossSpiralAngle = Math.atan2(-direction[0], -direction[2]);
      } else {
        // Pattern 3: Tri-Beam Heavy Aim Burst
        const yaw = bot.yaw;
        const offsets = [-0.12, 0, 0.12];
        for (const off of offsets) {
          const angle = yaw + off;
          const bDir: [number, number, number] = [-Math.sin(angle), direction[1], -Math.cos(angle)];
          const mag = Math.hypot(bDir[0], bDir[1], bDir[2]) || 1;
          this.spawnProjectile(bot, origin, [bDir[0] / mag, bDir[1] / mag, bDir[2] / mag], 22, 0.30, 26, '#f43f5e', 'plasma', 4.0);
        }
      }
    } else {
      this.spawnProjectile(bot, origin, direction, speed, radius, damage, color, 'plasma');
    }
  }

  private spawnProjectile(
    bot: PlayerNetworkState,
    origin: [number, number, number],
    direction: [number, number, number],
    speed: number,
    radius: number,
    damage: number,
    color: string,
    pattern: ProjectilePattern = 'plasma',
    maxLifeTime: number = 4.0
  ): void {
    const id = `bproj_${bot.id}_${++this.projCounter}_${Date.now()}`;
    const vx = direction[0] * speed;
    const vy = direction[1] * speed;
    const vz = direction[2] * speed;

    const proj: ServerProjectile = {
      id,
      botId: bot.id,
      x: origin[0],
      y: origin[1],
      z: origin[2],
      vx,
      vy,
      vz,
      radius,
      damage,
      color,
      pattern,
      spawnTime: Date.now(),
      maxLifeTime
    };

    this.activeProjectiles.set(id, proj);

    const payload: BotProjectilePayload = {
      id,
      botId: bot.id,
      x: origin[0],
      y: origin[1],
      z: origin[2],
      vx,
      vy,
      vz,
      radius,
      color,
      damage,
      pattern
    };

    this.io.to(this.roomState.roomId).emit('bot_projectile_spawn', payload);
  }

  private tickProjectiles(dt: number, livingHumans: PlayerNetworkState[]): void {
    const now = Date.now();
    for (const [id, proj] of this.activeProjectiles.entries()) {
      if (now - proj.spawnTime > proj.maxLifeTime * 1000) {
        this.activeProjectiles.delete(id);
        continue;
      }

      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.z += proj.vz * dt;

      // Floor / ceiling check
      if (proj.y <= 0.05 || proj.y > 60) {
        const payload: ProjectileImpactPayload = {
          id: proj.id,
          hitPoint: [proj.x, Math.max(0, proj.y), proj.z]
        };
        this.io.to(this.roomState.roomId).emit('bot_projectile_impact', payload);
        this.activeProjectiles.delete(id);
        continue;
      }

      // Check map obstacle collision
      let hitObstacle = false;
      for (let i = 0; i < this.mapObstacles.length; i++) {
        const obs = this.mapObstacles[i];
        if (
          proj.x >= obs.min[0] &&
          proj.x <= obs.max[0] &&
          proj.y >= obs.min[1] &&
          proj.y <= obs.max[1] &&
          proj.z >= obs.min[2] &&
          proj.z <= obs.max[2]
        ) {
          hitObstacle = true;
          break;
        }
      }

      if (hitObstacle) {
        const payload: ProjectileImpactPayload = {
          id: proj.id,
          hitPoint: [proj.x, proj.y, proj.z]
        };
        this.io.to(this.roomState.roomId).emit('bot_projectile_impact', payload);
        this.activeProjectiles.delete(id);
        continue;
      }

      // Check collision against living human players
      let hitPlayer: PlayerNetworkState | null = null;
      for (const human of livingHumans) {
        const horizDist = Math.hypot(proj.x - human.x, proj.z - human.z);
        const playerRadius = MOVEMENT.PLAYER_RADIUS; // 0.38
        if (horizDist <= playerRadius + proj.radius) {
          const playerHeight = human.isSliding ? MOVEMENT.PLAYER_SLIDE_HEIGHT : MOVEMENT.PLAYER_HEIGHT;
          if (proj.y >= human.y - 0.1 && proj.y <= human.y + playerHeight + proj.radius) {
            hitPlayer = human;
            break;
          }
        }
      }

      if (hitPlayer) {
        const shooterActive = this.activeBots.get(proj.botId);
        const shooterBot = shooterActive ? shooterActive.bot : null;
        if (shooterBot && !shooterBot.isDead) {
          this.applyDamageToPlayer(hitPlayer, shooterBot, proj.damage, false, shooterBot.currentWeapon);
        }
        const payload: ProjectileImpactPayload = {
          id: proj.id,
          hitPoint: [proj.x, proj.y, proj.z],
          hitPlayerId: hitPlayer.id
        };
        this.io.to(this.roomState.roomId).emit('bot_projectile_impact', payload);
        this.activeProjectiles.delete(id);
        continue;
      }
    }
  }

  private updateBossState(now: number): void {
    const bossActive = Array.from(this.activeBots.values()).find(
      (a) => a.archetype.role === 'boss' && !a.bot.isDead
    );

    if (bossActive) {
      const b = bossActive.bot;
      const totalHp = b.health + b.shieldHp;
      if (now - this.lastBossBroadcastTime > 300 || this.lastKnownBossHp !== totalHp) {
        this.lastBossBroadcastTime = now;
        this.lastKnownBossHp = totalHp;
        const payload: BossStatePayload = {
          bossId: b.id,
          name: b.name,
          health: b.health,
          maxHealth: b.maxHealth,
          shield: b.shieldHp,
          phase: bossActive.bossPhase || 1
        };
        this.io.to(this.roomState.roomId).emit('boss_state', payload);
      }
    } else if (this.lastKnownBossHp > 0) {
      // Boss was just eliminated
      this.lastKnownBossHp = 0;
      this.io.to(this.roomState.roomId).emit('boss_state', {
        bossId: '',
        name: '',
        health: 0,
        maxHealth: 100,
        shield: 0,
        phase: 0
      });
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

    this.io.to(this.roomState.roomId).emit('room_state_update', this.roomState);

    // Check for wave clear
    if (this.activeBots.size === 0 && this.roomState.mode === 'wave') {
      this.handleWaveCleared(killer);
    }
  }

  public notifyBotRespawned(botId: string): void {
    const bot = this.roomState.players[botId];
    if (!bot || !bot.isBot) return;
    bot.isDead = false;
    const arch = BOT_ARCHETYPES[bot.botRole || 'scout'] || BOT_ARCHETYPES['scout'];
    this.activeBots.set(botId, {
      bot,
      archetype: arch,
      lastFireTime: Date.now() + 1500,
      seed: Math.random() * 100,
      aiState: 'attack',
      stateTimer: 0,
      lastSeenTargetPos: null,
      patrolNode: [bot.x, bot.y, bot.z],
      telegraphUntil: 0,
      coverPosition: null,
      burstQueue: 0,
      burstTimer: 0,
      bossPhase: 1,
      bossAttackPattern: 'ring',
      bossSpiralAngle: 0,
      bossSpiralShotsRemaining: 0
    });
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

    this.io.to(this.roomState.roomId).emit('room_state_update', this.roomState);

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
    this.activeProjectiles.clear();
  }
}

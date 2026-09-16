export type GameMode = '1v1' | '4v4' | 'ffa' | 'wave';

export type TeamColor = 'blue' | 'red' | 'none';

export type BotRole = 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss';

export type PowerupType =
  | 'shield'      // +50 Temporary Overshield
  | 'speed'       // +40% Speed & Slide boost (10s)
  | 'quad_damage' // 2x Weapon damage (8s)
  | 'rapid_mag'   // Instant mag refill + 0s reload (12s)
  | 'radar'       // Tactical radar highlighting enemies through walls (10s)
  | 'phase_shift' // 80% cloak transparency & 50% damage reduction (5s)
  | 'airstrike';  // Orbital kinetic strike blast at crosshair (3s delay)

export interface PowerupDefinition {
  id: PowerupType;
  name: string;
  tier: 1 | 2 | 3;
  requiredStreak: number;
  durationSec: number;
  icon: string;
  description: string;
}

export interface OpenRoomSummary {
  roomId: string;
  mode: GameMode;
  mapName: string;
  fragLimit: number;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
  status: RoomStatus;
}

export type WeaponType = 'rifle' | 'shotgun' | 'sniper' | 'katana';

export interface WeaponStats {
  type: WeaponType;
  name: string;
  damage: number;
  headshotMultiplier: number;
  fireRate: number; // delay in seconds between shots
  magazineSize: number;
  reloadTime: number; // in seconds
  automatic: boolean;
  pelletCount?: number; // for shotgun
  spread: number; // in radians
  range: number; // max distance
  adsZoomFov: number; // target FOV in degrees
  icon: string;
}

export interface PlayerInputPayload {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  isSliding: boolean;
  isJumping: boolean;
  isGrounded: boolean;
  timestamp: number;
}

export interface CharacterCustomization {
  face: string;
  hair: string;
  headwear: string;
  eyewear: string;
  accessories: string[];
  top: string;
  bottom: string;
  shoes: string;
  socks: boolean;
  gloves: string;
  accentColor: string;
}

export interface PlayerNetworkState {
  id: string;
  name: string;
  color: string;
  team: TeamColor;
  isHost: boolean;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  pitch: number;
  health: number;
  maxHealth: number;
  shieldHp: number; // 0 to 50
  activePowerup?: PowerupType | null;
  powerupExpiresAt?: number;
  currentWeapon: WeaponType;
  currentWeaponIndex: number;
  isSliding: boolean;
  isJumping: boolean;
  isDead: boolean;
  score: number;
  kills: number;
  deaths: number;
  respawnTimer?: number;
  isBot?: boolean;
  botRole?: BotRole;
  outfitIndex?: number;
  customization?: CharacterCustomization;
}

export interface WaveNetworkState {
  currentWave: number;
  maxWaves: number; // 5, 10, or 0 (endless)
  status: 'preparing' | 'active' | 'cleared' | 'game_over';
  totalBotsInWave: number;
  aliveBotsCount: number;
  intermissionRemaining: number;
}

export type RoomStatus = 'lobby' | 'countdown' | 'playing' | 'game_over';

export interface RoomNetworkState {
  roomId: string;
  hostId: string;
  mode: GameMode;
  mapName: string;
  fragLimit: number;
  status: RoomStatus;
  countdown: number;
  players: Record<string, PlayerNetworkState>;
  teamScores?: { blue: number; red: number };
  waveState?: WaveNetworkState;
  winnerName?: string;
  winnerScore?: number;
  winningTeam?: TeamColor;
}

export interface WorldSnapshot {
  timestamp: number;
  players: Record<string, {
    x: number;
    y: number;
    z: number;
    vx: number;
    vy: number;
    vz: number;
    yaw: number;
    pitch: number;
    isSliding: boolean;
    isJumping: boolean;
    health: number;
    shieldHp?: number;
    activePowerup?: PowerupType | null;
    team?: TeamColor;
    isDead: boolean;
    currentWeapon: WeaponType;
  }>;
}

export interface FireWeaponPayload {
  weaponType: WeaponType;
  origin: [number, number, number];
  direction: [number, number, number];
  targetPlayerId?: string;
  isHeadshot?: boolean;
  hitPoint?: [number, number, number];
}

export interface RemoteFirePayload {
  shooterId: string;
  weaponType: WeaponType;
  origin: [number, number, number];
  direction: [number, number, number];
  hitPoint?: [number, number, number];
}

export interface HitNotificationPayload {
  attackerId: string;
  targetId: string;
  damage: number;
  isHeadshot: boolean;
  hitPoint: [number, number, number];
  targetRemainingHp: number;
  targetRemainingShield?: number;
}

export interface EliminationPayload {
  killerId: string;
  killerName: string;
  victimId: string;
  victimName: string;
  weapon: WeaponType;
  isHeadshot: boolean;
  killerScore: number;
}

export interface GameOverPayload {
  winnerId: string;
  winnerName: string;
  scores: { id: string; name: string; kills: number; deaths: number; score: number }[];
  winningTeam?: TeamColor;
}

export interface ActivatePowerupPayload {
  powerup: PowerupType;
  targetPoint?: [number, number, number]; // for kinetic strike
}

export interface PowerupActivatedPayload {
  playerId: string;
  powerup: PowerupType;
  durationSec: number;
  targetPoint?: [number, number, number];
}

export interface KineticStrikeExplosionPayload {
  origin: [number, number, number];
  damage: number;
  radius: number;
}

export interface WaveClearedPayload {
  waveNumber: number;
  nextWaveInSec: number;
  totalWaves: number;
}

export interface WaveStartPayload {
  waveNumber: number;
  totalBots: number;
}

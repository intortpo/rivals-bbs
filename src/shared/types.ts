export type GameMode = '1v1' | 'ffa';

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

export interface PlayerNetworkState {
  id: string;
  name: string;
  color: string;
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
  currentWeapon: WeaponType;
  currentWeaponIndex: number;
  isSliding: boolean;
  isJumping: boolean;
  isDead: boolean;
  score: number;
  kills: number;
  deaths: number;
  respawnTimer?: number;
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
  winnerName?: string;
  winnerScore?: number;
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
}

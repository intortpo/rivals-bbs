import { WeaponStats, WeaponType } from './types.js';

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  rifle: {
    type: 'rifle',
    name: 'Assault Rifle',
    damage: 24,
    headshotMultiplier: 1.75, // 42 headshot
    fireRate: 0.11, // ~545 RPM
    magazineSize: 30,
    reloadTime: 1.8,
    automatic: true,
    spread: 0.02,
    range: 120,
    adsZoomFov: 50,
    icon: '🔫'
  },
  shotgun: {
    type: 'shotgun',
    name: 'Pump Shotgun',
    damage: 13, // 8 pellets * 13 = 104 if all hit body
    headshotMultiplier: 1.5, // 19.5 per pellet
    fireRate: 0.75,
    magazineSize: 6,
    reloadTime: 2.2,
    automatic: false,
    pelletCount: 8,
    spread: 0.075,
    range: 45,
    adsZoomFov: 58,
    icon: '💥'
  },
  sniper: {
    type: 'sniper',
    name: 'Heavy Sniper',
    damage: 95,
    headshotMultiplier: 2.0, // 190 headshot = instant elimination
    fireRate: 1.25,
    magazineSize: 4,
    reloadTime: 2.8,
    automatic: false,
    spread: 0.001,
    range: 200,
    adsZoomFov: 24,
    icon: '🎯'
  },
  katana: {
    type: 'katana',
    name: 'Energy Katana',
    damage: 75,
    headshotMultiplier: 1.0,
    fireRate: 0.45,
    magazineSize: 1, // melee doesn't reload
    reloadTime: 0.1,
    automatic: false,
    spread: 0.0,
    range: 4.0,
    adsZoomFov: 70,
    icon: '⚔️'
  }
};

export const WEAPON_ORDER: WeaponType[] = ['rifle', 'shotgun', 'sniper', 'katana'];

export const MOVEMENT = {
  WALK_SPEED: 12.0,
  SLIDE_INITIAL_SPEED: 22.0,
  SLIDE_FRICTION: 12.0,
  SLIDE_MIN_SPEED: 6.0,
  SLIDE_DURATION_MAX: 0.85,
  JUMP_VELOCITY: 11.5,
  SLIDE_JUMP_BOOST: 1.2,
  GRAVITY: 28.0,
  PLAYER_HEIGHT: 2.2,
  PLAYER_SLIDE_HEIGHT: 1.2,
  PLAYER_RADIUS: 0.6,
  EYE_HEIGHT: 1.85,
  SLIDE_EYE_HEIGHT: 1.0
};

export const NETWORK = {
  SERVER_TICK_RATE: 30, // 30 updates per second
  TICK_INTERVAL_MS: 1000 / 30,
  INTERPOLATION_OFFSET_MS: 50,
  RESPAWN_DELAY_SEC: 3.0,
  COUNTDOWN_SECONDS: 3,
  DEFAULT_FRAG_LIMIT: 5
};

export const MAP_SPAWNS = [
  { x: -18, y: 1.5, z: -18, yaw: Math.PI / 4 },
  { x: 18, y: 1.5, z: 18, yaw: -3 * Math.PI / 4 },
  { x: -18, y: 1.5, z: 18, yaw: -Math.PI / 4 },
  { x: 18, y: 1.5, z: -18, yaw: 3 * Math.PI / 4 },
  { x: 0, y: 1.5, z: -20, yaw: 0 },
  { x: 0, y: 1.5, z: 20, yaw: Math.PI }
];

export const PLAYER_COLORS = [
  '#00d2ff', // Cyan
  '#ff2a55', // Red / Crimson
  '#00ff88', // Neon Green
  '#ffbb00', // Amber
  '#a855f7', // Purple
  '#ff7700'  // Orange
];

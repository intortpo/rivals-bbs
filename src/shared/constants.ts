import { PowerupDefinition, PowerupType, TeamColor, WeaponStats, WeaponType } from './types.js';

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
  },
  needle_carbine: {
    type: 'needle_carbine',
    name: 'Crystalline Needler',
    damage: 18,
    headshotMultiplier: 1.5,
    fireRate: 0.12, // ~500 RPM
    magazineSize: 28,
    reloadTime: 1.7,
    automatic: true,
    spread: 0.02,
    range: 90,
    adsZoomFov: 52,
    icon: '💎',
    ricochetCount: 2,
    supercombineCount: 5,
    supercombineDamage: 35
  },
  plasma_launcher: {
    type: 'plasma_launcher',
    name: 'Quantum Plasma Launcher',
    damage: 70,
    headshotMultiplier: 1.25,
    fireRate: 0.65,
    magazineSize: 8,
    reloadTime: 2.2,
    automatic: false,
    spread: 0.015,
    range: 110,
    adsZoomFov: 55,
    icon: '🔮',
    splashRadius: 4.5,
    splashDamage: 40,
    projectileSpeed: 36
  },
  railgun: {
    type: 'railgun',
    name: 'Hyper-Velocity Railgun',
    damage: 110,
    headshotMultiplier: 2.0, // 220 critical headshot
    fireRate: 1.35,
    magazineSize: 4,
    reloadTime: 2.6,
    automatic: false,
    spread: 0.0005,
    range: 220,
    adsZoomFov: 22,
    icon: '⚡',
    chargeTime: 0.45,
    piercing: true
  },
  arc_disruptor: {
    type: 'arc_disruptor',
    name: 'Tesla Arc Disruptor',
    damage: 16,
    headshotMultiplier: 1.0,
    fireRate: 0.10, // continuous channel 600 ticks/min
    magazineSize: 40,
    reloadTime: 1.6,
    automatic: true,
    spread: 0.04,
    range: 16,
    adsZoomFov: 65,
    icon: '🔌',
    shieldMultiplier: 1.75
  }
};

export const WEAPON_CATEGORIES = {
  tactical: ['rifle', 'shotgun', 'sniper', 'katana'] as WeaponType[],
  experimental: ['needle_carbine', 'plasma_launcher', 'railgun', 'arc_disruptor'] as WeaponType[]
};

export const WEAPON_ORDER: WeaponType[] = [
  'rifle',
  'shotgun',
  'sniper',
  'katana',
  'needle_carbine',
  'plasma_launcher',
  'railgun',
  'arc_disruptor'
];

export const MOVEMENT = {
  WALK_SPEED: 12.0,
  SLIDE_INITIAL_SPEED: 22.0,
  SLIDE_FRICTION: 12.0,
  SLIDE_MIN_SPEED: 6.0,
  SLIDE_DURATION_MAX: 0.85,
  JUMP_VELOCITY: 11.5,
  SLIDE_JUMP_BOOST: 1.2,
  GRAVITY: 28.0,
  PLAYER_HEIGHT: 1.45,
  PLAYER_SLIDE_HEIGHT: 0.80,
  PLAYER_RADIUS: 0.40,
  EYE_HEIGHT: 1.25,
  SLIDE_EYE_HEIGHT: 0.65
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

export const CITY_SPAWNS = [
  { x: 0, y: 1.0, z: 0, yaw: 0 }, // Central Fountain Plaza
  { x: 0, y: 1.0, z: -48, yaw: 0 }, // North Boulevard
  { x: 0, y: 1.0, z: 48, yaw: Math.PI }, // South Avenue
  { x: -35, y: 1.0, z: 0, yaw: Math.PI / 2 }, // West Station
  { x: 35, y: 1.0, z: 0, yaw: -Math.PI / 2 }, // East Tower
  { x: 0, y: 16.5, z: 22, yaw: Math.PI } // Rooftop Sniper Nest
];

export const CYBER_SPIRE_SPAWNS = [
  { x: 0, y: 1.0, z: -4, yaw: 0 },
  { x: 0, y: 1.0, z: 4, yaw: Math.PI },
  { x: 0, y: 4.0, z: -22, yaw: 0 }, // North Tower
  { x: 0, y: 4.0, z: 22, yaw: Math.PI }, // South Tower
  { x: -22, y: 3.0, z: 0, yaw: Math.PI / 2 }, // West Helipad
  { x: 22, y: 3.0, z: 0, yaw: -Math.PI / 2 }, // East Deck
  { x: 0, y: 11.0, z: 0, yaw: 0 } // High Spire
];

export const QUANTUM_LAB_SPAWNS = [
  { x: -22, y: 1.0, z: 0, yaw: Math.PI / 2 }, // West Lab Bay
  { x: 22, y: 1.0, z: 0, yaw: -Math.PI / 2 }, // East Lab Bay
  { x: 0, y: 1.0, z: -22, yaw: 0 }, // North Access
  { x: 0, y: 1.0, z: 22, yaw: Math.PI }, // South Access
  { x: 0, y: 4.5, z: 0, yaw: 0 }, // Observation Deck
  { x: -14, y: 1.0, z: 12, yaw: -Math.PI / 4 },
  { x: 14, y: 1.0, z: -12, yaw: 3 * Math.PI / 4 }
];

export const MAGMA_FOUNDRY_SPAWNS = [
  { x: 0, y: 1.0, z: -22, yaw: 0 }, // North Furnace
  { x: 0, y: 1.0, z: 22, yaw: Math.PI }, // South Furnace
  { x: -22, y: 1.0, z: 0, yaw: Math.PI / 2 }, // West Slag Pour
  { x: 22, y: 1.0, z: 0, yaw: -Math.PI / 2 }, // East Tank
  { x: 0, y: 1.0, z: 0, yaw: 0 }, // Central Crucible
  { x: 0, y: 5.5, z: 6, yaw: Math.PI } // High Crane Gantry
];

export const SUBZERO_STATION_SPAWNS = [
  { x: 0, y: 1.0, z: -24, yaw: 0 }, // North Bunker
  { x: 0, y: 1.0, z: 24, yaw: Math.PI }, // South Depot
  { x: -20, y: 1.0, z: 0, yaw: Math.PI / 2 }, // West Trench
  { x: 20, y: 1.0, z: 0, yaw: -Math.PI / 2 }, // East Container Yard
  { x: 0, y: 5.0, z: 0, yaw: 0 }, // Radar Roof
  { x: -16, y: 1.0, z: -16, yaw: Math.PI / 4 }
];

export const SKY_SANCTUARY_SPAWNS = [
  { x: 0, y: 1.0, z: 0, yaw: 0 }, // Central Shrine
  { x: 0, y: 1.0, z: -26, yaw: 0 }, // North Cloud Garden
  { x: 0, y: 1.0, z: 26, yaw: Math.PI }, // South Cloud Garden
  { x: -26, y: 1.0, z: 0, yaw: Math.PI / 2 }, // West Meditation Terrace
  { x: 26, y: 1.0, z: 0, yaw: -Math.PI / 2 }, // East Bell Tower
  { x: 0, y: 4.5, z: 0, yaw: Math.PI } // Shrine Pavilion Terrace
];

export function getMapSpawns(mapName?: string) {
  switch (mapName) {
    case 'Cartoon City':
      return CITY_SPAWNS;
    case 'Cyber Spire':
      return CYBER_SPIRE_SPAWNS;
    case 'Quantum Lab':
      return QUANTUM_LAB_SPAWNS;
    case 'Magma Foundry':
      return MAGMA_FOUNDRY_SPAWNS;
    case 'Subzero Station':
      return SUBZERO_STATION_SPAWNS;
    case 'Sky Sanctuary':
      return SKY_SANCTUARY_SPAWNS;
    default:
      return MAP_SPAWNS;
  }
}

export const PLAYER_COLORS = [
  '#00d2ff', // Cyan
  '#ff2a55', // Red / Crimson
  '#00ff88', // Neon Green
  '#ffbb00', // Amber
  '#a855f7', // Purple
  '#ff7700'  // Orange
];

export const TEAM_COLORS: Record<TeamColor, string> = {
  blue: '#00d2ff',
  red: '#ff2a55',
  none: '#ffffff'
};

export const TEAM_SPAWNS: Record<'blue' | 'red', { x: number; y: number; z: number; yaw: number }[]> = {
  blue: [
    { x: -6, y: 1.0, z: 46, yaw: Math.PI },
    { x: 0, y: 1.0, z: 48, yaw: Math.PI },
    { x: 6, y: 1.0, z: 46, yaw: Math.PI },
    { x: 0, y: 1.0, z: 38, yaw: Math.PI }
  ],
  red: [
    { x: -6, y: 1.0, z: -46, yaw: 0 },
    { x: 0, y: 1.0, z: -48, yaw: 0 },
    { x: 6, y: 1.0, z: -46, yaw: 0 },
    { x: 0, y: 1.0, z: -38, yaw: 0 }
  ]
};

export function getTeamSpawn(team: 'blue' | 'red', index: number, mapName?: string) {
  if (mapName === 'Cyber Spire') {
    const list = team === 'blue'
      ? [{ x: -3, y: 4.0, z: 22, yaw: Math.PI }, { x: 3, y: 4.0, z: 22, yaw: Math.PI }, { x: 0, y: 4.0, z: 20, yaw: Math.PI }]
      : [{ x: -3, y: 4.0, z: -22, yaw: 0 }, { x: 3, y: 4.0, z: -22, yaw: 0 }, { x: 0, y: 4.0, z: -20, yaw: 0 }];
    return list[index % list.length];
  }
  if (mapName === 'Quantum Lab') {
    const list = team === 'blue'
      ? [{ x: -22, y: 1.0, z: -3, yaw: Math.PI / 2 }, { x: -22, y: 1.0, z: 3, yaw: Math.PI / 2 }]
      : [{ x: 22, y: 1.0, z: -3, yaw: -Math.PI / 2 }, { x: 22, y: 1.0, z: 3, yaw: -Math.PI / 2 }];
    return list[index % list.length];
  }
  if (mapName === 'Magma Foundry') {
    const list = team === 'blue'
      ? [{ x: -3, y: 1.0, z: 22, yaw: Math.PI }, { x: 3, y: 1.0, z: 22, yaw: Math.PI }]
      : [{ x: -3, y: 1.0, z: -22, yaw: 0 }, { x: 3, y: 1.0, z: -22, yaw: 0 }];
    return list[index % list.length];
  }
  if (mapName === 'Subzero Station') {
    const list = team === 'blue'
      ? [{ x: -4, y: 1.0, z: 24, yaw: Math.PI }, { x: 4, y: 1.0, z: 24, yaw: Math.PI }]
      : [{ x: -4, y: 1.0, z: -24, yaw: 0 }, { x: 4, y: 1.0, z: -24, yaw: 0 }];
    return list[index % list.length];
  }
  if (mapName === 'Sky Sanctuary') {
    const list = team === 'blue'
      ? [{ x: -3, y: 1.0, z: 26, yaw: Math.PI }, { x: 3, y: 1.0, z: 26, yaw: Math.PI }]
      : [{ x: -3, y: 1.0, z: -26, yaw: 0 }, { x: 3, y: 1.0, z: -26, yaw: 0 }];
    return list[index % list.length];
  }

  const list = TEAM_SPAWNS[team];
  return list[index % list.length];
}

export const POWERUPS: Record<PowerupType, PowerupDefinition> = {
  shield: {
    id: 'shield',
    name: 'Overcharge Shield',
    tier: 1,
    requiredStreak: 2,
    durationSec: 25,
    icon: '⚡',
    description: '+50 Temporary Overshield absorbing damage'
  },
  speed: {
    id: 'speed',
    name: 'Hyper Sprint',
    tier: 1,
    requiredStreak: 2,
    durationSec: 10,
    icon: '🚀',
    description: '+40% Run & Slide speed boost with particle trail'
  },
  quad_damage: {
    id: 'quad_damage',
    name: 'Quad Plasma',
    tier: 2,
    requiredStreak: 4,
    durationSec: 8,
    icon: '🔥',
    description: 'Double (2x) weapon firepower damage'
  },
  rapid_mag: {
    id: 'rapid_mag',
    name: 'Instant Core Refill',
    tier: 2,
    requiredStreak: 4,
    durationSec: 12,
    icon: '⚡',
    description: 'Instantly refills all magazines with 0s reload'
  },
  radar: {
    id: 'radar',
    name: 'Tactical Radar',
    tier: 3,
    requiredStreak: 6,
    durationSec: 10,
    icon: '🎯',
    description: 'Thermal vision outlines enemies through buildings'
  },
  phase_shift: {
    id: 'phase_shift',
    name: 'Phase Cloak',
    tier: 3,
    requiredStreak: 6,
    durationSec: 5,
    icon: '🛡️',
    description: '80% cloaking transparency & 50% damage reduction'
  },
  airstrike: {
    id: 'airstrike',
    name: 'Kinetic Strike',
    tier: 3,
    requiredStreak: 6,
    durationSec: 3,
    icon: '💥',
    description: 'Calls an orbital kinetic strike at crosshair target'
  }
};

export interface BotArchetype {
  role: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss';
  namePrefix: string;
  weapon: WeaponType;
  maxHp: number;
  shieldHp: number;
  speed: number;
  preferredRange: number;
  fireCooldown: number;
  burstCount: number;
  accuracy: number;
  outfitIndex: number;
  color: string;
}

export const BOT_ARCHETYPES: Record<string, BotArchetype> = {
  scout: {
    role: 'scout',
    namePrefix: '🤖 Cyber Scout',
    weapon: 'rifle',
    maxHp: 60,
    shieldHp: 0,
    speed: 4.0,
    preferredRange: 14,
    fireCooldown: 2.0,
    burstCount: 2,
    accuracy: 0.22,
    outfitIndex: 0,
    color: '#ff4466'
  },
  rusher: {
    role: 'rusher',
    namePrefix: '⚡ Blade Rusher',
    weapon: 'katana',
    maxHp: 65,
    shieldHp: 0,
    speed: 4.5,
    preferredRange: 2.0,
    fireCooldown: 1.8,
    burstCount: 1,
    accuracy: 0.5,
    outfitIndex: 2,
    color: '#ffaa00'
  },
  heavy: {
    role: 'heavy',
    namePrefix: '🛡️ Enforcer Heavy',
    weapon: 'shotgun',
    maxHp: 85,
    shieldHp: 20,
    speed: 2.8,
    preferredRange: 6.0,
    fireCooldown: 2.5,
    burstCount: 1,
    accuracy: 0.3,
    outfitIndex: 1,
    color: '#a855f7'
  },
  sniper: {
    role: 'sniper',
    namePrefix: '🎯 Ghost Sniper',
    weapon: 'sniper',
    maxHp: 50,
    shieldHp: 0,
    speed: 3.0,
    preferredRange: 24,
    fireCooldown: 3.8,
    burstCount: 1,
    accuracy: 0.35,
    outfitIndex: 3,
    color: '#00ffff'
  },
  boss: {
    role: 'boss',
    namePrefix: '💀 TITAN BOSS',
    weapon: 'rifle',
    maxHp: 200,
    shieldHp: 50,
    speed: 3.8,
    preferredRange: 11,
    fireCooldown: 2.0,
    burstCount: 3,
    accuracy: 0.35,
    outfitIndex: 1,
    color: '#ff0033'
  }
};

export const WAVE_INTERMISSION_SECONDS = 5;

export interface WaveDefinition {
  waveNumber: number;
  bots: { role: 'scout' | 'rusher' | 'heavy' | 'sniper' | 'boss'; count: number }[];
}

export function getWaveConfig(waveNum: number): WaveDefinition {
  if (waveNum === 1) {
    // Gentle warm-up: 2 introductory scouts
    return {
      waveNumber: 1,
      bots: [{ role: 'scout', count: 2 }]
    };
  }
  if (waveNum === 2) {
    // Target practice: 3 scouts
    return {
      waveNumber: 2,
      bots: [{ role: 'scout', count: 3 }]
    };
  }
  if (waveNum === 3) {
    // Introduce melee threat: 2 scouts + 1 blade rusher
    return {
      waveNumber: 3,
      bots: [
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 1 }
      ]
    };
  }
  if (waveNum === 4) {
    // Introduce shotgun heavy: 2 scouts, 1 rusher, 1 heavy
    return {
      waveNumber: 4,
      bots: [
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 1 },
        { role: 'heavy', count: 1 }
      ]
    };
  }
  if (waveNum === 5) {
    // Introduce long-range sniper: 2 scouts, 1 rusher, 1 sniper
    return {
      waveNumber: 5,
      bots: [
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 1 },
        { role: 'sniper', count: 1 }
      ]
    };
  }
  if (waveNum === 6) {
    // Mid-game Mini-Boss encounter!
    return {
      waveNumber: 6,
      bots: [
        { role: 'boss', count: 1 },
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 1 }
      ]
    };
  }
  if (waveNum === 7) {
    return {
      waveNumber: 7,
      bots: [
        { role: 'scout', count: 3 },
        { role: 'rusher', count: 2 },
        { role: 'heavy', count: 1 }
      ]
    };
  }
  if (waveNum === 8) {
    return {
      waveNumber: 8,
      bots: [
        { role: 'scout', count: 3 },
        { role: 'rusher', count: 2 },
        { role: 'heavy', count: 1 },
        { role: 'sniper', count: 1 }
      ]
    };
  }
  if (waveNum === 9) {
    return {
      waveNumber: 9,
      bots: [
        { role: 'scout', count: 4 },
        { role: 'rusher', count: 2 },
        { role: 'heavy', count: 2 },
        { role: 'sniper', count: 1 }
      ]
    };
  }
  if (waveNum === 10) {
    // Grand Finale Boss Battle!
    return {
      waveNumber: 10,
      bots: [
        { role: 'boss', count: 1 },
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 2 },
        { role: 'heavy', count: 1 },
        { role: 'sniper', count: 1 }
      ]
    };
  }
  // Wave 11+: smoothly scaled endless mode
  const baseCount = 6 + (waveNum - 10);
  const isBossWave = waveNum % 5 === 0;
  return {
    waveNumber: waveNum,
    bots: [
      ...(isBossWave ? [{ role: 'boss' as const, count: 1 }] : []),
      { role: 'scout' as const, count: Math.max(2, Math.floor(baseCount * 0.35)) },
      { role: 'rusher' as const, count: Math.max(1, Math.floor(baseCount * 0.25)) },
      { role: 'heavy' as const, count: Math.max(1, Math.floor(baseCount * 0.2)) },
      { role: 'sniper' as const, count: Math.max(1, Math.floor(baseCount * 0.2)) }
    ]
  };
}

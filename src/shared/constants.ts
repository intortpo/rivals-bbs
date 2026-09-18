import { PowerupDefinition, PowerupType, TeamColor, WeaponStats, WeaponType } from './types.js';

export const WEAPONS: Record<WeaponType, WeaponStats> = {
  rifle: {
    type: 'rifle',
    name: 'Assault Blaster Mk-I',
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
    name: 'Scatter Blaster Heavy',
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
    name: 'Longshot Blaster Rifle',
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
    name: 'Pulse Blaster Sidearm',
    damage: 75,
    headshotMultiplier: 1.0,
    fireRate: 0.45,
    magazineSize: 1, // melee/sidearm doesn't reload
    reloadTime: 0.1,
    automatic: false,
    spread: 0.0,
    range: 4.0,
    adsZoomFov: 70,
    icon: '⚡'
  },
  needle_carbine: {
    type: 'needle_carbine',
    name: 'Needler Blaster Carbine',
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
    name: 'Plasma Cannon Blaster',
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
    name: 'Hyper-Rail Blaster',
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
    name: 'Arc Disruptor Blaster',
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

export const MAP_NAMES = [
  'Cyber Spire',
  'Skyline Penthouse',
  'Sky Sanctuary',
  'Solar Relay',
  'Orbital Station',
  'Arena TDM'
] as const;

export const MOVEMENT = {
  WALK_SPEED: 8.5,
  SLIDE_INITIAL_SPEED: 16.0,
  SLIDE_FRICTION: 12.0,
  SLIDE_MIN_SPEED: 4.5,
  SLIDE_DURATION_MAX: 0.85,
  JUMP_VELOCITY: 11.5,
  SLIDE_JUMP_BOOST: 1.2,
  GRAVITY: 28.0,
  AIR_ACCEL: 18.0,
  AIR_MAX_SPEED: 8.5,
  AIR_DRAG: 0.985,
  PLAYER_HEIGHT: 1.28,
  PLAYER_SLIDE_HEIGHT: 0.70,
  PLAYER_RADIUS: 0.38,
  EYE_HEIGHT: 1.08,
  SLIDE_EYE_HEIGHT: 0.55,
  CLIMB_SPEED: 4.8,
  GRAPPLE_MAX_DIST: 48.0,
  GRAPPLE_PULL_SPEED: 26.0,
  GRAPPLE_PULL_ACCEL: 55.0,
  GRAPPLE_SLINGSHOT_BOOST: 1.35,
  GRAPPLE_COOLDOWN_SEC: 3.5,
  GRAPPLE_DETACH_DIST: 2.2
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
  { x: -18, y: 0.0, z: -18, yaw: Math.PI / 4 },
  { x: 18, y: 0.0, z: 18, yaw: -3 * Math.PI / 4 },
  { x: -18, y: 0.0, z: 18, yaw: -Math.PI / 4 },
  { x: 18, y: 0.0, z: -18, yaw: 3 * Math.PI / 4 },
  { x: 0, y: 0.0, z: -14, yaw: 0 },
  { x: 0, y: 0.0, z: 14, yaw: Math.PI }
];

export const CITY_SPAWNS = [
  { x: 0, y: 0.0, z: 0, yaw: 0 }, // Central Fountain Plaza
  { x: 0, y: 0.0, z: -48, yaw: 0 }, // North Boulevard
  { x: 0, y: 0.0, z: 48, yaw: Math.PI }, // South Avenue
  { x: -35, y: 0.0, z: 0, yaw: Math.PI / 2 }, // West Station
  { x: 35, y: 0.0, z: 0, yaw: -Math.PI / 2 }, // East Tower
  { x: 0, y: 0.0, z: 24, yaw: Math.PI } // South Avenue Plaza
];

export const CYBER_SPIRE_SPAWNS = [
  { x: 0, y: 0.0, z: -5, yaw: 0 }, // Lower Plaza North
  { x: 0, y: 0.0, z: 5, yaw: Math.PI }, // Lower Plaza South
  { x: 0, y: 3.0, z: -19, yaw: 0 }, // North Tower Deck
  { x: 0, y: 3.0, z: 19, yaw: Math.PI }, // South Tower Deck
  { x: -20, y: 2.0, z: 3, yaw: Math.PI / 2 }, // West Helipad
  { x: 20, y: 2.0, z: 3, yaw: -Math.PI / 2 }, // East Deck
  { x: 2.2, y: 10.0, z: 0, yaw: -Math.PI / 2 } // High Spire Perch
];

export const QUANTUM_LAB_SPAWNS = [
  { x: -22, y: 0.0, z: 0, yaw: Math.PI / 2 }, // West Lab Bay
  { x: 22, y: 0.0, z: 0, yaw: -Math.PI / 2 }, // East Lab Bay
  { x: 0, y: 0.0, z: -22, yaw: 0 }, // North Access
  { x: 0, y: 0.0, z: 22, yaw: Math.PI }, // South Access
  { x: 0, y: 3.5, z: 3.8, yaw: 0 }, // Observation Deck
  { x: -14, y: 0.0, z: 12, yaw: -Math.PI / 4 },
  { x: 14, y: 0.0, z: -12, yaw: 3 * Math.PI / 4 }
];

export const MAGMA_FOUNDRY_SPAWNS = [
  { x: 0, y: 0.0, z: -18, yaw: 0 }, // North Furnace Platform
  { x: 0, y: 0.0, z: 18, yaw: Math.PI }, // South Furnace Platform
  { x: -19, y: 0.0, z: 4, yaw: Math.PI / 2 }, // West Slag Pour
  { x: 19, y: 0.0, z: 4, yaw: -Math.PI / 2 }, // East Tank
  { x: 4.5, y: 0.0, z: 4.5, yaw: -3 * Math.PI / 4 }, // Central Crucible Deck
  { x: 0, y: 4.5, z: 6, yaw: Math.PI } // High Crane Gantry
];

export const SUBZERO_STATION_SPAWNS = [
  { x: 0, y: 0.0, z: -24, yaw: 0 }, // North Bunker
  { x: 0, y: 0.0, z: 24, yaw: Math.PI }, // South Depot
  { x: -20, y: 0.0, z: 0, yaw: Math.PI / 2 }, // West Trench
  { x: 20, y: 0.0, z: 0, yaw: -Math.PI / 2 }, // East Container Yard
  { x: 0, y: 4.0, z: 4.2, yaw: 0 }, // Radar Roof Terrace
  { x: -16, y: 0.0, z: -16, yaw: Math.PI / 4 }
];

export const SKY_SANCTUARY_SPAWNS = [
  { x: 0, y: 0.0, z: -8, yaw: 0 }, // Central Shrine North Lawn
  { x: 0, y: 0.0, z: -26, yaw: 0 }, // North Cloud Garden
  { x: 0, y: 0.0, z: 26, yaw: Math.PI }, // South Cloud Garden
  { x: -26, y: 0.0, z: 3.5, yaw: Math.PI / 2 }, // West Meditation Terrace
  { x: 26, y: 0.0, z: 3.5, yaw: -Math.PI / 2 }, // East Bell Tower
  { x: 0, y: 0.0, z: 8, yaw: Math.PI } // Central Shrine South Lawn
];

export const FACILITY_SPAWNS = [
  { x: -22, y: 0.0, z: -18, yaw: Math.PI / 4 },
  { x: 22, y: 0.0, z: 18, yaw: -3 * Math.PI / 4 },
  { x: -18, y: 0.0, z: 18, yaw: 3 * Math.PI / 4 },
  { x: 18, y: 0.0, z: -18, yaw: -Math.PI / 4 },
  { x: 0, y: 3.5, z: 0, yaw: 0 },             // Central high catwalk
  { x: 0, y: 3.5, z: -10, yaw: Math.PI },     // North catwalk overlook
  { x: 0, y: 3.5, z: 10, yaw: 0 },            // South catwalk overlook
  { x: 0, y: 0.0, z: 0, yaw: Math.PI / 2 }    // Ground central arena
];

export const NEON_WAREHOUSE_SPAWNS = [
  { x: -22, y: 0.0, z: -22, yaw: Math.PI / 4 },
  { x: 22, y: 0.0, z: 22, yaw: -3 * Math.PI / 4 },
  { x: -22, y: 0.0, z: 22, yaw: 3 * Math.PI / 4 },
  { x: 22, y: 0.0, z: -22, yaw: -Math.PI / 4 },
  { x: 0, y: 3.7, z: 0, yaw: 0 },              // Central conveyor gantry
  { x: 0, y: 3.7, z: -8, yaw: Math.PI },       // North gantry overlook
  { x: 0, y: 3.7, z: 8, yaw: 0 },              // South gantry overlook
  { x: 0, y: 0.0, z: 0, yaw: Math.PI / 2 }     // Central ground bay
];

export const ORBITAL_STATION_SPAWNS = [
  { x: -20, y: 0.0, z: 0, yaw: Math.PI / 2 },
  { x: 20, y: 0.0, z: 0, yaw: -Math.PI / 2 },
  { x: 0, y: 0.0, z: -20, yaw: 0 },
  { x: 0, y: 0.0, z: 20, yaw: Math.PI },
  { x: -12, y: 3.9, z: -15, yaw: Math.PI / 4 },   // Vantage deck North
  { x: 12, y: 3.9, z: 15, yaw: -3 * Math.PI / 4 }, // Vantage deck South
  { x: 0, y: 0.0, z: -16, yaw: 0 },              // North observation walkway
  { x: -15, y: 0.0, z: 15, yaw: Math.PI / 3 }     // West corridor
];

export const BIODOME_SPAWNS = [
  { x: -24, y: 0.0, z: -24, yaw: Math.PI / 4 },
  { x: 24, y: 0.0, z: 24, yaw: -3 * Math.PI / 4 },
  { x: -24, y: 0.0, z: 24, yaw: 3 * Math.PI / 4 },
  { x: 24, y: 0.0, z: -24, yaw: -Math.PI / 4 },
  { x: 0, y: 0.0, z: -26, yaw: 0 },
  { x: 0, y: 0.0, z: 26, yaw: Math.PI },
  { x: -26, y: 0.0, z: 0, yaw: Math.PI / 2 },
  { x: 26, y: 0.0, z: 0, yaw: -Math.PI / 2 }
];

export const METRO_UNDERPASS_SPAWNS = [
  { x: -18, y: 1.2, z: -20, yaw: Math.PI / 2 },
  { x: -18, y: 1.2, z: 20, yaw: Math.PI / 2 },
  { x: -18, y: 1.2, z: 0, yaw: Math.PI / 2 },
  { x: 18, y: 1.2, z: -20, yaw: -Math.PI / 2 },
  { x: 18, y: 1.2, z: 20, yaw: -Math.PI / 2 },
  { x: 18, y: 1.2, z: 0, yaw: -Math.PI / 2 },
  { x: 0, y: 0.0, z: -2, yaw: 0 },
  { x: 0, y: 0.0, z: 2, yaw: Math.PI }
];

export const SUNKEN_ATOLL_SPAWNS = [
  { x: 0, y: 1.6, z: 0, yaw: 0 },
  { x: -20, y: 2.0, z: -5, yaw: Math.PI / 2 },
  { x: -20, y: 2.0, z: 5, yaw: Math.PI / 2 },
  { x: 20, y: 2.0, z: -5, yaw: -Math.PI / 2 },
  { x: 20, y: 2.0, z: 5, yaw: -Math.PI / 2 },
  { x: -10, y: 0.0, z: -15, yaw: Math.PI / 4 },
  { x: 10, y: 0.0, z: 15, yaw: -3 * Math.PI / 4 },
  { x: 0, y: 0.0, z: -14, yaw: 0 }
];

export const SCRAPYARD_CANYON_SPAWNS = [
  { x: 8, y: 5.0, z: 0, yaw: -Math.PI / 2 },
  { x: -8, y: 5.0, z: 0, yaw: Math.PI / 2 },
  { x: 0, y: 0.0, z: -20, yaw: 0 },
  { x: 0, y: 0.0, z: 20, yaw: Math.PI },
  { x: -16, y: 0.0, z: 0, yaw: Math.PI / 2 },
  { x: 16, y: 0.0, z: 0, yaw: -Math.PI / 2 },
  { x: -18, y: 0.0, z: -22, yaw: Math.PI / 4 },
  { x: 18, y: 0.0, z: 22, yaw: -3 * Math.PI / 4 }
];

export const SOLAR_RELAY_SPAWNS = [
  { x: -5, y: 0.0, z: 0, yaw: Math.PI / 2 },
  { x: 5, y: 0.0, z: 0, yaw: -Math.PI / 2 },
  { x: -20, y: 2.5, z: -5, yaw: 0 },
  { x: -20, y: 2.5, z: 5, yaw: Math.PI },
  { x: 20, y: 2.5, z: -5, yaw: 0 },
  { x: 20, y: 2.5, z: 5, yaw: Math.PI },
  { x: 0, y: 3.5, z: -22, yaw: 0 },
  { x: 0, y: 3.5, z: 22, yaw: Math.PI }
];

export const SKYLINE_PENTHOUSE_SPAWNS = [
  { x: 14, y: 0.0, z: 0, yaw: 0 },
  { x: 14, y: 0.0, z: -14, yaw: 0 },
  { x: 14, y: 0.0, z: 14, yaw: Math.PI },
  { x: -4, y: 0.0, z: -14, yaw: Math.PI / 4 },
  { x: -4, y: 0.0, z: 14, yaw: -3 * Math.PI / 4 },
  { x: -16, y: 4.0, z: -12, yaw: 0 },
  { x: -16, y: 4.0, z: 12, yaw: Math.PI },
  { x: 4, y: 0.0, z: 0, yaw: -Math.PI / 2 }
];

export const SKY_ISLANDS_SPAWNS = [

  { x: 0, y: 3.0, z: -6, yaw: 0 },

  { x: 0, y: 3.0, z: 6, yaw: Math.PI },

  { x: 6, y: 3.0, z: 0, yaw: -Math.PI / 2 },

  { x: -6, y: 3.0, z: 0, yaw: Math.PI / 2 },

  { x: 0, y: -2.0, z: -35, yaw: 0 },

  { x: 0, y: 14.0, z: 35, yaw: Math.PI },

  { x: 40, y: 16.0, z: 0, yaw: Math.PI / 2 },
  { x: 20, y: 6.0, z: 0, yaw: Math.PI / 2 }
];

export const ARENA_TDM_SPAWNS = [
  { x: -4.0, y: 0.0, z: 12.0, yaw: Math.PI },       // North Courtyard spawn
  { x: 4.0, y: 0.0, z: -12.0, yaw: 0 },            // South Courtyard spawn
  { x: -10.5, y: 0.0, z: -16.0, yaw: Math.PI / 4 }, // South-West Flank
  { x: 10.5, y: 0.0, z: 16.0, yaw: -3 * Math.PI / 4 }, // North-East Flank
  { x: -8.0, y: 3.2, z: 0.0, yaw: Math.PI / 2 },    // West Walkway Gantries (Elevated)
  { x: 8.0, y: 3.2, z: 0.0, yaw: -Math.PI / 2 },    // East Walkway Gantries (Elevated)
  { x: 0.0, y: 0.0, z: 0.0, yaw: 0 },              // Center Arena Intersection
  { x: 0.0, y: 3.2, z: -6.0, yaw: 0 }             // South Bridge Overlook (Elevated)
];

export function getMapSpawns(mapName?: string) {
  switch (mapName) {
    case 'Cyber Spire':
      return CYBER_SPIRE_SPAWNS;
    case 'Skyline Penthouse':
    case 'Skyline Penthouse (Vertigo Lounge)':
      return SKYLINE_PENTHOUSE_SPAWNS;
    case 'Sky Sanctuary':
      return SKY_SANCTUARY_SPAWNS;
    case 'Solar Relay':
    case 'Solar Relay (Helios Mirror Array)':
      return SOLAR_RELAY_SPAWNS;
    case 'Orbital Station':
      return ORBITAL_STATION_SPAWNS;
    case 'Arena TDM':
    case 'Arena TDM (Tactical)':
      return ARENA_TDM_SPAWNS;
    case 'Facility':
      return FACILITY_SPAWNS;
    case 'Cartoon City':
      return CITY_SPAWNS;
    case 'Arena Classic':
      return MAP_SPAWNS;
    case 'Neon Warehouse':
      return NEON_WAREHOUSE_SPAWNS;
    case 'Quantum Lab':
      return QUANTUM_LAB_SPAWNS;
    case 'Magma Foundry':
      return MAGMA_FOUNDRY_SPAWNS;
    case 'Subzero Station':
      return SUBZERO_STATION_SPAWNS;
    case 'Bio-Dome':
      return BIODOME_SPAWNS;
    case 'Metro Underpass':
      return METRO_UNDERPASS_SPAWNS;
    case 'Sunken Atoll':
      return SUNKEN_ATOLL_SPAWNS;
    case 'Scrapyard Canyon':
      return SCRAPYARD_CANYON_SPAWNS;
    default:
      return CYBER_SPIRE_SPAWNS;
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
    { x: -6, y: 0.0, z: 38, yaw: Math.PI },
    { x: 0, y: 0.0, z: 36, yaw: Math.PI },
    { x: 6, y: 0.0, z: 38, yaw: Math.PI },
    { x: 0, y: 0.0, z: 32, yaw: Math.PI }
  ],
  red: [
    { x: -6, y: 0.0, z: -38, yaw: 0 },
    { x: 0, y: 0.0, z: -36, yaw: 0 },
    { x: 6, y: 0.0, z: -38, yaw: 0 },
    { x: 0, y: 0.0, z: -32, yaw: 0 }
  ]
};

export function getTeamSpawn(team: 'blue' | 'red', index: number, mapName?: string) {
  if (mapName === 'Facility') {
    const list = team === 'blue'
      ? [
          { x: -24, y: 0.0, z: -4, yaw: Math.PI / 2 },
          { x: -24, y: 0.0, z: 4, yaw: Math.PI / 2 },
          { x: -20, y: 0.0, z: 0, yaw: Math.PI / 2 },
          { x: -26, y: 0.0, z: 0, yaw: Math.PI / 2 }
        ]
      : [
          { x: 24, y: 0.0, z: 4, yaw: -Math.PI / 2 },
          { x: 24, y: 0.0, z: -4, yaw: -Math.PI / 2 },
          { x: 20, y: 0.0, z: 0, yaw: -Math.PI / 2 },
          { x: 26, y: 0.0, z: 0, yaw: -Math.PI / 2 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Cartoon City') {
    const list = team === 'blue'
      ? [
          { x: -6, y: 0.0, z: 44, yaw: Math.PI },
          { x: 0, y: 0.0, z: 46, yaw: Math.PI },
          { x: 6, y: 0.0, z: 44, yaw: Math.PI },
          { x: 0, y: 0.0, z: 38, yaw: Math.PI }
        ]
      : [
          { x: -6, y: 0.0, z: -44, yaw: 0 },
          { x: 0, y: 0.0, z: -46, yaw: 0 },
          { x: 6, y: 0.0, z: -44, yaw: 0 },
          { x: 0, y: 0.0, z: -38, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Arena Classic') {
    const list = team === 'blue'
      ? [
          { x: -6, y: 0.0, z: 38, yaw: Math.PI },
          { x: 0, y: 0.0, z: 36, yaw: Math.PI },
          { x: 6, y: 0.0, z: 38, yaw: Math.PI },
          { x: 0, y: 0.0, z: 32, yaw: Math.PI }
        ]
      : [
          { x: -6, y: 0.0, z: -38, yaw: 0 },
          { x: 0, y: 0.0, z: -36, yaw: 0 },
          { x: 6, y: 0.0, z: -38, yaw: 0 },
          { x: 0, y: 0.0, z: -32, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Neon Warehouse') {
    const list = team === 'blue'
      ? [
          { x: -6, y: 0.0, z: 40, yaw: Math.PI },
          { x: 0, y: 0.0, z: 42, yaw: Math.PI },
          { x: 6, y: 0.0, z: 40, yaw: Math.PI },
          { x: 0, y: 0.0, z: 34, yaw: Math.PI }
        ]
      : [
          { x: -6, y: 0.0, z: -40, yaw: 0 },
          { x: 0, y: 0.0, z: -42, yaw: 0 },
          { x: 6, y: 0.0, z: -40, yaw: 0 },
          { x: 0, y: 0.0, z: -34, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Cyber Spire') {
    const list = team === 'blue'
      ? [
          { x: -3, y: 3.0, z: 19, yaw: Math.PI },
          { x: 3, y: 3.0, z: 19, yaw: Math.PI },
          { x: 0, y: 3.0, z: 18, yaw: Math.PI },
          { x: 0, y: 3.0, z: 25, yaw: 0 }
        ]
      : [
          { x: -3, y: 3.0, z: -19, yaw: 0 },
          { x: 3, y: 3.0, z: -19, yaw: 0 },
          { x: 0, y: 3.0, z: -18, yaw: 0 },
          { x: 0, y: 3.0, z: -25, yaw: Math.PI }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Quantum Lab') {
    const list = team === 'blue'
      ? [
          { x: -22, y: 0.0, z: 1.5, yaw: Math.PI / 2 },
          { x: -22, y: 0.0, z: -0.5, yaw: Math.PI / 2 },
          { x: -25, y: 0.0, z: 2.5, yaw: Math.PI / 2 },
          { x: -19, y: 0.0, z: 0.0, yaw: Math.PI / 2 }
        ]
      : [
          { x: 22, y: 0.0, z: -1.5, yaw: -Math.PI / 2 },
          { x: 22, y: 0.0, z: 0.5, yaw: -Math.PI / 2 },
          { x: 25, y: 0.0, z: -2.5, yaw: -Math.PI / 2 },
          { x: 19, y: 0.0, z: 0.0, yaw: -Math.PI / 2 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Magma Foundry') {
    const list = team === 'blue'
      ? [
          { x: -5, y: 0.0, z: 19, yaw: Math.PI },
          { x: 5, y: 0.0, z: 19, yaw: Math.PI },
          { x: 0, y: 0.0, z: 18, yaw: Math.PI },
          { x: -4, y: 0.0, z: 26, yaw: Math.PI }
        ]
      : [
          { x: -5, y: 0.0, z: -19, yaw: 0 },
          { x: 5, y: 0.0, z: -19, yaw: 0 },
          { x: 0, y: 0.0, z: -18, yaw: 0 },
          { x: -4, y: 0.0, z: -26, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Subzero Station') {
    const list = team === 'blue'
      ? [
          { x: -4, y: 0.0, z: 24, yaw: Math.PI },
          { x: 4, y: 0.0, z: 24, yaw: Math.PI },
          { x: 0, y: 0.0, z: 26, yaw: Math.PI },
          { x: 0, y: 0.0, z: 28, yaw: Math.PI }
        ]
      : [
          { x: -4, y: 0.0, z: -24, yaw: 0 },
          { x: 4, y: 0.0, z: -24, yaw: 0 },
          { x: 0, y: 0.0, z: -26, yaw: 0 },
          { x: 0, y: 0.0, z: -28, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Sky Sanctuary') {
    const list = team === 'blue'
      ? [
          { x: -3, y: 0.0, z: 26, yaw: Math.PI },
          { x: 3, y: 0.0, z: 26, yaw: Math.PI },
          { x: 0, y: 0.0, z: 24, yaw: Math.PI },
          { x: 0, y: 0.0, z: 28, yaw: Math.PI }
        ]
      : [
          { x: -3, y: 0.0, z: -26, yaw: 0 },
          { x: 3, y: 0.0, z: -26, yaw: 0 },
          { x: 0, y: 0.0, z: -24, yaw: 0 },
          { x: 0, y: 0.0, z: -28, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Orbital Station') {
    const list = team === 'blue'
      ? [
          { x: -22, y: 0.0, z: -4, yaw: Math.PI / 2 },
          { x: -22, y: 0.0, z: 4, yaw: Math.PI / 2 },
          { x: -18, y: 0.0, z: 0, yaw: Math.PI / 2 },
          { x: -24, y: 0.0, z: 0, yaw: Math.PI / 2 }
        ]
      : [
          { x: 22, y: 0.0, z: 4, yaw: -Math.PI / 2 },
          { x: 22, y: 0.0, z: -4, yaw: -Math.PI / 2 },
          { x: 18, y: 0.0, z: 0, yaw: -Math.PI / 2 },
          { x: 24, y: 0.0, z: 0, yaw: -Math.PI / 2 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Bio-Dome' || mapName === 'Bio-Dome (Neo Arboretum)') {
    const list = team === 'blue'
      ? [
          { x: -4, y: 0.0, z: 26, yaw: Math.PI },
          { x: 4, y: 0.0, z: 26, yaw: Math.PI },
          { x: 0, y: 0.0, z: 28, yaw: Math.PI },
          { x: 0, y: 0.0, z: 24, yaw: Math.PI }
        ]
      : [
          { x: -4, y: 0.0, z: -26, yaw: 0 },
          { x: 4, y: 0.0, z: -26, yaw: 0 },
          { x: 0, y: 0.0, z: -28, yaw: 0 },
          { x: 0, y: 0.0, z: -24, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Metro Underpass' || mapName === 'Metro Underpass (Neon Subways)') {
    const list = team === 'blue'
      ? [
          { x: -18, y: 1.2, z: 20, yaw: Math.PI / 2 },
          { x: -18, y: 1.2, z: 24, yaw: Math.PI / 2 },
          { x: -20, y: 1.2, z: 22, yaw: Math.PI / 2 },
          { x: -16, y: 1.2, z: 22, yaw: Math.PI / 2 }
        ]
      : [
          { x: 18, y: 1.2, z: -20, yaw: -Math.PI / 2 },
          { x: 18, y: 1.2, z: -24, yaw: -Math.PI / 2 },
          { x: 20, y: 1.2, z: -22, yaw: -Math.PI / 2 },
          { x: 16, y: 1.2, z: -22, yaw: -Math.PI / 2 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Sunken Atoll' || mapName === 'Sunken Atoll (Ancient Coral Ruins)') {
    const list = team === 'blue'
      ? [
          { x: -4, y: 0.0, z: 28, yaw: Math.PI },
          { x: 4, y: 0.0, z: 28, yaw: Math.PI },
          { x: 0, y: 0.0, z: 29, yaw: Math.PI },
          { x: 0, y: 0.0, z: 27, yaw: Math.PI }
        ]
      : [
          { x: -4, y: 0.0, z: -28, yaw: 0 },
          { x: 4, y: 0.0, z: -28, yaw: 0 },
          { x: 0, y: 0.0, z: -29, yaw: 0 },
          { x: 0, y: 0.0, z: -27, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Scrapyard Canyon' || mapName === 'Scrapyard Canyon (Rust Basin)') {
    const list = team === 'blue'
      ? [
          { x: -4, y: 0.0, z: 20, yaw: Math.PI },
          { x: 4, y: 0.0, z: 20, yaw: Math.PI },
          { x: 0, y: 0.0, z: 22, yaw: Math.PI },
          { x: 0, y: 0.0, z: 18, yaw: Math.PI }
        ]
      : [
          { x: -4, y: 0.0, z: -20, yaw: 0 },
          { x: 4, y: 0.0, z: -20, yaw: 0 },
          { x: 0, y: 0.0, z: -22, yaw: 0 },
          { x: 0, y: 0.0, z: -18, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Solar Relay' || mapName === 'Solar Relay (Helios Mirror Array)') {
    const list = team === 'blue'
      ? [
          { x: -3, y: 3.5, z: 22, yaw: Math.PI },
          { x: 3, y: 3.5, z: 22, yaw: Math.PI },
          { x: 0, y: 3.5, z: 20, yaw: Math.PI },
          { x: 0, y: 3.5, z: 24, yaw: Math.PI }
        ]
      : [
          { x: -3, y: 3.5, z: -22, yaw: 0 },
          { x: 3, y: 3.5, z: -22, yaw: 0 },
          { x: 0, y: 3.5, z: -20, yaw: 0 },
          { x: 0, y: 3.5, z: -24, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Skyline Penthouse' || mapName === 'Skyline Penthouse (Vertigo Lounge)') {
    const list = team === 'blue'
      ? [
          { x: 12, y: 0.0, z: 16, yaw: Math.PI },
          { x: 16, y: 0.0, z: 16, yaw: Math.PI },
          { x: 14, y: 0.0, z: 18, yaw: Math.PI },
          { x: 14, y: 0.0, z: 14, yaw: Math.PI }
        ]
      : [
          { x: 12, y: 0.0, z: -16, yaw: 0 },
          { x: 16, y: 0.0, z: -16, yaw: 0 },
          { x: 14, y: 0.0, z: -18, yaw: 0 },
          { x: 14, y: 0.0, z: -14, yaw: 0 }
        ];
    return list[index % list.length];
  }

  if (mapName === 'Arena TDM' || mapName === 'Arena TDM (Tactical)') {
    const list = team === 'blue'
      ? [
          { x: -4, y: 0.0, z: 14, yaw: Math.PI },
          { x: 4, y: 0.0, z: 14, yaw: Math.PI },
          { x: 0, y: 0.0, z: 16, yaw: Math.PI },
          { x: 0, y: 3.2, z: 12, yaw: Math.PI }
        ]
      : [
          { x: -4, y: 0.0, z: -14, yaw: 0 },
          { x: 4, y: 0.0, z: -14, yaw: 0 },
          { x: 0, y: 0.0, z: -16, yaw: 0 },
          { x: 0, y: 3.2, z: -12, yaw: 0 }
        ];
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
  projectileSpeed: number;
  projectileRadius: number;
  projectileColor: string;
  projectileDamage: number;
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
    preferredRange: 13,
    fireCooldown: 0.6,
    burstCount: 2,
    accuracy: 0.25,
    projectileSpeed: 22,
    projectileRadius: 0.20,
    projectileColor: '#00ffcc',
    projectileDamage: 16,
    outfitIndex: 0,
    color: '#ff4466'
  },
  rusher: {
    role: 'rusher',
    namePrefix: '⚡ Blade Rusher',
    weapon: 'katana',
    maxHp: 65,
    shieldHp: 0,
    speed: 4.8,
    preferredRange: 3.0,
    fireCooldown: 0.6,
    burstCount: 3,
    accuracy: 0.45,
    projectileSpeed: 28,
    projectileRadius: 0.18,
    projectileColor: '#ffaa00',
    projectileDamage: 18,
    outfitIndex: 2,
    color: '#ffaa00'
  },
  heavy: {
    role: 'heavy',
    namePrefix: '🛡️ Enforcer Heavy',
    weapon: 'shotgun',
    maxHp: 85,
    shieldHp: 25,
    speed: 2.6,
    preferredRange: 7.0,
    fireCooldown: 0.6,
    burstCount: 5,
    accuracy: 0.3,
    projectileSpeed: 16,
    projectileRadius: 0.26,
    projectileColor: '#a855f7',
    projectileDamage: 22,
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
    preferredRange: 26,
    fireCooldown: 0.6,
    burstCount: 1,
    accuracy: 0.4,
    projectileSpeed: 55,
    projectileRadius: 0.15,
    projectileColor: '#00e5ff',
    projectileDamage: 40,
    outfitIndex: 3,
    color: '#00ffff'
  },
  boss: {
    role: 'boss',
    namePrefix: '👑 GEOMETRIC NEXUS',
    weapon: 'plasma_launcher',
    maxHp: 320,
    shieldHp: 120,
    speed: 3.2,
    preferredRange: 14,
    fireCooldown: 0.6,
    burstCount: 16,
    accuracy: 0.5,
    projectileSpeed: 15,
    projectileRadius: 0.28,
    projectileColor: '#f43f5e',
    projectileDamage: 24,
    outfitIndex: 1,
    color: '#f43f5e'
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
    // Target practice: 2 scouts + 1 rusher
    return {
      waveNumber: 2,
      bots: [
        { role: 'scout', count: 2 },
        { role: 'rusher', count: 1 }
      ]
    };
  }
  if (waveNum === 3) {
    // Inter-Level Boss 1: Geometric Prism Construct
    return {
      waveNumber: 3,
      bots: [
        { role: 'boss', count: 1 },
        { role: 'scout', count: 1 }
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
    // Inter-Level Boss 2: Octahedron Overlord
    return {
      waveNumber: 6,
      bots: [
        { role: 'boss', count: 1 },
        { role: 'rusher', count: 1 },
        { role: 'heavy', count: 1 }
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

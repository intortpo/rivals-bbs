export interface BoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  name?: string;
}

/**
 * Fast Ray/Segment vs AABB Slab Intersection algorithm.
 * Returns true if the segment from p1 to p2 intersects the given axis-aligned bounding box.
 */
export function lineIntersectsBox(
  p1: [number, number, number],
  p2: [number, number, number],
  box: BoundingBox,
  epsilon: number = 0.02
): boolean {
  const [x1, y1, z1] = p1;
  const [x2, y2, z2] = p2;
  const [minX, minY, minZ] = box.min;
  const [maxX, maxY, maxZ] = box.max;

  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;

  let tmin = epsilon;
  let tmax = 1.0 - epsilon;

  // X slab
  if (Math.abs(dx) < 1e-6) {
    if (x1 < minX || x1 > maxX) return false;
  } else {
    const invD = 1.0 / dx;
    let t1 = (minX - x1) * invD;
    let t2 = (maxX - x1) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Y slab
  if (Math.abs(dy) < 1e-6) {
    if (y1 < minY || y1 > maxY) return false;
  } else {
    const invD = 1.0 / dy;
    let t1 = (minY - y1) * invD;
    let t2 = (maxY - y1) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  // Z slab
  if (Math.abs(dz) < 1e-6) {
    if (z1 < minZ || z1 > maxZ) return false;
  } else {
    const invD = 1.0 / dz;
    let t1 = (minZ - z1) * invD;
    let t2 = (maxZ - z1) * invD;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }

  return true;
}

/**
 * Checks whether there is an unobstructed direct line of sight between two points.
 * Returns false if any building or vehicle obstacle blocks the line of sight.
 */
export function hasLineOfSight(
  from: [number, number, number],
  to: [number, number, number],
  obstacles: BoundingBox[]
): boolean {
  const rMinX = from[0] < to[0] ? from[0] : to[0];
  const rMaxX = from[0] > to[0] ? from[0] : to[0];
  const rMinY = from[1] < to[1] ? from[1] : to[1];
  const rMaxY = from[1] > to[1] ? from[1] : to[1];
  const rMinZ = from[2] < to[2] ? from[2] : to[2];
  const rMaxZ = from[2] > to[2] ? from[2] : to[2];

  for (let i = 0; i < obstacles.length; i++) {
    const box = obstacles[i];
    // Fast broadphase AABB rejection: if ray segment bounds do not overlap obstacle, skip slab test
    if (
      box.min[0] > rMaxX || box.max[0] < rMinX ||
      box.min[1] > rMaxY || box.max[1] < rMinY ||
      box.min[2] > rMaxZ || box.max[2] < rMinZ
    ) {
      continue;
    }

    if (lineIntersectsBox(from, to, box)) {
      return false;
    }
  }
  return true;
}

export const CARTOON_CITY_OBSTACLES: BoundingBox[] = [
  {
    "min": [
      1.95,
      0.42,
      45.72
    ],
    "max": [
      3.65,
      0.98,
      50.46
    ],
    "name": "Van001-Mesh"
  },
  {
    "min": [
      1.77,
      0.14,
      45.7
    ],
    "max": [
      3.83,
      2.85,
      50.49
    ],
    "name": "Van001-Mesh_1"
  },
  {
    "min": [
      1.88,
      1.15,
      45.83
    ],
    "max": [
      3.73,
      2.33,
      49.69
    ],
    "name": "Van001-Mesh_2"
  },
  {
    "min": [
      5,
      0.13,
      -4.4
    ],
    "max": [
      6.72,
      1.57,
      -0.97
    ],
    "name": "Car_06001-Mesh"
  },
  {
    "min": [
      4.71,
      0.3,
      -4.42
    ],
    "max": [
      7.01,
      1.63,
      -0.99
    ],
    "name": "Car_06001-Mesh_1"
  },
  {
    "min": [
      4.75,
      0.93,
      -4.24
    ],
    "max": [
      6.97,
      1.52,
      -2.02
    ],
    "name": "Car_06001-Mesh_2"
  },
  {
    "min": [
      5.01,
      0.04,
      -21.03
    ],
    "max": [
      6.73,
      1.24,
      -17.06
    ],
    "name": "Car_13001-Mesh"
  },
  {
    "min": [
      4.83,
      0.05,
      -21.03
    ],
    "max": [
      6.9,
      1.26,
      -16.94
    ],
    "name": "Car_13001-Mesh_1"
  },
  {
    "min": [
      -54.97,
      0.16,
      14.02
    ],
    "max": [
      -53.51,
      1.14,
      17.45
    ],
    "name": "Car_19001-Mesh"
  },
  {
    "min": [
      -55.01,
      0.16,
      14.38
    ],
    "max": [
      -53.47,
      1.39,
      17.23
    ],
    "name": "Car_19001-Mesh_1"
  },
  {
    "min": [
      -55.01,
      0.1,
      14.01
    ],
    "max": [
      -53.47,
      1.55,
      17.4
    ],
    "name": "Car_19001-Mesh_2"
  },
  {
    "min": [
      22.87,
      0.13,
      68.68
    ],
    "max": [
      26.29,
      1.57,
      70.4
    ],
    "name": "Car_06002-Mesh"
  },
  {
    "min": [
      22.84,
      0.3,
      68.39
    ],
    "max": [
      26.28,
      1.63,
      70.68
    ],
    "name": "Car_06002-Mesh_1"
  },
  {
    "min": [
      23.02,
      0.93,
      68.42
    ],
    "max": [
      25.24,
      1.52,
      70.65
    ],
    "name": "Car_06002-Mesh_2"
  },
  {
    "min": [
      53.67,
      0.04,
      -8.39
    ],
    "max": [
      55.4,
      1.24,
      -4.43
    ],
    "name": "Car_13002-Mesh"
  },
  {
    "min": [
      53.5,
      0.05,
      -8.52
    ],
    "max": [
      55.57,
      1.26,
      -4.43
    ],
    "name": "Car_13002-Mesh_1"
  },
  {
    "min": [
      -31.79,
      0.13,
      64.72
    ],
    "max": [
      -28.37,
      1.57,
      66.44
    ],
    "name": "Car_06003-Mesh"
  },
  {
    "min": [
      -31.77,
      0.3,
      64.44
    ],
    "max": [
      -28.34,
      1.63,
      66.73
    ],
    "name": "Car_06003-Mesh_1"
  },
  {
    "min": [
      -30.74,
      0.93,
      64.47
    ],
    "max": [
      -28.52,
      1.52,
      66.7
    ],
    "name": "Car_06003-Mesh_2"
  },
  {
    "min": [
      -55.12,
      0.04,
      -47.07
    ],
    "max": [
      -53.39,
      1.24,
      -43.1
    ],
    "name": "Car_13003-Mesh"
  },
  {
    "min": [
      -55.29,
      0.05,
      -47.07
    ],
    "max": [
      -53.22,
      1.26,
      -42.98
    ],
    "name": "Car_13003-Mesh_1"
  },
  {
    "min": [
      34.03,
      0.42,
      23.2
    ],
    "max": [
      38.77,
      0.98,
      24.89
    ],
    "name": "Van002-Mesh"
  },
  {
    "min": [
      34.01,
      0.14,
      23.02
    ],
    "max": [
      38.8,
      2.85,
      25.07
    ],
    "name": "Van002-Mesh_1"
  },
  {
    "min": [
      34.14,
      1.15,
      23.12
    ],
    "max": [
      38,
      2.33,
      24.97
    ],
    "name": "Van002-Mesh_2"
  },
  {
    "min": [
      11.39,
      0.42,
      -34.56
    ],
    "max": [
      13.08,
      0.98,
      -29.82
    ],
    "name": "Van003-Mesh"
  },
  {
    "min": [
      11.21,
      0.14,
      -34.58
    ],
    "max": [
      13.26,
      2.85,
      -29.8
    ],
    "name": "Van003-Mesh_1"
  },
  {
    "min": [
      11.31,
      1.15,
      -33.79
    ],
    "max": [
      13.16,
      2.33,
      -29.93
    ],
    "name": "Van003-Mesh_2"
  },
  {
    "min": [
      -22.28,
      0.42,
      -70.21
    ],
    "max": [
      -17.54,
      0.98,
      -68.52
    ],
    "name": "Van004-Mesh"
  },
  {
    "min": [
      -22.31,
      0.14,
      -70.39
    ],
    "max": [
      -17.52,
      2.85,
      -68.34
    ],
    "name": "Van004-Mesh_1"
  },
  {
    "min": [
      -21.51,
      1.15,
      -70.29
    ],
    "max": [
      -17.65,
      2.33,
      -68.44
    ],
    "name": "Van004-Mesh_2"
  },
  {
    "min": [
      -16.83,
      0.42,
      68.41
    ],
    "max": [
      -12.09,
      0.98,
      70.1
    ],
    "name": "Van005-Mesh"
  },
  {
    "min": [
      -16.86,
      0.14,
      68.23
    ],
    "max": [
      -12.07,
      2.85,
      70.28
    ],
    "name": "Van005-Mesh_1"
  },
  {
    "min": [
      -16.72,
      1.15,
      68.33
    ],
    "max": [
      -12.86,
      2.33,
      70.18
    ],
    "name": "Van005-Mesh_2"
  },
  {
    "min": [
      49.75,
      0.13,
      -21.63
    ],
    "max": [
      51.47,
      1.57,
      -18.21
    ],
    "name": "Car_06004-Mesh"
  },
  {
    "min": [
      49.47,
      0.3,
      -21.66
    ],
    "max": [
      51.76,
      1.63,
      -18.23
    ],
    "name": "Car_06004-Mesh_1"
  },
  {
    "min": [
      49.5,
      0.93,
      -21.48
    ],
    "max": [
      51.72,
      1.52,
      -19.26
    ],
    "name": "Car_06004-Mesh_2"
  },
  {
    "min": [
      49.57,
      0.16,
      6.01
    ],
    "max": [
      51.11,
      1.39,
      8.86
    ],
    "name": "Car_19002-Mesh"
  },
  {
    "min": [
      49.57,
      0.1,
      5.64
    ],
    "max": [
      51.11,
      1.55,
      9.03
    ],
    "name": "Car_19002-Mesh_1"
  },
  {
    "min": [
      49.61,
      0.16,
      5.65
    ],
    "max": [
      51.07,
      1.14,
      9.08
    ],
    "name": "Car_19002-Mesh_3"
  },
  {
    "min": [
      5.11,
      0.16,
      -49.65
    ],
    "max": [
      6.58,
      1.14,
      -46.23
    ],
    "name": "Car_19003-Mesh"
  },
  {
    "min": [
      5.07,
      0.16,
      -49.3
    ],
    "max": [
      6.61,
      1.39,
      -46.45
    ],
    "name": "Car_19003-Mesh_1"
  },
  {
    "min": [
      5.07,
      0.1,
      -49.66
    ],
    "max": [
      6.61,
      1.55,
      -46.27
    ],
    "name": "Car_19003-Mesh_2"
  },
  {
    "min": [
      1.89,
      0.15,
      -14.48
    ],
    "max": [
      3.66,
      1.43,
      -10.8
    ],
    "name": "Car_16001-Mesh"
  },
  {
    "min": [
      1.81,
      0.15,
      -14.58
    ],
    "max": [
      3.75,
      1.48,
      -10.69
    ],
    "name": "Car_16001-Mesh_1"
  },
  {
    "min": [
      1.84,
      0.93,
      -13.29
    ],
    "max": [
      3.72,
      1.4,
      -11.81
    ],
    "name": "Car_16001-Mesh_2"
  },
  {
    "min": [
      4.83,
      0.1,
      4.7
    ],
    "max": [
      6.91,
      0.94,
      8.99
    ],
    "name": "Futuristic_Car_1001-Mesh"
  },
  {
    "min": [
      4.83,
      0.1,
      4.65
    ],
    "max": [
      6.91,
      1.6,
      9.03
    ],
    "name": "Futuristic_Car_1001-Mesh_1"
  },
  {
    "min": [
      5.11,
      1.19,
      5.35
    ],
    "max": [
      6.62,
      1.66,
      7.68
    ],
    "name": "Futuristic_Car_1001-Mesh_2"
  },
  {
    "min": [
      53.65,
      0.15,
      45.01
    ],
    "max": [
      55.42,
      1.43,
      48.7
    ],
    "name": "Car_16002-Mesh_1"
  },
  {
    "min": [
      53.57,
      0.15,
      44.91
    ],
    "max": [
      55.5,
      1.48,
      48.8
    ],
    "name": "Car_16002-Mesh_2"
  },
  {
    "min": [
      53.6,
      0.93,
      46.02
    ],
    "max": [
      55.47,
      1.4,
      47.51
    ],
    "name": "Car_16002-Mesh_3"
  },
  {
    "min": [
      53.55,
      0.1,
      -38.21
    ],
    "max": [
      55.63,
      0.94,
      -33.93
    ],
    "name": "Futuristic_Car_1002-Mesh"
  },
  {
    "min": [
      53.55,
      0.1,
      -38.26
    ],
    "max": [
      55.63,
      1.6,
      -33.87
    ],
    "name": "Futuristic_Car_1002-Mesh_1"
  },
  {
    "min": [
      53.83,
      1.19,
      -36.91
    ],
    "max": [
      55.35,
      1.66,
      -34.57
    ],
    "name": "Futuristic_Car_1002-Mesh_2"
  },
  {
    "min": [
      -51.14,
      0.15,
      33.32
    ],
    "max": [
      -49.37,
      1.43,
      37
    ],
    "name": "Car_16003-Mesh_1"
  },
  {
    "min": [
      -51.22,
      0.15,
      33.22
    ],
    "max": [
      -49.28,
      1.48,
      37.11
    ],
    "name": "Car_16003-Mesh_2"
  },
  {
    "min": [
      -51.19,
      0.93,
      34.33
    ],
    "max": [
      -49.31,
      1.4,
      35.81
    ],
    "name": "Car_16003-Mesh_3"
  },
  {
    "min": [
      -51.64,
      0.1,
      0.69
    ],
    "max": [
      -49.56,
      0.94,
      4.98
    ],
    "name": "Futuristic_Car_1003-Mesh"
  },
  {
    "min": [
      -51.64,
      0.1,
      0.65
    ],
    "max": [
      -49.56,
      1.6,
      5.04
    ],
    "name": "Futuristic_Car_1003-Mesh_1"
  },
  {
    "min": [
      -51.36,
      1.19,
      2
    ],
    "max": [
      -49.84,
      1.66,
      4.33
    ],
    "name": "Futuristic_Car_1003-Mesh_2"
  },
  {
    "min": [
      -44.81,
      0,
      42.77
    ],
    "max": [
      -6.31,
      57.39,
      62.01
    ],
    "name": "Eco_Building_Slope004-Mesh"
  },
  {
    "min": [
      -34.14,
      4.86,
      44.05
    ],
    "max": [
      -8.3,
      15.75,
      60.89
    ],
    "name": "Eco_Building_Slope004-Mesh_1"
  },
  {
    "min": [
      -43.81,
      53.97,
      45.95
    ],
    "max": [
      -39.36,
      57.12,
      55.76
    ],
    "name": "Eco_Building_Slope004-Mesh_2"
  },
  {
    "min": [
      24.03,
      0,
      -22.23
    ],
    "max": [
      42.51,
      51.74,
      8.63
    ],
    "name": "Eco_Building_Grid005-Mesh_1"
  },
  {
    "min": [
      24.17,
      0,
      -21.45
    ],
    "max": [
      41.25,
      46.23,
      7.85
    ],
    "name": "Eco_Building_Grid005-Mesh_2"
  },
  {
    "min": [
      -43.54,
      53.97,
      -43.61
    ],
    "max": [
      -39.08,
      57.12,
      -33.8
    ],
    "name": "Eco_Building_Slope005-Mesh"
  },
  {
    "min": [
      -44.53,
      0,
      -46.79
    ],
    "max": [
      -6.04,
      57.39,
      -27.55
    ],
    "name": "Eco_Building_Slope005-Mesh_1"
  },
  {
    "min": [
      -33.87,
      4.86,
      -45.52
    ],
    "max": [
      -8.03,
      15.75,
      -28.67
    ],
    "name": "Eco_Building_Slope005-Mesh_2"
  },
  {
    "min": [
      23.88,
      0,
      -63.02
    ],
    "max": [
      42.97,
      24.41,
      -24.82
    ],
    "name": "Eco_Building_Terrace008-Mesh"
  },
  {
    "min": [
      25,
      4.86,
      -61.03
    ],
    "max": [
      41.85,
      15.75,
      -35.19
    ],
    "name": "Eco_Building_Terrace008-Mesh_1"
  },
  {
    "min": [
      -33.87,
      4.86,
      -0.39
    ],
    "max": [
      -8.03,
      15.75,
      16.46
    ],
    "name": "Eco_Building_Slope001-Mesh"
  },
  {
    "min": [
      -44.53,
      0,
      -1.66
    ],
    "max": [
      -6.04,
      57.39,
      17.58
    ],
    "name": "Eco_Building_Slope001-Mesh_1"
  },
  {
    "min": [
      -43.54,
      53.97,
      1.51
    ],
    "max": [
      -39.08,
      57.12,
      11.32
    ],
    "name": "Eco_Building_Slope001-Mesh_2"
  },
  {
    "min": [
      18.41,
      0,
      31
    ],
    "max": [
      41.53,
      53.17,
      60.83
    ],
    "name": "Regular_Building_TwistedTower_Large004-Mesh"
  },
  {
    "min": [
      21.2,
      0,
      35.29
    ],
    "max": [
      40.04,
      43.8,
      58.29
    ],
    "name": "Regular_Building_TwistedTower_Large004-Mesh_1"
  },
  {
    "min": [
      45.95,
      0,
      -25.79
    ],
    "max": [
      47.93,
      2.5,
      -21.13
    ],
    "name": "Bus_Stop_02050-Mesh"
  },
  {
    "min": [
      46,
      0.65,
      -25.66
    ],
    "max": [
      47.86,
      2.46,
      -21.32
    ],
    "name": "Bus_Stop_02050-Mesh_1"
  },
  {
    "min": [
      -59.23,
      0.65,
      -40
    ],
    "max": [
      -57.36,
      2.46,
      -35.67
    ],
    "name": "Bus_Stop_02052-Mesh"
  },
  {
    "min": [
      -59.28,
      0,
      -40.14
    ],
    "max": [
      -57.29,
      2.5,
      -35.47
    ],
    "name": "Bus_Stop_02052-Mesh_1"
  },
  {
    "min": [
      -15.51,
      -0.03,
      27.16
    ],
    "max": [
      -9.62,
      4.21,
      33.21
    ],
    "name": "Fountain_03002-Mesh"
  },
  {
    "min": [
      -15.07,
      0.53,
      27.67
    ],
    "max": [
      -10.05,
      3.03,
      32.69
    ],
    "name": "Fountain_03002-Mesh_1"
  },
  {
    "min": [
      -15.07,
      0.53,
      -17.78
    ],
    "max": [
      -10.05,
      3.03,
      -12.77
    ],
    "name": "Fountain_03003-Mesh"
  },
  {
    "min": [
      -15.51,
      -0.03,
      -18.3
    ],
    "max": [
      -9.62,
      4.21,
      -12.25
    ],
    "name": "Fountain_03003-Mesh_1"
  },
  {
    "min": [-6.2, 13.8, 6.4],
    "max": [22.0, 15.2, 9.6],
    "name": "SkybridgeMainAvenue"
  }
];

export const CLASSIC_ARENA_OBSTACLES: BoundingBox[] = [
  // Central Platform
  { min: [-6, 0, -6], max: [6, 2.5, 6], name: 'CenterPlatform' },
  // 4 Symmetrical Cover Pillars
  { min: [12.5, 0, 12.5], max: [15.5, 5, 15.5], name: 'CoverPillarNE' },
  { min: [12.5, 0, -15.5], max: [15.5, 5, -12.5], name: 'CoverPillarSE' },
  { min: [-15.5, 0, 12.5], max: [-12.5, 5, 15.5], name: 'CoverPillarNW' },
  { min: [-15.5, 0, -15.5], max: [-12.5, 5, -12.5], name: 'CoverPillarSW' },
  // Side low covers
  { min: [9.5, 0, 13.5], max: [12.5, 2, 15.5], name: 'LowCoverNE' },
  { min: [9.5, 0, -15.5], max: [12.5, 2, -13.5], name: 'LowCoverSE' },
  { min: [-12.5, 0, 13.5], max: [-9.5, 2, 15.5], name: 'LowCoverNW' },
  { min: [-12.5, 0, -15.5], max: [-9.5, 2, -13.5], name: 'LowCoverSW' },
  // 4 Elevated Corner Sniper Bastions
  { min: [31, 0, 31], max: [41, 3, 41], name: 'BastionNE' },
  { min: [31, 0, -41], max: [41, 3, -31], name: 'BastionSE' },
  { min: [-41, 0, 31], max: [-31, 3, 41], name: 'BastionNW' },
  { min: [-41, 0, -41], max: [-31, 3, -31], name: 'BastionSW' }
];

export const CYBER_SPIRE_OBSTACLES: BoundingBox[] = [
  { min: [-2, 0, -2], max: [2, 12, 2], name: 'CentralSpireCore' },
  { min: [-4, 3, -24], max: [4, 7, -20], name: 'NorthTowerCover' },
  { min: [-4, 3, 20], max: [4, 7, 24], name: 'SouthTowerCover' },
  { min: [-24, 2, -2], max: [-20, 5, 2], name: 'WestHelipadCover' },
  { min: [20, 2, -2], max: [24, 5, 2], name: 'EastDeckCover' },
  { min: [-6, 4, -6], max: [-4, 6.5, -4], name: 'Tier2CoverNW' },
  { min: [4, 4, 4], max: [6, 6.5, 6], name: 'Tier2CoverSE' },
  // 4 Outer Helipad Covers
  { min: [40.5, 2, 40.5], max: [43.5, 4, 43.5], name: 'HelipadCoverNE' },
  { min: [40.5, 2, -43.5], max: [43.5, 4, -40.5], name: 'HelipadCoverSE' },
  { min: [-43.5, 2, 40.5], max: [-40.5, 4, 43.5], name: 'HelipadCoverNW' },
  { min: [-43.5, 2, -43.5], max: [-40.5, 4, -40.5], name: 'HelipadCoverSW' }
];

export const QUANTUM_LAB_OBSTACLES: BoundingBox[] = [
  { min: [-5, 0, -5], max: [5, 3.5, 5], name: 'ObservationDeckBase' },
  { min: [7, 0, 7], max: [9, 6, 9], name: 'ColliderCoilNE' },
  { min: [7, 0, -9], max: [9, 6, -7], name: 'ColliderCoilSE' },
  { min: [-9, 0, 7], max: [-7, 6, 9], name: 'ColliderCoilNW' },
  { min: [-9, 0, -9], max: [-7, 6, -7], name: 'ColliderCoilSW' },
  { min: [-24, 0, -6], max: [-20, 4, -2], name: 'WestCryoBank' },
  { min: [20, 0, 2], max: [24, 4, 6], name: 'EastTerminalArray' },
  // 4 Outer Cryogenic Cleanroom Coils
  { min: [37, 2.5, 37], max: [39, 6.5, 39], name: 'CryoBayCoilNE' },
  { min: [37, 2.5, -39], max: [39, 6.5, -37], name: 'CryoBayCoilSE' },
  { min: [-39, 2.5, 37], max: [-37, 6.5, 39], name: 'CryoBayCoilNW' },
  { min: [-39, 2.5, -39], max: [-37, 6.5, -37], name: 'CryoBayCoilSW' }
];

export const MAGMA_FOUNDRY_OBSTACLES: BoundingBox[] = [
  { min: [-3, 0, -3], max: [3, 8, 3], name: 'CentralExhaustStack' },
  { min: [-5, 0, -25], max: [5, 5, -19], name: 'NorthBlastCrucible' },
  { min: [-5, 0, 19], max: [5, 5, 25], name: 'SouthBlastCrucible' },
  { min: [-25, 0, -4], max: [-19, 4, 4], name: 'WestSlagVat' },
  { min: [19, 0, -4], max: [25, 4, 4], name: 'EastCoolingTank' },
  { min: [-1, 0, -8], max: [1, 5, -6], name: 'CraneSupportNorth' },
  { min: [-1, 0, 6], max: [1, 5, 8], name: 'CraneSupportSouth' },
  // 4 Outer Slag Processing Cooling Towers
  { min: [40, 0, 40], max: [44, 4, 44], name: 'CoolingTowerNE' },
  { min: [40, 0, -44], max: [44, 4, -40], name: 'CoolingTowerSE' },
  { min: [-44, 0, 40], max: [-40, 4, 44], name: 'CoolingTowerNW' },
  { min: [-44, 0, -44], max: [-40, 4, -40], name: 'CoolingTowerSW' }
];

export const SUBZERO_STATION_OBSTACLES: BoundingBox[] = [
  { min: [-8, 0, -6], max: [8, 4, 6], name: 'BunkerMainBuilding' },
  { min: [-2.5, 4, -2.5], max: [2.5, 7.5, 2.5], name: 'RadarDomeBase' },
  { min: [-18, 0, -6], max: [-12, 6, 6], name: 'ShippingContainersWest' },
  { min: [12, 0, -6], max: [18, 6, 6], name: 'ShippingContainersEast' },
  { min: [-6, 0, -22], max: [6, 2.5, -18], name: 'NorthSnowBerm' },
  { min: [-6, 0, 18], max: [6, 2.5, 22], name: 'SouthSnowBerm' },
  // 4 Outer Satellite Radar Outposts
  { min: [35, 0, 35], max: [45, 3, 45], name: 'RadarOutpostNE' },
  { min: [35, 0, -45], max: [45, 3, -35], name: 'RadarOutpostSE' },
  { min: [-45, 0, 35], max: [-35, 3, 45], name: 'RadarOutpostNW' },
  { min: [-45, 0, -45], max: [-35, 3, -35], name: 'RadarOutpostSW' }
];

export const SKY_SANCTUARY_OBSTACLES: BoundingBox[] = [
  { min: [-4, 0, -4], max: [4, 4, 4], name: 'ShrinePavilion' },
  { min: [-3.5, 0, -12], max: [-2.5, 6, -11], name: 'ToriiPillarNorthL' },
  { min: [2.5, 0, -12], max: [3.5, 6, -11], name: 'ToriiPillarNorthR' },
  { min: [-3.5, 0, 11], max: [-2.5, 6, 12], name: 'ToriiPillarSouthL' },
  { min: [2.5, 0, 11], max: [3.5, 6, 12], name: 'ToriiPillarSouthR' },
  { min: [-28, 0, -3], max: [-24, 3.5, 3], name: 'WestRockShrine' },
  { min: [24, 0, -3], max: [28, 5.5, 3], name: 'EastBellTower' },
  // 4 Outer Floating Spirit Shrines
  { min: [48.5, 0, 48.5], max: [51.5, 4, 51.5], name: 'OuterShrineNE' },
  { min: [48.5, 0, -51.5], max: [51.5, 4, -48.5], name: 'OuterShrineSE' },
  { min: [-51.5, 0, 48.5], max: [-48.5, 4, 51.5], name: 'OuterShrineNW' },
  { min: [-51.5, 0, -51.5], max: [-48.5, 4, -48.5], name: 'OuterShrineSW' }
];

export const FACILITY_OBSTACLES: BoundingBox[] = [
  // Perimeter Containment Walls
  { min: [-33, 0, 31], max: [33, 8, 33], name: 'WallNorth' },
  { min: [-33, 0, -33], max: [33, 8, -31], name: 'WallSouth' },
  { min: [-33, 0, -33], max: [-31, 8, 33], name: 'WallWest' },
  { min: [31, 0, -33], max: [33, 8, 33], name: 'WallEast' },

  // Central Catwalk & Observation Platform (y=3.5m)
  { min: [-3, 3.2, -12], max: [3, 3.5, 12], name: 'CatwalkPlatform' },
  { min: [-3.1, 3.5, -12], max: [-2.9, 4.3, 12], name: 'CatwalkRailWest' },
  { min: [2.9, 3.5, -12], max: [3.1, 4.3, 12], name: 'CatwalkRailEast' },

  // Access Ramps (North & South)
  { min: [-2.5, 0, -18], max: [2.5, 1.2, -15], name: 'RampNorthLow' },
  { min: [-2.5, 0, -15], max: [2.5, 2.4, -12], name: 'RampNorthMid' },
  { min: [-2.5, 0, 15], max: [2.5, 1.2, 18], name: 'RampSouthLow' },
  { min: [-2.5, 0, 12], max: [2.5, 2.4, 15], name: 'RampSouthMid' },

  // Structural Support Pillars
  { min: [-9, 0, -11], max: [-7, 10, -9], name: 'PillarNW' },
  { min: [7, 0, -11], max: [9, 10, -9], name: 'PillarNE' },
  { min: [-9, 0, 9], max: [-7, 10, 11], name: 'PillarSW' },
  { min: [7, 0, 9], max: [9, 10, 11], name: 'PillarSE' },

  // Shipping Containers
  { min: [-18, 0, -8], max: [-12, 3, -5], name: 'ContainerWestNorth' },
  { min: [-18, 0, 5], max: [-12, 3, 8], name: 'ContainerWestSouth' },
  { min: [12, 0, -8], max: [18, 3, -5], name: 'ContainerEastNorth' },
  { min: [12, 0, 5], max: [18, 3, 8], name: 'ContainerEastSouth' },

  // Cargo Crate Clusters
  { min: [-16, 0, -20], max: [-13, 2.2, -17], name: 'CratesNW' },
  { min: [13, 0, -20], max: [16, 2.2, -17], name: 'CratesNE' },
  { min: [-16, 0, 17], max: [-13, 2.2, 20], name: 'CratesSW' },
  { min: [13, 0, 17], max: [16, 2.2, 20], name: 'CratesSE' },
  { min: [-2, 0, -6], max: [2, 1.5, -4], name: 'CoverMidNorth' },
  { min: [-2, 0, 4], max: [2, 1.5, 6], name: 'CoverMidSouth' },

  // Team Depot Back Covers
  { min: [-28, 0, -6], max: [-27, 2.5, 6], name: 'DepotCoverBlue' },
  { min: [27, 0, -6], max: [28, 2.5, 6], name: 'DepotCoverRed' }
];

export const NEON_WAREHOUSE_OBSTACLES: BoundingBox[] = [
  // Perimeter Containment Walls
  { min: [-33, 0, 31], max: [33, 8, 33], name: 'WallNorth' },
  { min: [-33, 0, -33], max: [33, 8, -31], name: 'WallSouth' },
  { min: [-33, 0, -33], max: [-31, 8, 33], name: 'WallWest' },
  { min: [31, 0, -33], max: [33, 8, 33], name: 'WallEast' },

  // Overhead Conveyor Bridge & Gantry (y=3.3m)
  { min: [-4, 3.1, -15], max: [4, 3.4, 15], name: 'GantryCatwalk' },
  { min: [-4.1, 3.4, -15], max: [-3.9, 4.2, 15], name: 'GantryRailWest' },
  { min: [3.9, 3.4, -15], max: [4.1, 4.2, 15], name: 'GantryRailEast' },

  // Industrial Shelving Racks (North & South Wings)
  { min: [-20, 0, -18], max: [-14, 5.5, -15], name: 'ShelvingNW' },
  { min: [14, 0, -18], max: [20, 5.5, -15], name: 'ShelvingNE' },
  { min: [-20, 0, 15], max: [-14, 5.5, 18], name: 'ShelvingSW' },
  { min: [14, 0, 15], max: [20, 5.5, 18], name: 'ShelvingSE' },

  // Shipping Container Stacks
  { min: [-16, 0, -4], max: [-10, 3.2, 4], name: 'ContainerBayWest' },
  { min: [10, 0, -4], max: [16, 3.2, 4], name: 'ContainerBayEast' },

  // Pallet Stacks and Low Barriers
  { min: [-5, 0, -6], max: [-1, 1.4, -3], name: 'PalletsMidNorth' },
  { min: [1, 0, 3], max: [5, 1.4, 6], name: 'PalletsMidSouth' },

  // Loading Dock Terminals
  { min: [-28, 0, -8], max: [-26, 2.5, 8], name: 'DockCoverBlue' },
  { min: [26, 0, -8], max: [28, 2.5, 8], name: 'DockCoverRed' }
];

export const ORBITAL_STATION_OBSTACLES: BoundingBox[] = [
  // Hull Containment Bulkheads
  { min: [-36, 0, 34], max: [36, 10, 36], name: 'HullNorth' },
  { min: [-36, 0, -36], max: [36, 10, -34], name: 'HullSouth' },
  { min: [-36, 0, -36], max: [-34, 10, 36], name: 'HullWest' },
  { min: [34, 0, -36], max: [36, 10, 36], name: 'HullEast' },

  // Central Gravity Core & Observation Spire
  { min: [-5, 0, -5], max: [5, 5.0, 5], name: 'GravityCore' },
  { min: [-8, 0, -8], max: [8, 0.8, 8], name: 'CorePlatform' },

  // Solar Control Terminal Wings
  { min: [-18, 0, 14], max: [-11, 3.2, 22], name: 'SolarTerminalNW' },
  { min: [11, 0, -22], max: [18, 3.2, -14], name: 'SolarTerminalSE' },

  // Airlock Pressure Chambers
  { min: [-28, 0, -6], max: [-22, 3.6, 6], name: 'AirlockWest' },
  { min: [22, 0, -6], max: [28, 3.6, 6], name: 'AirlockEast' },

  // Elevated Sniper Vantage Platforms (y=3.8m)
  { min: [-15, 3.6, -18], max: [-9, 3.9, -12], name: 'VantageDeckNorth' },
  { min: [9, 3.6, 12], max: [15, 3.9, 18], name: 'VantageDeckSouth' },

  // Low Console Barriers
  { min: [-3, 0, -12], max: [3, 1.4, -10], name: 'ConsoleNorth' },
  { min: [-3, 0, 10], max: [3, 1.4, 12], name: 'ConsoleSouth' }
];

export function getMapObstacles(mapName: string): BoundingBox[] {
  switch (mapName) {
    case 'Facility':
      return FACILITY_OBSTACLES;
    case 'Cartoon City':
      return CARTOON_CITY_OBSTACLES;
    case 'Arena Classic':
      return CLASSIC_ARENA_OBSTACLES;
    case 'Neon Warehouse':
      return NEON_WAREHOUSE_OBSTACLES;
    case 'Cyber Spire':
      return CYBER_SPIRE_OBSTACLES;
    case 'Quantum Lab':
      return QUANTUM_LAB_OBSTACLES;
    case 'Magma Foundry':
      return MAGMA_FOUNDRY_OBSTACLES;
    case 'Subzero Station':
      return SUBZERO_STATION_OBSTACLES;
    case 'Sky Sanctuary':
      return SKY_SANCTUARY_OBSTACLES;
    case 'Orbital Station':
      return ORBITAL_STATION_OBSTACLES;
    default:
      return FACILITY_OBSTACLES;
  }
}

/**
 * Match Mode Data — defines the arena, minions, and structures for the
 * AoV-inspired quick-play mode.
 *
 * Match Mode is a self-contained 10-20 minute battle separate from the
 * roguelite realm progression. The player uses their Sanctum-equipped
 * skills in a structured arena with:
 *   - 2 lanes (top + bottom)
 *   - Minion waves that spawn periodically
 *   - Towers (structures) that must be destroyed
 *   - A core (final objective) — destroy to win
 *   - Enemy AI minions + structures
 *
 * Per README §6 Layer 3: "Self-contained 10-20 min matches, two lanes,
 * minion waves, structures, boss monster. Solo vs AI."
 */

// ─────────────────────────────────────────────────────────────────────────────
// Arena Layout
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchArena {
  width: number;  // tiles
  height: number; // tiles
  tiles: number[]; // tile codes (same as realm: 0=grass, 1=path, 2=rock, 3=water, 4=accent)
  // Structure positions (tile coords)
  playerCore: { col: number; row: number };
  enemyCore: { col: number; row: number };
  playerTowers: Array<{ col: number; row: number }>;
  enemyTowers: Array<{ col: number; row: number }>;
  // Lane paths (for minion movement)
  topLane: Array<{ col: number; row: number }>;
  bottomLane: Array<{ col: number; row: number }>;
  playerStart: { col: number; row: number };
}

/**
 * Build a match arena — smaller than a realm, with 2 lanes and structures.
 * 32x32 tiles. Player starts bottom-left, enemy core is top-right.
 */
export function buildMatchArena(): MatchArena {
  const W = 32;
  const H = 32;
  const tiles = new Array(W * H).fill(0); // grass

  // Border walls
  for (let i = 0; i < W; i++) {
    tiles[0 * W + i] = 2;
    tiles[(H - 1) * W + i] = 2;
    tiles[i * W + 0] = 2;
    tiles[i * W + (W - 1)] = 2;
  }

  // Top lane (horizontal path across the top third)
  const topLaneY = Math.floor(H * 0.25);
  for (let x = 2; x < W - 2; x++) {
    tiles[topLaneY * W + x] = 1;
    tiles[(topLaneY + 1) * W + x] = 1;
  }

  // Bottom lane (horizontal path across the bottom third)
  const bottomLaneY = Math.floor(H * 0.75);
  for (let x = 2; x < W - 2; x++) {
    tiles[bottomLaneY * W + x] = 1;
    tiles[(bottomLaneY + 1) * W + x] = 1;
  }

  // Vertical connectors (middle of map)
  const midX = Math.floor(W / 2);
  for (let y = topLaneY + 2; y < bottomLaneY - 1; y++) {
    tiles[y * W + midX] = 1;
    tiles[y * W + midX + 1] = 1;
  }

  // Some rock clusters for cover
  const rocks: Array<[number, number]> = [
    [8, 10], [9, 10], [8, 11],
    [22, 8], [23, 8], [22, 9],
    [8, 22], [9, 22], [8, 23],
    [22, 20], [23, 20], [22, 21],
    [15, 15], [16, 15], [15, 16],
  ];
  for (const [c, r] of rocks) {
    if (c < W && r < H) tiles[r * W + c] = 2;
  }

  // Structure positions
  const playerCore = { col: 3, row: H - 4 };
  const enemyCore = { col: W - 4, row: 3 };
  const playerTowers = [
    { col: 6, row: H - 6 },
    { col: 6, row: Math.floor(H * 0.25) + 1 },
  ];
  const enemyTowers = [
    { col: W - 7, row: 5 },
    { col: W - 7, row: Math.floor(H * 0.75) - 1 },
  ];

  // Mark structures with accent tiles
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // Lane paths (waypoints for minion movement)
  const topLane = [
    { col: 3, row: topLaneY + 1 },
    { col: Math.floor(W / 2), row: topLaneY + 1 },
    { col: W - 4, row: topLaneY + 1 },
  ];
  const bottomLane = [
    { col: 3, row: bottomLaneY + 1 },
    { col: Math.floor(W / 2), row: bottomLaneY + 1 },
    { col: W - 4, row: bottomLaneY + 1 },
  ];

  const playerStart = { col: 3, row: H - 6 };

  return {
    width: W,
    height: H,
    tiles,
    playerCore,
    enemyCore,
    playerTowers,
    enemyTowers,
    topLane,
    bottomLane,
    playerStart,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Minion Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface MinionDef {
  hp: number;
  damage: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  /** Color for VFX. */
  color: number;
  /** Sprite size multiplier. */
  size: number;
}

export const MINION_TYPES: Record<string, MinionDef> = {
  melee: {
    hp: 40,
    damage: 6,
    speed: 50,
    attackRange: 30,
    attackCooldown: 1.0,
    color: 0x60a0ff,
    size: 0.8,
  },
  ranged: {
    hp: 25,
    damage: 8,
    speed: 45,
    attackRange: 120,
    attackCooldown: 1.5,
    color: 0xffa060,
    size: 0.7,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Structure Definitions
// ─────────────────────────────────────────────────────────────────────────────

export interface StructureDef {
  hp: number;
  damage: number;
  attackRange: number;
  attackCooldown: number;
  color: number;
}

export const STRUCTURE_TYPES: Record<string, StructureDef> = {
  tower: {
    hp: 200,
    damage: 15,
    attackRange: 150,
    attackCooldown: 1.2,
    color: 0x808090,
  },
  core: {
    hp: 500,
    damage: 20,
    attackRange: 180,
    attackCooldown: 1.5,
    color: 0xffb86c,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Match Config
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchConfig {
  /** Seconds between minion waves. */
  waveInterval: number;
  /** Seconds until first wave. */
  firstWaveDelay: number;
  /** Minions per wave per lane. */
  minionsPerLane: number;
  /** Match time limit (seconds). */
  timeLimit: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  waveInterval: 30,
  firstWaveDelay: 10,
  minionsPerLane: 3,
  timeLimit: 1200, // 20 minutes
};

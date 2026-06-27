/**
 * Match Mode Data — defines the arena, minions, and structures for the
 * AoV-inspired quick-play mode.
 *
 * Phase 7.5: Redesigned arena with clear team territories.
 *   - Player side (bottom-left): blue-tinted tiles
 *   - Enemy side (top-right): red-tinted tiles
 *   - Neutral center: default grass
 *   - Lanes are wide and clearly visible
 *   - Structures are placed at strategic chokepoints
 *
 * Tile codes:
 *   0 = grass (neutral)
 *   1 = path (lane — walkable)
 *   2 = rock (obstacle)
 *   3 = water (obstacle)
 *   4 = accent (structure base)
 *   5 = player territory (blue-tinted grass)
 *   6 = enemy territory (red-tinted grass)
 *   7 = player path (blue-tinted lane)
 *   8 = enemy path (red-tinted lane)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Team Colors
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_COLORS = {
  player: {
    primary: 0x4080ff,   // blue
    secondary: 0x60a0ff, // lighter blue
    minion: 0x4080ff,
    structure: 0x3060c0,
    core: 0x40c0ff,
    territory: 0x2a3a5a,  // blue-tinted grass
    path: 0x4a5a8a,       // blue-tinted path
  },
  enemy: {
    primary: 0xff4040,   // red
    secondary: 0xff6060, // lighter red
    minion: 0xff4040,
    structure: 0xc03030,
    core: 0xff4060,
    territory: 0x5a2a2a,  // red-tinted grass
    path: 0x8a4a4a,       // red-tinted path
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Arena Layout
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchArena {
  width: number;
  height: number;
  tiles: number[];
  playerCore: { col: number; row: number };
  enemyCore: { col: number; row: number };
  playerTowers: Array<{ col: number; row: number }>;
  enemyTowers: Array<{ col: number; row: number }>;
  topLane: Array<{ col: number; row: number }>;
  bottomLane: Array<{ col: number; row: number }>;
  playerStart: { col: number; row: number };
}

/**
 * Build a match arena — 40x40 tiles for more space.
 * Player territory is bottom-left (blue), enemy territory is top-right (red).
 * Diagonal split creates a clear visual divide.
 */
export function buildMatchArena(): MatchArena {
  const W = 40;
  const H = 40;
  const tiles = new Array(W * H).fill(0); // grass

  // Border walls
  for (let i = 0; i < W; i++) {
    tiles[0 * W + i] = 2;
    tiles[(H - 1) * W + i] = 2;
    tiles[i * W + 0] = 2;
    tiles[i * W + (W - 1)] = 2;
  }

  // Diagonal territory split: player (bottom-left) vs enemy (top-right)
  // tiles code 5 = player territory, 6 = enemy territory
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      // Diagonal: r + c < W means bottom-left (player), else top-right (enemy)
      if (r + c > W + 2) {
        tiles[r * W + c] = 6; // enemy territory
      } else if (r + c < W - 2) {
        tiles[r * W + c] = 5; // player territory
      }
      // Middle band stays neutral grass (0)
    }
  }

  // ── Top lane (horizontal, upper third) ─────────────────────────────
  const topLaneY = Math.floor(H * 0.3);
  for (let x = 2; x < W - 2; x++) {
    // Player side of lane = blue path (7), enemy side = red path (8)
    if (x < W / 2) {
      tiles[topLaneY * W + x] = 7;
      tiles[(topLaneY + 1) * W + x] = 7;
    } else {
      tiles[topLaneY * W + x] = 8;
      tiles[(topLaneY + 1) * W + x] = 8;
    }
  }

  // ── Bottom lane (horizontal, lower third) ──────────────────────────
  const bottomLaneY = Math.floor(H * 0.7);
  for (let x = 2; x < W - 2; x++) {
    if (x < W / 2) {
      tiles[bottomLaneY * W + x] = 7;
      tiles[(bottomLaneY + 1) * W + x] = 7;
    } else {
      tiles[bottomLaneY * W + x] = 8;
      tiles[(bottomLaneY + 1) * W + x] = 8;
    }
  }

  // ── Vertical connector in the middle ───────────────────────────────
  const midX = Math.floor(W / 2);
  for (let y = topLaneY + 2; y < bottomLaneY - 1; y++) {
    tiles[y * W + midX] = 1;
    tiles[y * W + midX + 1] = 1;
  }

  // ── Rock clusters for cover (in neutral zone) ──────────────────────
  const rocks: Array<[number, number]> = [
    [12, 12], [13, 12], [12, 13],
    [26, 10], [27, 10], [26, 11],
    [10, 26], [11, 26], [10, 27],
    [27, 28], [28, 28], [27, 29],
    [19, 19], [20, 19], [19, 20],
    [15, 24], [16, 24],
    [23, 15], [24, 15],
  ];
  for (const [c, r] of rocks) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 2;
    }
  }

  // ── Structure positions ────────────────────────────────────────────
  const playerCore = { col: 4, row: H - 5 };
  const enemyCore = { col: W - 5, row: 4 };
  const playerTowers = [
    { col: 8, row: H - 8 },           // bottom lane tower
    { col: 8, row: topLaneY + 1 },    // top lane tower
  ];
  const enemyTowers = [
    { col: W - 9, row: 7 },           // top lane tower
    { col: W - 9, row: bottomLaneY }, // bottom lane tower
  ];

  // Mark structures with accent tiles (4)
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // ── Lane waypoints (for minion movement) ───────────────────────────
  // Player minions go left→right, enemy minions go right→left
  const topLane = [
    { col: 5, row: topLaneY + 1 },
    { col: Math.floor(W / 2), row: topLaneY + 1 },
    { col: W - 5, row: topLaneY + 1 },
  ];
  const bottomLane = [
    { col: 5, row: bottomLaneY + 1 },
    { col: Math.floor(W / 2), row: bottomLaneY + 1 },
    { col: W - 5, row: bottomLaneY + 1 },
  ];

  const playerStart = { col: 5, row: H - 8 };

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
  size: number;
}

export const MINION_TYPES: Record<string, MinionDef> = {
  melee: {
    hp: 40,
    damage: 6,
    speed: 50,
    attackRange: 30,
    attackCooldown: 1.0,
    size: 0.8,
  },
  ranged: {
    hp: 25,
    damage: 8,
    speed: 45,
    attackRange: 120,
    attackCooldown: 1.5,
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
}

export const STRUCTURE_TYPES: Record<string, StructureDef> = {
  tower: {
    hp: 200,
    damage: 15,
    attackRange: 150,
    attackCooldown: 1.2,
  },
  core: {
    hp: 500,
    damage: 20,
    attackRange: 180,
    attackCooldown: 1.5,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Match Config
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchConfig {
  waveInterval: number;
  firstWaveDelay: number;
  minionsPerLane: number;
  timeLimit: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  waveInterval: 30,
  firstWaveDelay: 10,
  minionsPerLane: 3,
  timeLimit: 1200,
};

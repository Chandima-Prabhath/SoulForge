/**
 * Match Mode Data — MOBA-style arena inspired by Arena of Valor.
 *
 * Map Layout (isometric, 40x40):
 *
 *     ENEMY BASE (top)
 *     ┌─────────────────┐
 *     │   [Core]        │
 *     │  /    \         │
 *     │ T1    T1        │  ← enemy towers
 *     │ |      |        │
 *     │ |  JUNGLE  |    │  ← neutral zone
 *     │ |      |        │
 *     │ T2    T2        │  ← player towers
 *     │  \    /         │
 *     │   [Core]        │
 *     └─────────────────┘
 *     PLAYER BASE (bottom)
 *
 * Top lane: goes from player core UP the LEFT side to enemy core
 * Bottom lane: goes from player core UP the RIGHT side to enemy core
 * Towers placed along each lane (2 per side)
 * Jungle in the middle (neutral, rocks for cover)
 *
 * Tile codes:
 *   0 = grass (neutral)
 *   1 = path (lane)
 *   2 = rock (obstacle)
 *   3 = water (obstacle, jungle river)
 *   4 = accent (structure base)
 *   5 = player territory (blue-tinted)
 *   6 = enemy territory (red-tinted)
 *   7 = player lane path (blue-tinted)
 *   8 = enemy lane path (red-tinted)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Team Colors
// ─────────────────────────────────────────────────────────────────────────────

export const TEAM_COLORS = {
  player: {
    primary: 0x4080ff,
    secondary: 0x60a0ff,
    minion: 0x4080ff,
    structure: 0x3060c0,
    core: 0x40c0ff,
    territory: 0x2a3a5a,
    path: 0x4a5a8a,
  },
  enemy: {
    primary: 0xff4040,
    secondary: 0xff6060,
    minion: 0xff4040,
    structure: 0xc03030,
    core: 0xff4060,
    territory: 0x5a2a2a,
    path: 0x8a4a4a,
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
 * Build a MOBA-style arena.
 *
 * The map is 40x40 tiles. Player base is at bottom-center, enemy base
 * is at top-center. Two lanes curve from bottom to top:
 *   - Top lane: goes up the LEFT side
 *   - Bottom lane: goes up the RIGHT side
 * Jungle (rocks + water) fills the middle.
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

  // ── Territory: bottom 40% = player (blue), top 40% = enemy (red) ───
  const playerZoneEnd = Math.floor(H * 0.4);   // rows 0-15: enemy
  const enemyZoneStart = Math.floor(H * 0.6);   // rows 24-39: player
  // Middle (rows 16-23) = neutral jungle

  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (r > enemyZoneStart) {
        tiles[r * W + c] = 5; // player territory (blue)
      } else if (r < playerZoneEnd) {
        tiles[r * W + c] = 6; // enemy territory (red)
      }
      // Middle stays neutral (0)
    }
  }

  // ── Top Lane: goes up the LEFT side ────────────────────────────────
  // Vertical segment (left side, from player core up to enemy core)
  const leftLaneX = Math.floor(W * 0.25); // col 10
  for (let r = 3; r < H - 3; r++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = leftLaneX + dx;
      if (x > 1 && x < W - 2) {
        // Color based on territory
        if (r > enemyZoneStart) {
          tiles[r * W + x] = 7; // player path (blue)
        } else if (r < playerZoneEnd) {
          tiles[r * W + x] = 8; // enemy path (red)
        } else {
          tiles[r * W + x] = 1; // neutral path
        }
      }
    }
  }
  // Horizontal connectors at top and bottom of left lane
  // Bottom: connect to player core area
  for (let x = leftLaneX; x < Math.floor(W / 2); x++) {
    for (let dy = 0; dy < 2; dy++) {
      const y = H - 5 + dy;
      if (y < H - 1) tiles[y * W + x] = 7; // player path
    }
  }
  // Top: connect to enemy core area
  for (let x = leftLaneX; x < Math.floor(W / 2); x++) {
    for (let dy = 0; dy < 2; dy++) {
      const y = 3 + dy;
      if (y > 0) tiles[y * W + x] = 8; // enemy path
    }
  }

  // ── Bottom Lane: goes up the RIGHT side ────────────────────────────
  const rightLaneX = Math.floor(W * 0.75); // col 30
  for (let r = 3; r < H - 3; r++) {
    for (let dx = 0; dx < 2; dx++) {
      const x = rightLaneX + dx;
      if (x > 1 && x < W - 2) {
        if (r > enemyZoneStart) {
          tiles[r * W + x] = 7; // player path (blue)
        } else if (r < playerZoneEnd) {
          tiles[r * W + x] = 8; // enemy path (red)
        } else {
          tiles[r * W + x] = 1; // neutral path
        }
      }
    }
  }
  // Bottom: connect to player core area
  for (let x = Math.floor(W / 2); x <= rightLaneX + 1; x++) {
    for (let dy = 0; dy < 2; dy++) {
      const y = H - 5 + dy;
      if (y < H - 1 && x < W - 1) tiles[y * W + x] = 7;
    }
  }
  // Top: connect to enemy core area
  for (let x = Math.floor(W / 2); x <= rightLaneX + 1; x++) {
    for (let dy = 0; dy < 2; dy++) {
      const y = 3 + dy;
      if (y > 0 && x < W - 1) tiles[y * W + x] = 8;
    }
  }

  // ── Jungle (middle neutral zone) ───────────────────────────────────
  // Water river across the middle
  const riverY = Math.floor(H / 2);
  for (let x = leftLaneX + 3; x < rightLaneX - 1; x++) {
    tiles[riverY * W + x] = 3; // water
    tiles[(riverY + 1) * W + x] = 3;
  }
  // Rock clusters in jungle
  const jungleRocks: Array<[number, number]> = [
    [14, 16], [15, 16], [14, 17], [16, 17],
    [24, 16], [25, 16], [24, 17], [23, 17],
    [14, 22], [15, 22], [14, 21], [16, 21],
    [24, 22], [25, 22], [24, 21], [23, 21],
    [19, 14], [20, 14], [19, 24], [20, 24],
  ];
  for (const [c, r] of jungleRocks) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 2; // rock
    }
  }

  // ── Structure Positions ────────────────────────────────────────────
  // Player core: bottom-center
  const playerCore = { col: Math.floor(W / 2), row: H - 4 };
  // Enemy core: top-center
  const enemyCore = { col: Math.floor(W / 2), row: 3 };

  // Player towers: one on each lane, in player territory
  const playerTowers = [
    { col: leftLaneX, row: H - 10 },   // top lane tower
    { col: rightLaneX, row: H - 10 },  // bottom lane tower
  ];

  // Enemy towers: one on each lane, in enemy territory
  const enemyTowers = [
    { col: leftLaneX, row: 9 },        // top lane tower
    { col: rightLaneX, row: 9 },       // bottom lane tower
  ];

  // Mark structures with accent tiles
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // ── Lane Waypoints (for minion movement) ───────────────────────────
  // Player minions go from bottom→top, enemy minions go from top→bottom
  // Top lane (left side): bottom → left → top
  const topLane = [
    { col: Math.floor(W / 2), row: H - 5 },   // start at player core
    { col: leftLaneX + 1, row: H - 5 },        // move left
    { col: leftLaneX + 1, row: Math.floor(H / 2) }, // move up through jungle
    { col: leftLaneX + 1, row: 4 },            // reach enemy area
    { col: Math.floor(W / 2), row: 4 },        // move to enemy core
  ];

  // Bottom lane (right side): bottom → right → top
  const bottomLane = [
    { col: Math.floor(W / 2), row: H - 5 },   // start at player core
    { col: rightLaneX, row: H - 5 },           // move right
    { col: rightLaneX, row: Math.floor(H / 2) }, // move up through jungle
    { col: rightLaneX, row: 4 },               // reach enemy area
    { col: Math.floor(W / 2), row: 4 },        // move to enemy core
  ];

  // Player starts near their core
  const playerStart = { col: Math.floor(W / 2), row: H - 6 };

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

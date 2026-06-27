/**
 * Match Mode Data — AoV-style diamond MOBA arena with 3 lanes.
 *
 * Map Layout (isometric diamond):
 *
 *          ENEMY BASE (top-right corner)
 *         ╱  [Core]  ╲
 *        ╱  /  |  \  ╲
 *       T1  T1 | T1  T1     ← enemy towers
 *       |   |  |  |   |
 *  TOP ←───  MID  ───→ BOT
 *  LANE     LANE     LANE
 *       |   |  |  |   |
 *       T2  T2 | T2  T2     ← player towers
 *        ╲  \  |  /  ╱
 *         ╲  [Core]  ╱
 *          PLAYER BASE (bottom-left corner)
 *
 * - Mid lane: diagonal from bottom-left to top-right (the main diagonal)
 * - Top lane: along the top-left edge of the diamond
 * - Bottom lane: along the bottom-right edge of the diamond
 * - Jungle: area between lanes (rocks, water)
 * - Player core: bottom-left, Enemy core: top-right
 *
 * Tile codes:
 *   0 = grass (neutral/jungle)
 *   1 = path (neutral lane)
 *   2 = rock (obstacle)
 *   3 = water (obstacle)
 *   4 = accent (structure base)
 *   5 = player territory (blue)
 *   6 = enemy territory (red)
 *   7 = player lane (blue path)
 *   8 = enemy lane (red path)
 */

export const TEAM_COLORS = {
  player: {
    primary: 0x4080ff, secondary: 0x60a0ff, minion: 0x4080ff,
    structure: 0x3060c0, core: 0x40c0ff, territory: 0x2a3a5a, path: 0x4a5a8a,
  },
  enemy: {
    primary: 0xff4040, secondary: 0xff6060, minion: 0xff4040,
    structure: 0xc03030, core: 0xff4060, territory: 0x5a2a2a, path: 0x8a4a4a,
  },
};

export interface MatchArena {
  width: number;
  height: number;
  tiles: number[];
  playerCore: { col: number; row: number };
  enemyCore: { col: number; row: number };
  playerTowers: Array<{ col: number; row: number }>;
  enemyTowers: Array<{ col: number; row: number }>;
  topLane: Array<{ col: number; row: number }>;
  midLane: Array<{ col: number; row: number }>;
  bottomLane: Array<{ col: number; row: number }>;
  playerStart: { col: number; row: number };
}

/**
 * Build a MOBA arena rotated 90° CCW from the diagonal layout.
 *
 * After rotation:
 *   - Player core: bottom-CENTER
 *   - Enemy core: top-CENTER
 *   - MID lane: vertical, straight up the middle (col = W/2)
 *   - TOP lane: goes from player base → up the LEFT edge → to enemy base
 *   - BOTTOM lane: goes from player base → up the RIGHT edge → to enemy base
 *   - Territory: bottom half = player (blue), top half = enemy (red)
 *   - Jungle: horizontal band in the middle
 */
export function buildMatchArena(): MatchArena {
  const W = 44;
  const H = 44;
  const tiles = new Array(W * H).fill(0);

  // Border walls
  for (let i = 0; i < W; i++) {
    tiles[0 * W + i] = 2;
    tiles[(H - 1) * W + i] = 2;
    tiles[i * W + 0] = 2;
    tiles[i * W + (W - 1)] = 2;
  }

  const midCol = Math.floor(W / 2);
  const jungleStart = Math.floor(H * 0.4);
  const jungleEnd = Math.floor(H * 0.6);

  // ── Territory: bottom = player (blue), top = enemy (red) ───────────
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      if (r > jungleEnd) {
        tiles[r * W + c] = 5; // player territory (blue)
      } else if (r < jungleStart) {
        tiles[r * W + c] = 6; // enemy territory (red)
      }
      // Middle band (jungleStart..jungleEnd) stays neutral (0)
    }
  }

  // Helper: set a tile to lane color based on territory
  const setLaneTile = (c: number, r: number) => {
    if (c < 1 || c >= W - 1 || r < 1 || r >= H - 1) return;
    if (r > jungleEnd) {
      tiles[r * W + c] = 7; // player lane (blue)
    } else if (r < jungleStart) {
      tiles[r * W + c] = 8; // enemy lane (red)
    } else {
      tiles[r * W + c] = 1; // neutral lane
    }
  };

  // ── MID LANE: vertical, straight up the middle (col = midCol) ──────
  for (let r = 2; r < H - 2; r++) {
    setLaneTile(midCol - 1, r);
    setLaneTile(midCol, r);
    setLaneTile(midCol + 1, r);
  }

  // ── TOP LANE: goes up the LEFT edge ────────────────────────────────
  // Player core (bottom-center) → left → up the left edge → right to enemy core (top-center)
  const topLaneCol = 5;
  // Horizontal segment at bottom (from midCol to topLaneCol)
  for (let c = topLaneCol; c <= midCol; c++) {
    setLaneTile(c, H - 5);
    setLaneTile(c, H - 6);
  }
  // Vertical segment (going up the left side)
  for (let r = 5; r < H - 5; r++) {
    setLaneTile(topLaneCol, r);
    setLaneTile(topLaneCol + 1, r);
  }
  // Horizontal segment at top (from topLaneCol to midCol)
  for (let c = topLaneCol; c <= midCol; c++) {
    setLaneTile(c, 5);
    setLaneTile(c, 4);
  }

  // ── BOTTOM LANE: goes up the RIGHT edge ────────────────────────────
  // Player core (bottom-center) → right → up the right edge → left to enemy core (top-center)
  const botLaneCol = W - 6;
  // Horizontal segment at bottom (from midCol to botLaneCol)
  for (let c = midCol; c <= botLaneCol; c++) {
    setLaneTile(c, H - 5);
    setLaneTile(c, H - 6);
  }
  // Vertical segment (going up the right side)
  for (let r = 5; r < H - 5; r++) {
    setLaneTile(botLaneCol, r);
    setLaneTile(botLaneCol + 1, r);
  }
  // Horizontal segment at top (from midCol to botLaneCol)
  for (let c = midCol; c <= botLaneCol; c++) {
    setLaneTile(c, 5);
    setLaneTile(c, 4);
  }

  // ── Jungle: water + rocks in the middle band ───────────────────────
  const waterPatches: Array<[number, number]> = [
    // Left jungle (between mid and top lane)
    [10, Math.floor(H/2) - 1], [11, Math.floor(H/2) - 1], [10, Math.floor(H/2)],
    [12, Math.floor(H/2) + 1], [13, Math.floor(H/2) + 1],
    // Right jungle (between mid and bottom lane)
    [W-11, Math.floor(H/2) - 1], [W-12, Math.floor(H/2) - 1], [W-11, Math.floor(H/2)],
    [W-13, Math.floor(H/2) + 1], [W-14, Math.floor(H/2) + 1],
    // Center jungle (near mid lane sides)
    [midCol - 6, Math.floor(H/2)], [midCol + 5, Math.floor(H/2)],
  ];
  for (const [c, r] of waterPatches) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 3; // water
    }
  }

  const jungleRocks: Array<[number, number]> = [
    [8, Math.floor(H/2) - 2], [9, Math.floor(H/2) - 2], [8, Math.floor(H/2) - 1],
    [W-9, Math.floor(H/2) - 2], [W-10, Math.floor(H/2) - 2], [W-9, Math.floor(H/2) - 1],
    [midCol - 5, Math.floor(H/2) + 2], [midCol - 4, Math.floor(H/2) + 2],
    [midCol + 4, Math.floor(H/2) + 2], [midCol + 5, Math.floor(H/2) + 2],
    [15, Math.floor(H/2) - 3], [W-16, Math.floor(H/2) - 3],
  ];
  for (const [c, r] of jungleRocks) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 2; // rock
    }
  }

  // ── Structure Positions ────────────────────────────────────────────
  const playerCore = { col: midCol, row: H - 4 };
  const enemyCore = { col: midCol, row: 3 };

  const playerTowers = [
    { col: topLaneCol, row: H - 10 },            // top lane tower (left side)
    { col: midCol, row: H - 12 },                 // mid lane tower
    { col: botLaneCol, row: H - 10 },             // bottom lane tower (right side)
  ];

  const enemyTowers = [
    { col: topLaneCol, row: 9 },                  // top lane tower
    { col: midCol, row: 11 },                     // mid lane tower
    { col: botLaneCol, row: 9 },                  // bottom lane tower
  ];

  // Mark structures
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // ── Lane Waypoints ─────────────────────────────────────────────────
  // Player minions go from player core (bottom) → toward enemy core (top)
  // Enemy minions go from enemy core (top) → toward player core (bottom)

  // TOP lane: player core → left → up left edge → right → enemy core
  const topLane = [
    { col: midCol, row: H - 5 },           // start at player core
    { col: topLaneCol + 1, row: H - 5 },   // move left
    { col: topLaneCol + 1, row: Math.floor(H/2) }, // go up
    { col: topLaneCol + 1, row: 5 },       // reach top
    { col: midCol, row: 5 },               // move right to enemy core
    { col: enemyCore.col, row: enemyCore.row + 1 }, // arrive
  ];

  // MID lane: straight vertical from player core to enemy core
  const midLane = [];
  const midSteps = 6;
  for (let i = 0; i <= midSteps; i++) {
    const t = i / midSteps;
    midLane.push({
      col: midCol,
      row: Math.round(playerCore.row + (enemyCore.row - playerCore.row) * t),
    });
  }

  // BOTTOM lane: player core → right → up right edge → left → enemy core
  const bottomLane = [
    { col: midCol, row: H - 5 },           // start at player core
    { col: botLaneCol, row: H - 5 },       // move right
    { col: botLaneCol, row: Math.floor(H/2) }, // go up
    { col: botLaneCol, row: 5 },           // reach top
    { col: midCol, row: 5 },               // move left to enemy core
    { col: enemyCore.col, row: enemyCore.row + 1 }, // arrive
  ];

  const playerStart = { col: midCol, row: H - 6 };

  return {
    width: W,
    height: H,
    tiles,
    playerCore,
    enemyCore,
    playerTowers,
    enemyTowers,
    topLane,
    midLane,
    bottomLane,
    playerStart,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Minion + Structure Definitions (unchanged)
// ─────────────────────────────────────────────────────────────────────────────

export interface MinionDef {
  hp: number; damage: number; speed: number;
  attackRange: number; attackCooldown: number; size: number;
}

export const MINION_TYPES: Record<string, MinionDef> = {
  melee: { hp: 40, damage: 6, speed: 50, attackRange: 30, attackCooldown: 1.0, size: 0.8 },
  ranged: { hp: 25, damage: 8, speed: 45, attackRange: 120, attackCooldown: 1.5, size: 0.7 },
};

export interface StructureDef {
  hp: number; damage: number; attackRange: number; attackCooldown: number;
}

export const STRUCTURE_TYPES: Record<string, StructureDef> = {
  tower: { hp: 200, damage: 15, attackRange: 150, attackCooldown: 1.2 },
  core: { hp: 500, damage: 20, attackRange: 180, attackCooldown: 1.5 },
};

export interface MatchConfig {
  waveInterval: number; firstWaveDelay: number;
  minionsPerLane: number; timeLimit: number;
}

export const DEFAULT_MATCH_CONFIG: MatchConfig = {
  waveInterval: 30, firstWaveDelay: 10, minionsPerLane: 3, timeLimit: 1200,
};

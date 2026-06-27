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
 * Build a diamond-shaped MOBA arena with 3 lanes.
 *
 * The map is 44x44 tiles. Player base is at bottom-left, enemy base
 * is at top-right. The diamond is formed by the playable area inside
 * the border walls.
 *
 * Lanes:
 *   - MID: straight diagonal from bottom-left to top-right (main diagonal)
 *   - TOP: goes from player base → up the left edge → across the top → to enemy base
 *   - BOTTOM: goes from player base → across the bottom → up the right edge → to enemy base
 */
export function buildMatchArena(): MatchArena {
  const W = 44;
  const H = 44;
  const tiles = new Array(W * H).fill(0);

  // Border walls (creates a square boundary, the diamond shape comes
  // from the lane layout + territory coloring inside)
  for (let i = 0; i < W; i++) {
    tiles[0 * W + i] = 2;
    tiles[(H - 1) * W + i] = 2;
    tiles[i * W + 0] = 2;
    tiles[i * W + (W - 1)] = 2;
  }

  // ── Territory: diagonal split ──────────────────────────────────────
  // Bottom-left triangle = player (blue), Top-right triangle = enemy (red)
  // The split line is the anti-diagonal: r + c = W
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      const distFromDiagonal = (r + c) - W;
      if (distFromDiagonal < -4) {
        tiles[r * W + c] = 5; // player territory (blue)
      } else if (distFromDiagonal > 4) {
        tiles[r * W + c] = 6; // enemy territory (red)
      }
      // |distFromDiagonal| <= 4 → neutral jungle band along the diagonal
    }
  }

  // ── MID LANE: main diagonal from bottom-left (3, H-4) to top-right (W-4, 3) ─
  // In isometric, the "diagonal" of the grid goes from bottom-left to top-right.
  // We make a 3-tile-wide path along col + row = constant (roughly W).
  for (let r = 3; r < H - 3; r++) {
    // The mid-lane column for this row: c = W - r (anti-diagonal)
    // But we want it to go from (3, H-4) to (W-4, 3), so c = W - 1 - r + offset
    const midC = W - 1 - r;
    for (let dx = -1; dx <= 1; dx++) {
      const c = midC + dx;
      if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
        if (r + c < W - 4) {
          tiles[r * W + c] = 7; // player lane (blue)
        } else if (r + c > W + 4) {
          tiles[r * W + c] = 8; // enemy lane (red)
        } else {
          tiles[r * W + c] = 1; // neutral mid lane
        }
      }
    }
  }

  // ── TOP LANE: along the left + top edges ───────────────────────────
  // Goes from player core (bottom-left) → up the LEFT edge → across the TOP → to enemy core (top-right)
  // Left edge segment (going up): col ~5, rows from H-6 to 5
  const topLaneLeftCol = 5;
  for (let r = H - 6; r >= 5; r--) {
    for (let dx = 0; dx < 2; dx++) {
      const c = topLaneLeftCol + dx;
      if (c > 1 && c < W - 2) {
        if (r + c < W - 4) {
          tiles[r * W + c] = 7; // player side
        } else if (r + c > W + 4) {
          tiles[r * W + c] = 8; // enemy side
        } else {
          tiles[r * W + c] = 1; // neutral
        }
      }
    }
  }
  // Top edge segment (going right): row ~5, cols from 5 to W-6
  const topLaneTopRow = 5;
  for (let c = 5; c <= W - 6; c++) {
    for (let dy = 0; dy < 2; dy++) {
      const r = topLaneTopRow + dy;
      if (r > 1 && r < H - 2) {
        if (r + c < W - 4) {
          tiles[r * W + c] = 7;
        } else if (r + c > W + 4) {
          tiles[r * W + c] = 8;
        } else {
          tiles[r * W + c] = 1;
        }
      }
    }
  }

  // ── BOTTOM LANE: along the bottom + right edges ────────────────────
  // Goes from player core (bottom-left) → across the BOTTOM → up the RIGHT edge → to enemy core (top-right)
  // Bottom edge segment (going right): row ~H-6, cols from 5 to W-6
  const botLaneBotRow = H - 6;
  for (let c = 5; c <= W - 6; c++) {
    for (let dy = 0; dy < 2; dy++) {
      const r = botLaneBotRow + dy;
      if (r > 1 && r < H - 2) {
        if (r + c < W - 4) {
          tiles[r * W + c] = 7;
        } else if (r + c > W + 4) {
          tiles[r * W + c] = 8;
        } else {
          tiles[r * W + c] = 1;
        }
      }
    }
  }
  // Right edge segment (going up): col ~W-6, rows from H-6 to 5
  const botLaneRightCol = W - 6;
  for (let r = H - 6; r >= 5; r--) {
    for (let dx = 0; dx < 2; dx++) {
      const c = botLaneRightCol + dx;
      if (c > 1 && c < W - 2) {
        if (r + c < W - 4) {
          tiles[r * W + c] = 7;
        } else if (r + c > W + 4) {
          tiles[r * W + c] = 8;
        } else {
          tiles[r * W + c] = 1;
        }
      }
    }
  }

  // ── Jungle: water + rocks in the neutral band between lanes ────────
  // Water patches in the jungle areas (between mid and top/bottom lanes)
  const waterPatches: Array<[number, number]> = [
    // Between mid and top lane (left side)
    [10, 14], [11, 14], [10, 15],
    [14, 10], [14, 11], [15, 10],
    // Between mid and bottom lane (right side)
    [W-12, H-15], [W-11, H-15], [W-12, H-14],
    [W-15, H-12], [W-15, H-11], [W-14, H-12],
    // Center jungle
    [Math.floor(W/2)-2, Math.floor(H/2)+2], [Math.floor(W/2)-1, Math.floor(H/2)+2],
  ];
  for (const [c, r] of waterPatches) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 3; // water
    }
  }

  // Rock clusters in jungle
  const jungleRocks: Array<[number, number]> = [
    [8, 10], [9, 10], [8, 11],
    [10, 8], [10, 9], [11, 8],
    [W-9, H-10], [W-10, H-10], [W-9, H-11],
    [W-10, H-8], [W-10, H-9], [W-11, H-8],
    [Math.floor(W/2)-3, Math.floor(H/2)], [Math.floor(W/2)-2, Math.floor(H/2)],
    [Math.floor(W/2)+1, Math.floor(H/2)], [Math.floor(W/2)+2, Math.floor(H/2)],
  ];
  for (const [c, r] of jungleRocks) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 2; // rock
    }
  }

  // ── Structure Positions ────────────────────────────────────────────
  // Player core: bottom-left corner
  const playerCore = { col: 3, row: H - 4 };
  // Enemy core: top-right corner
  const enemyCore = { col: W - 4, row: 3 };

  // Player towers (2 per lane = 6 total, but we'll do 1 per lane for now = 3)
  const playerTowers = [
    { col: 5, row: H - 8 },           // top lane tower
    { col: Math.floor(W * 0.35), row: Math.floor(H * 0.65) }, // mid lane tower
    { col: Math.floor(W * 0.65), row: H - 8 },  // bottom lane tower
  ];

  // Enemy towers
  const enemyTowers = [
    { col: 5, row: 8 },               // top lane tower
    { col: Math.floor(W * 0.65), row: Math.floor(H * 0.35) }, // mid lane tower
    { col: Math.floor(W * 0.35), row: 8 },  // bottom lane tower (mirrored)
  ];

  // Mark structures with accent tiles
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // ── Lane Waypoints (for minion movement) ───────────────────────────
  // Player minions go from player core → toward enemy core
  // Enemy minions go from enemy core → toward player core (reverse order)

  // TOP lane: player core → up left edge → across top → enemy core
  const topLane = [
    { col: playerCore.col, row: playerCore.row - 1 },  // start at player core
    { col: topLaneLeftCol + 1, row: H - 8 },            // move to left edge
    { col: topLaneLeftCol + 1, row: Math.floor(H / 2) }, // go up
    { col: topLaneLeftCol + 1, row: 6 },                // reach top
    { col: Math.floor(W / 2), row: topLaneTopRow },     // move right along top
    { col: enemyCore.col, row: enemyCore.row + 1 },     // arrive at enemy core
  ];

  // MID lane: straight diagonal from player core to enemy core
  const midLane = [];
  const midSteps = 6;
  for (let i = 0; i <= midSteps; i++) {
    const t = i / midSteps;
    midLane.push({
      col: Math.round(playerCore.col + (enemyCore.col - playerCore.col) * t),
      row: Math.round(playerCore.row + (enemyCore.row - playerCore.row) * t),
    });
  }

  // BOTTOM lane: player core → across bottom → up right edge → enemy core
  const bottomLane = [
    { col: playerCore.col + 2, row: playerCore.row },   // start at player core
    { col: Math.floor(W / 2), row: botLaneBotRow },      // move right along bottom
    { col: botLaneRightCol, row: botLaneBotRow },         // reach right edge
    { col: botLaneRightCol, row: Math.floor(H / 2) },     // go up
    { col: botLaneRightCol, row: 8 },                     // reach top
    { col: enemyCore.col, row: enemyCore.row + 1 },      // arrive at enemy core
  ];

  const playerStart = { col: playerCore.col + 1, row: playerCore.row - 1 };

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

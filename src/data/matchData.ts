/**
 * Match Mode Data — AoV-style MOBA arena.
 *
 * KEY INSIGHT: In isometric projection:
 *   Screen X = (col - row) * TILE_W/2  →  col = row means CENTER of screen (vertical line)
 *   Screen Y = (col + row) * TILE_H/2  →  high col+row = BOTTOM, low col+row = TOP
 *
 * So for a vertical mid lane on screen, we need col = row (the MAIN diagonal).
 * Player core at (W-4, H-4) = bottom-center on screen.
 * Enemy core at (3, 3) = top-center on screen.
 * Mid lane: main diagonal from (40,40) to (3,3) → appears VERTICAL on screen.
 *
 * Top lane: goes LEFT on screen (decrease col) then UP (decrease row)
 * Bottom lane: goes RIGHT on screen (increase col, decrease row) then UP
 *
 * The map naturally looks like a DIAMOND on screen because of isometric projection.
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

export function buildMatchArena(): MatchArena {
  const W = 72;
  const H = 72;
  const tiles = new Array(W * H).fill(0);

  // Border walls
  for (let i = 0; i < W; i++) {
    tiles[0 * W + i] = 2;
    tiles[(H - 1) * W + i] = 2;
    tiles[i * W + 0] = 2;
    tiles[i * W + (W - 1)] = 2;
  }

  // ── Territory: split along the main diagonal ───────────────────────
  // col + row > W → bottom-right half = player (blue, bottom of screen)
  // col + row < W → top-left half = enemy (red, top of screen)
  // Band near diagonal = neutral jungle
  for (let r = 1; r < H - 1; r++) {
    for (let c = 1; c < W - 1; c++) {
      const sum = c + r;
      if (sum > W + 4) {
        tiles[r * W + c] = 5; // player territory (blue)
      } else if (sum < W - 4) {
        tiles[r * W + c] = 6; // enemy territory (red)
      }
      // |sum - W| <= 4 → neutral jungle
    }
  }

  // Helper: set lane tile color based on territory
  const setLaneTile = (c: number, r: number) => {
    if (c < 1 || c >= W - 1 || r < 1 || r >= H - 1) return;
    const sum = c + r;
    if (sum > W + 4) {
      tiles[r * W + c] = 7; // player lane (blue)
    } else if (sum < W - 4) {
      tiles[r * W + c] = 8; // enemy lane (red)
    } else {
      tiles[r * W + c] = 1; // neutral lane
    }
  };

  // ── MID LANE: main diagonal (col = row) — 3 tiles wide ────────────
  for (let i = 3; i <= W - 4; i++) {
    setLaneTile(i - 1, i - 1);
    setLaneTile(i, i);
    setLaneTile(i + 1, i + 1);
    // Extra width: offset by 1 perpendicular to diagonal
    setLaneTile(i, i - 1);
    setLaneTile(i - 1, i);
  }

  // ── TOP LANE: goes LEFT on screen then UP — 3 tiles wide ──────────
  const topLaneCol = 6;
  // Horizontal segment at bottom
  for (let c = topLaneCol; c <= W - 5; c++) {
    setLaneTile(c, H - 5);
    setLaneTile(c, H - 6);
    setLaneTile(c, H - 7);
  }
  // Vertical segment (going up the left side)
  for (let r = 5; r <= H - 5; r++) {
    setLaneTile(topLaneCol, r);
    setLaneTile(topLaneCol + 1, r);
    setLaneTile(topLaneCol + 2, r);
  }
  // Horizontal segment at top
  for (let c = topLaneCol; c <= W - 5; c++) {
    setLaneTile(c, 5);
    setLaneTile(c, 6);
    setLaneTile(c, 7);
  }

  // ── BOTTOM LANE: goes RIGHT on screen then UP — 3 tiles wide ──────
  const botLaneCol = W - 8;
  // Vertical segment (going up the right side)
  for (let r = 5; r <= H - 5; r++) {
    setLaneTile(botLaneCol, r);
    setLaneTile(botLaneCol + 1, r);
    setLaneTile(botLaneCol + 2, r);
  }
  // Horizontal segment at top
  for (let c = 5; c <= botLaneCol; c++) {
    setLaneTile(c, 5);
    setLaneTile(c, 6);
    setLaneTile(c, 7);
  }

  // ── Jungle: water + rocks in the neutral band ──────────────────────
  const mid = Math.floor(W / 2);
  const waterPatches: Array<[number, number]> = [
    [mid - 8, mid + 2], [mid - 7, mid + 2], [mid - 8, mid + 3],
    [mid + 2, mid - 8], [mid + 3, mid - 8], [mid + 2, mid - 7],
    [mid - 6, mid + 4], [mid + 4, mid - 6],
    [mid - 4, mid + 6], [mid + 6, mid - 4],
  ];
  for (const [c, r] of waterPatches) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 3;
    }
  }

  const jungleRocks: Array<[number, number]> = [
    [mid - 10, mid + 2], [mid - 9, mid + 2], [mid - 10, mid + 3],
    [mid + 2, mid - 10], [mid + 3, mid - 10], [mid + 2, mid - 9],
    [mid - 5, mid + 5], [mid + 5, mid - 5],
    [mid - 7, mid + 7], [mid + 7, mid - 7],
  ];
  for (const [c, r] of jungleRocks) {
    if (c > 1 && c < W - 2 && r > 1 && r < H - 2) {
      tiles[r * W + c] = 2;
    }
  }

  // ── Structure Positions ────────────────────────────────────────────
  const playerCore = { col: W - 4, row: H - 4 };
  const enemyCore = { col: 3, row: 3 };

  // 2 towers per lane per side (6 per side = 12 total)
  const playerTowers = [
    { col: topLaneCol, row: H - 12 },              // top lane outer
    { col: topLaneCol, row: Math.floor(H * 0.5) }, // top lane inner
    { col: Math.floor(W * 0.6), row: Math.floor(H * 0.6) }, // mid lane outer
    { col: Math.floor(W * 0.55), row: Math.floor(H * 0.55) }, // mid lane inner
    { col: W - 12, row: topLaneCol },              // bottom lane outer
    { col: Math.floor(H * 0.5), row: topLaneCol },  // bottom lane inner
  ];

  const enemyTowers = [
    { col: topLaneCol, row: 11 },                   // top lane outer
    { col: topLaneCol, row: Math.floor(H * 0.5) }, // top lane inner
    { col: Math.floor(W * 0.4), row: Math.floor(H * 0.4) }, // mid lane outer
    { col: Math.floor(W * 0.45), row: Math.floor(H * 0.45) }, // mid lane inner
    { col: 11, row: topLaneCol },                   // bottom lane outer
    { col: Math.floor(H * 0.5), row: topLaneCol },  // bottom lane inner
  ];

  // Mark structures
  tiles[playerCore.row * W + playerCore.col] = 4;
  tiles[enemyCore.row * W + enemyCore.col] = 4;
  for (const t of playerTowers) tiles[t.row * W + t.col] = 4;
  for (const t of enemyTowers) tiles[t.row * W + t.col] = 4;

  // ── Lane Waypoints ─────────────────────────────────────────────────
  // TOP lane: player core → LEFT → UP → enemy core
  const topLane = [
    { col: W - 5, row: H - 5 },
    { col: topLaneCol + 1, row: H - 5 },
    { col: topLaneCol + 1, row: Math.floor(H * 0.75) },
    { col: topLaneCol + 1, row: Math.floor(H * 0.5) },
    { col: topLaneCol + 1, row: Math.floor(H * 0.25) },
    { col: topLaneCol + 1, row: 6 },
    { col: Math.floor(W * 0.25), row: 6 },
    { col: enemyCore.col + 1, row: enemyCore.row + 1 },
  ];

  // MID lane: main diagonal from player core to enemy core
  const midLane = [];
  const midSteps = 8;
  for (let i = 0; i <= midSteps; i++) {
    const t = i / midSteps;
    midLane.push({
      col: Math.round(playerCore.col + (enemyCore.col - playerCore.col) * t),
      row: Math.round(playerCore.row + (enemyCore.row - playerCore.row) * t),
    });
  }

  // BOTTOM lane: player core → RIGHT → UP → enemy core
  const bottomLane = [
    { col: W - 5, row: H - 5 },
    { col: W - 5, row: Math.floor(H * 0.75) },
    { col: botLaneCol, row: Math.floor(H * 0.5) },
    { col: botLaneCol, row: Math.floor(H * 0.25) },
    { col: botLaneCol, row: 6 },
    { col: Math.floor(W * 0.75), row: 6 },
    { col: enemyCore.col + 1, row: enemyCore.row + 1 },
  ];

  const playerStart = { col: W - 5, row: H - 5 };

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
// Definitions (unchanged)
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

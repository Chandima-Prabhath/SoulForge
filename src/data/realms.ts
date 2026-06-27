/**
 * Realm data — for Phase 0 this is a hand-laid prototype map.
 *
 * In Phase 4, this will be replaced by procedural generation seeded by
 * composeRealmSeed() (README §5 Layer 1).
 *
 * Tile codes:
 *   0 = grass (walkable, light green)
 *   1 = path (walkable, tan)
 *   2 = rock (visual only — Phase 0 doesn't have collision yet)
 *   3 = water (visual only)
 */

export interface RealmData {
  name: string;
  biome: string;
  width: number; // tiles
  height: number; // tiles
  tiles: number[]; // length = width * height, row-major
  playerStart: { col: number; row: number };
}

/**
 * Verdant Rift prototype — a 24x24 hand-laid map.
 * Center path runs diagonally; surrounded by grass with a few water/rock accents.
 */
function buildVerdantRiftPrototype(): RealmData {
  const W = 24;
  const H = 24;
  const tiles = new Array(W * H).fill(0); // grass

  // Diagonal path from top-left area toward center
  for (let i = 4; i < 20; i++) {
    const r = i;
    const c = i;
    if (c < W && r < H) tiles[r * W + c] = 1;
    if (c + 1 < W) tiles[r * W + c + 1] = 1;
  }

  // A few rock clusters
  const rocks: Array<[number, number]> = [
    [3, 6], [4, 6], [3, 7],
    [18, 4], [19, 4], [18, 5],
    [6, 18], [7, 18], [6, 19],
    [20, 18], [21, 18], [20, 19], [21, 19],
  ];
  for (const [c, r] of rocks) {
    if (c < W && r < H) tiles[r * W + c] = 2;
  }

  // A small pond
  const water: Array<[number, number]> = [
    [14, 8], [15, 8], [16, 8],
    [14, 9], [15, 9], [16, 9],
    [15, 10],
  ];
  for (const [c, r] of water) {
    if (c < W && r < H) tiles[r * W + c] = 3;
  }

  return {
    name: "Verdant Rift",
    biome: "forest",
    width: W,
    height: H,
    tiles,
    playerStart: { col: 6, row: 6 },
  };
}

export const verdantRiftPrototype: RealmData = buildVerdantRiftPrototype();

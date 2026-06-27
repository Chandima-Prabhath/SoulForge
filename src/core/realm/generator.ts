/**
 * Procedural Realm Generator — generates a RealmData from a seed.
 *
 * This is the heart of Phase 4's roguelite structure. Each realm is:
 *   - Seeded by composeRealmSeed(realmSeed, playerEssenceSalt, runNumber)
 *   - Biome chosen by depth (forest → cave → void)
 *   - Tilemap generated with paths, obstacles, and a boss arena
 *   - Enemy spawns placed procedurally (excluding boss arena)
 *   - Boss placed in the center of the arena
 *
 * The same seed always produces the same realm (deterministic).
 * Different players with different essence salts get different realms
 * even at the same depth (README §5 Layer 1).
 *
 * Death loop:
 *   1. Player dies → realm depth increments
 *   2. New seed = composeRealmSeed(depth, essenceSalt, runNumber)
 *   3. New biome based on depth
 *   4. DevourProgress persists (unlocked atoms carry over)
 *   5. New realm is harder (more enemies, higher stats)
 */

import { rngFromSeed, composeRealmSeed } from "../seed/rng";
import { getBiomeForDepth, type BiomeDef } from "../../data/biomes";

export interface GeneratedRealm {
  name: string;
  biome: string; // biome ID (forest, cave, void)
  width: number;
  height: number;
  tiles: number[];
  playerStart: { col: number; row: number };
  enemySpawns: Array<{ col: number; row: number }>;
  // Phase 4 extensions:
  biomeDef: BiomeDef; // full biome definition for renderer
  depth: number;
  bossSpawn: { col: number; row: number };
  bossTypeId: number;
  seed: number;
}

/**
 * Generate a realm from a seed + depth.
 *
 * @param baseSeed The realm seed (shared per depth tier)
 * @param playerEssenceSalt Derived from player's devour history (README §5 Layer 1)
 * @param runNumber Which run for this player (increments on death)
 * @param depth Current realm depth (1 = first realm, 2 = second, etc.)
 */
export function generateRealm(
  baseSeed: number,
  playerEssenceSalt: number,
  runNumber: number,
  depth: number
): GeneratedRealm {
  const finalSeed = composeRealmSeed(baseSeed, playerEssenceSalt, runNumber);
  const rng = rngFromSeed(finalSeed);
  const biome = getBiomeForDepth(depth);
  const size = biome.realmSize;

  // Generate the tilemap
  const tiles = generateTiles(size, rng, biome);

  // Find a valid player start (top-left area, on walkable tile)
  const playerStart = findWalkableTile(tiles, size, 2, 2, rng);

  // Generate enemy spawns (spread across the map, away from player start)
  const enemyCount = Math.floor(biome.baseEnemyCount + depth * 0.5);
  const enemySpawns = generateEnemySpawns(
    tiles, size, playerStart, enemyCount, rng
  );

  // Boss arena in the center-bottom of the map
  const bossSpawn = { col: Math.floor(size / 2), row: size - 3 };

  return {
    name: biome.name,
    biome: biome.id,
    biomeDef: biome,
    width: size,
    height: size,
    tiles,
    playerStart,
    enemySpawns,
    seed: finalSeed,
    depth,
    bossTypeId: biome.bossTypeId,
    bossSpawn,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tilemap Generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a tilemap with:
 *   - A border of rocks (walls)
 *   - Random rock clusters (obstacles)
 *   - A water/lava pond
 *   - A diagonal path from player start toward center
 *   - A boss arena (clear area in center-bottom)
 *
 * Tile codes:
 *   0 = grass (walkable)
 *   1 = path (walkable)
 *   2 = rock (obstacle)
 *   3 = water (obstacle)
 *   4 = accent (boss arena floor — visual only)
 */
function generateTiles(
  size: number,
  rng: () => number,
  biome: BiomeDef
): number[] {
  const tiles = new Array(size * size).fill(0); // grass

  // Border walls
  for (let i = 0; i < size; i++) {
    tiles[0 * size + i] = 2;            // top row
    tiles[(size - 1) * size + i] = 2;   // bottom row
    tiles[i * size + 0] = 2;            // left col
    tiles[i * size + (size - 1)] = 2;   // right col
  }

  // Random rock clusters (3-5 clusters)
  const rockClusterCount = 3 + Math.floor(rng() * 3);
  for (let c = 0; c < rockClusterCount; c++) {
    const cx = 2 + Math.floor(rng() * (size - 4));
    const cy = 2 + Math.floor(rng() * (size - 4));
    const clusterSize = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < clusterSize; i++) {
      const dx = Math.floor((rng() - 0.5) * 4);
      const dy = Math.floor((rng() - 0.5) * 4);
      const x = cx + dx;
      const y = cy + dy;
      if (x > 1 && x < size - 2 && y > 1 && y < size - 2) {
        tiles[y * size + x] = 2;
      }
    }
  }

  // A pond (water/lava)
  const pondCx = 4 + Math.floor(rng() * (size - 8));
  const pondCy = 4 + Math.floor(rng() * (size - 8));
  const pondRadius = 2 + Math.floor(rng() * 2);
  for (let y = pondCy - pondRadius; y <= pondCy + pondRadius; y++) {
    for (let x = pondCx - pondRadius; x <= pondCx + pondRadius; x++) {
      if (x > 1 && x < size - 2 && y > 1 && y < size - 2) {
        const dx = x - pondCx;
        const dy = y - pondCy;
        if (dx * dx + dy * dy <= pondRadius * pondRadius) {
          tiles[y * size + x] = 3;
        }
      }
    }
  }

  // Diagonal path from top-left toward center
  const pathStart = 3;
  const pathEnd = Math.floor(size * 0.6);
  for (let i = pathStart; i < pathEnd; i++) {
    const r = i;
    const c = i;
    if (c < size - 1 && r < size - 1) {
      tiles[r * size + c] = 1;
      tiles[r * size + c + 1] = 1;
    }
  }

  // Boss arena — clear a circle in the center-bottom and mark with accent tiles
  const arenaCx = Math.floor(size / 2);
  const arenaCy = size - 3;
  const arenaRadius = 3;
  for (let y = arenaCy - arenaRadius; y <= arenaCy + arenaRadius; y++) {
    for (let x = arenaCx - arenaRadius; x <= arenaCx + arenaRadius; x++) {
      if (x > 0 && x < size - 1 && y > 0 && y < size - 1) {
        const dx = x - arenaCx;
        const dy = y - arenaCy;
        if (dx * dx + dy * dy <= arenaRadius * arenaRadius) {
          tiles[y * size + x] = 4; // accent (boss arena floor)
        }
      }
    }
  }

  // Reference biome to avoid unused warning (biome tile colors are read by renderer)
  void biome;

  return tiles;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function findWalkableTile(
  tiles: number[],
  size: number,
  startCol: number,
  startRow: number,
  rng: () => number
): { col: number; row: number } {
  // Search outward from (startCol, startRow) for a walkable tile (0 or 1)
  for (let radius = 0; radius < size; radius++) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;
        const c = startCol + dx;
        const r = startRow + dy;
        if (c < 0 || c >= size || r < 0 || r >= size) continue;
        const tile = tiles[r * size + c];
        if (tile === 0 || tile === 1) {
          return { col: c, row: r };
        }
      }
    }
  }
  // Fallback — just use (startCol, startRow) even if not walkable
  void rng;
  return { col: startCol, row: startRow };
}

function generateEnemySpawns(
  tiles: number[],
  size: number,
  playerStart: { col: number; row: number },
  count: number,
  rng: () => number
): Array<{ col: number; row: number }> {
  const spawns: Array<{ col: number; row: number }> = [];
  const minDistFromPlayer = 6; // tiles
  const arenaCx = Math.floor(size / 2);
  const arenaCy = size - 3;

  let attempts = 0;
  const maxAttempts = count * 10;
  while (spawns.length < count && attempts < maxAttempts) {
    attempts++;
    const c = 1 + Math.floor(rng() * (size - 2));
    const r = 1 + Math.floor(rng() * (size - 2));
    const tile = tiles[r * size + c];
    if (tile !== 0 && tile !== 1) continue; // not walkable

    // Distance from player start
    const distToPlayer = Math.hypot(c - playerStart.col, r - playerStart.row);
    if (distToPlayer < minDistFromPlayer) continue;

    // Distance from boss arena
    const distToArena = Math.hypot(c - arenaCx, r - arenaCy);
    if (distToArena < 4) continue;

    // Distance from other spawns (avoid clumping)
    let tooClose = false;
    for (const s of spawns) {
      if (Math.hypot(c - s.col, r - s.row) < 3) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    spawns.push({ col: c, row: r });
  }

  return spawns;
}

// ─────────────────────────────────────────────────────────────────────────────
// Essence Salt — derived from player's devour history (README §5 Layer 1)
//
// The salt personalizes the realm seed so two players at the same depth
// get different realms. It evolves as the player devours more enemies,
// so the same player's realms shift over time too.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compute the player's essence salt from their DevourProgress.
 * This is a hash of: total devoured + unlocked atom bitmask.
 * It changes as the player unlocks new atoms, so their realms evolve.
 */
export function computeEssenceSalt(
  totalDevoured: number,
  unlockedElements: number,
  unlockedForms: number,
  unlockedVectors: number,
  unlockedModifiers: number
): number {
  // Simple hash — combine all factors into a single 32-bit number
  let h = totalDevoured * 7919;
  h ^= unlockedElements * 31;
  h ^= unlockedForms * 97;
  h ^= unlockedVectors * 53;
  h ^= unlockedModifiers * 71;
  return h >>> 0;
}

/**
 * Biome Registry — defines the visual + gameplay character of each biome.
 *
 * Biomes are chosen based on realm depth. Deeper realms = harder biomes
 * with better devour drops. This is the vertical progression that
 * complements the horizontal divergence (README §5).
 *
 * Phase 4: 3 biomes, cycling as the player descends.
 *   Depth 1-2: Verdant Rift (forest) — Frost/Fire enemies, easy
 *   Depth 3-4: Emberdeep Caverns (cave) — Fire/Lightning enemies, medium
 *   Depth 5+:  The Void Below (void) — Void enemies, hard, rare drops
 */

export interface BiomeDef {
  id: string;
  name: string;
  /** Tile colors for the renderer: [grass, path, rock, water]. */
  tileColors: {
    grass: number;
    path: number;
    rock: number;
    water: number;
    accent: number; // special tiles (boss arena, shrines)
  };
  /** Enemy type IDs (from ENEMY_TYPES) that spawn in this biome. */
  enemyTypeIds: number[];
  /** Boss enemy type ID for this biome. */
  bossTypeId: number;
  /** Number of enemies to spawn (excluding boss). Scales with depth. */
  baseEnemyCount: number;
  /** Enemy stat multiplier (HP, damage) — scales with depth. */
  enemyStatMultiplier: number;
  /** Realm size in tiles (width = height). */
  realmSize: number;
  /** Flavor text shown when entering the realm. */
  enterFlavor: string;
  /** Ambient color tint (future: post-processing filter). */
  ambientColor: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Biome Definitions
// ─────────────────────────────────────────────────────────────────────────────

export const BIOMES: Record<string, BiomeDef> = {
  forest: {
    id: "forest",
    name: "Verdant Rift",
    tileColors: {
      grass: 0x4a7c3a,
      path: 0x9c8456,
      rock: 0x6b6b75,
      water: 0x3a6db0,
      accent: 0xffb86c,
    },
    enemyTypeIds: [0, 1, 2], // Frost Slime, Ember Wisp, Storm Sprite
    bossTypeId: 3, // Treant Boss (defined in enemies.ts)
    baseEnemyCount: 12,
    enemyStatMultiplier: 1.0,
    realmSize: 48,
    enterFlavor: "The air hums with ancient growth. Something watches from the canopy.",
    ambientColor: 0x202030,
  },
  cave: {
    id: "cave",
    name: "Emberdeep Caverns",
    tileColors: {
      grass: 0x3a2a1a, // dark earth
      path: 0x6a4a2a, // warm brown
      rock: 0x4a3020, // dark stone
      water: 0x8a3a1a, // lava
      accent: 0xff6020, // ember glow
    },
    enemyTypeIds: [1, 2, 4], // Ember Wisp, Storm Sprite, Void Shade
    bossTypeId: 4, // Magma Wyrm (placeholder — uses Void Shade type for now)
    baseEnemyCount: 16,
    enemyStatMultiplier: 1.3,
    realmSize: 52,
    enterFlavor: "Heat rises from below. The walls pulse with ember-light.",
    ambientColor: 0x301810,
  },
  void: {
    id: "void",
    name: "The Void Below",
    tileColors: {
      grass: 0x1a1a2a, // void floor
      path: 0x3a2a4a, // purple path
      rock: 0x2a2a3a, // dark crystal
      water: 0x4a2a6a, // void fluid
      accent: 0x9040ff, // void glow
    },
    enemyTypeIds: [4, 2, 1], // Void Shade, Storm Sprite, Ember Wisp
    bossTypeId: 5, // Void Titan
    baseEnemyCount: 20,
    enemyStatMultiplier: 1.6,
    realmSize: 56,
    enterFlavor: "Reality frays at the edges. The void stares back.",
    ambientColor: 0x100820,
  },
};

/**
 * Get the biome for a given realm depth.
 * Depth 1-2: forest, Depth 3-4: cave, Depth 5+: void.
 */
export function getBiomeForDepth(depth: number): BiomeDef {
  if (depth <= 2) return BIOMES.forest;
  if (depth <= 4) return BIOMES.cave;
  return BIOMES.void;
}

/**
 * Get the biome by ID.
 */
export function getBiomeById(id: string): BiomeDef | undefined {
  return BIOMES[id];
}

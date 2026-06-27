/**
 * Enemy Type Registry — data for all enemy types in SoulForge.
 *
 * Each enemy type defines:
 *   - Base stats (HP, speed, aggro range, attack damage/cooldown)
 *   - Visual style (color, sprite ID)
 *   - Devour drops — which grammar atoms this enemy type can reveal when devoured
 *
 * Phase 3: 3 enemy types, each dropping a different element fragment.
 * This is the foundation of the Devour progression system (README §4.2).
 *
 * When the player devours an enemy's essence shard, there's a chance to
 * unlock one of the atoms from that enemy's devourDrops list. Once unlocked,
 * the atom is permanently available for skill crafting in the Sanctum.
 */

import type { ElementId, FormId, VectorId, ModifierId } from "../core/grammar/types";

/** Atom type for unlock tracking. */
export type AtomType = "element" | "form" | "vector" | "modifier";

/** An atom that can be unlocked by devouring enemies. */
export interface AtomUnlock {
  type: AtomType;
  id: ElementId | FormId | VectorId | ModifierId;
  /** Drop chance 0..1. */
  chance: number;
}

export interface EnemyTypeDef {
  id: number;
  name: string;
  /** Sprite ID for the renderer. */
  spriteId: number;
  /** Primary color (used if renderer wants to tint). */
  color: number;
  /** Base stats. */
  hp: number;
  speed: number;
  aggroRange: number;
  attackRange: number;
  attackDamage: number;
  attackCooldown: number; // seconds
  /** Grammar atoms this enemy can reveal when devoured. */
  devourDrops: AtomUnlock[];
  /** Flavor text shown in the grimoire. */
  flavor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Enemy Types
// ─────────────────────────────────────────────────────────────────────────────

export const ENEMY_TYPES: Record<number, EnemyTypeDef> = {
  0: {
    id: 0,
    name: "Frost Slime",
    spriteId: 4,
    color: 0x60c0ff,
    hp: 50,
    speed: 90,
    aggroRange: 200,
    attackRange: 36,
    attackDamage: 8,
    attackCooldown: 1.5,
    devourDrops: [
      { type: "element", id: 2, chance: 1.0 }, // Frost element (guaranteed first kill)
      { type: "modifier", id: 2, chance: 0.3 }, // Linger modifier (30% chance)
    ],
    flavor: "A gelatinous blob of animated frost. Slow, but persistent.",
  },
  1: {
    id: 1,
    name: "Ember Wisp",
    spriteId: 4,
    color: 0xff6020,
    hp: 35,
    speed: 120,
    aggroRange: 240,
    attackRange: 30,
    attackDamage: 6,
    attackCooldown: 1.0,
    devourDrops: [
      { type: "element", id: 1, chance: 1.0 }, // Fire element
      { type: "modifier", id: 1, chance: 0.3 }, // Split modifier
    ],
    flavor: "A flickering mote of living flame. Fast and fragile.",
  },
  2: {
    id: 2,
    name: "Storm Sprite",
    spriteId: 4,
    color: 0xffe040,
    hp: 65,
    speed: 100,
    aggroRange: 260,
    attackRange: 40,
    attackDamage: 10,
    attackCooldown: 1.3,
    devourDrops: [
      { type: "element", id: 3, chance: 1.0 }, // Lightning element
      { type: "modifier", id: 3, chance: 0.3 }, // Chain modifier
    ],
    flavor: "A crackling knot of wind and static. Announces itself with thunder.",
  },
  3: {
    id: 3,
    name: "Treant Boss",
    spriteId: 4,
    color: 0x4a7c3a,
    hp: 200,
    speed: 60,
    aggroRange: 300,
    attackRange: 50,
    attackDamage: 15,
    attackCooldown: 1.8,
    devourDrops: [
      { type: "element", id: 2, chance: 1.0 }, // Frost
      { type: "element", id: 1, chance: 1.0 }, // Fire
      { type: "form", id: 2, chance: 1.0 },    // Nova form
      { type: "modifier", id: 0, chance: 0.5 }, // Pierce
    ],
    flavor: "An ancient guardian of the Verdant Rift. Its roots run deep.",
  },
  4: {
    id: 4,
    name: "Void Shade",
    spriteId: 4,
    color: 0x9040ff,
    hp: 80,
    speed: 110,
    aggroRange: 280,
    attackRange: 35,
    attackDamage: 12,
    attackCooldown: 1.1,
    devourDrops: [
      { type: "element", id: 4, chance: 1.0 }, // Void element
      { type: "modifier", id: 4, chance: 0.3 }, // Grow modifier
    ],
    flavor: "A fragment of the void given form. It devours light.",
  },
  5: {
    id: 5,
    name: "Void Titan",
    spriteId: 4,
    color: 0xd0a0ff,
    hp: 350,
    speed: 70,
    aggroRange: 350,
    attackRange: 60,
    attackDamage: 20,
    attackCooldown: 2.0,
    devourDrops: [
      { type: "element", id: 4, chance: 1.0 }, // Void
      { type: "element", id: 3, chance: 1.0 }, // Lightning
      { type: "form", id: 1, chance: 1.0 },    // Beam
      { type: "modifier", id: 4, chance: 1.0 }, // Grow
      { type: "modifier", id: 1, chance: 0.5 }, // Split
    ],
    flavor: "A colossus of the void. Its presence warps reality.",
  },
};

/**
 * Default enemy type for the Phase 1 slime (backwards compatible).
 * This is what spawnEnemy() uses if no type is specified.
 */
export const DEFAULT_ENEMY_TYPE = 0;

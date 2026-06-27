/**
 * Skill Grammar Registry — atom definitions for Phase 2.
 *
 * This is the data that the grammar engine reads. Adding a new element, form,
 * vector, or modifier is purely additive — just add an entry here. The
 * execution system picks it up automatically.
 *
 * Phase 2 atom set (per README roadmap):
 *   5 Elements  : Force, Fire, Frost, Lightning, Void
 *   3 Forms     : Projectile, Beam, Nova
 *   3 Vectors   : Ranged, Self, Cone
 *   5 Modifiers : Pierce, Split, Linger, Chain, Grow
 *
 * Total unique skills possible from this set:
 *   5 × 3 × 3 × (1 + 5 + 10 + 10) = 2,310
 *
 * (Modifiers can stack up to 3 deep; C(5,k) for k=0..3 = 1+5+10+10 = 26
 * modifier combinations per element×form×vector.)
 */

import type {
  ElementDef,
  FormDef,
  VectorDef,
  ModifierDef,
  ElementId,
  FormId,
  VectorId,
  ModifierId,
} from "../core/grammar/types";

// ─────────────────────────────────────────────────────────────────────────────
// Elements — the "what" of a skill
// ─────────────────────────────────────────────────────────────────────────────

export const ELEMENTS: Record<ElementId, ElementDef> = {
  0: {
    id: 0,
    name: "Force",
    color: 0xe0e0e8,
    accentColor: 0xffffff,
    damageMultiplier: 1.0,
    flavor: "Pure kinetic will. No frills, no status — just impact.",
  },
  1: {
    id: 1,
    name: "Fire",
    color: 0xff6020,
    accentColor: 0xffd060,
    damageMultiplier: 1.0,
    statusEffect: {
      type: "burn",
      duration: 3.0,
      magnitude: 4, // dmg/sec
    },
    flavor: "Heat that lingers. Burns through flesh and patience alike.",
  },
  2: {
    id: 2,
    name: "Frost",
    color: 0x60c0ff,
    accentColor: 0xe0f0ff,
    damageMultiplier: 0.9,
    statusEffect: {
      type: "slow",
      duration: 2.5,
      magnitude: 0.5, // 50% slow
    },
    flavor: "Cold that grips. Slows the body, sharpens the mind.",
  },
  3: {
    id: 3,
    name: "Lightning",
    color: 0xffe040,
    accentColor: 0xffffff,
    damageMultiplier: 1.1,
    statusEffect: {
      type: "shock",
      duration: 1.0,
      magnitude: 0.3, // 30% damage taken increase
    },
    flavor: "Flickering violence. Strikes once, then again, then again.",
  },
  4: {
    id: 4,
    name: "Void",
    color: 0x9040ff,
    accentColor: 0xd0a0ff,
    damageMultiplier: 1.2,
    statusEffect: {
      type: "drain",
      duration: 2.0,
      magnitude: 0.3, // heal 30% of damage dealt
    },
    flavor: "The space between stars. Hungry. Patient.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Forms — the "shape" of a skill
// ─────────────────────────────────────────────────────────────────────────────

export const FORMS: Record<FormId, FormDef> = {
  0: {
    id: 0,
    name: "Projectile",
    baseDamage: 22,
    baseSpeed: 420,
    baseRadius: 10,
    baseCooldown: 0.45,
    baseLifetime: 1.6,
    flavor: "A single bolt that travels from caster to target.",
  },
  1: {
    id: 1,
    name: "Beam",
    baseDamage: 32,
    baseSpeed: 0, // instant
    baseRadius: 8,
    baseCooldown: 1.2,
    baseLifetime: 0, // instant
    flavor: "An instantaneous line of energy. Hits everything along its path.",
  },
  2: {
    id: 2,
    name: "Nova",
    baseDamage: 28,
    baseSpeed: 360, // expansion speed
    baseRadius: 140, // max radius
    baseCooldown: 2.0,
    baseLifetime: 0.4, // time to fully expand
    flavor: "An expanding ring of energy emanating from the caster.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Vectors — the "where/how" of a skill
// ─────────────────────────────────────────────────────────────────────────────

export const VECTORS: Record<VectorId, VectorDef> = {
  0: {
    id: 0,
    name: "Ranged",
    damageMultiplier: 1.0,
    cooldownMultiplier: 1.0,
    flavor: "Aimed at a target point. Standard delivery.",
  },
  1: {
    id: 1,
    name: "Self",
    damageMultiplier: 1.1,
    cooldownMultiplier: 0.9,
    flavor: "Centered on the caster. Slightly stronger, slightly faster to cast.",
  },
  2: {
    id: 2,
    name: "Cone",
    damageMultiplier: 0.85,
    cooldownMultiplier: 1.1,
    flavor: "A short-range fan in the facing direction. Wider reach, weaker hit.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Modifiers — stackable traits (up to 3 per skill)
// ─────────────────────────────────────────────────────────────────────────────

export const MODIFIERS: Record<ModifierId, ModifierDef> = {
  0: {
    id: 0,
    name: "Pierce",
    damageMultiplier: 0.85,
    cooldownMultiplier: 1.1,
    magnitude: 2, // pierces 2 additional enemies (so hits 3 total)
    flavor: "Pierces through up to 2 additional enemies before despawning.",
  },
  1: {
    id: 1,
    name: "Split",
    damageMultiplier: 0.9,
    cooldownMultiplier: 1.15,
    magnitude: 2, // splits into 2
    flavor: "On enemy death, splits into 2 smaller copies that seek new targets.",
  },
  2: {
    id: 2,
    name: "Linger",
    damageMultiplier: 0.8,
    cooldownMultiplier: 1.2,
    magnitude: 2.0, // seconds the area persists
    flavor: "Leaves a damaging area at the impact point for 2 seconds.",
  },
  3: {
    id: 3,
    name: "Chain",
    damageMultiplier: 0.75,
    cooldownMultiplier: 1.25,
    magnitude: 3, // chains to 3 additional enemies
    flavor: "Bounces to the nearest enemy within range, up to 3 times.",
  },
  4: {
    id: 4,
    name: "Grow",
    damageMultiplier: 1.0,
    cooldownMultiplier: 1.05,
    magnitude: 1.5, // up to 1.5× damage and radius with travel distance
    flavor: "Grows in size and damage the further it travels.",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Pre-defined starter skills — the player's initial kit
// ─────────────────────────────────────────────────────────────────────────────

import type { SkillDefinition } from "../core/grammar/types";

/**
 * The player's starting kit per README §4.6:
 *   Slot 1: [Devour]     — unique skill, comes online in Phase 3
 *   Slot 2: Mana Bolt    — Force + Projectile + Ranged
 *   Slot 3: Frost Nova   — Frost + Nova + Self
 *   Slot 4: Phase Step   — movement skill (placeholder, uses Force + Cone + Self)
 *
 * Phase 2 ships with these as pre-defined compositions. The player will be
 * able to craft NEW skills in the Sanctum UI (later in Phase 2).
 */
export const STARTER_SKILLS: SkillDefinition[] = [
  {
    id: "starter-mana-bolt",
    name: "Mana Bolt",
    element: 0, // Force
    form: 0,    // Projectile
    vector: 0,  // Ranged
    modifiers: [null, null, null],
    description: "Your basic attack. Pure force, no frills.",
  },
  {
    id: "starter-frost-nova",
    name: "Frost Nova",
    element: 2, // Frost
    form: 2,    // Nova
    vector: 1,  // Self
    modifiers: [null, null, null],
    description: "An expanding ring of frost. Slows anything it touches.",
  },
  {
    id: "starter-lightning-beam",
    name: "Lightning Beam",
    element: 3, // Lightning
    form: 1,    // Beam
    vector: 0,  // Ranged
    modifiers: [null, null, null],
    description: "An instantaneous bolt of lightning. Higher damage, longer cooldown.",
  },
];

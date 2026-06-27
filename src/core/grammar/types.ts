/**
 * Skill Grammar Types — pure TypeScript, no rendering dependencies.
 *
 * This is the heart of SoulForge. A skill is not a hardcoded function —
 * it's a composition of grammar atoms. The skill execution system interprets
 * the composition at runtime to produce the actual effect.
 *
 * Layers (per README §4.1):
 *   Element    — the "what" (Fire, Frost, etc.) — drives color + damage type
 *   Form       — the "shape" (Projectile, Beam, Nova) — drives geometry
 *   Vector     — the "where/how" (Ranged, Self, Cone) — drives targeting
 *   Modifiers  — stackable traits (Pierce, Split, Linger) — 0-3 slots
 *
 * Total possible skills with the Phase 2 atom set:
 *   5 elements × 3 forms × 3 vectors × C(5,0..3) modifier combos
 *   = 5 × 3 × 3 × (1 + 5 + 10 + 10) = 2,310 unique skills
 *   (more than enough to prove the grammar works)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Atom IDs — small integers for compact storage and fast lookup
// ─────────────────────────────────────────────────────────────────────────────

/** Element IDs (index into ELEMENTS registry). */
export type ElementId =
  | 0 // Force    — pure kinetic, gray/white
  | 1 // Fire     — orange/red, burns over time
  | 2 // Frost    — cyan, slows on hit
  | 3 // Lightning — yellow, chains to nearby enemies
  | 4 // Void     — purple, ignores一部分 armor (placeholder for Phase 3+)

/** Form IDs (index into FORMS registry). */
export type FormId =
  | 0 // Projectile — single traveling bolt
  | 1 // Beam       — instant line from caster
  | 2 // Nova       — expanding ring around caster

/** Vector IDs (index into VECTORS registry). */
export type VectorId =
  | 0 // Ranged — aimed at a target point
  | 1 // Self   — centered on caster
  | 2 // Cone   — short-range fan in facing direction

/** Modifier IDs (index into MODIFIERS registry). */
export type ModifierId =
  | 0 // Pierce — passes through up to N enemies
  | 1 // Split  — on enemy death, spawns 2 smaller copies
  | 2 // Linger — leaves a damaging area at impact for 2s
  | 3 // Chain  — bounces to nearest enemy within range
  | 4 // Grow   — increases size/damage with travel distance

// ─────────────────────────────────────────────────────────────────────────────
// Atom Definitions — static data describing each atom's gameplay effects
// ─────────────────────────────────────────────────────────────────────────────

export interface ElementDef {
  id: ElementId;
  name: string;
  color: number;       // primary color (hex)
  accentColor: number; // secondary color (hex)
  damageMultiplier: number; // base damage × this
  /** Status effect applied on hit. */
  statusEffect?: {
    type: "burn" | "slow" | "shock" | "drain";
    duration: number; // seconds
    magnitude: number; // per-element meaning (dmg/sec, slow%, etc.)
  };
  /** Optional lore flavor — shown in crafting UI. */
  flavor: string;
}

export interface FormDef {
  id: FormId;
  name: string;
  /** Base geometric properties — interpreted by the execution system. */
  baseDamage: number;
  baseSpeed: number;       // px/sec for projectile; 0 for instant forms
  baseRadius: number;      // hit radius / nova radius
  baseCooldown: number;    // seconds
  baseLifetime: number;    // seconds (0 for instant)
  flavor: string;
}

export interface VectorDef {
  id: VectorId;
  name: string;
  /** Damage multiplier applied on top of Form's base damage. */
  damageMultiplier: number;
  /** Cooldown multiplier applied on top of Form's base cooldown. */
  cooldownMultiplier: number;
  flavor: string;
}

export interface ModifierDef {
  id: ModifierId;
  name: string;
  /** Damage multiplier — e.g., Pierce might do 0.8× damage but hit multiple. */
  damageMultiplier: number;
  /** Cooldown multiplier — e.g., powerful modifiers add cooldown. */
  cooldownMultiplier: number;
  /** Effect magnitude — meaning depends on the modifier type. */
  magnitude: number;
  flavor: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Composed Skill Definition — what gets stored in a SkillSlot
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A skill is a composition of grammar atoms. The execution system reads this
 * and produces the actual effect. Players craft these in the Sanctum (Phase 5)
 * and equip them to slots. Phase 2 ships with a few pre-defined ones.
 */
export interface SkillDefinition {
  /** Unique ID for this composed skill (used for save/load, sharing codes). */
  id: string;
  /** Player-authored name (e.g., "Frost Echo", "Veilfire Bloom"). */
  name: string;
  /** Element atom. */
  element: ElementId;
  /** Form atom. */
  form: FormId;
  /** Vector atom. */
  vector: VectorId;
  /** Up to 3 modifier atoms. Empty slots are null. */
  modifiers: (ModifierId | null)[];
  /** Optional short description shown in the grimoire. */
  description?: string;
}

/**
 * Computed stats for a skill — derived from its atoms.
 * The execution system uses these instead of recomputing every cast.
 */
export interface SkillStats {
  damage: number;
  speed: number;
  radius: number;
  cooldown: number;
  lifetime: number;
  pierceCount: number;
  splitOnKill: boolean;
  lingerDuration: number;
  chainCount: number;
  growWithDistance: boolean;
  statusEffect?: ElementDef["statusEffect"];
  color: number;
  accentColor: number;
}

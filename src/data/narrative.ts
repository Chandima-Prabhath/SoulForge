/**
 * Narrative Data — all story text for SoulForge.
 *
 * Per README §7: "Light but resonant. No Genshin-scale cutscenes."
 *   - No long cutscenes — max 30 seconds between realms
 *   - Voice of the World: concise system messages (diegetic guidance)
 *   - Inner Sage: short reactive dialogue in combat
 *   - Lore via items: skill descriptions, essence descriptions, realm names
 *   - Prologue: 2-3 minute isekai summoning → tutorial naturally → first realm
 *
 * This file centralizes all narrative text so it's easy to edit without
 * touching game logic. Future localization would replace this with a
 * JSON loader.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Prologue — the isekai summoning sequence shown on first load
// ─────────────────────────────────────────────────────────────────────────────

export interface PrologueBeat {
  /** Text shown for this beat. */
  text: string;
  /** Seconds to display before auto-advancing (0 = wait for click). */
  duration: number;
  /** Optional speaker name. */
  speaker?: string;
  /** Background color tint for this beat. */
  color?: string;
}

export const PROLOGUE_BEATS: PrologueBeat[] = [
  {
    text: "You were nobody special.",
    duration: 3.5,
    color: "#0a0a0f",
  },
  {
    text: "A life that ended without fanfare — a Tuesday, a crosswalk, a truck you didn't see coming.",
    duration: 5,
    color: "#0a0a0f",
  },
  {
    text: "But death was not the end.",
    duration: 3,
    color: "#1a0a2a",
  },
  {
    text: "You feel yourself pulled — not toward light, but toward hunger.",
    duration: 4,
    color: "#1a0a2a",
  },
  {
    text: "A voice speaks. Not from outside. From within.",
    duration: 3.5,
    speaker: "???",
    color: "#2a1a3a",
  },
  {
    text: "「You have been summoned. The realm is broken. You are the anomaly that will mend it — or consume it.」",
    duration: 6,
    speaker: "Voice of the World",
    color: "#2a1a3a",
  },
  {
    text: "「Unique Skill acquired: [Devour].」",
    duration: 4,
    speaker: "Voice of the World",
    color: "#2a1a3a",
  },
  {
    text: "「Analysis protocol initialized. I am your Sage. I will guide your growth.」",
    duration: 5,
    speaker: "Inner Sage",
    color: "#2a1a3a",
  },
  {
    text: "You open your eyes. The air hums with ancient growth.",
    duration: 3.5,
    color: "#0a1a0f",
  },
  {
    text: "Something watches from the canopy. You are no longer alone.",
    duration: 4,
    color: "#0a1a0f",
  },
  {
    text: "You are no longer powerless.",
    duration: 3,
    color: "#0a1a0f",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Realm Intro Texts — shown when entering a new realm
// ─────────────────────────────────────────────────────────────────────────────

export interface RealmIntro {
  /** Biome ID this intro applies to. */
  biomeId: string;
  /** Text shown when entering a realm of this biome. */
  intro: string;
  /** Sage's comment on entering. */
  sageComment: string;
}

export const REALM_INTROS: Record<string, RealmIntro> = {
  forest: {
    biomeId: "forest",
    intro: "The Verdant Rift. Ancient growth stirs with corruption.",
    sageComment: "「I detect multiple hostiles. Recommend caution — your [Devour] grows stronger with each consumed essence.」",
  },
  cave: {
    biomeId: "cave",
    intro: "Emberdeep Caverns. The heat rises from something vast below.",
    sageComment: "「Enemies here are more resilient. Consider synthesizing a skill with the Split modifier — crowd control will be essential.」",
  },
  void: {
    biomeId: "void",
    intro: "The Void Below. Reality frays at the edges of your perception.",
    sageComment: "「You have grown powerful. But the Void Titan ahead... even I cannot fully analyze it. Trust your instincts.」",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Sage Dialogue — shown in the Sanctum
// ─────────────────────────────────────────────────────────────────────────────

export interface SageLine {
  /** Condition for this line to appear. */
  condition: "first_sanctum" | "return_sanctum" | "low_atoms" | "many_atoms" | "boss_killed";
  /** The Sage's dialogue. */
  text: string;
}

export const SAGE_LINES: SageLine[] = [
  {
    condition: "first_sanctum",
    text: "「This is your Sanctum — a space between realms. Here, you forge new skills from the essence you have devoured. Craft. Synthesize. Equip. Then descend deeper.」",
  },
  {
    condition: "return_sanctum",
    text: "「Death is not the end for you, anomaly. Each fall makes you wiser. What will you forge with your new understanding?」",
  },
  {
    condition: "low_atoms",
    text: "「Your grimoire is sparse. Devour more enemies to unlock new elements, forms, and modifiers. The deeper you go, the rarer the drops.」",
  },
  {
    condition: "many_atoms",
    text: "「Impressive. Your devouring has unlocked many atoms. Consider synthesizing — combining two skills can produce results neither could achieve alone.」",
  },
  {
    condition: "boss_killed",
    text: "「You devoured a guardian. Its essence was rich — I detect new atoms available for crafting. Use them wisely.」",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Combat Hints — Inner Sage reactive dialogue during combat
// ─────────────────────────────────────────────────────────────────────────────

export interface CombatHint {
  /** Trigger condition. */
  trigger: "low_hp" | "enemy_near" | "skill_unlocked" | "devour_ready" | "boss_engaged";
  /** Hint text (shown briefly via Voice of the World). */
  text: string;
  /** Minimum seconds between repeats of this hint. */
  cooldown: number;
}

export const COMBAT_HINTS: CombatHint[] = [
  {
    trigger: "low_hp",
    text: "「Health critical. Consider [Devour] — it executes weakened enemies.」",
    cooldown: 15,
  },
  {
    trigger: "devour_ready",
    text: "「Essence shard detected nearby. Walk over it to devour.」",
    cooldown: 10,
  },
  {
    trigger: "boss_engaged",
    text: "「A guardian approaches. Analyze its pattern — weaknesses will reveal themselves.」",
    cooldown: 30,
  },
  {
    trigger: "skill_unlocked",
    text: "「New atom analyzed. Visit the Sanctum to craft with it.」",
    cooldown: 5,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Death Quotes — shown when the player dies
// ─────────────────────────────────────────────────────────────────────────────

export const DEATH_QUOTES: string[] = [
  "「The realm claims another. But you... you are different.」",
  "「Death is a teacher. Listen to what it showed you.」",
  "「Your essence persists. The Sanctum awaits your return.」",
  "「Each fall reveals a weakness. Each rise, a new strength.」",
  "「The anomaly cannot be destroyed — only delayed.」",
];

/**
 * Get a random death quote.
 */
export function getRandomDeathQuote(): string {
  return DEATH_QUOTES[Math.floor(Math.random() * DEATH_QUOTES.length)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill Description Flavor — appended to skill descriptions in the grimoire
// ─────────────────────────────────────────────────────────────────────────────

export const SKILL_FLAVOR: Record<string, string> = {
  // Elements
  Force: "Pure kinetic will. The foundation of all combat.",
  Fire: "Heat that lingers. Burns through flesh and patience alike.",
  Frost: "Cold that grips. Slows the body, sharpens the mind.",
  Lightning: "Flickering violence. Strikes once, then again, then again.",
  Void: "The space between stars. Hungry. Patient.",
  // Forms
  Projectile: "A single bolt that travels from caster to target. Reliable.",
  Beam: "An instantaneous line of energy. Hits everything along its path.",
  Nova: "An expanding ring of energy. The caster's last resort.",
  // Vectors
  Ranged: "Aimed at a target point. The standard delivery.",
  Self: "Centered on the caster. Slightly stronger, slightly faster.",
  Cone: "A short-range fan. Wider reach, weaker hit.",
  // Modifiers
  Pierce: "Passes through enemies. One bolt, many wounds.",
  Split: "On kill, divides. Cancerous, beautiful.",
  Linger: "Leaves a wound in reality that keeps bleeding.",
  Chain: "Bounces between enemies. Lightning's favorite shape.",
  Grow: "Gains mass with distance. A snowball of destruction.",
};

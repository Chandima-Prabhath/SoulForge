/**
 * Run State — persistent state across deaths (roguelite meta-progression).
 *
 * Phase 5: now also tracks the player's crafted skills + equipped skill slots.
 * These persist across deaths alongside DevourProgress.
 *
 * The player's "save file" for the current run. Tracks:
 *   - Current realm depth (increments on death)
 *   - Run number (increments on death, used in seed composition)
 *   - DevourProgress (unlocked atoms — THE thing that persists)
 *   - Crafted skills (player-authored compositions, persist across death)
 *   - Equipped skill indices (which 4 skills are in slots 0-3)
 *   - Base seed for this run
 *   - Game mode (realm vs sanctum)
 */

import type { SkillDefinition, ModifierId } from "../../core/grammar/types";
import { STARTER_SKILLS } from "../../data/grammar";

export interface DevourProgressData {
  unlockedElements: number;
  unlockedForms: number;
  unlockedVectors: number;
  unlockedModifiers: number;
  totalDevoured: number;
}

export type GameMode = "realm" | "sanctum" | "death";

export interface RunState {
  /** Current realm depth (1 = first realm, increments on death). */
  depth: number;
  /** Run number (increments on death, used in seed composition). */
  runNumber: number;
  /** Base seed for this run (randomized on new game). */
  baseSeed: number;
  /** Persistent devour progress — survives death. */
  devourProgress: DevourProgressData;
  /** Whether the player has died at least once (for UI feedback). */
  hasDied: boolean;
  /** Phase 5: the player's owned skills (starters + crafted). */
  ownedSkills: SkillDefinition[];
  /** Phase 5: indices into ownedSkills for the 4 equipped slots. -1 = empty. */
  equippedSkillIndices: number[];
  /** Phase 5: current game mode. */
  mode: GameMode;
}

/**
 * Create a fresh run state for a new game.
 * Player starts with the 3 starter skills equipped in slots 0-2.
 */
export function createNewRunState(): RunState {
  return {
    depth: 1,
    runNumber: 1,
    baseSeed: Math.floor(Math.random() * 0xffffffff),
    devourProgress: {
      unlockedElements: 0b00001, // Force
      unlockedForms: 0b00001,    // Projectile
      unlockedVectors: 0b00001,  // Ranged
      unlockedModifiers: 0b00000,
      totalDevoured: 0,
    },
    hasDied: false,
    ownedSkills: [...STARTER_SKILLS],
    equippedSkillIndices: [0, 1, 2, -1], // Mana Bolt, Frost Nova, Lightning Beam, empty
    mode: "realm",
  };
}

/**
 * Advance the run state on death — increment depth + runNumber + switch to sanctum mode.
 * DevourProgress + ownedSkills + equippedSkillIndices are preserved.
 */
export function advanceRunOnDeath(state: RunState): RunState {
  return {
    ...state,
    depth: state.depth + 1,
    runNumber: state.runNumber + 1,
    hasDied: true,
    mode: "sanctum",
  };
}

/**
 * Add a newly crafted skill to the player's owned skills.
 * Returns the new index.
 */
export function addCraftedSkill(state: RunState, skill: SkillDefinition): number {
  state.ownedSkills.push(skill);
  return state.ownedSkills.length - 1;
}

/**
 * Equip a skill to a slot (0-3).
 */
export function equipSkill(state: RunState, slot: number, skillIndex: number) {
  if (slot < 0 || slot > 3) return;
  state.equippedSkillIndices[slot] = skillIndex;
}

/**
 * Synthesize two skills into a new one.
 * Phase 5 simple synthesis: takes the element from skill A, the form from skill B,
 * and combines their modifiers (up to 3 total, deduped).
 */
export function synthesizeSkills(
  skillA: SkillDefinition,
  skillB: SkillDefinition,
  newName: string
): SkillDefinition {
  // Combine modifiers from both skills, dedupe, cap at 3
  const allMods: number[] = [];
  for (const m of [...skillA.modifiers, ...skillB.modifiers]) {
    if (m !== null && !allMods.includes(m)) {
      allMods.push(m);
    }
  }
  const modifiers: (ModifierId | null)[] = [
    (allMods[0] as ModifierId) ?? null,
    (allMods[1] as ModifierId) ?? null,
    (allMods[2] as ModifierId) ?? null,
  ];

  return {
    id: `synth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    name: newName,
    element: skillA.element,
    form: skillB.form,
    vector: skillA.vector,
    modifiers,
    description: `Synthesized from ${skillA.name} + ${skillB.name}.`,
  };
}

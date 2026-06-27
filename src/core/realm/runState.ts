/**
 * Run State — persistent state across deaths (roguelite meta-progression).
 *
 * This is the player's "save file" for the current run. It tracks:
 *   - Current realm depth (increments on death)
 *   - Run number (increments on death)
 *   - DevourProgress (unlocked atoms — THE thing that persists)
 *   - Total devoured count
 *   - Base seed for this run
 *
 * When the player dies:
 *   1. Run state is preserved (depth++, runNumber++)
 *   2. A new realm is generated with the new seed
 *   3. DevourProgress is restored to the new player entity
 *   4. The realm is harder (deeper = more enemies, higher stats)
 *
 * This is the roguelite loop from README §6 Layer 2.
 */

export interface DevourProgressData {
  unlockedElements: number;
  unlockedForms: number;
  unlockedVectors: number;
  unlockedModifiers: number;
  totalDevoured: number;
}

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
}

/**
 * Create a fresh run state for a new game.
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
  };
}

/**
 * Advance the run state on death — increment depth + runNumber.
 * DevourProgress is preserved (that's the whole point of roguelite meta-progression).
 */
export function advanceRunOnDeath(state: RunState): RunState {
  return {
    ...state,
    depth: state.depth + 1,
    runNumber: state.runNumber + 1,
    hasDied: true,
  };
}

/**
 * PRNG & Seed utilities — pure TypeScript.
 *
 * Foundation for SoulForge's divergence system (README §5).
 * Phase 0 doesn't use this yet, but it's here so we can build on it
 * in Phase 4 (procedural realm generation).
 *
 * Uses xmur3 (string hash) + mulberry32 (PRNG) — fast, deterministic,
 * good enough distribution for game purposes.
 */

/**
 * xmur3 string hasher — produces a 32-bit seed from any string.
 */
export function xmur3(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/**
 * mulberry32 — a small, fast, deterministic PRNG.
 * Returns a function that produces a float in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Compose a final realm seed from realm seed + player essence salt + run number.
 * (README §5 Layer 1)
 */
export function composeRealmSeed(
  realmSeed: number,
  playerEssenceSalt: number,
  runNumber: number
): number {
  const h = xmur3(`${realmSeed}:${playerEssenceSalt}:${runNumber}`);
  return h();
}

/**
 * Create a deterministic RNG from a numeric seed.
 */
export function rngFromSeed(seed: number): () => number {
  return mulberry32(seed);
}

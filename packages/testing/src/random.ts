/**
 * Deterministic seeded pseudo-random number generator (mulberry32).
 *
 * Returns a function that, given the same seed, always produces the same
 * sequence of floats in [0, 1). This makes fixture generation reproducible
 * across test runs without relying on a fixed process-level random seed.
 *
 * Usage:
 *   const rng = seededRandom(42);
 *   const a = rng(); // always the same value for seed 42
 *   const b = rng(); // next value in the sequence
 */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0; // coerce to uint32
  return function next(): number {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Pick a random element from an array using a seeded RNG.
 * Throws if the array is empty.
 */
export function pickRandom<T>(arr: readonly T[], rng: () => number): T {
  if (arr.length === 0) throw new RangeError("pickRandom: empty array");
  return arr[Math.floor(rng() * arr.length)]!;
}

/**
 * Shuffle an array in-place using Fisher-Yates with a seeded RNG.
 * Returns the same array reference for chaining.
 */
export function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

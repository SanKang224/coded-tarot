// ─────────────────────────────────────────────────────────────────────────────
// CODED TAROT — Deck Shuffler
// Simulates real tarot shuffling: split → flip → riffle, repeated 2–3 times,
// then a 3-way cut.
// ─────────────────────────────────────────────────────────────────────────────

export type Card = {
  id: number;
  isReversed: boolean;
};

const DECK_SIZE = 78;

/** Create the initial 78-card deck, all upright. */
export function createFreshDeck(): Card[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => ({
    id: i,
    isReversed: false,
  }));
}

/**
 * Riffle merge: interleave two piles by taking 1–3 cards from one side
 * then 1–3 from the other, alternating until both piles are exhausted.
 */
function riffleMerge(left: Card[], right: Card[]): Card[] {
  const result: Card[] = [];
  let l = 0;
  let r = 0;
  // Randomly start from either the left or right pile
  let fromLeft = Math.random() < 0.5;

  while (l < left.length || r < right.length) {
    if (fromLeft) {
      const take = Math.min(
        Math.floor(Math.random() * 3) + 1,
        left.length - l
      );
      for (let i = 0; i < take; i++) result.push(left[l++]);
    } else {
      const take = Math.min(
        Math.floor(Math.random() * 3) + 1,
        right.length - r
      );
      for (let i = 0; i < take; i++) result.push(right[r++]);
    }
    fromLeft = !fromLeft;
  }

  return result;
}

/**
 * One full shuffle cycle:
 * 1. Split the deck roughly in half (±10% variance).
 * 2. Flip one half — toggle isReversed for all cards in that half.
 * 3. Riffle merge the two halves.
 */
function shuffleCycle(deck: Card[]): Card[] {
  const mid = Math.floor(
    deck.length / 2 + (Math.random() - 0.5) * Math.floor(deck.length * 0.2)
  );
  const clampedMid = Math.max(10, Math.min(deck.length - 10, mid));

  let left = deck.slice(0, clampedMid);
  let right = deck.slice(clampedMid);

  // Randomly flip either the left or right half
  const flipLeft = Math.random() < 0.5;
  if (flipLeft) {
    left = left.map((c) => ({ ...c, isReversed: !c.isReversed }));
  } else {
    right = right.map((c) => ({ ...c, isReversed: !c.isReversed }));
  }

  return riffleMerge(left, right);
}

/**
 * Shuffle the deck by running 2–3 split→flip→riffle cycles, then performing
 * a 3-way cut (reorder: [chunk2, chunk3, chunk1]).
 *
 * Returns a new array — the original deck is not mutated.
 */
export function shuffleDeck(deck: Card[]): Card[] {
  const cycles = 2 + Math.floor(Math.random() * 2); // 2 or 3
  let result = [...deck];

  for (let i = 0; i < cycles; i++) {
    result = shuffleCycle(result);
  }

  // 3-way cut: split into three chunks, reorder as [chunk2, chunk3, chunk1]
  const cut1 = Math.floor((deck.length / 3) * (0.7 + Math.random() * 0.6));
  const cut2 = Math.floor(
    cut1 + (deck.length - cut1) * (0.4 + Math.random() * 0.6)
  );
  const chunk1 = result.slice(0, cut1);
  const chunk2 = result.slice(cut1, cut2);
  const chunk3 = result.slice(cut2);

  return [...chunk2, ...chunk3, ...chunk1];
}

export type AlignmentAttempt = {
  reversed: number;
  upright: number;
  ratio: number;   // 0.00–1.00
  maxRun: number;
  checksum: string; // e.g. "0xA3F2"
  passed: boolean;
};

/** Compute alignment stats for a deck without mutating it. */
function computeAlignmentStats(deck: Card[]): AlignmentAttempt {
  const reversed = deck.filter(c => c.isReversed).length;
  const upright = deck.length - reversed;
  const ratio = parseFloat((reversed / deck.length).toFixed(2));

  let maxRun = 1;
  let run = 1;
  for (let i = 1; i < deck.length; i++) {
    if (deck[i].isReversed === deck[i - 1].isReversed) {
      run++;
      if (run > maxRun) maxRun = run;
    } else {
      run = 1;
    }
  }

  const checksum =
    '0x' + Math.floor(Math.random() * 0xffff).toString(16).toUpperCase().padStart(4, '0');

  const passed = ratio >= 0.25 && ratio <= 0.75 && maxRun <= 15;
  return { reversed, upright, ratio, maxRun, checksum, passed };
}

/**
 * Shuffle with alignment check.
 * If the result is unbalanced, continue shuffling from the current state
 * (never resets to original) up to MAX_RETRIES times.
 *
 * Returns { deck, attempts } where attempts[0] is the first shuffle,
 * and subsequent entries are retries. Each attempt includes its stats.
 */
export const ALIGNMENT_MAX_RETRIES = 4;

export function shuffleDeckWithAlignment(deck: Card[]): {
  deck: Card[];
  attempts: AlignmentAttempt[];
} {
  const attempts: AlignmentAttempt[] = [];
  let current = shuffleDeck(deck);

  while (true) {
    const stats = computeAlignmentStats(current);
    attempts.push(stats);
    if (stats.passed || attempts.length > ALIGNMENT_MAX_RETRIES) break;
    current = shuffleDeck(current); // continue from current state — do not reset
  }

  return { deck: current, attempts };
}

/**
 * Draw `count` cards starting from `startIndex` in the deck.
 * Returns the drawn cards in order (index 0 = first drawn).
 * Never mutates the deck.
 */
export function drawCards(deck: Card[], startIndex: number, count: number): Card[] {
  return deck.slice(startIndex, startIndex + count);
}

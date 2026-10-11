import { compareCodeUnits } from './compare.js';

/** Most suggestions one unknown key can receive. One strong match beats several weak ones. */
export const MAX_KEY_SUGGESTIONS = 3;

interface Candidate {
  readonly key: string;
  readonly folded: string;
  /** Everything before the last `.`, or `''` for a top-level key. */
  readonly parent: string;
  readonly segmentCount: number;
}

/**
 * How many edits a key of `length` code units may be away from a candidate and still be
 * worth suggesting. Deliberately stingy: a wrong "did you mean" is worse than none.
 *
 * - up to 5 units: only a case-only difference. `to` is one edit from `on`, `no` and `go`,
 *   which says nothing about intent.
 * - 6-11 units: one edit (a typo, a transposition, a stray or missing character).
 * - 12-23 units: two edits.
 * - 24+ units: three edits, still under one in eight characters.
 */
function maxEdits(length: number): number {
  if (length <= 5) return 0;
  if (length <= 11) return 1;
  if (length <= 23) return 2;
  return 3;
}

/**
 * Builds the private "did you mean" engine for one analysis. The catalog is indexed once and
 * answers are cached per unknown key, so repeated typos cost one ranking.
 *
 * Pure and locale-independent: the result depends only on the unknown key and the set of
 * catalog keys, never on their input order, the host locale or the platform.
 *
 * Eligibility: the case-folded keys must be within {@link maxEdits} of the longer key's
 * length, measured as optimal-string-alignment (restricted Damerau-Levenshtein) distance, so
 * an adjacent transposition costs one edit. Ranking, best first:
 *
 * 1. `2 * edits - 1` when the parent namespace matches exactly, else `2 * edits`. A shared
 *    namespace is a boost, not a requirement, so `nva.docs` can still reach `nav.docs`.
 * 2. the same number of segments as the unknown key.
 * 3. edits counted case-sensitively.
 * 4. UTF-16 code-unit order.
 *
 * Only candidates scoring within one point of the best survive, capped at
 * {@link MAX_KEY_SUGGESTIONS}.
 */
export function createKeySuggester(
  catalogKeys: Iterable<string>,
): (unknown: string) => readonly string[] {
  let candidates: Candidate[] | undefined;
  const cache = new Map<string, readonly string[]>();

  function index(): Candidate[] {
    candidates ??= [...new Set(catalogKeys)].sort(compareCodeUnits).map(key => ({
      key,
      folded: key.toLowerCase(),
      parent: key.slice(0, Math.max(key.lastIndexOf('.'), 0)),
      segmentCount: countSegments(key),
    }));
    return candidates;
  }

  return unknown => {
    const cached = cache.get(unknown);
    if (cached) return cached;
    const suggestions = rank(unknown, index());
    cache.set(unknown, suggestions);
    return suggestions;
  };
}

interface Scored {
  readonly key: string;
  readonly score: number;
  readonly segmentMatch: boolean;
  readonly exactEdits: number;
}

function rank(unknown: string, candidates: readonly Candidate[]): readonly string[] {
  const folded = unknown.toLowerCase();
  const parent = unknown.slice(0, Math.max(unknown.lastIndexOf('.'), 0)).toLowerCase();
  const segmentCount = countSegments(unknown);
  const scored: Scored[] = [];

  for (const candidate of candidates) {
    const limit = maxEdits(Math.max(folded.length, candidate.folded.length));
    if (Math.abs(folded.length - candidate.folded.length) > limit) continue;

    const edits = boundedEditDistance(folded, candidate.folded, limit);
    if (edits > limit) continue;

    scored.push({
      key: candidate.key,
      score: 2 * edits - (candidate.parent.toLowerCase() === parent ? 1 : 0),
      segmentMatch: candidate.segmentCount === segmentCount,
      exactEdits: boundedEditDistance(unknown, candidate.key, Infinity),
    });
  }

  if (scored.length === 0) return [];
  scored.sort(
    (a, b) =>
      a.score - b.score ||
      Number(b.segmentMatch) - Number(a.segmentMatch) ||
      a.exactEdits - b.exactEdits ||
      compareCodeUnits(a.key, b.key),
  );

  const cutoff = (scored[0]?.score ?? 0) + 1;
  return scored
    .filter(entry => entry.score <= cutoff)
    .slice(0, MAX_KEY_SUGGESTIONS)
    .map(entry => entry.key);
}

function countSegments(key: string): number {
  let count = 1;
  for (let i = 0; i < key.length; i++) if (key.charCodeAt(i) === 46) count++;
  return count;
}

/**
 * Optimal-string-alignment distance over UTF-16 code units (insert, delete, substitute and
 * swap two adjacent units, each one edit). Returns `limit + 1` as soon as the distance is
 * known to exceed `limit`. Keeps three rows, so memory is linear in the key length.
 */
function boundedEditDistance(a: string, b: string, limit: number): number {
  if (a === b) return 0;
  const n = a.length;
  const m = b.length;
  if (Math.abs(n - m) > limit) return limit + 1;
  if (n === 0 || m === 0) return Math.max(n, m);

  let twoBack = new Array<number>(m + 1).fill(0);
  let previous = Array.from({ length: m + 1 }, (_, j) => j);
  let current = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= m; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let value = Math.min(
        (previous[j] ?? 0) + 1,
        (current[j - 1] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a.charCodeAt(i - 1) === b.charCodeAt(j - 2) &&
        a.charCodeAt(i - 2) === b.charCodeAt(j - 1)
      ) {
        value = Math.min(value, (twoBack[j - 2] ?? 0) + 1);
      }
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > limit) return limit + 1;
    [twoBack, previous, current] = [previous, current, twoBack];
  }

  return previous[m] ?? 0;
}

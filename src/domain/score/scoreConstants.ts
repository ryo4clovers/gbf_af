export const IDEAL_MATCH_SCORE = {
  0: 0,
  1: 20,
  2: 45,
  3: 75,
  4: 110,
} as const;

export const TABLE_RANK_MULTIPLIER = {
  a: 1.0,
  b: 1.05,
  c: 1.1,
  d: 1.15,
  e: 1.25,
} as const;

export const UNWANTED_SKILL_PENALTY = {
  0: 0,
  1: 25,
  2: 60,
  3: 100,
  4: 150,
} as const;

export const PRIORITY_BASE_SCORE = {
  1: 40,
  2: 32,
  3: 25,
  4: 19,
  5: 14,
} as const;

export const PRIORITY_BASE_SCORE_FALLBACK = 10;

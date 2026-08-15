import type { NormalizedSkillKey, TableRank } from "../skill/normalizedSkill";
import {
  createDefaultIdealSkillConfiguration,
  IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  IDEAL_FOURTH_SLOT_OPTIONS,
  IDEAL_THIRD_SLOT_OPTIONS,
  type IdealSkillConfiguration,
} from "./idealSkillConfiguration";

export type CustomScoreSettings = {
  idealSkillConfigurations: IdealSkillConfiguration[];
  idealMatchScores: IdealMatchScores;
  skillScores: SkillScores;
  tableRankPenalties: TableRankPenalties;
  updatedAt: string;
};

type StoredCustomScoreSettings = Partial<CustomScoreSettings> & {
  idealSkillKeys?: NormalizedSkillKey[];
  skillPriority?: LegacySkillPriorityEntry[];
};

export type IdealMatchScores = {
  1: number;
  2: number;
  3: number;
  4: number;
};

export type SkillScoreEntry = {
  skillKey: NormalizedSkillKey;
  score: number;
};

export type SkillScores = {
  firstSecondSlot: SkillScoreEntry[];
  thirdSlot: SkillScoreEntry[];
  fourthSlot: SkillScoreEntry[];
};

export type TableRankPenalties = Record<TableRank, number>;

type LegacySkillPriorityEntry = {
  skillKey: NormalizedSkillKey;
  rank: number;
};

export type UnwantedSkillConfig = {
  skillKeys: NormalizedSkillKey[];
  updatedAt: string;
};

export const DEFAULT_IDEAL_MATCH_SCORES: IdealMatchScores = {
  1: 0,
  2: 0,
  3: 75,
  4: 100,
};

export const DEFAULT_TABLE_RANK_PENALTIES: TableRankPenalties = {
  a: 0,
  b: 1,
  c: 2,
  d: 3,
  e: 4,
};

export const DEFAULT_CUSTOM_SCORE_SETTINGS: CustomScoreSettings = {
  idealSkillConfigurations: [
    createDefaultIdealSkillConfiguration("default-ideal-configuration"),
  ],
  idealMatchScores: { ...DEFAULT_IDEAL_MATCH_SCORES },
  skillScores: createSkillScoresFromLegacyPriority([
    { skillKey: "normal_attack_damage_cap", rank: 1 },
    { skillKey: "element_attack", rank: 2 },
    { skillKey: "ougi_damage_cap", rank: 3 },
    { skillKey: "ability_damage_cap", rank: 4 },
    { skillKey: "triple_attack_rate", rank: 5 },
    { skillKey: "attack_power", rank: 6 },
  ]),
  tableRankPenalties: { ...DEFAULT_TABLE_RANK_PENALTIES },
  updatedAt: "default",
};

export const DEFAULT_UNWANTED_SKILL_CONFIG: UnwantedSkillConfig = {
  skillKeys: ["debuff_resistance", "healing_performance"],
  updatedAt: "default",
};

export function withCustomScoreSettingsDefaults(
  settings: StoredCustomScoreSettings,
): CustomScoreSettings {
  return {
    idealSkillConfigurations:
      settings.idealSkillConfigurations?.map(cloneIdealSkillConfiguration) ??
      migrateLegacyIdealSkillKeys(settings.idealSkillKeys ?? []),
    idealMatchScores: {
      ...DEFAULT_IDEAL_MATCH_SCORES,
      ...settings.idealMatchScores,
    },
    skillScores: settings.skillScores
      ? normalizeSkillScores(settings.skillScores)
      : createSkillScoresFromLegacyPriority(settings.skillPriority ?? []),
    tableRankPenalties: normalizeTableRankPenalties(
      settings.tableRankPenalties,
    ),
    updatedAt: settings.updatedAt ?? "default",
  };
}

export function validateTableRankPenalties(penalties: unknown): string | null {
  if (typeof penalties !== "object" || penalties === null) {
    return "Skill quality penalties are required.";
  }

  const ranks: TableRank[] = ["a", "b", "c", "d", "e"];
  const values = ranks.map((rank) => Reflect.get(penalties, rank));

  if (
    !values.every(
      (value) =>
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 25,
    )
  ) {
    return "Skill quality penalties must be integers from 0 to 25.";
  }

  for (let index = 1; index < values.length; index += 1) {
    const previousValue = values[index - 1];
    const currentValue = values[index];

    if (
      typeof previousValue === "number" &&
      typeof currentValue === "number" &&
      previousValue > currentValue
    ) {
      return "Skill quality penalties must satisfy A <= B <= C <= D <= E.";
    }
  }

  return null;
}

function normalizeTableRankPenalties(
  penalties: TableRankPenalties | undefined,
): TableRankPenalties {
  const merged = { ...DEFAULT_TABLE_RANK_PENALTIES, ...penalties };
  const isLegacyDescending =
    merged.a >= merged.b &&
    merged.b >= merged.c &&
    merged.c >= merged.d &&
    merged.d >= merged.e &&
    (merged.a > merged.e || merged.b > merged.d);

  if (!isLegacyDescending) return merged;

  return {
    a: merged.e,
    b: merged.d,
    c: merged.c,
    d: merged.b,
    e: merged.a,
  };
}

export function validateSkillScores(skillScores: unknown): string | null {
  if (typeof skillScores !== "object" || skillScores === null) {
    return "Skill scores are required.";
  }

  const groups: Array<{
    entries: unknown;
    options: readonly { key: NormalizedSkillKey }[];
  }> = [
    {
      entries: Reflect.get(skillScores, "firstSecondSlot"),
      options: IDEAL_FIRST_SECOND_SLOT_OPTIONS,
    },
    {
      entries: Reflect.get(skillScores, "thirdSlot"),
      options: IDEAL_THIRD_SLOT_OPTIONS,
    },
    {
      entries: Reflect.get(skillScores, "fourthSlot"),
      options: IDEAL_FOURTH_SLOT_OPTIONS,
    },
  ];

  for (const group of groups) {
    if (!Array.isArray(group.entries)) {
      return "Each skill score group must be an array.";
    }

    const scoresByKey = new Map<string, number>();

    for (const entry of group.entries) {
      if (typeof entry !== "object" || entry === null) {
        return "Skill score entries are invalid.";
      }

      const skillKey = Reflect.get(entry, "skillKey");
      const score = Reflect.get(entry, "score");

      if (
        typeof skillKey !== "string" ||
        !group.options.some((option) => option.key === skillKey) ||
        scoresByKey.has(skillKey)
      ) {
        return "Skill score keys must be valid and unique within each group.";
      }

      if (
        typeof score !== "number" ||
        !Number.isInteger(score) ||
        score < 0 ||
        score > 25
      ) {
        return "Skill scores must be integers from 0 to 25.";
      }

      scoresByKey.set(skillKey, score);
    }

    if (scoresByKey.size !== group.options.length) {
      return "Every available skill requires a score.";
    }
  }

  return null;
}

export function migrateLegacyIdealSkillKeys(
  idealSkillKeys: NormalizedSkillKey[],
): IdealSkillConfiguration[] {
  const configuration = createDefaultIdealSkillConfiguration(
    "migrated-ideal-configuration",
  );
  const firstSecondKeys = idealSkillKeys.filter((key) =>
    IDEAL_FIRST_SECOND_SLOT_OPTIONS.some((option) => option.key === key),
  );

  configuration.firstSecondSlotSkillKeys = [
    firstSecondKeys[0] ?? null,
    firstSecondKeys[1] ?? null,
  ];
  configuration.thirdSlotSkillKey =
    idealSkillKeys.find((key) =>
      IDEAL_THIRD_SLOT_OPTIONS.some((option) => option.key === key),
    ) ?? null;
  configuration.fourthSlotSkillKey =
    idealSkillKeys.find((key) =>
      IDEAL_FOURTH_SLOT_OPTIONS.some((option) => option.key === key),
    ) ?? null;

  return [configuration];
}

export function validateIdealMatchScores(scores: unknown): string | null {
  if (typeof scores !== "object" || scores === null) {
    return "Ideal match scores are required.";
  }

  const values = [1, 2, 3, 4].map((matchCount) =>
    Reflect.get(scores, String(matchCount)),
  );

  if (
    !values.every(
      (value) =>
        typeof value === "number" &&
        Number.isInteger(value) &&
        value >= 0 &&
        value <= 100,
    )
  ) {
    return "Ideal match scores must be integers from 0 to 100.";
  }

  for (let index = 1; index < values.length; index += 1) {
    const previousValue = values[index - 1];
    const currentValue = values[index];

    if (
      typeof previousValue === "number" &&
      typeof currentValue === "number" &&
      currentValue < previousValue
    ) {
      return "Ideal match scores must not decrease as match count increases.";
    }
  }

  return null;
}

function cloneIdealSkillConfiguration(
  configuration: IdealSkillConfiguration,
): IdealSkillConfiguration {
  return {
    ...configuration,
    comment: configuration.comment ?? "",
    attributeKeys: [...configuration.attributeKeys],
    kindKeys: [...configuration.kindKeys],
    firstSecondSlotSkillKeys: [...configuration.firstSecondSlotSkillKeys],
  };
}

function normalizeSkillScores(skillScores: SkillScores): SkillScores {
  return {
    firstSecondSlot: normalizeSkillScoreGroup(
      skillScores.firstSecondSlot,
      IDEAL_FIRST_SECOND_SLOT_OPTIONS,
    ),
    thirdSlot: normalizeSkillScoreGroup(
      skillScores.thirdSlot,
      IDEAL_THIRD_SLOT_OPTIONS,
    ),
    fourthSlot: normalizeSkillScoreGroup(
      skillScores.fourthSlot,
      IDEAL_FOURTH_SLOT_OPTIONS,
    ),
  };
}

function normalizeSkillScoreGroup(
  entries: SkillScoreEntry[] | undefined,
  options: readonly { key: NormalizedSkillKey }[],
): SkillScoreEntry[] {
  const scoreByKey = new Map(
    entries?.map((entry) => [entry.skillKey, entry.score]) ?? [],
  );

  return options.map((option) => ({
    skillKey: option.key,
    score: scoreByKey.get(option.key) ?? 0,
  }));
}

export function createSkillScoresFromLegacyPriority(
  entries: LegacySkillPriorityEntry[],
): SkillScores {
  const scoreByKey = new Map(
    entries.map((entry) => [
      entry.skillKey,
      getLegacyPriorityScore(entry.rank),
    ]),
  );

  return {
    firstSecondSlot: createSkillScoreGroup(
      IDEAL_FIRST_SECOND_SLOT_OPTIONS,
      scoreByKey,
    ),
    thirdSlot: createSkillScoreGroup(IDEAL_THIRD_SLOT_OPTIONS, scoreByKey),
    fourthSlot: createSkillScoreGroup(IDEAL_FOURTH_SLOT_OPTIONS, scoreByKey),
  };
}

function createSkillScoreGroup(
  options: readonly { key: NormalizedSkillKey }[],
  scoreByKey: ReadonlyMap<NormalizedSkillKey, number>,
): SkillScoreEntry[] {
  return options.map((option) => ({
    skillKey: option.key,
    score: scoreByKey.get(option.key) ?? 0,
  }));
}

function getLegacyPriorityScore(rank: number): number {
  if (rank <= 3) {
    return 25;
  }
  if (rank === 4) {
    return 19;
  }
  if (rank === 5) {
    return 14;
  }

  return 10;
}

import type { NormalizedSkillKey } from "../skill/normalizedSkill";

export type CustomScoreSettings = {
  idealSkillKeys: NormalizedSkillKey[];
  idealMatchScores: IdealMatchScores;
  skillPriority: SkillPriorityEntry[];
  updatedAt: string;
};

export type IdealMatchScores = {
  1: number;
  2: number;
  3: number;
  4: number;
};

export type SkillPriorityEntry = {
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

export const DEFAULT_CUSTOM_SCORE_SETTINGS: CustomScoreSettings = {
  idealSkillKeys: [
    "normal_attack_damage_cap",
    "element_attack",
    "triple_attack_rate",
    "attack_power",
  ],
  idealMatchScores: { ...DEFAULT_IDEAL_MATCH_SCORES },
  skillPriority: [
    { skillKey: "normal_attack_damage_cap", rank: 1 },
    { skillKey: "element_attack", rank: 2 },
    { skillKey: "ougi_damage_cap", rank: 3 },
    { skillKey: "ability_damage_cap", rank: 4 },
    { skillKey: "triple_attack_rate", rank: 5 },
    { skillKey: "attack_power", rank: 6 },
  ],
  updatedAt: "default",
};

export const DEFAULT_UNWANTED_SKILL_CONFIG: UnwantedSkillConfig = {
  skillKeys: ["debuff_resistance", "healing_performance"],
  updatedAt: "default",
};

export function withCustomScoreSettingsDefaults(
  settings: CustomScoreSettings,
): CustomScoreSettings {
  return {
    ...settings,
    idealMatchScores: {
      ...DEFAULT_IDEAL_MATCH_SCORES,
      ...settings.idealMatchScores,
    },
  };
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

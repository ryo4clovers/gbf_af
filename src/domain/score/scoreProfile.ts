import type { NormalizedSkillKey } from "../skill/normalizedSkill";

export type ScoreProfile = {
  id: string;
  name: string;
  idealSkillKeys: NormalizedSkillKey[];
  skillPriority: SkillPriorityEntry[];
  createdAt: string;
  updatedAt: string;
};

export type SkillPriorityEntry = {
  skillKey: NormalizedSkillKey;
  rank: number;
};

export type UnwantedSkillConfig = {
  skillKeys: NormalizedSkillKey[];
  updatedAt: string;
};

export const DEFAULT_SCORE_PROFILE: ScoreProfile = {
  id: "default-general",
  name: "General",
  idealSkillKeys: [
    "normal_attack_damage_cap",
    "element_attack",
    "triple_attack_rate",
    "attack_power",
  ],
  skillPriority: [
    { skillKey: "normal_attack_damage_cap", rank: 1 },
    { skillKey: "element_attack", rank: 2 },
    { skillKey: "ougi_damage_cap", rank: 3 },
    { skillKey: "ability_damage_cap", rank: 4 },
    { skillKey: "triple_attack_rate", rank: 5 },
    { skillKey: "attack_power", rank: 6 },
  ],
  createdAt: "default",
  updatedAt: "default",
};

export const DEFAULT_UNWANTED_SKILL_CONFIG: UnwantedSkillConfig = {
  skillKeys: ["debuff_resistance", "healing_performance"],
  updatedAt: "default",
};

export type NormalizedSkillKey = string;

export type TableRank = "a" | "b" | "c" | "d" | "e";

export type SkillCategory =
  | "normal_attack"
  | "ougi"
  | "ability"
  | "defense"
  | "healing"
  | "utility"
  | "drop"
  | "unknown";

export type NormalizedSkillUnit =
  | "percent"
  | "flat"
  | "times"
  | "count"
  | "unknown";

export type NormalizedArtifactSkill = {
  rawName: string;
  normalizedKey: NormalizedSkillKey;
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  level: number;
  value?: number;
  unit?: NormalizedSkillUnit;
  tableRank?: TableRank;
  category: SkillCategory;
};

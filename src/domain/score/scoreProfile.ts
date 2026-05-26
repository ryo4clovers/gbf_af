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

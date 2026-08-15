import type { NormalizedSkillKey } from "../skill/normalizedSkill";

export type ScoreRoute = "ideal" | "priority";

export type ScoreResult = {
  total: number;
  selectedRoute: ScoreRoute;
  idealRouteScore: number;
  priorityRouteScore: number;
  reasons: ScoreReason[];
};

export type ScoreReason = {
  type: "ideal_match" | "priority_skill" | "table_penalty";
  skillKey?: NormalizedSkillKey;
  label: string;
  delta: number;
};

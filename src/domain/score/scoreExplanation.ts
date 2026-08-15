import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import type { TableRankPenalties } from "./customScoreSettings";
import type { ScoreReason } from "./scoreResult";

export function createIdealMatchReason(args: {
  matchCount: number;
  score: number;
}): ScoreReason {
  return {
    type: "ideal_match",
    label: `${args.matchCount}/4 ideal match`,
    delta: args.score,
  };
}

export function createSkillScoreReason(args: {
  skill: NormalizedArtifactSkill;
  baseScore: number;
  score: number;
}): ScoreReason {
  return {
    type: "priority_skill",
    skillKey: args.skill.normalizedKey,
    label: `${args.skill.rawName} skill score ${args.baseScore}`,
    delta: args.score,
  };
}

export function createAppliedTablePenaltyReason(args: {
  skill: NormalizedArtifactSkill;
  penalty: number;
}): ScoreReason {
  return {
    type: "table_penalty",
    skillKey: args.skill.normalizedKey,
    label:
      args.skill.tableRank === undefined
        ? `${args.skill.rawName} quality unknown`
        : `${args.skill.rawName} quality ${args.skill.tableRank.toUpperCase()}`,
    delta: -args.penalty,
  };
}

export function getTableRankPenalty(
  skill: Pick<NormalizedArtifactSkill, "slot" | "tableRank">,
  penalties: TableRankPenalties,
): number {
  if (skill.slot === 4 || skill.tableRank === undefined) {
    return 0;
  }

  return penalties[skill.tableRank];
}

export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import { TABLE_RANK_MULTIPLIER } from "./scoreConstants";
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

export function createPrioritySkillReason(args: {
  skill: NormalizedArtifactSkill;
  baseScore: number;
  score: number;
}): ScoreReason {
  return {
    type: "priority_skill",
    skillKey: args.skill.normalizedKey,
    label: `${args.skill.rawName} priority base ${args.baseScore}`,
    delta: args.score,
  };
}

export function createAppliedTableMultiplierReason(args: {
  skill: NormalizedArtifactSkill;
  baseScore: number;
  multipliedScore: number;
}): ScoreReason {
  return {
    type: "table_multiplier",
    skillKey: args.skill.normalizedKey,
    label:
      args.skill.tableRank === undefined
        ? `${args.skill.rawName} rank unknown`
        : `${args.skill.rawName} rank ${args.skill.tableRank}`,
    delta: roundScore(args.multipliedScore - args.baseScore),
  };
}

export function createUnwantedPenaltyReason(args: {
  count: number;
  penalty: number;
}): ScoreReason {
  return {
    type: "unwanted_penalty",
    label: `不要スキル ${args.count}件`,
    delta: -args.penalty,
  };
}

export function getTableRankMultiplier(
  skill: Pick<NormalizedArtifactSkill, "tableRank">,
): number {
  if (skill.tableRank === undefined) {
    return 1.0;
  }

  return TABLE_RANK_MULTIPLIER[skill.tableRank];
}

export function roundScore(score: number): number {
  return Math.round(score * 100) / 100;
}

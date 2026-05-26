import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import {
  PRIORITY_BASE_SCORE,
  PRIORITY_BASE_SCORE_FALLBACK,
  UNWANTED_SKILL_PENALTY,
} from "./scoreConstants";
import {
  createAppliedTableMultiplierReason,
  createPrioritySkillReason,
  createUnwantedPenaltyReason,
  getTableRankMultiplier,
  roundScore,
} from "./scoreExplanation";
import type { ScoreProfile, UnwantedSkillConfig } from "./scoreProfile";
import type { ScoreReason } from "./scoreResult";

export type PriorityRouteResult = {
  score: number;
  reasons: ScoreReason[];
};

export function evaluatePriorityRoute(args: {
  skills: NormalizedArtifactSkill[];
  profile: ScoreProfile;
  unwantedSkillConfig: UnwantedSkillConfig;
}): PriorityRouteResult {
  const priorityRankBySkillKey = createPriorityRankMap(
    args.profile.skillPriority,
  );
  const reasons: ScoreReason[] = [];
  let score = 0;

  for (const skill of args.skills) {
    const priorityRank = priorityRankBySkillKey.get(skill.normalizedKey);

    if (priorityRank === undefined) {
      continue;
    }

    const baseScore = getPriorityBaseScore(priorityRank);
    const multipliedScore = baseScore * getTableRankMultiplier(skill);

    reasons.push(
      createPrioritySkillReason({
        skill,
        baseScore,
        score: baseScore,
      }),
    );
    reasons.push(
      createAppliedTableMultiplierReason({
        skill,
        baseScore,
        multipliedScore,
      }),
    );

    score += multipliedScore;
  }

  const unwantedSkillCount = countUnwantedSkills(
    args.skills,
    args.unwantedSkillConfig.skillKeys,
  );
  const unwantedPenalty = getUnwantedSkillPenalty(unwantedSkillCount);

  if (unwantedPenalty > 0) {
    reasons.push(
      createUnwantedPenaltyReason({
        count: unwantedSkillCount,
        penalty: unwantedPenalty,
      }),
    );
  }

  return {
    score: roundScore(score - unwantedPenalty),
    reasons,
  };
}

function createPriorityRankMap(
  entries: ScoreProfile["skillPriority"],
): Map<string, number> {
  const priorityRankBySkillKey = new Map<string, number>();

  for (const entry of entries) {
    const existingRank = priorityRankBySkillKey.get(entry.skillKey);

    if (existingRank === undefined || entry.rank < existingRank) {
      priorityRankBySkillKey.set(entry.skillKey, entry.rank);
    }
  }

  return priorityRankBySkillKey;
}

function getPriorityBaseScore(rank: number): number {
  if (rank === 1) {
    return PRIORITY_BASE_SCORE[1];
  }
  if (rank === 2) {
    return PRIORITY_BASE_SCORE[2];
  }
  if (rank === 3) {
    return PRIORITY_BASE_SCORE[3];
  }
  if (rank === 4) {
    return PRIORITY_BASE_SCORE[4];
  }
  if (rank === 5) {
    return PRIORITY_BASE_SCORE[5];
  }

  return PRIORITY_BASE_SCORE_FALLBACK;
}

function countUnwantedSkills(
  skills: NormalizedArtifactSkill[],
  unwantedSkillKeys: string[],
): 0 | 1 | 2 | 3 | 4 {
  const unwantedSkillKeySet = new Set(unwantedSkillKeys);
  const unwantedSkillCount = skills.filter((skill) =>
    unwantedSkillKeySet.has(skill.normalizedKey),
  ).length;

  return Math.min(unwantedSkillCount, 4) as 0 | 1 | 2 | 3 | 4;
}

function getUnwantedSkillPenalty(count: 0 | 1 | 2 | 3 | 4): number {
  return UNWANTED_SKILL_PENALTY[count];
}

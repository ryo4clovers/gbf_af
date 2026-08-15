import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import {
  type CustomScoreSettings,
  DEFAULT_IDEAL_MATCH_SCORES,
} from "./customScoreSettings";
import {
  createAppliedTableMultiplierReason,
  createIdealMatchReason,
  getTableRankMultiplier,
  roundScore,
} from "./scoreExplanation";
import type { ScoreReason } from "./scoreResult";

export type IdealRouteResult = {
  score: number;
  reasons: ScoreReason[];
};

export function evaluateIdealRoute(args: {
  skills: NormalizedArtifactSkill[];
  settings: CustomScoreSettings;
}): IdealRouteResult {
  const idealSkillKeys = getUniqueSkillKeys(args.settings.idealSkillKeys).slice(
    0,
    4,
  );
  const matchedSkills = getUniqueMatchedSkills(args.skills, idealSkillKeys);
  const matchCount = Math.min(matchedSkills.length, 4) as 0 | 1 | 2 | 3 | 4;
  const matchScore = getIdealMatchScore(args.settings, matchCount);
  const reasons: ScoreReason[] = [
    createIdealMatchReason({
      matchCount,
      score: matchScore,
    }),
  ];

  const perMatchedSkillBaseScore = matchCount > 0 ? matchScore / matchCount : 0;
  const tableMultiplierScore = matchedSkills.reduce((total, skill) => {
    const multipliedScore =
      perMatchedSkillBaseScore * getTableRankMultiplier(skill);

    reasons.push(
      createAppliedTableMultiplierReason({
        skill,
        baseScore: perMatchedSkillBaseScore,
        multipliedScore,
      }),
    );

    return total + (multipliedScore - perMatchedSkillBaseScore);
  }, 0);

  return {
    score: roundScore(matchScore + tableMultiplierScore),
    reasons,
  };
}

function getIdealMatchScore(
  settings: CustomScoreSettings,
  matchCount: 0 | 1 | 2 | 3 | 4,
): number {
  if (matchCount === 0) {
    return 0;
  }

  return (
    settings.idealMatchScores?.[matchCount] ??
    DEFAULT_IDEAL_MATCH_SCORES[matchCount]
  );
}

function getUniqueMatchedSkills(
  skills: NormalizedArtifactSkill[],
  idealSkillKeys: string[],
): NormalizedArtifactSkill[] {
  const idealSkillKeySet = new Set(idealSkillKeys);
  const matchedSkillKeys = new Set<string>();
  const matchedSkills: NormalizedArtifactSkill[] = [];

  for (const skill of skills) {
    // Phase 1 treats duplicate ideal skills as one match because slot order is ignored.
    if (!idealSkillKeySet.has(skill.normalizedKey)) {
      continue;
    }

    if (matchedSkillKeys.has(skill.normalizedKey)) {
      continue;
    }

    matchedSkillKeys.add(skill.normalizedKey);
    matchedSkills.push(skill);
  }

  return matchedSkills;
}

function getUniqueSkillKeys(skillKeys: string[]): string[] {
  return Array.from(new Set(skillKeys));
}

import type { Artifact } from "../artifact";
import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import {
  type CustomScoreSettings,
  DEFAULT_IDEAL_MATCH_SCORES,
} from "./customScoreSettings";
import {
  doesIdealSkillOptionMatch,
  type IdealSkillConfiguration,
} from "./idealSkillConfiguration";
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
  artifact: Artifact;
  skills: NormalizedArtifactSkill[];
  settings: CustomScoreSettings;
}): IdealRouteResult {
  const configuration = args.settings.idealSkillConfigurations.find(
    (candidate) =>
      candidate.attributeKeys.some(
        (attributeKey) => attributeKey === args.artifact.attribute.raw,
      ) &&
      candidate.kindKeys.some((kindKey) => kindKey === args.artifact.kind.raw),
  );
  const matchResult =
    configuration === undefined
      ? { matchCount: 0 as const, matchedSkills: [] }
      : matchIdealSkillConfiguration(args.skills, configuration);
  const { matchCount, matchedSkills } = matchResult;
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

function matchIdealSkillConfiguration(
  skills: NormalizedArtifactSkill[],
  configuration: IdealSkillConfiguration,
): {
  matchCount: 0 | 1 | 2 | 3 | 4;
  matchedSkills: NormalizedArtifactSkill[];
} {
  let matchCount = 0;
  const matchedSkills: NormalizedArtifactSkill[] = [];
  const availableFirstSecondSkills = skills.filter(
    (skill) => skill.slot === 1 || skill.slot === 2,
  );

  for (const skillKey of configuration.firstSecondSlotSkillKeys) {
    if (skillKey === null) {
      matchCount += 1;
      continue;
    }

    const matchedIndex = availableFirstSecondSkills.findIndex((skill) =>
      doesIdealSkillOptionMatch(skillKey, skill),
    );

    if (matchedIndex < 0) {
      continue;
    }

    const matchedSkill = availableFirstSecondSkills[matchedIndex];

    if (matchedSkill !== undefined) {
      matchCount += 1;
      matchedSkills.push(matchedSkill);
      availableFirstSecondSkills.splice(matchedIndex, 1);
    }
  }

  const thirdSlotSkill = skills.find((skill) => skill.slot === 3);
  const fourthSlotSkill = skills.find((skill) => skill.slot === 4);

  if (configuration.thirdSlotSkillKey === null) {
    matchCount += 1;
  } else if (
    thirdSlotSkill !== undefined &&
    doesIdealSkillOptionMatch(configuration.thirdSlotSkillKey, thirdSlotSkill)
  ) {
    matchCount += 1;
    matchedSkills.push(thirdSlotSkill);
  }

  if (configuration.fourthSlotSkillKey === null) {
    matchCount += 1;
  } else if (
    fourthSlotSkill !== undefined &&
    doesIdealSkillOptionMatch(configuration.fourthSlotSkillKey, fourthSlotSkill)
  ) {
    matchCount += 1;
    matchedSkills.push(fourthSlotSkill);
  }

  return {
    matchCount: Math.min(matchCount, 4) as 0 | 1 | 2 | 3 | 4,
    matchedSkills,
  };
}

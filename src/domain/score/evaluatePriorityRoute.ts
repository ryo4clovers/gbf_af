import type { NormalizedArtifactSkill } from "../skill/normalizedSkill";
import type {
  CustomScoreSettings,
  SkillScoreEntry,
} from "./customScoreSettings";
import {
  doesIdealSkillOptionMatch,
  IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  IDEAL_FOURTH_SLOT_OPTIONS,
  IDEAL_THIRD_SLOT_OPTIONS,
  type IdealSkillOption,
} from "./idealSkillConfiguration";
import {
  createAppliedTablePenaltyReason,
  createSkillScoreReason,
  getTableRankPenalty,
  roundScore,
} from "./scoreExplanation";
import type { ScoreReason } from "./scoreResult";

export type PriorityRouteResult = {
  score: number;
  reasons: ScoreReason[];
};

export function evaluatePriorityRoute(args: {
  skills: NormalizedArtifactSkill[];
  settings: CustomScoreSettings;
}): PriorityRouteResult {
  const reasons: ScoreReason[] = [];
  let score = 0;

  for (const skill of args.skills) {
    const baseScore = getConfiguredSkillScore(skill, args.settings);
    const requestedPenalty = getTableRankPenalty(
      skill,
      args.settings.tableRankPenalties,
    );
    const adjustedScore = Math.max(0, baseScore - requestedPenalty);
    const appliedPenalty = baseScore - adjustedScore;

    reasons.push(
      createSkillScoreReason({
        skill,
        baseScore,
        score: baseScore,
      }),
    );
    if (appliedPenalty > 0) {
      reasons.push(
        createAppliedTablePenaltyReason({
          skill,
          penalty: appliedPenalty,
        }),
      );
    }

    score += adjustedScore;
  }

  return {
    score: roundScore(score),
    reasons,
  };
}

function getConfiguredSkillScore(
  skill: NormalizedArtifactSkill,
  settings: CustomScoreSettings,
): number {
  const group =
    skill.slot === 1 || skill.slot === 2
      ? {
          entries: settings.skillScores.firstSecondSlot,
          options: IDEAL_FIRST_SECOND_SLOT_OPTIONS,
        }
      : skill.slot === 3
        ? {
            entries: settings.skillScores.thirdSlot,
            options: IDEAL_THIRD_SLOT_OPTIONS,
          }
        : {
            entries: settings.skillScores.fourthSlot,
            options: IDEAL_FOURTH_SLOT_OPTIONS,
          };
  const matchedOption = findMatchingOption(skill, group.options);

  if (matchedOption === undefined) {
    return 0;
  }

  return getScoreBySkillKey(group.entries, matchedOption.key);
}

function findMatchingOption(
  skill: NormalizedArtifactSkill,
  options: readonly IdealSkillOption[],
): IdealSkillOption | undefined {
  return options.find((option) => doesIdealSkillOptionMatch(option.key, skill));
}

function getScoreBySkillKey(
  entries: SkillScoreEntry[],
  skillKey: string,
): number {
  return entries.find((entry) => entry.skillKey === skillKey)?.score ?? 0;
}

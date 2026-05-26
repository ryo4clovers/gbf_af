import type { Artifact } from "../artifact";
import { normalizeArtifactSkills } from "../skill/normalizeSkill";
import { evaluateIdealRoute } from "./evaluateIdealRoute";
import { evaluatePriorityRoute } from "./evaluatePriorityRoute";
import type { ScoreProfile, UnwantedSkillConfig } from "./scoreProfile";
import type { ScoreResult } from "./scoreResult";

export type EvaluateCustomScoreInput = {
  artifact: Artifact;
  profile: ScoreProfile;
  unwantedSkillConfig: UnwantedSkillConfig;
};

export function evaluateCustomScore(
  input: EvaluateCustomScoreInput,
): ScoreResult {
  const skills = normalizeArtifactSkills(input.artifact.skills);
  const idealRoute = evaluateIdealRoute({
    skills,
    profile: input.profile,
  });
  const priorityRoute = evaluatePriorityRoute({
    skills,
    profile: input.profile,
    unwantedSkillConfig: input.unwantedSkillConfig,
  });
  const selectedRoute =
    idealRoute.score >= priorityRoute.score ? "ideal" : "priority";

  return {
    total: selectedRoute === "ideal" ? idealRoute.score : priorityRoute.score,
    selectedRoute,
    idealRouteScore: idealRoute.score,
    priorityRouteScore: priorityRoute.score,
    reasons:
      selectedRoute === "ideal" ? idealRoute.reasons : priorityRoute.reasons,
  };
}

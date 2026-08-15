import type { Artifact } from "../artifact";
import { normalizeArtifactSkills } from "../skill/normalizeSkill";
import type {
  CustomScoreSettings,
  UnwantedSkillConfig,
} from "./customScoreSettings";
import { evaluateIdealRoute } from "./evaluateIdealRoute";
import { evaluatePriorityRoute } from "./evaluatePriorityRoute";
import type { ScoreResult } from "./scoreResult";

export type EvaluateCustomScoreInput = {
  artifact: Artifact;
  settings: CustomScoreSettings;
  unwantedSkillConfig: UnwantedSkillConfig;
};

export function evaluateCustomScore(
  input: EvaluateCustomScoreInput,
): ScoreResult {
  const skills = normalizeArtifactSkills(input.artifact.skills);
  const idealRoute = evaluateIdealRoute({
    skills,
    settings: input.settings,
  });
  const priorityRoute = evaluatePriorityRoute({
    skills,
    settings: input.settings,
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

import type { Artifact } from "../artifact";
import { normalizeArtifactSkills } from "../skill/normalizeSkill";
import type { CustomScoreSettings } from "./customScoreSettings";
import { evaluateIdealRoute } from "./evaluateIdealRoute";
import { evaluatePriorityRoute } from "./evaluatePriorityRoute";
import type { ScoreResult } from "./scoreResult";

export type EvaluateCustomScoreInput = {
  artifact: Artifact;
  settings: CustomScoreSettings;
};

export function evaluateCustomScore(
  input: EvaluateCustomScoreInput,
): ScoreResult {
  if (input.artifact.isQuirk === true || input.artifact.raw.is_quirk === true) {
    return {
      total: 100,
      selectedRoute: "quirk",
      idealRouteScore: 0,
      priorityRouteScore: 0,
      reasons: [
        {
          type: "quirk",
          label: "クァーキーアーティファクト",
          delta: 100,
        },
      ],
    };
  }

  const skills = normalizeArtifactSkills(input.artifact.skills);
  const idealRoute = evaluateIdealRoute({
    artifact: input.artifact,
    skills,
    settings: input.settings,
  });
  const priorityRoute = evaluatePriorityRoute({
    skills,
    settings: input.settings,
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

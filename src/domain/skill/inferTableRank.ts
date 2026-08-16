import type { ArtifactSkill } from "../artifact";
import type { TableRank } from "./normalizedSkill";

const QUALITY_TO_TABLE_RANK: Record<number, TableRank> = {
  1: "e",
  2: "d",
  3: "c",
  4: "b",
  5: "a",
};

export function inferTableRank(
  skill: Pick<ArtifactSkill, "isMaxQuality" | "quality">,
): TableRank | undefined {
  if (skill.isMaxQuality) return "a";

  return inferSkillQuality(skill.quality);
}

export function inferSkillQuality(quality: number): TableRank | undefined {
  return QUALITY_TO_TABLE_RANK[quality];
}

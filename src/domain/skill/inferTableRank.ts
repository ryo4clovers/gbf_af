import type { ArtifactSkill } from "../artifact";
import type { TableRank } from "./normalizedSkill";

const QUALITY_TO_TABLE_RANK: Record<number, TableRank> = {
  1: "a",
  2: "b",
  3: "c",
  4: "d",
  5: "e",
};

export function inferTableRank(
  skill: Pick<ArtifactSkill, "slot" | "quality">,
): TableRank | undefined {
  if (skill.slot === 4) {
    return undefined;
  }

  return QUALITY_TO_TABLE_RANK[skill.quality];
}

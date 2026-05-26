import type { ArtifactSkill } from "../artifact";
import { inferTableRank } from "./inferTableRank";
import type {
  NormalizedArtifactSkill,
  NormalizedSkillKey,
} from "./normalizedSkill";
import { getSkillCatalogEntry } from "./skillCatalog";

export function normalizeArtifactSkill(
  skill: ArtifactSkill,
): NormalizedArtifactSkill {
  const catalogEntry = getSkillCatalogEntry(skill.skillId);

  return {
    rawName: skill.name,
    normalizedKey: catalogEntry?.normalizedKey ?? createFallbackSkillKey(skill),
    slot: skill.slot,
    skillId: skill.skillId,
    level: skill.level,
    value: skill.parsedValue?.value,
    unit: skill.parsedValue?.unit,
    tableRank: inferTableRank(skill),
    category: catalogEntry?.category ?? "unknown",
  };
}

export function normalizeArtifactSkills(
  skills: ArtifactSkill[],
): NormalizedArtifactSkill[] {
  return skills.map((skill) => normalizeArtifactSkill(skill));
}

export function createFallbackSkillKey(
  skill: Pick<ArtifactSkill, "skillId" | "name">,
): NormalizedSkillKey {
  if (Number.isFinite(skill.skillId) && skill.skillId > 0) {
    return `unknown_skill_id:${skill.skillId}`;
  }

  return `unknown_skill_name:${normalizeRawNameForKey(skill.name)}`;
}

function normalizeRawNameForKey(rawName: string): string {
  const normalized = rawName
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized.length > 0 ? normalized : "empty";
}

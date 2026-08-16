import type { Artifact } from "../domain/artifact";
import type { NormalizedSkillKey } from "../domain/skill/normalizedSkill";
import { normalizeArtifactSkills } from "../domain/skill/normalizeSkill";

export type LockedFilter = "all" | "locked" | "unlocked";
export type EquippedFilter = "all" | "equipped" | "unequipped";
export type LifecycleFilter = "all" | "active" | "possiblyDeleted";

export type SkillFilterCondition = {
  firstSecondSlotKeys: NormalizedSkillKey[];
  thirdSlotKeys: NormalizedSkillKey[];
  fourthSlotKeys: NormalizedSkillKey[];
};

export type ArtifactFilters = {
  searchText: string;
  attributeKeys: string[];
  kindKeys: string[];
  scoreRange: [number, number];
  ratingRange: [number, number];
  skillConditions: [
    SkillFilterCondition,
    SkillFilterCondition,
    SkillFilterCondition,
  ];
  locked: LockedFilter;
  equipped: EquippedFilter;
  lifecycle: LifecycleFilter;
};

export type FilterableArtifactRow = {
  artifact: Artifact;
  customScore: number;
  rating: number;
  isPossiblyDeleted: boolean;
};

export function createDefaultArtifactFilters(): ArtifactFilters {
  return {
    searchText: "",
    attributeKeys: ["1", "2", "3", "4", "5", "6"],
    kindKeys: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
    scoreRange: [0, 100],
    ratingRange: [0, 5],
    skillConditions: [
      createEmptySkillFilterCondition(),
      createEmptySkillFilterCondition(),
      createEmptySkillFilterCondition(),
    ],
    locked: "all",
    equipped: "all",
    lifecycle: "all",
  };
}

export function matchesArtifactFilters(
  row: FilterableArtifactRow,
  filters: ArtifactFilters,
): boolean {
  const { artifact } = row;
  const searchText = filters.searchText.trim().toLowerCase();

  if (searchText.length > 0 && !matchesSearchText(artifact, searchText)) {
    return false;
  }

  if (!filters.attributeKeys.includes(artifact.attribute.raw)) return false;
  if (!filters.kindKeys.includes(artifact.kind.raw)) return false;
  if (!isWithinRange(row.customScore, filters.scoreRange)) return false;
  if (!isWithinRange(row.rating, filters.ratingRange)) return false;

  if (filters.locked === "locked" && !artifact.isLocked) return false;
  if (filters.locked === "unlocked" && artifact.isLocked) return false;
  if (filters.equipped === "equipped" && artifact.equippedCharacter === null) {
    return false;
  }
  if (
    filters.equipped === "unequipped" &&
    artifact.equippedCharacter !== null
  ) {
    return false;
  }
  if (filters.lifecycle === "active" && row.isPossiblyDeleted) return false;
  if (filters.lifecycle === "possiblyDeleted" && !row.isPossiblyDeleted) {
    return false;
  }

  const artifactSkillKeys = new Set(
    normalizeArtifactSkills(artifact.skills).map(
      (skill) => skill.normalizedKey,
    ),
  );

  return filters.skillConditions.every((condition) => {
    const selectedKeys = getSelectedSkillKeys(condition);
    return (
      selectedKeys.length === 0 ||
      selectedKeys.some((skillKey) => artifactSkillKeys.has(skillKey))
    );
  });
}

function createEmptySkillFilterCondition(): SkillFilterCondition {
  return {
    firstSecondSlotKeys: [],
    thirdSlotKeys: [],
    fourthSlotKeys: [],
  };
}

function getSelectedSkillKeys(
  condition: SkillFilterCondition,
): NormalizedSkillKey[] {
  return [
    ...condition.firstSecondSlotKeys,
    ...condition.thirdSlotKeys,
    ...condition.fourthSlotKeys,
  ];
}

function isWithinRange(value: number, range: [number, number]): boolean {
  return value >= range[0] && value <= range[1];
}

function matchesSearchText(artifact: Artifact, searchText: string): boolean {
  if (artifact.name.toLowerCase().includes(searchText)) return true;
  if (artifact.equippedCharacter?.name.toLowerCase().includes(searchText)) {
    return true;
  }
  return artifact.skills.some((skill) =>
    skill.name.toLowerCase().includes(searchText),
  );
}

import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";

export type ImportedArtifactData = {
  artifacts: Artifact[];
  reviews: ArtifactUserReview[];
  presence: ArtifactPresence[];
};

export function isImportedArtifactData(
  value: unknown,
): value is ImportedArtifactData {
  if (
    !isRecord(value) ||
    !Array.isArray(value.artifacts) ||
    !Array.isArray(value.reviews) ||
    !Array.isArray(value.presence) ||
    !value.artifacts.every(isArtifact) ||
    !value.reviews.every(isArtifactUserReview) ||
    !value.presence.every(isArtifactPresence)
  ) {
    return false;
  }

  const artifactIds = new Set(
    value.artifacts.map((artifact) => artifact.ownedId),
  );
  return (
    artifactIds.size === value.artifacts.length &&
    value.reviews.every((review) => artifactIds.has(review.ownedId)) &&
    value.presence.every((item) => artifactIds.has(item.ownedId))
  );
}

function isArtifact(value: unknown): value is Artifact {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.ownedId) &&
    isNonNegativeInteger(value.artifactTypeId) &&
    typeof value.name === "string" &&
    isNonNegativeInteger(value.rarity) &&
    isNonNegativeInteger(value.level) &&
    isNonNegativeInteger(value.maxLevel) &&
    isLabeledValue(value.kind) &&
    isLabeledValue(value.attribute) &&
    typeof value.isLocked === "boolean" &&
    typeof value.isMarkedUnnecessaryInGame === "boolean" &&
    (value.isQuirk === undefined || typeof value.isQuirk === "boolean") &&
    ["none", "keep", "trash", "review"].includes(String(value.userMark)) &&
    isGameScore(value.gameScore) &&
    (value.customScore === null || isCustomScore(value.customScore)) &&
    Array.isArray(value.skills) &&
    value.skills.length <= 4 &&
    value.skills.every(isArtifactSkill) &&
    new Set(value.skills.map((skill) => skill.slot)).size ===
      value.skills.length &&
    (value.equippedCharacter === null ||
      isEquippedCharacter(value.equippedCharacter)) &&
    isRecord(value.raw) &&
    isIsoDate(value.scannedAt)
  );
}

function isArtifactUserReview(value: unknown): value is ArtifactUserReview {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.ownedId) &&
    isNonNegativeInteger(value.rating) &&
    value.rating <= 5 &&
    typeof value.memo === "string" &&
    isIsoDate(value.updatedAt)
  );
}

function isArtifactPresence(value: unknown): value is ArtifactPresence {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.ownedId) &&
    isIsoDate(value.firstSeenAt) &&
    isIsoDate(value.lastSeenAt) &&
    typeof value.lastSeenSessionId === "string" &&
    typeof value.isPossiblyDeleted === "boolean" &&
    (value.missingSinceSessionId === undefined ||
      typeof value.missingSinceSessionId === "string")
  );
}

function isArtifactSkill(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.slot === "number" &&
    [1, 2, 3, 4].includes(value.slot) &&
    isNonNegativeInteger(value.skillId) &&
    isNonNegativeInteger(value.quality) &&
    isNonNegativeInteger(value.level) &&
    typeof value.name === "string" &&
    typeof value.isMaxQuality === "boolean" &&
    typeof value.effectValueText === "string" &&
    (value.parsedValue === null || isParsedEffectValue(value.parsedValue)) &&
    typeof value.iconImage === "string" &&
    ["attack", "defense", "special", "unknown"].includes(
      String(value.scoreCategory),
    )
  );
}

function isParsedEffectValue(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.value) &&
    ["percent", "flat", "times", "count", "unknown"].includes(
      String(value.unit),
    )
  );
}

function isCustomScore(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.total) &&
    isFiniteNumber(value.attack) &&
    isFiniteNumber(value.defense) &&
    isFiniteNumber(value.special) &&
    Array.isArray(value.reasons) &&
    value.reasons.every(
      (reason) =>
        isRecord(reason) &&
        isNonNegativeInteger(reason.skillId) &&
        typeof reason.skillName === "string" &&
        isFiniteNumber(reason.delta) &&
        typeof reason.message === "string",
    )
  );
}

function isLabeledValue(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.raw === "string" &&
    typeof value.label === "string"
  );
}

function isGameScore(value: unknown): boolean {
  return (
    isRecord(value) &&
    isFiniteNumber(value.attack) &&
    isFiniteNumber(value.defense) &&
    isFiniteNumber(value.special) &&
    isFiniteNumber(value.total)
  );
}

function isEquippedCharacter(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.userNpcId) &&
    typeof value.image === "string" &&
    typeof value.name === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

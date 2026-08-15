import type { Artifact, ArtifactSkill } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";

export type ArtifactCsvRow = {
  artifact: Artifact;
  review?: ArtifactUserReview | undefined;
  presence?: ArtifactPresence | undefined;
};

const CSV_HEADERS = [
  "ownedId",
  "artifactId",
  "name",
  "attribute",
  "kind",
  "rarity",
  "level",
  "maxLevel",
  "locked",
  "unnecessary",
  "equippedCharacterName",
  "attackScore",
  "defenseScore",
  "specialScore",
  "totalScore",
  "skill1Name",
  "skill1Value",
  "skill1Quality",
  "skill1Category",
  "skill2Name",
  "skill2Value",
  "skill2Quality",
  "skill2Category",
  "skill3Name",
  "skill3Value",
  "skill3Quality",
  "skill3Category",
  "skill4Name",
  "skill4Value",
  "skill4Quality",
  "skill4Category",
  "rating",
  "memo",
  "lastSeenAt",
  "isPossiblyDeleted",
  "missingSinceSessionId",
  "artifactData",
  "reviewData",
  "presenceData",
];

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

export function convertArtifactsToCsv(artifacts: Artifact[]): string {
  return convertArtifactRowsToCsv(
    artifacts.map((artifact) => ({
      artifact,
    })),
  );
}

export function convertArtifactRowsToCsv(rows: ArtifactCsvRow[]): string {
  const csvRows = rows.map((row) => {
    return CSV_HEADERS.map((header) => {
      return escapeCsvValue(getArtifactCsvValue(row, header));
    }).join(",");
  });

  return [CSV_HEADERS.join(","), ...csvRows].join("\r\n");
}

export function escapeCsvValue(
  value: string | number | boolean | null,
): string {
  const text = value === null ? "" : String(value);

  if (!/[",\r\n]/.test(text)) {
    return text;
  }

  return `"${text.replaceAll('"', '""')}"`;
}

function getArtifactCsvValue(
  row: ArtifactCsvRow,
  header: string,
): string | number | boolean | null {
  const { artifact, review } = row;
  const { presence } = row;

  switch (header) {
    case "ownedId":
      return artifact.ownedId;
    case "artifactId":
      return artifact.artifactTypeId;
    case "name":
      return artifact.name;
    case "attribute":
      return artifact.attribute.label;
    case "kind":
      return artifact.kind.label;
    case "rarity":
      return artifact.rarity;
    case "level":
      return artifact.level;
    case "maxLevel":
      return artifact.maxLevel;
    case "locked":
      return artifact.isLocked;
    case "unnecessary":
      return artifact.isMarkedUnnecessaryInGame;
    case "equippedCharacterName":
      return artifact.equippedCharacter?.name ?? null;
    case "attackScore":
      return artifact.gameScore.attack;
    case "defenseScore":
      return artifact.gameScore.defense;
    case "specialScore":
      return artifact.gameScore.special;
    case "totalScore":
      return artifact.gameScore.total;
    case "rating":
      return review?.rating ?? 0;
    case "memo":
      return review?.memo ?? null;
    case "lastSeenAt":
      return presence?.lastSeenAt ?? null;
    case "isPossiblyDeleted":
      return presence?.isPossiblyDeleted ?? false;
    case "missingSinceSessionId":
      return presence?.missingSinceSessionId ?? null;
    case "artifactData":
      return JSON.stringify(artifact);
    case "reviewData":
      return review === undefined ? null : JSON.stringify(review);
    case "presenceData":
      return presence === undefined ? null : JSON.stringify(presence);
    default:
      return getSkillCsvValue(artifact, header);
  }
}

export function parseArtifactRowsFromCsv(csv: string): ImportedArtifactData {
  const records = parseCsvRecords(csv);
  const [headers, ...rows] = records;

  if (headers === undefined) {
    throw new Error("CSV is empty.");
  }

  const artifactDataIndex = headers.indexOf("artifactData");
  const reviewDataIndex = headers.indexOf("reviewData");
  const presenceDataIndex = headers.indexOf("presenceData");
  if (artifactDataIndex < 0) {
    throw new Error("This CSV does not contain migration data.");
  }

  const artifacts: Artifact[] = [];
  const reviews: ArtifactUserReview[] = [];
  const presence: ArtifactPresence[] = [];

  for (const [index, row] of rows.entries()) {
    if (row.every((value) => value.length === 0)) {
      continue;
    }

    const artifact = parseJsonCell(row[artifactDataIndex], `row ${index + 2}`);
    if (!isArtifact(artifact)) {
      throw new Error(`Invalid artifact migration data at row ${index + 2}.`);
    }
    artifacts.push(artifact);

    const review = parseOptionalJsonCell(row[reviewDataIndex]);
    if (review !== null) {
      if (
        !isArtifactUserReview(review) ||
        review.ownedId !== artifact.ownedId
      ) {
        throw new Error(`Invalid review migration data at row ${index + 2}.`);
      }
      reviews.push(review);
    }

    const artifactPresence = parseOptionalJsonCell(row[presenceDataIndex]);
    if (artifactPresence !== null) {
      if (
        !isArtifactPresence(artifactPresence) ||
        artifactPresence.ownedId !== artifact.ownedId
      ) {
        throw new Error(`Invalid presence migration data at row ${index + 2}.`);
      }
      presence.push(artifactPresence);
    }
  }

  const imported = { artifacts, reviews, presence };
  if (!isImportedArtifactData(imported)) {
    throw new Error("CSV migration data contains inconsistent record IDs.");
  }
  return imported;
}

function parseCsvRecords(csv: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      record.push(field);
      field = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") {
        index += 1;
      }
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV contains an unterminated quoted field.");
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

function parseJsonCell(value: string | undefined, location: string): unknown {
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing migration data at ${location}.`);
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error(`Invalid JSON migration data at ${location}.`);
  }
}

function parseOptionalJsonCell(value: string | undefined): unknown | null {
  if (value === undefined || value.length === 0) {
    return null;
  }
  return parseJsonCell(value, "CSV field");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

function isEquippedCharacter(value: unknown): boolean {
  return (
    isRecord(value) &&
    isNonNegativeInteger(value.userNpcId) &&
    typeof value.image === "string" &&
    typeof value.name === "string"
  );
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

function getSkillCsvValue(
  artifact: Artifact,
  header: string,
): string | number | boolean | null {
  const match =
    /^skill(?<slot>[1-4])(?<field>Name|Value|Quality|Category)$/.exec(header);

  if (match?.groups === undefined) {
    return null;
  }

  const slot = Number.parseInt(match.groups.slot, 10);
  const skill = artifact.skills.find((candidate) => candidate.slot === slot);

  if (skill === undefined) {
    return null;
  }

  return getSingleSkillCsvValue(skill, match.groups.field);
}

function getSingleSkillCsvValue(
  skill: ArtifactSkill,
  field: string,
): string | number {
  switch (field) {
    case "Name":
      return skill.name;
    case "Value":
      return skill.effectValueText;
    case "Quality":
      return skill.quality;
    case "Category":
      return skill.scoreCategory;
    default:
      return "";
  }
}

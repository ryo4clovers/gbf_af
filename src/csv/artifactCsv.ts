import type { Artifact, ArtifactSkill } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";

export type ArtifactCsvRow = {
  artifact: Artifact;
  review?: ArtifactUserReview | undefined;
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
];

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
    default:
      return getSkillCsvValue(artifact, header);
  }
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

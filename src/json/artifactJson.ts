import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";
import { isImportedArtifactData } from "./artifactDataValidation";

export const ARTIFACT_JSON_FORMAT = "gbf-af-manager";
export const ARTIFACT_JSON_VERSION = 1;

export type ArtifactJsonDocument = {
  format: typeof ARTIFACT_JSON_FORMAT;
  version: typeof ARTIFACT_JSON_VERSION;
  exportedAt: string;
  artifacts: Artifact[];
  reviews: ArtifactUserReview[];
  presence: ArtifactPresence[];
};

export function createArtifactJson(
  data: Pick<ArtifactJsonDocument, "artifacts" | "reviews" | "presence">,
  exportedAt: string,
): string {
  const document: ArtifactJsonDocument = {
    format: ARTIFACT_JSON_FORMAT,
    version: ARTIFACT_JSON_VERSION,
    exportedAt,
    artifacts: data.artifacts,
    reviews: data.reviews,
    presence: data.presence,
  };

  return JSON.stringify(document, null, 2);
}

export function parseArtifactJson(json: string): ArtifactJsonDocument {
  let value: unknown;

  try {
    value = JSON.parse(json.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("JSONの形式が正しくありません。");
  }

  if (!isRecord(value) || value.format !== ARTIFACT_JSON_FORMAT) {
    throw new Error("GBF AF ManagerのJSONファイルではありません。");
  }
  if (value.version !== ARTIFACT_JSON_VERSION) {
    throw new Error(`未対応のJSONバージョンです: ${String(value.version)}`);
  }
  if (!isIsoDate(value.exportedAt)) {
    throw new Error("エクスポート日時が正しくありません。");
  }
  const exportedAt = value.exportedAt;
  if (!isImportedArtifactData(value)) {
    throw new Error("アーティファクトデータが正しくありません。");
  }

  return {
    format: ARTIFACT_JSON_FORMAT,
    version: ARTIFACT_JSON_VERSION,
    exportedAt,
    artifacts: value.artifacts,
    reviews: value.reviews,
    presence: value.presence,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return (
    typeof value === "string" &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value).toISOString() === value
  );
}

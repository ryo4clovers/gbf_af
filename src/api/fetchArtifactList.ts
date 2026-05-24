import { artifactListResponseSchema } from "./artifactListSchema";
import type { ArtifactListResponse } from "./artifactListTypes";

const GBF_ORIGIN = "https://game.granbluefantasy.jp";

export async function fetchArtifactListPage(
  page: number,
): Promise<ArtifactListResponse> {
  if (!Number.isInteger(page) || page < 1) {
    throw new Error(`Invalid artifact page: ${page}`);
  }

  const response = await fetch(`${GBF_ORIGIN}/rest/artifact/list/${page}`, {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Artifact list request failed: HTTP ${response.status}`);
  }

  const data: unknown = await response.json();
  return artifactListResponseSchema.parse(data) as ArtifactListResponse;
}

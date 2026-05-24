import type { Artifact } from "../domain/artifact";

export type LastSuccessfulScanResult = {
  page: number;
  artifactCount: number;
  scannedAt: string;
  artifacts: Artifact[];
};

const artifactsByOwnedId = new Map<number, Artifact>();
let lastSuccessfulScanResult: LastSuccessfulScanResult | null = null;

export function saveSuccessfulScanInMemory(
  artifacts: Artifact[],
  page: number,
  scannedAt: string,
): number {
  for (const artifact of artifacts) {
    artifactsByOwnedId.set(artifact.ownedId, artifact);
  }

  lastSuccessfulScanResult = {
    page,
    artifactCount: artifacts.length,
    scannedAt,
    artifacts,
  };

  return artifactsByOwnedId.size;
}

export function getStoredArtifactCount(): number {
  return artifactsByOwnedId.size;
}

export function getLastSuccessfulScanResult(): LastSuccessfulScanResult | null {
  return lastSuccessfulScanResult;
}

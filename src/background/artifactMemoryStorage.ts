import type { Artifact } from "../domain/artifact";

const artifactsByOwnedId = new Map<number, Artifact>();

export function saveArtifactsInMemory(artifacts: Artifact[]): number {
  for (const artifact of artifacts) {
    artifactsByOwnedId.set(artifact.ownedId, artifact);
  }

  return artifactsByOwnedId.size;
}

export function getStoredArtifactCount(): number {
  return artifactsByOwnedId.size;
}

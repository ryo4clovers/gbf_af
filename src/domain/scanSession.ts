export type ScanSession = {
  id: string;
  startedAt: string;
  finishedAt?: string;
  observedPages: number[];
  expectedLastPage?: number;
  observedArtifactCount: number;
  isFullScan: boolean;
};

export type ArtifactPresence = {
  ownedId: number;
  firstSeenAt: string;
  lastSeenAt: string;
  lastSeenSessionId: string;
  isPossiblyDeleted: boolean;
  missingSinceSessionId?: string;
};

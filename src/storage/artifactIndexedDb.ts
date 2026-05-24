import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import type { ArtifactPresence, ScanSession } from "../domain/scanSession";

const DATABASE_NAME = "gbf-artifact-manager";
const DATABASE_VERSION = 3;
const ARTIFACT_STORE_NAME = "artifacts";
const SCAN_METADATA_STORE_NAME = "scanMetadata";
const ARTIFACT_USER_REVIEW_STORE_NAME = "artifactUserReviews";
const SCAN_SESSION_STORE_NAME = "scanSessions";
const ARTIFACT_PRESENCE_STORE_NAME = "artifactPresence";
const LAST_SCAN_METADATA_ID = "lastScan";

export type ScanMetadata = {
  id: typeof LAST_SCAN_METADATA_ID;
  scannedPage: number;
  scannedAt: string;
  artifactCount: number;
};

export type SaveScannedArtifactsInput = {
  artifacts: Artifact[];
  scannedPage: number;
  scannedAt: string;
};

export type BackfillLegacyArtifactPresenceResult = {
  artifactCount: number;
  existingPresenceCount: number;
  createdPresenceCount: number;
};

export type MarkMissingArtifactsResult = {
  markedPossiblyDeletedCount: number;
};

export async function saveScannedArtifacts(
  input: SaveScannedArtifactsInput,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ARTIFACT_STORE_NAME, SCAN_METADATA_STORE_NAME],
    "readwrite",
  );

  const artifactStore = transaction.objectStore(ARTIFACT_STORE_NAME);

  for (const artifact of input.artifacts) {
    artifactStore.put(artifact);
  }

  transaction.objectStore(SCAN_METADATA_STORE_NAME).put({
    id: LAST_SCAN_METADATA_ID,
    scannedPage: input.scannedPage,
    scannedAt: input.scannedAt,
    artifactCount: input.artifacts.length,
  } satisfies ScanMetadata);

  await waitForTransaction(transaction);
  database.close();
}

export async function getAllArtifacts(): Promise<Artifact[]> {
  const database = await openDatabase();
  const request = database
    .transaction(ARTIFACT_STORE_NAME, "readonly")
    .objectStore(ARTIFACT_STORE_NAME)
    .getAll();
  const artifacts = await waitForRequest<Artifact[]>(request);

  database.close();
  return artifacts;
}

export async function getScanMetadata(): Promise<ScanMetadata | null> {
  const database = await openDatabase();
  const request = database
    .transaction(SCAN_METADATA_STORE_NAME, "readonly")
    .objectStore(SCAN_METADATA_STORE_NAME)
    .get(LAST_SCAN_METADATA_ID);
  const metadata = await waitForRequest<ScanMetadata | undefined>(request);

  database.close();
  return metadata ?? null;
}

export async function clearAllArtifacts(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    [ARTIFACT_STORE_NAME, SCAN_METADATA_STORE_NAME],
    "readwrite",
  );

  transaction.objectStore(ARTIFACT_STORE_NAME).clear();
  transaction.objectStore(SCAN_METADATA_STORE_NAME).clear();

  await waitForTransaction(transaction);
  database.close();
}

export async function getArtifactUserReviews(): Promise<ArtifactUserReview[]> {
  const database = await openDatabase();
  const request = database
    .transaction(ARTIFACT_USER_REVIEW_STORE_NAME, "readonly")
    .objectStore(ARTIFACT_USER_REVIEW_STORE_NAME)
    .getAll();
  const reviews = await waitForRequest<ArtifactUserReview[]>(request);

  database.close();
  return reviews;
}

export async function getArtifactUserReview(
  ownedId: number,
): Promise<ArtifactUserReview | null> {
  const database = await openDatabase();
  const request = database
    .transaction(ARTIFACT_USER_REVIEW_STORE_NAME, "readonly")
    .objectStore(ARTIFACT_USER_REVIEW_STORE_NAME)
    .get(ownedId);
  const review = await waitForRequest<ArtifactUserReview | undefined>(request);

  database.close();
  return review ?? null;
}

export async function saveArtifactUserReview(
  review: ArtifactUserReview,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ARTIFACT_USER_REVIEW_STORE_NAME,
    "readwrite",
  );

  transaction.objectStore(ARTIFACT_USER_REVIEW_STORE_NAME).put(review);

  await waitForTransaction(transaction);
  database.close();
}

export async function clearArtifactUserReviews(): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    ARTIFACT_USER_REVIEW_STORE_NAME,
    "readwrite",
  );

  transaction.objectStore(ARTIFACT_USER_REVIEW_STORE_NAME).clear();

  await waitForTransaction(transaction);
  database.close();
}

export async function createScanSession(session: ScanSession): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(
    SCAN_SESSION_STORE_NAME,
    "readwrite",
  );

  transaction.objectStore(SCAN_SESSION_STORE_NAME).put(session);

  await waitForTransaction(transaction);
  database.close();
}

export async function updateScanSession(session: ScanSession): Promise<void> {
  await createScanSession(session);
}

export async function getActiveScanSession(): Promise<ScanSession | null> {
  const sessions = await getAllScanSessions();

  return (
    sessions
      .filter((session) => session.finishedAt === undefined)
      .sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      )[0] ?? null
  );
}

export async function finishActiveScanSession(
  finishedAt: string,
): Promise<ScanSession | null> {
  const activeSession = await getActiveScanSession();

  if (activeSession === null) {
    return null;
  }

  const finishedSession = {
    ...activeSession,
    finishedAt,
    isFullScan: isFullScan(activeSession),
  };

  await updateScanSession(finishedSession);
  return finishedSession;
}

export async function getLatestScanSession(): Promise<ScanSession | null> {
  const sessions = await getAllScanSessions();

  return (
    sessions.sort((left, right) =>
      (right.finishedAt ?? right.startedAt).localeCompare(
        left.finishedAt ?? left.startedAt,
      ),
    )[0] ?? null
  );
}

export async function getArtifactPresenceMap(): Promise<
  Record<number, ArtifactPresence>
> {
  const database = await openDatabase();
  const request = database
    .transaction(ARTIFACT_PRESENCE_STORE_NAME, "readonly")
    .objectStore(ARTIFACT_PRESENCE_STORE_NAME)
    .getAll();
  const presenceRecords = await waitForRequest<ArtifactPresence[]>(request);
  const presenceMap: Record<number, ArtifactPresence> = {};

  for (const presence of presenceRecords) {
    presenceMap[presence.ownedId] = presence;
  }

  database.close();
  return presenceMap;
}

export async function updateArtifactPresence(
  artifacts: Artifact[],
  sessionId: string,
  seenAt: string,
): Promise<void> {
  const existingPresence = await getArtifactPresenceMap();
  const database = await openDatabase();
  const transaction = database.transaction(
    ARTIFACT_PRESENCE_STORE_NAME,
    "readwrite",
  );
  const store = transaction.objectStore(ARTIFACT_PRESENCE_STORE_NAME);

  for (const artifact of artifacts) {
    const existing = existingPresence[artifact.ownedId];
    const nextPresence: ArtifactPresence = {
      ownedId: artifact.ownedId,
      firstSeenAt: existing?.firstSeenAt ?? seenAt,
      lastSeenAt: seenAt,
      lastSeenSessionId: sessionId,
      isPossiblyDeleted: false,
      missingSinceSessionId: undefined,
    };

    store.put(nextPresence);
  }

  await waitForTransaction(transaction);
  database.close();
}

export async function backfillLegacyArtifactPresence(
  timestamp: string,
): Promise<BackfillLegacyArtifactPresenceResult> {
  const artifacts = await getAllArtifacts();
  const existingPresence = await getArtifactPresenceMap();
  const database = await openDatabase();
  const transaction = database.transaction(
    ARTIFACT_PRESENCE_STORE_NAME,
    "readwrite",
  );
  const store = transaction.objectStore(ARTIFACT_PRESENCE_STORE_NAME);
  let createdPresenceCount = 0;

  for (const artifact of artifacts) {
    if (existingPresence[artifact.ownedId] !== undefined) {
      continue;
    }

    store.put({
      ownedId: artifact.ownedId,
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      lastSeenSessionId: "legacy",
      isPossiblyDeleted: false,
      missingSinceSessionId: undefined,
    } satisfies ArtifactPresence);
    createdPresenceCount += 1;
  }

  await waitForTransaction(transaction);
  database.close();

  return {
    artifactCount: artifacts.length,
    existingPresenceCount: Object.keys(existingPresence).length,
    createdPresenceCount,
  };
}

export async function markMissingArtifactsPossiblyDeleted(
  sessionId: string,
): Promise<MarkMissingArtifactsResult> {
  const presenceMap = await getArtifactPresenceMap();
  const database = await openDatabase();
  const transaction = database.transaction(
    ARTIFACT_PRESENCE_STORE_NAME,
    "readwrite",
  );
  const store = transaction.objectStore(ARTIFACT_PRESENCE_STORE_NAME);
  let markedPossiblyDeletedCount = 0;

  for (const presence of Object.values(presenceMap)) {
    if (presence.lastSeenSessionId === sessionId) {
      continue;
    }

    store.put({
      ...presence,
      isPossiblyDeleted: true,
      missingSinceSessionId: sessionId,
    } satisfies ArtifactPresence);
    markedPossiblyDeletedCount += 1;
  }

  await waitForTransaction(transaction);
  database.close();

  return {
    markedPossiblyDeletedCount,
  };
}

async function getAllScanSessions(): Promise<ScanSession[]> {
  const database = await openDatabase();
  const request = database
    .transaction(SCAN_SESSION_STORE_NAME, "readonly")
    .objectStore(SCAN_SESSION_STORE_NAME)
    .getAll();
  const sessions = await waitForRequest<ScanSession[]>(request);

  database.close();
  return sessions;
}

function isFullScan(session: ScanSession): boolean {
  if (session.expectedLastPage === undefined || session.expectedLastPage < 1) {
    return false;
  }

  const observedPages = new Set(session.observedPages);

  for (let page = 1; page <= session.expectedLastPage; page += 1) {
    if (!observedPages.has(page)) {
      return false;
    }
  }

  return true;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(ARTIFACT_STORE_NAME)) {
        database.createObjectStore(ARTIFACT_STORE_NAME, {
          keyPath: "ownedId",
        });
      }

      if (!database.objectStoreNames.contains(SCAN_METADATA_STORE_NAME)) {
        database.createObjectStore(SCAN_METADATA_STORE_NAME, {
          keyPath: "id",
        });
      }

      if (
        !database.objectStoreNames.contains(ARTIFACT_USER_REVIEW_STORE_NAME)
      ) {
        database.createObjectStore(ARTIFACT_USER_REVIEW_STORE_NAME, {
          keyPath: "ownedId",
        });
      }

      if (!database.objectStoreNames.contains(SCAN_SESSION_STORE_NAME)) {
        database.createObjectStore(SCAN_SESSION_STORE_NAME, {
          keyPath: "id",
        });
      }

      if (!database.objectStoreNames.contains(ARTIFACT_PRESENCE_STORE_NAME)) {
        database.createObjectStore(ARTIFACT_PRESENCE_STORE_NAME, {
          keyPath: "ownedId",
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

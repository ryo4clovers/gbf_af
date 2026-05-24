import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";

const DATABASE_NAME = "gbf-artifact-manager";
const DATABASE_VERSION = 2;
const ARTIFACT_STORE_NAME = "artifacts";
const SCAN_METADATA_STORE_NAME = "scanMetadata";
const ARTIFACT_USER_REVIEW_STORE_NAME = "artifactUserReviews";
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

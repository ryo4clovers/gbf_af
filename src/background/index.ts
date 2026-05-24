import { ZodError } from "zod";
import { artifactListResponseSchema } from "../api/artifactListSchema";
import type { ArtifactListResponse } from "../api/artifactListTypes";
import type { Artifact } from "../domain/artifact";
import { normalizeArtifact } from "../domain/normalizeArtifact";
import type {
  ErrorResponse,
  ExtensionMessage,
  ExtensionResponse,
} from "../shared/messages";
import {
  type AppMode,
  initialScanState,
  type ScanErrorCode,
} from "../state/appState";
import {
  clearAllArtifacts,
  getAllArtifacts,
  getScanMetadata,
  saveScannedArtifacts,
} from "../storage/artifactIndexedDb";
import {
  clearArtifactsInMemory,
  saveSuccessfulScanInMemory,
} from "./artifactMemoryStorage";

let currentMode: AppMode = "scan";
let currentScanState = initialScanState;

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    handleMessage(message)
      .then(sendResponse)
      .catch((error: unknown) => {
        logDebugError("Unhandled extension message error", error);
        currentScanState = markScanError(
          "unexpected_response",
          "Unexpected extension error.",
        );
        sendResponse({
          ok: false,
          type: "ERROR",
          message: "Unexpected extension error.",
          errorCode: "unexpected_response",
          scan: currentScanState,
        });
      });

    return true;
  },
);

async function handleMessage(
  message: ExtensionMessage,
): Promise<ExtensionResponse> {
  switch (message.type) {
    case "GET_APP_STATE":
      currentScanState = await hydratePersistedScanState(currentScanState);
      return {
        ok: true,
        type: "APP_STATE",
        mode: currentMode,
        scan: currentScanState,
      };
    case "SET_APP_MODE":
      currentMode = message.mode;
      return {
        ok: true,
        type: "APP_STATE",
        mode: currentMode,
        scan: currentScanState,
      };
    case "START_OBSERVING":
      return startObserving();
    case "STOP_OBSERVING":
      return stopObserving();
    case "ARTIFACT_LIST_OBSERVED":
      return handleObservedArtifactList(message);
    case "GET_STORED_ARTIFACT_COUNT":
      return getStoredArtifactCountResponse();
    case "GET_STORED_ARTIFACTS":
      return getStoredArtifactsResponse();
    case "CLEAR_STORED_ARTIFACTS":
      return clearStoredArtifacts();
    case "OPEN_DASHBOARD":
      await chrome.tabs.create({
        url: chrome.runtime.getURL("dashboard.html"),
      });
      return {
        ok: true,
        type: "OPEN_DASHBOARD_RESULT",
      };
    default:
      return {
        ok: false,
        type: "ERROR",
        message: "Unsupported message type.",
        errorCode: "unexpected_response",
      };
  }
}

async function startObserving(): Promise<ExtensionResponse> {
  const tab = await getActiveTab();

  if (tab?.id === undefined) {
    return scanErrorResponse(
      "active_tab_unavailable",
      "Active tab could not be identified.",
    );
  }

  if (!isGranblueFantasyTab(tab)) {
    return scanErrorResponse(
      "not_on_artifact_page",
      "Open a GBF page before starting observation.",
    );
  }

  try {
    await injectPageObserver(tab.id);
    await chrome.tabs.sendMessage<ExtensionMessage, ExtensionResponse>(tab.id, {
      type: "START_OBSERVING",
    });
  } catch (error) {
    logDebugError("Could not start observer", error, { tabId: tab.id });
    return scanErrorResponse(
      "unexpected_response",
      "Could not start artifact response observation.",
    );
  }

  currentScanState = {
    ...currentScanState,
    status: "observing",
    errorCode: null,
    errorMessage: null,
  };
  console.info("[GBF Artifact Manager] observer start", { tabId: tab.id });

  return {
    ok: true,
    type: "OBSERVATION_STATUS",
    message: "Observing GBF artifact list responses.",
    observing: true,
    scan: currentScanState,
  };
}

async function stopObserving(): Promise<ExtensionResponse> {
  const tab = await getActiveTab();

  if (tab?.id === undefined) {
    return scanErrorResponse(
      "active_tab_unavailable",
      "Active tab could not be identified.",
    );
  }

  try {
    await chrome.tabs.sendMessage<ExtensionMessage, ExtensionResponse>(tab.id, {
      type: "STOP_OBSERVING",
    });
  } catch (error) {
    logDebugError("Could not stop observer", error, { tabId: tab.id });
  }

  currentScanState = {
    ...currentScanState,
    status: "idle",
    errorCode: null,
    errorMessage: null,
  };
  console.info("[GBF Artifact Manager] observer stop", { tabId: tab.id });

  return {
    ok: true,
    type: "OBSERVATION_STATUS",
    message: "Observation stopped.",
    observing: false,
    scan: currentScanState,
  };
}

async function handleObservedArtifactList(
  message: Extract<ExtensionMessage, { type: "ARTIFACT_LIST_OBSERVED" }>,
): Promise<ExtensionResponse> {
  console.info("[GBF Artifact Manager] matched request URL", {
    url: message.url,
  });

  const scannedAt = new Date().toISOString();
  const artifactListResult = validateObservedArtifactList(message.payload);

  if (!artifactListResult.ok) {
    return artifactListResult;
  }

  const artifactList = artifactListResult.artifactList;
  const artifacts = artifactList.list.map((raw) =>
    normalizeArtifact(raw, scannedAt),
  );
  const persistenceResult = await persistScannedArtifacts(
    artifacts,
    artifactList.current,
    scannedAt,
  );

  if (!persistenceResult.ok) {
    return persistenceResult;
  }

  const storedArtifactCount = saveSuccessfulScanInMemory(
    artifacts,
    artifactList.current,
    scannedAt,
  );

  currentScanState = {
    status: "captured",
    currentPage: artifactList.current,
    lastPage: artifactList.last,
    totalCount: artifactList.count,
    scannedArtifactCount: storedArtifactCount,
    persistedArtifactCount: persistenceResult.persistedArtifactCount,
    lastScannedPage: artifactList.current,
    lastScanArtifactCount: artifacts.length,
    scannedPages: addScannedPage(
      currentScanState.scannedPages,
      artifactList.current,
    ),
    lastScannedAt: scannedAt,
    errorCode: null,
    errorMessage: null,
  };
  chrome.runtime
    .sendMessage({
      type: "OBSERVATION_CAPTURED_UPDATE",
      scan: currentScanState,
    } satisfies ExtensionMessage)
    .catch(() => {
      // Popup may be closed; no action needed.
    });

  return {
    ok: true,
    type: "ARTIFACT_LIST_OBSERVED_RESULT",
    message: `Captured ${artifacts.length} artifacts from page ${artifactList.current}.`,
    artifactCount: artifacts.length,
    page: artifactList.current,
    scan: currentScanState,
  };
}

async function injectPageObserver(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({
    target: {
      tabId,
    },
    files: ["assets/pageObserver.js"],
    world: "MAIN",
  });
  console.info("[GBF Artifact Manager] observer injection requested", {
    tabId,
  });
}

async function getStoredArtifactCountResponse(): Promise<ExtensionResponse> {
  try {
    currentScanState = await hydratePersistedScanState(currentScanState);

    return {
      ok: true,
      type: "STORED_ARTIFACT_COUNT",
      artifactCount: currentScanState.persistedArtifactCount,
      scan: currentScanState,
    };
  } catch (error) {
    logDebugError("Could not read stored artifact count", error);
    return scanErrorResponse(
      "storage_failed",
      "Could not read stored artifact data.",
    );
  }
}

async function getStoredArtifactsResponse(): Promise<ExtensionResponse> {
  try {
    const artifacts = await getAllArtifacts();
    currentScanState = await hydratePersistedScanState(currentScanState);

    return {
      ok: true,
      type: "STORED_ARTIFACTS",
      artifacts,
      artifactCount: artifacts.length,
      scan: currentScanState,
    };
  } catch (error) {
    logDebugError("Could not read stored artifacts", error);
    return scanErrorResponse(
      "storage_failed",
      "Could not read stored artifact data.",
    );
  }
}

async function clearStoredArtifacts(): Promise<ExtensionResponse> {
  try {
    await clearAllArtifacts();
    clearArtifactsInMemory();
    currentScanState = {
      ...initialScanState,
      status: "idle",
    };

    return {
      ok: true,
      type: "CLEAR_STORED_ARTIFACTS_RESULT",
      artifactCount: 0,
      scan: currentScanState,
    };
  } catch (error) {
    logDebugError("Could not clear stored artifacts", error);
    return scanErrorResponse(
      "storage_failed",
      "Could not clear stored artifact data.",
    );
  }
}

function validateObservedArtifactList(payload: unknown):
  | {
      ok: true;
      artifactList: ArtifactListResponse;
    }
  | ErrorResponse {
  try {
    const artifactList = artifactListResponseSchema.parse(
      payload,
    ) as ArtifactListResponse;
    console.info("[GBF Artifact Manager] validation success", {
      page: artifactList.current,
      artifactCount: artifactList.list.length,
    });

    return {
      ok: true,
      artifactList,
    };
  } catch (error) {
    if (error instanceof ZodError) {
      logZodError("validation failure", error);
      return scanErrorResponse(
        "api_validation_failed",
        "Artifact list response did not match the expected shape.",
      );
    }

    logDebugError("Artifact list validation failed", error);
    return scanErrorResponse(
      "api_validation_failed",
      "Artifact list response did not match the expected shape.",
    );
  }
}

async function persistScannedArtifacts(
  artifacts: Artifact[],
  scannedPage: number,
  scannedAt: string,
): Promise<
  | {
      ok: true;
      persistedArtifactCount: number;
    }
  | ErrorResponse
> {
  try {
    await saveScannedArtifacts({
      artifacts,
      scannedPage,
      scannedAt,
    });

    const persistedArtifactCount = (await getAllArtifacts()).length;
    console.info("[GBF Artifact Manager] persistence success", {
      artifactCount: artifacts.length,
      persistedArtifactCount,
      scannedPage,
    });

    return {
      ok: true,
      persistedArtifactCount,
    };
  } catch (error) {
    logDebugError("persistence failure", error, {
      artifactCount: artifacts.length,
      scannedPage,
    });
    return scanErrorResponse(
      "storage_failed",
      "Could not save scanned artifacts.",
    );
  }
}

function isGranblueFantasyTab(tab: chrome.tabs.Tab): boolean {
  if (tab.url === undefined) {
    return false;
  }

  try {
    return new URL(tab.url).hostname === "game.granbluefantasy.jp";
  } catch {
    return false;
  }
}

async function hydratePersistedScanState(
  scanState: typeof currentScanState,
): Promise<typeof currentScanState> {
  const [artifacts, metadata] = await Promise.all([
    getAllArtifacts(),
    getScanMetadata(),
  ]);

  if (metadata === null) {
    return {
      ...scanState,
      persistedArtifactCount: artifacts.length,
    };
  }

  return {
    ...scanState,
    persistedArtifactCount: artifacts.length,
    lastScannedPage: metadata.scannedPage,
    lastScanArtifactCount: metadata.artifactCount,
    lastScannedAt: metadata.scannedAt,
  };
}

async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (tab === undefined) {
    return null;
  }

  return tab;
}

function addScannedPage(scannedPages: number[], page: number): number[] {
  return Array.from(new Set([...scannedPages, page])).sort((left, right) => {
    return left - right;
  });
}

function scanErrorResponse(
  errorCode: ScanErrorCode,
  message: string,
): ErrorResponse {
  currentScanState = markScanError(errorCode, message);

  return {
    ok: false,
    type: "ERROR",
    message,
    errorCode,
    scan: currentScanState,
  };
}

function markScanError(
  errorCode: ScanErrorCode,
  message: string,
): typeof currentScanState {
  return {
    ...currentScanState,
    status: "error",
    errorCode,
    errorMessage: message,
  };
}

function logDebugError(
  context: string,
  error: unknown,
  details: Record<string, unknown> = {},
) {
  const safeError =
    error instanceof Error
      ? {
          name: error.name,
          message: error.message,
        }
      : {
          message: String(error),
        };

  console.error("[GBF Artifact Manager]", context, {
    ...details,
    error: safeError,
  });
}

function logZodError(context: string, error: ZodError) {
  console.error("[GBF Artifact Manager]", context, {
    issueCount: error.issues.length,
    issues: error.issues.map((issue) => ({
      code: issue.code,
      path: issue.path.join("."),
      message: issue.message,
    })),
  });
}

import { ZodError } from "zod";
import type { ArtifactListResponse } from "../api/artifactListTypes";
import { fetchArtifactListPage } from "../api/fetchArtifactList";
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
import { saveSuccessfulScanInMemory } from "./artifactMemoryStorage";

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
    case "SCAN_CURRENT_PAGE":
      return scanCurrentPage();
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

async function scanCurrentPage(): Promise<ExtensionResponse> {
  currentScanState = {
    ...currentScanState,
    status: "scanning",
    errorCode: null,
    errorMessage: null,
  };

  const tab = await getActiveTab();

  if (tab?.id === undefined) {
    return scanErrorResponse(
      "active_tab_unavailable",
      "Active tab could not be identified.",
    );
  }

  const pageInfo = await getPageInfo(tab.id);

  if (!pageInfo.ok) {
    return pageInfo;
  }

  if (pageInfo.type !== "PAGE_INFO") {
    return scanErrorResponse(
      "unexpected_response",
      "Unexpected page info response.",
    );
  }

  if (!pageInfo.isGranblueFantasyPage || !pageInfo.isArtifactPage) {
    return scanErrorResponse(
      "not_on_artifact_page",
      "Open a GBF artifact page before scanning.",
    );
  }

  if (pageInfo.artifactPage === null) {
    return scanErrorResponse(
      "page_number_not_detected",
      "Could not detect the current artifact page number.",
    );
  }

  const scannedAt = new Date().toISOString();
  const artifactListResult = await fetchCurrentArtifactList(
    pageInfo.artifactPage,
  );

  if (!artifactListResult.ok) {
    return artifactListResult;
  }

  const artifactList = artifactListResult.artifactList;
  const artifacts = artifactList.list.map((raw) =>
    normalizeArtifact(raw, scannedAt),
  );
  const storedArtifactCount = saveSuccessfulScanInMemory(
    artifacts,
    artifactList.current,
    scannedAt,
  );

  currentScanState = {
    status: "success",
    currentPage: artifactList.current,
    lastPage: artifactList.last,
    totalCount: artifactList.count,
    scannedArtifactCount: storedArtifactCount,
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

  return {
    ok: true,
    type: "SCAN_CURRENT_PAGE_RESULT",
    message: `Scanned ${artifacts.length} artifacts from page ${artifactList.current}.`,
    artifactCount: artifacts.length,
    page: artifactList.current,
    scan: currentScanState,
  };
}

async function getPageInfo(tabId: number): Promise<ExtensionResponse> {
  try {
    return await chrome.tabs.sendMessage<ExtensionMessage, ExtensionResponse>(
      tabId,
      {
        type: "GET_PAGE_INFO",
      },
    );
  } catch (error) {
    logDebugError("Could not read current page info", error);
    return scanErrorResponse(
      "not_on_artifact_page",
      "Open a GBF artifact page before scanning.",
    );
  }
}

async function fetchCurrentArtifactList(page: number): Promise<
  | {
      ok: true;
      artifactList: ArtifactListResponse;
    }
  | ErrorResponse
> {
  try {
    return {
      ok: true as const,
      artifactList: await fetchArtifactListPage(page),
    };
  } catch (error) {
    if (error instanceof ZodError) {
      logZodError("Artifact list response validation failed", error);
      return scanErrorResponse(
        "api_validation_failed",
        "Artifact list response did not match the expected shape.",
      );
    }

    logDebugError("Artifact list request failed", error, { page });
    return scanErrorResponse(
      "request_failed",
      "Artifact list request failed. Check the GBF page and network state.",
    );
  }
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

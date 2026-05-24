import { ZodError } from "zod";
import { fetchArtifactListPage } from "../api/fetchArtifactList";
import { normalizeArtifact } from "../domain/normalizeArtifact";
import type { ExtensionMessage, ExtensionResponse } from "../shared/messages";
import { type AppMode, initialScanState } from "../state/appState";
import {
  getStoredArtifactCount,
  saveArtifactsInMemory,
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
        console.error("Unhandled extension message error", error);
        sendResponse({
          ok: false,
          type: "ERROR",
          message: "Unexpected extension error.",
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
      };
  }
}

async function scanCurrentPage(): Promise<ExtensionResponse> {
  const tab = await getActiveTab();

  if (tab.id === undefined) {
    return {
      ok: false,
      type: "ERROR",
      message: "Active tab could not be identified.",
    };
  }

  const pageInfo = await getPageInfo(tab.id);

  if (!pageInfo.ok) {
    return pageInfo;
  }

  if (pageInfo.type !== "PAGE_INFO") {
    return {
      ok: false,
      type: "ERROR",
      message: "Unexpected page info response.",
    };
  }

  if (!pageInfo.isGranblueFantasyPage || !pageInfo.isArtifactPage) {
    return {
      ok: false,
      type: "ERROR",
      message: "Open a GBF artifact page before scanning.",
    };
  }

  if (pageInfo.artifactPage === null) {
    return {
      ok: false,
      type: "ERROR",
      message: "Could not detect the current artifact page number.",
    };
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
  const storedArtifactCount = saveArtifactsInMemory(artifacts);

  currentScanState = {
    currentPage: artifactList.current,
    lastPage: artifactList.last,
    totalCount: artifactList.count,
    scannedArtifactCount: storedArtifactCount,
    scannedPages: addScannedPage(
      currentScanState.scannedPages,
      artifactList.current,
    ),
    lastScannedAt: scannedAt,
  };

  return {
    ok: true,
    type: "SCAN_CURRENT_PAGE_RESULT",
    message: `Scanned ${artifacts.length} artifacts from page ${artifactList.current}.`,
    artifactCount: getStoredArtifactCount(),
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
    console.error("Could not read current page info", error);
    return {
      ok: false,
      type: "ERROR",
      message: "Could not read the active tab. Reload the GBF page and retry.",
    };
  }
}

async function fetchCurrentArtifactList(page: number) {
  try {
    return {
      ok: true as const,
      artifactList: await fetchArtifactListPage(page),
    };
  } catch (error) {
    console.error("Artifact list fetch failed", error);

    if (error instanceof ZodError) {
      return {
        ok: false as const,
        type: "ERROR" as const,
        message: "Artifact list response did not match the expected shape.",
      };
    }

    return {
      ok: false as const,
      type: "ERROR" as const,
      message:
        error instanceof Error
          ? error.message
          : "Artifact list request failed.",
    };
  }
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (tab === undefined) {
    throw new Error("No active tab found.");
  }

  return tab;
}

function addScannedPage(scannedPages: number[], page: number): number[] {
  return Array.from(new Set([...scannedPages, page])).sort((left, right) => {
    return left - right;
  });
}

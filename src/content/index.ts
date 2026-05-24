import type { ExtensionMessage, ExtensionResponse } from "../shared/messages";

type ContentBridgeWindow = Window &
  typeof globalThis & {
    __GBF_ARTIFACT_MANAGER_CONTENT_BRIDGE__?: boolean;
  };

const OBSERVER_SOURCE = "gbf-artifact-manager";
const CONTROL_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CONTROL";
const CAPTURE_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CAPTURE";
const contentWindow = window as ContentBridgeWindow;

if (!contentWindow.__GBF_ARTIFACT_MANAGER_CONTENT_BRIDGE__) {
  contentWindow.__GBF_ARTIFACT_MANAGER_CONTENT_BRIDGE__ = true;
  installRuntimeMessageListener();
  installPageCaptureListener();

  console.info("[GBF Artifact Manager] content bridge installed");
} else {
  console.info("[GBF Artifact Manager] content bridge already installed");
}

function installRuntimeMessageListener() {
  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender,
      sendResponse: (response: ExtensionResponse) => void,
    ) => {
      if (message.type === "PING_CONTENT_BRIDGE") {
        sendResponse({
          ok: true,
          type: "PONG_CONTENT_BRIDGE",
        });
        return false;
      }

      if (message.type === "START_OBSERVING") {
        postObserverControlMessage("start");
        sendResponse({
          ok: true,
          type: "OBSERVATION_STATUS",
          message: "Observation started.",
          observing: true,
          scan: {
            status: "observing",
            currentPage: null,
            lastPage: null,
            totalCount: null,
            scannedArtifactCount: 0,
            persistedArtifactCount: 0,
            lastScannedPage: null,
            lastScanArtifactCount: 0,
            scannedPages: [],
            lastScannedAt: null,
            activeScanSessionId: null,
            latestScanSessionId: null,
            observedPages: [],
            expectedLastPage: null,
            observedArtifactCount: 0,
            isFullScan: false,
            errorCode: null,
            errorMessage: null,
          },
        });
        return false;
      }

      if (message.type === "STOP_OBSERVING") {
        postObserverControlMessage("stop");
        sendResponse({
          ok: true,
          type: "OBSERVATION_STATUS",
          message: "Observation stopped.",
          observing: false,
          scan: {
            status: "idle",
            currentPage: null,
            lastPage: null,
            totalCount: null,
            scannedArtifactCount: 0,
            persistedArtifactCount: 0,
            lastScannedPage: null,
            lastScanArtifactCount: 0,
            scannedPages: [],
            lastScannedAt: null,
            activeScanSessionId: null,
            latestScanSessionId: null,
            observedPages: [],
            expectedLastPage: null,
            observedArtifactCount: 0,
            isFullScan: false,
            errorCode: null,
            errorMessage: null,
          },
        });
        return false;
      }

      if (message.type === "START_DISPLAY_MODE") {
        postObserverControlMessage("start");
        sendResponse({
          ok: true,
          type: "DISPLAY_STATUS",
          message: "Display mode started.",
          display: {
            isEnabled: true,
            itemCount: 0,
            items: [],
          },
        });
        return false;
      }

      if (message.type === "STOP_DISPLAY_MODE") {
        postObserverControlMessage("stop");
        sendResponse({
          ok: true,
          type: "DISPLAY_STATUS",
          message: "Display mode stopped.",
          display: {
            isEnabled: false,
            itemCount: 0,
            items: [],
          },
        });
        return false;
      }

      if (message.type === "GET_PAGE_INFO") {
        const url = window.location.href;
        const artifactPage = detectCurrentArtifactPage(url);
        const isArtifactPage = isArtifactUrl(url) || hasArtifactListMarkup();

        sendResponse({
          ok: true,
          type: "PAGE_INFO",
          url,
          isGranblueFantasyPage:
            window.location.hostname === "game.granbluefantasy.jp",
          isArtifactPage,
          artifactPage,
        });
        return false;
      }

      return false;
    },
  );
}

function installPageCaptureListener() {
  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;

    if (
      typeof data !== "object" ||
      data === null ||
      data.source !== OBSERVER_SOURCE ||
      data.type !== CAPTURE_MESSAGE_TYPE
    ) {
      return;
    }

    console.info("[GBF Artifact Manager] content received captured response", {
      url: data.url,
      page: data.page,
    });

    chrome.runtime
      .sendMessage({
        type: "ARTIFACT_LIST_OBSERVED",
        url: String(data.url),
        page: typeof data.page === "number" ? data.page : null,
        payload: data.payload,
      })
      .catch((error: unknown) => {
        console.error("[GBF Artifact Manager] capture forwarding failed", {
          message: getErrorMessage(error),
        });
      });
  });
}

function postObserverControlMessage(action: "start" | "stop") {
  window.postMessage(
    {
      source: OBSERVER_SOURCE,
      type: CONTROL_MESSAGE_TYPE,
      action,
    },
    window.location.origin,
  );
}

function isArtifactUrl(url: string): boolean {
  return /(?:#|\/)artifact(?:\/|$)/.test(url);
}

function hasArtifactListMarkup(): boolean {
  return (
    document.querySelector(
      ".prt-artifact-list-page, .prt-artifact-list-body, .prt-artifact-list-item",
    ) !== null
  );
}

function detectCurrentArtifactPage(url: string): number | null {
  const match = /\/rest\/artifact\/list\/(?<page>\d+)/.exec(url);
  const pageText = match?.groups?.page;

  if (pageText === undefined) {
    return null;
  }

  const page = Number.parseInt(pageText, 10);

  return Number.isInteger(page) && page >= 1 ? page : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

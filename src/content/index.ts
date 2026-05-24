import type { ExtensionMessage, ExtensionResponse } from "../shared/messages";

const OBSERVER_SOURCE = "gbf-artifact-manager";
const CONTROL_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CONTROL";
const CAPTURE_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CAPTURE";

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
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
        message: error instanceof Error ? error.message : String(error),
      });
    });
});

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
  const pageFromUrl = detectPageFromUrl(url);

  if (pageFromUrl !== null) {
    return pageFromUrl;
  }

  const pageFromPaginationText = detectPageFromPaginationText();

  if (pageFromPaginationText !== null) {
    return pageFromPaginationText;
  }

  return detectPageFromCurrentPageElement();
}

function detectPageFromUrl(url: string): number | null {
  const patterns = [
    /(?:#|\/)artifact\/list\/(?<page>\d+)(?:[/?#]|$)/,
    /(?:[?&]page=)(?<page>\d+)(?:&|$)/,
    /(?:#|\/)artifact(?:\/index)?\/(?<page>\d+)(?:[/?#]|$)/,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(url);
    const pageText = match?.groups?.page;
    const page = pageText === undefined ? null : Number.parseInt(pageText, 10);

    if (isValidPage(page)) {
      return page;
    }
  }

  return null;
}

function detectPageFromPaginationText(): number | null {
  const paginationText = document
    .querySelector("#prt-pagination-text .txt-total-paging")
    ?.textContent?.trim();

  const pageText = paginationText?.match(/^(?<page>\d+)\s*\/\s*\d+$/)?.groups
    ?.page;
  const page = pageText === undefined ? null : Number.parseInt(pageText, 10);

  return isValidPage(page) ? page : null;
}

function detectPageFromCurrentPageElement(): number | null {
  const pageText = document
    .querySelector("#prt-pagination .prt-page-number[disable='true'][page]")
    ?.getAttribute("page");
  const page = pageText == null ? null : Number.parseInt(pageText, 10);

  return isValidPage(page) ? page : null;
}

function isValidPage(page: number | null): page is number {
  return page !== null && Number.isInteger(page) && page >= 1;
}

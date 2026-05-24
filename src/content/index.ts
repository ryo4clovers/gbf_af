import type { ExtensionMessage, ExtensionResponse } from "../shared/messages";

chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender,
    sendResponse: (response: ExtensionResponse) => void,
  ) => {
    if (message.type !== "GET_PAGE_INFO") {
      return false;
    }

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
  },
);

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

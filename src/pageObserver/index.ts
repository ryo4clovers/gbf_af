type ObserverWindow = Window &
  typeof globalThis & {
    __gbfArtifactObserverInstalled?: boolean;
    __gbfArtifactObserverEnabled?: boolean;
  };

type ObservedXmlHttpRequest = XMLHttpRequest & {
  __gbfArtifactObserverUrl?: string;
};

const OBSERVER_SOURCE = "gbf-artifact-manager";
const CONTROL_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CONTROL";
const CAPTURE_MESSAGE_TYPE = "GBF_ARTIFACT_OBSERVER_CAPTURE";
const ARTIFACT_LIST_PATTERN = /\/rest\/artifact\/list\/(?<page>\d+)(?:[/?#]|$)/;
const observerWindow = window as ObserverWindow;

if (!observerWindow.__gbfArtifactObserverInstalled) {
  observerWindow.__gbfArtifactObserverInstalled = true;
  observerWindow.__gbfArtifactObserverEnabled = false;

  installFetchObserver();
  installXhrObserver();
  installControlListener();

  console.info("[GBF Artifact Manager] observer injected");
} else {
  console.info("[GBF Artifact Manager] observer already injected");
}

function installControlListener() {
  window.addEventListener("message", (event) => {
    if (event.source !== window) {
      return;
    }

    const data = event.data;

    if (
      typeof data !== "object" ||
      data === null ||
      data.source !== OBSERVER_SOURCE ||
      data.type !== CONTROL_MESSAGE_TYPE
    ) {
      return;
    }

    if (data.action === "start") {
      observerWindow.__gbfArtifactObserverEnabled = true;
      console.info("[GBF Artifact Manager] observer start");
      return;
    }

    if (data.action === "stop") {
      observerWindow.__gbfArtifactObserverEnabled = false;
      console.info("[GBF Artifact Manager] observer stop");
    }
  });
}

function installFetchObserver() {
  const originalFetch = window.fetch;

  window.fetch = function observedFetch(...args) {
    const requestUrl = getFetchRequestUrl(args[0]);
    const fetchResult = originalFetch.apply(this, args);

    return fetchResult.then((response) => {
      observeFetchResponse(requestUrl, response);
      return response;
    });
  };
}

function observeFetchResponse(requestUrl: string | null, response: Response) {
  if (!observerWindow.__gbfArtifactObserverEnabled || requestUrl === null) {
    return;
  }

  const match = matchArtifactListUrl(requestUrl);

  if (match === null) {
    return;
  }

  console.info("[GBF Artifact Manager] matched fetch request", {
    url: requestUrl,
  });

  response
    .clone()
    .text()
    .then((bodyText) => captureResponseBody(requestUrl, match.page, bodyText))
    .catch((error: unknown) => {
      console.error("[GBF Artifact Manager] fetch response capture failed", {
        message: error instanceof Error ? error.message : String(error),
      });
    });
}

function installXhrObserver() {
  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;

  Object.defineProperty(XMLHttpRequest.prototype, "open", {
    value: function observedOpen(
      this: ObservedXmlHttpRequest,
      method: string,
      url: string | URL,
      async?: boolean,
      username?: string | null,
      password?: string | null,
    ) {
      this.__gbfArtifactObserverUrl = typeof url === "string" ? url : url.href;

      if (async === undefined) {
        return Reflect.apply(originalOpen, this, [method, url]);
      }

      return Reflect.apply(originalOpen, this, [
        method,
        url,
        async,
        username,
        password,
      ]);
    },
  });

  Object.defineProperty(XMLHttpRequest.prototype, "send", {
    value: function observedSend(
      this: ObservedXmlHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      this.addEventListener("loadend", () => {
        observeXhrResponse(this);
      });

      return originalSend.call(this, body);
    },
  });
}

function observeXhrResponse(request: ObservedXmlHttpRequest) {
  if (!observerWindow.__gbfArtifactObserverEnabled) {
    return;
  }

  const requestUrl = request.__gbfArtifactObserverUrl;

  if (typeof requestUrl !== "string") {
    return;
  }

  const match = matchArtifactListUrl(requestUrl);

  if (match === null) {
    return;
  }

  console.info("[GBF Artifact Manager] matched XHR request", {
    url: requestUrl,
  });

  try {
    captureResponseBody(requestUrl, match.page, request.responseText);
  } catch (error) {
    console.error("[GBF Artifact Manager] XHR response capture failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function captureResponseBody(
  requestUrl: string,
  page: number,
  bodyText: string,
) {
  const payload: unknown = JSON.parse(bodyText);

  window.postMessage(
    {
      source: OBSERVER_SOURCE,
      type: CAPTURE_MESSAGE_TYPE,
      url: requestUrl,
      page,
      payload,
    },
    window.location.origin,
  );
}

function getFetchRequestUrl(input: RequestInfo | URL): string | null {
  if (typeof input === "string") {
    return input;
  }

  if (input instanceof URL) {
    return input.href;
  }

  return input.url;
}

function matchArtifactListUrl(url: string): { page: number } | null {
  const absoluteUrl = new URL(url, window.location.href);
  const match = ARTIFACT_LIST_PATTERN.exec(absoluteUrl.pathname);
  const pageText = match?.groups?.page;

  if (pageText === undefined) {
    return null;
  }

  const page = Number.parseInt(pageText, 10);

  return Number.isInteger(page) && page >= 1 ? { page } : null;
}

export {};

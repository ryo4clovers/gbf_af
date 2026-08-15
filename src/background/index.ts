import { ZodError } from "zod";
import { artifactListResponseSchema } from "../api/artifactListSchema";
import type { ArtifactListResponse } from "../api/artifactListTypes";
import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import {
  type DisplayArtifactItem,
  type DisplayState,
  initialDisplayState,
} from "../domain/displayMode";
import { normalizeArtifact } from "../domain/normalizeArtifact";
import type { ArtifactPresence, ScanSession } from "../domain/scanSession";
import {
  type CustomScoreSettings,
  type UnwantedSkillConfig,
  validateIdealMatchScores,
  validateSkillScores,
  validateTableRankPenalties,
} from "../domain/score/customScoreSettings";
import { validateIdealSkillConfigurations } from "../domain/score/idealSkillConfiguration";
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
  backfillLegacyArtifactPresence,
  clearAllArtifacts,
  clearArtifactUserReviews,
  createScanSession,
  finishActiveScanSession,
  getActiveScanSession,
  getAllArtifacts,
  getArtifactPresenceMap,
  getArtifactUserReviews,
  getCustomScoreSettings,
  getLatestScanSession,
  getScanMetadata,
  getUnwantedSkillConfig,
  markMissingArtifactsPossiblyDeleted,
  saveArtifactUserReview,
  saveCustomScoreSettings,
  saveScannedArtifacts,
  saveUnwantedSkillConfig,
  updateArtifactPresence,
  updateScanSession,
} from "../storage/artifactIndexedDb";
import {
  clearArtifactsInMemory,
  saveSuccessfulScanInMemory,
} from "./artifactMemoryStorage";

let currentMode: AppMode = "scan";
let currentScanState = initialScanState;
let currentDisplayState: DisplayState = initialDisplayState;

type ContentBridgePhase =
  | "content_bridge_ping"
  | "content_bridge_injection"
  | "content_bridge_reping"
  | "observer_injection"
  | "mode_start_message"
  | "mode_stop_message";

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
          display: currentDisplayState,
        });
      });

    return true;
  },
);

chrome.action.onClicked.addListener((tab) => {
  openSidePanelForTab(tab).catch((error: unknown) => {
    logDebugError("Could not open side panel", error, {
      tabId: tab.id,
      url: tab.url,
    });
  });
});

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
        display: currentDisplayState,
      };
    case "SET_APP_MODE":
      currentMode = message.mode;
      return {
        ok: true,
        type: "APP_STATE",
        mode: currentMode,
        scan: currentScanState,
        display: currentDisplayState,
      };
    case "START_OBSERVING":
      return startObserving();
    case "STOP_OBSERVING":
      return stopObserving();
    case "START_DISPLAY_MODE":
      return startDisplayMode();
    case "STOP_DISPLAY_MODE":
      return stopDisplayMode();
    case "GET_DISPLAY_STATE":
      return {
        ok: true,
        type: "DISPLAY_STATE",
        display: currentDisplayState,
      };
    case "ARTIFACT_LIST_OBSERVED":
      return handleObservedArtifactList(message);
    case "GET_STORED_ARTIFACT_COUNT":
      return getStoredArtifactCountResponse();
    case "GET_STORED_ARTIFACTS":
      return getStoredArtifactsResponse();
    case "CLEAR_STORED_ARTIFACTS":
      return clearStoredArtifacts();
    case "GET_ARTIFACT_USER_REVIEWS":
      return getArtifactUserReviewsResponse();
    case "SAVE_ARTIFACT_USER_REVIEW":
      return saveArtifactUserReviewResponse(message.review);
    case "CLEAR_ARTIFACT_USER_REVIEWS":
      return clearArtifactUserReviewsResponse();
    case "GET_SCAN_SESSIONS":
      return getScanSessionsResponse();
    case "GET_ARTIFACT_PRESENCE":
      return getArtifactPresenceResponse();
    case "GET_CUSTOM_SCORE_SETTINGS":
      return getCustomScoreSettingsResponse();
    case "SAVE_CUSTOM_SCORE_SETTINGS":
      return saveCustomScoreSettingsResponse(message.settings);
    case "GET_UNWANTED_SKILL_CONFIG":
      return getUnwantedSkillConfigResponse();
    case "SAVE_UNWANTED_SKILL_CONFIG":
      return saveUnwantedSkillConfigResponse(message.config);
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

async function openSidePanelForTab(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) {
    throw new Error("Active tab id is unavailable.");
  }

  await chrome.sidePanel.open({
    tabId: tab.id,
  });
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
    await ensureContentBridge(tab.id);
  } catch {
    return scanErrorResponse(
      "content_bridge_unavailable",
      "Could not connect to the GBF page. Please reload the GBF tab and try again.",
    );
  }

  try {
    await injectPageObserver(tab.id);
  } catch (error) {
    logBridgeError("Could not inject page observer", error, {
      tabId: tab.id,
      phase: "observer_injection",
    });
    return scanErrorResponse(
      "unexpected_response",
      "Could not start artifact response observation.",
    );
  }

  try {
    await sendContentBridgeMessage(tab.id, { type: "START_OBSERVING" });
  } catch (error) {
    logBridgeError("Could not send scan start message", error, {
      tabId: tab.id,
      phase: "mode_start_message",
    });
    return scanErrorResponse(
      "content_bridge_unavailable",
      "Could not connect to the GBF page. Please reload the GBF tab and try again.",
    );
  }

  const startedAt = new Date().toISOString();
  const session: ScanSession = {
    id: createScanSessionId(startedAt),
    startedAt,
    observedPages: [],
    observedArtifactCount: 0,
    isFullScan: false,
  };

  try {
    await createScanSession(session);
  } catch (error) {
    logDebugError("Could not create scan session", error);
    return scanErrorResponse(
      "storage_failed",
      "Could not create scan session.",
    );
  }

  currentScanState = {
    ...currentScanState,
    status: "observing",
    currentPage: null,
    lastPage: null,
    totalCount: null,
    lastScannedPage: null,
    lastScanArtifactCount: 0,
    scannedPages: [],
    activeScanSessionId: session.id,
    latestScanSessionId: session.id,
    observedPages: [],
    expectedLastPage: null,
    observedArtifactCount: 0,
    isFullScan: false,
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
    await ensureContentBridge(tab.id);
    await sendContentBridgeMessage(tab.id, { type: "STOP_OBSERVING" });
  } catch (error) {
    logBridgeError("Could not send scan stop message", error, {
      tabId: tab.id,
      phase: "mode_stop_message",
    });
  }

  let finishedSession: ScanSession | null = null;

  try {
    const finishedAt = new Date().toISOString();
    finishedSession = await finishActiveScanSession(finishedAt);

    if (finishedSession?.isFullScan) {
      const backfillResult = await backfillLegacyArtifactPresence(finishedAt);
      console.info("[GBF Artifact Manager] legacy presence backfill", {
        artifactCount: backfillResult.artifactCount,
        existingPresenceCount: backfillResult.existingPresenceCount,
        createdPresenceCount: backfillResult.createdPresenceCount,
      });

      const missingResult = await markMissingArtifactsPossiblyDeleted(
        finishedSession.id,
      );
      console.info("[GBF Artifact Manager] full scan lifecycle marking", {
        sessionId: finishedSession.id,
        markedPossiblyDeletedCount: missingResult.markedPossiblyDeletedCount,
      });
    }
  } catch (error) {
    logDebugError("Could not finish scan session", error);
    return scanErrorResponse(
      "storage_failed",
      "Could not finish scan session.",
    );
  }

  currentScanState = await hydratePersistedScanState({
    ...currentScanState,
    status: "stopped",
    activeScanSessionId: null,
    latestScanSessionId:
      finishedSession?.id ?? currentScanState.latestScanSessionId,
    observedPages:
      finishedSession?.observedPages ?? currentScanState.observedPages,
    expectedLastPage:
      finishedSession?.expectedLastPage ?? currentScanState.expectedLastPage,
    observedArtifactCount:
      finishedSession?.observedArtifactCount ??
      currentScanState.observedArtifactCount,
    isFullScan: finishedSession?.isFullScan ?? currentScanState.isFullScan,
    errorCode: null,
    errorMessage: null,
  });
  console.info("[GBF Artifact Manager] observer stop", { tabId: tab.id });

  return {
    ok: true,
    type: "OBSERVATION_STATUS",
    message: "Observation stopped.",
    observing: false,
    scan: currentScanState,
  };
}

async function startDisplayMode(): Promise<ExtensionResponse> {
  const tab = await getActiveTab();

  if (tab?.id === undefined) {
    return displayErrorResponse(
      "active_tab_unavailable",
      "Active tab could not be identified.",
    );
  }

  if (!isGranblueFantasyTab(tab)) {
    return displayErrorResponse(
      "not_on_artifact_page",
      "Open a GBF page before starting display mode.",
    );
  }

  if ((await getActiveScanSession()) !== null) {
    return displayErrorResponse(
      "unexpected_response",
      "Stop scan observation before starting display mode.",
    );
  }

  try {
    await ensureContentBridge(tab.id);
  } catch {
    return displayErrorResponse(
      "content_bridge_unavailable",
      "Could not connect to the GBF page. Please reload the GBF tab and try again.",
    );
  }

  try {
    await injectPageObserver(tab.id);
  } catch (error) {
    logBridgeError("Could not inject page observer", error, {
      tabId: tab.id,
      phase: "observer_injection",
    });
    return displayErrorResponse(
      "unexpected_response",
      "Could not start display mode.",
    );
  }

  try {
    await sendContentBridgeMessage(tab.id, { type: "START_DISPLAY_MODE" });
  } catch (error) {
    logBridgeError("Could not send display start message", error, {
      tabId: tab.id,
      phase: "mode_start_message",
    });
    return displayErrorResponse(
      "content_bridge_unavailable",
      "Could not connect to the GBF page. Please reload the GBF tab and try again.",
    );
  }

  currentMode = "display";
  currentDisplayState = {
    isEnabled: true,
    itemCount: 0,
    items: [],
  };
  console.info("[GBF Artifact Manager] display mode start", { tabId: tab.id });

  return {
    ok: true,
    type: "DISPLAY_STATUS",
    message: "Display mode started.",
    display: currentDisplayState,
  };
}

async function stopDisplayMode(): Promise<ExtensionResponse> {
  const tab = await getActiveTab();

  if (tab?.id === undefined) {
    return displayErrorResponse(
      "active_tab_unavailable",
      "Active tab could not be identified.",
    );
  }

  try {
    await ensureContentBridge(tab.id);
    await sendContentBridgeMessage(tab.id, { type: "STOP_DISPLAY_MODE" });
  } catch (error) {
    logBridgeError("Could not send display stop message", error, {
      tabId: tab.id,
      phase: "mode_stop_message",
    });
  }

  currentDisplayState = {
    ...currentDisplayState,
    isEnabled: false,
  };
  console.info("[GBF Artifact Manager] display mode stop", { tabId: tab.id });

  return {
    ok: true,
    type: "DISPLAY_STATUS",
    message: "Display mode stopped.",
    display: currentDisplayState,
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
    if (currentMode === "display" && currentDisplayState.isEnabled) {
      return displayErrorResponse(
        artifactListResult.errorCode ?? "api_validation_failed",
        artifactListResult.message,
      );
    }

    return scanErrorResponse(
      artifactListResult.errorCode ?? "api_validation_failed",
      artifactListResult.message,
    );
  }

  const artifactList = artifactListResult.artifactList;

  if (currentMode === "display" && currentDisplayState.isEnabled) {
    return updateDisplayFromObservedArtifactList(artifactList);
  }

  const activeSession = await ensureActiveScanSession(scannedAt);
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

  await updateArtifactPresence(artifacts, activeSession.id, scannedAt);
  const updatedSession = await updateSessionForObservedPage(
    activeSession,
    artifactList,
  );

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
    scannedPages: updatedSession.observedPages,
    lastScannedAt: scannedAt,
    activeScanSessionId: updatedSession.id,
    latestScanSessionId: updatedSession.id,
    observedPages: updatedSession.observedPages,
    expectedLastPage: updatedSession.expectedLastPage ?? null,
    observedArtifactCount: updatedSession.observedArtifactCount,
    isFullScan: updatedSession.isFullScan,
    errorCode: null,
    errorMessage: null,
  };
  chrome.runtime
    .sendMessage({
      type: "OBSERVATION_CAPTURED_UPDATE",
      scan: currentScanState,
    } satisfies ExtensionMessage)
    .catch(() => {
      // Side panel may be closed; no action needed.
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

async function updateDisplayFromObservedArtifactList(
  artifactList: ArtifactListResponse,
): Promise<ExtensionResponse> {
  const capturedAt = new Date().toISOString();
  const artifacts = artifactList.list.map((raw) =>
    normalizeArtifact(raw, capturedAt),
  );

  try {
    const [reviews, presenceMap] = await Promise.all([
      getArtifactUserReviews(),
      getArtifactPresenceMap(),
    ]);
    const reviewsByOwnedId = indexReviewsByOwnedId(reviews);
    const items = artifacts.map((artifact) =>
      createDisplayArtifactItem(
        artifact,
        reviewsByOwnedId[artifact.ownedId] ?? null,
        presenceMap[artifact.ownedId] ?? null,
      ),
    );

    currentDisplayState = {
      isEnabled: true,
      currentPage: artifactList.current,
      capturedAt,
      itemCount: items.length,
      items,
    };

    chrome.runtime
      .sendMessage({
        type: "DISPLAY_CAPTURED_UPDATE",
        display: currentDisplayState,
      } satisfies ExtensionMessage)
      .catch(() => {
        // Side panel may be closed; no action needed.
      });

    console.info("[GBF Artifact Manager] display capture update", {
      page: artifactList.current,
      artifactCount: items.length,
    });

    return {
      ok: true,
      type: "DISPLAY_STATUS",
      message: `Display updated from page ${artifactList.current}.`,
      display: currentDisplayState,
    };
  } catch (error) {
    logDebugError("Could not update display mode", error, {
      page: artifactList.current,
    });
    return displayErrorResponse(
      "storage_failed",
      "Could not read stored review data for display mode.",
    );
  }
}

async function ensureContentBridge(tabId: number): Promise<void> {
  if (await pingContentBridge(tabId, "content_bridge_ping")) {
    return;
  }

  try {
    console.info("[GBF Artifact Manager] content bridge injection requested", {
      tabId,
      phase: "content_bridge_injection" satisfies ContentBridgePhase,
    });
    await chrome.scripting.executeScript({
      target: {
        tabId,
      },
      files: ["assets/content.js"],
    });
  } catch (error) {
    logBridgeError("Could not inject content bridge", error, {
      tabId,
      phase: "content_bridge_injection",
    });
    throw error;
  }

  if (await pingContentBridge(tabId, "content_bridge_reping")) {
    return;
  }

  const error = new Error("Content bridge did not respond after injection.");
  logBridgeError("Content bridge ping failed after injection", error, {
    tabId,
    phase: "content_bridge_reping",
  });
  throw error;
}

async function pingContentBridge(
  tabId: number,
  phase: ContentBridgePhase,
): Promise<boolean> {
  try {
    const response = await chrome.tabs.sendMessage<
      ExtensionMessage,
      ExtensionResponse
    >(tabId, {
      type: "PING_CONTENT_BRIDGE",
    });

    if (response.ok && response.type === "PONG_CONTENT_BRIDGE") {
      console.info("[GBF Artifact Manager] content bridge ping ok", {
        tabId,
        phase,
      });
      return true;
    }

    logBridgeError(
      "Content bridge ping returned an invalid response",
      response,
      {
        tabId,
        phase,
      },
    );
    return false;
  } catch (error) {
    logBridgeError("Content bridge ping failed", error, {
      tabId,
      phase,
    });
    return false;
  }
}

async function sendContentBridgeMessage(
  tabId: number,
  message: ExtensionMessage,
): Promise<ExtensionResponse> {
  return chrome.tabs.sendMessage<ExtensionMessage, ExtensionResponse>(
    tabId,
    message,
  );
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

async function getArtifactUserReviewsResponse(): Promise<ExtensionResponse> {
  try {
    return {
      ok: true,
      type: "ARTIFACT_USER_REVIEWS",
      reviews: await getArtifactUserReviews(),
    };
  } catch (error) {
    logDebugError("Could not read artifact user reviews", error);
    return {
      ok: false,
      type: "ERROR",
      message: "Could not read artifact user reviews.",
      errorCode: "storage_failed",
    };
  }
}

async function saveArtifactUserReviewResponse(
  review: Parameters<typeof saveArtifactUserReview>[0],
): Promise<ExtensionResponse> {
  try {
    await saveArtifactUserReview(review);

    return {
      ok: true,
      type: "SAVE_ARTIFACT_USER_REVIEW_RESULT",
      review,
    };
  } catch (error) {
    logDebugError("Could not save artifact user review", error, {
      ownedId: review.ownedId,
    });
    return {
      ok: false,
      type: "ERROR",
      message: "Could not save artifact user review.",
      errorCode: "storage_failed",
    };
  }
}

async function clearArtifactUserReviewsResponse(): Promise<ExtensionResponse> {
  try {
    await clearArtifactUserReviews();

    return {
      ok: true,
      type: "CLEAR_ARTIFACT_USER_REVIEWS_RESULT",
    };
  } catch (error) {
    logDebugError("Could not clear artifact user reviews", error);
    return {
      ok: false,
      type: "ERROR",
      message: "Could not clear artifact user reviews.",
      errorCode: "storage_failed",
    };
  }
}

async function getScanSessionsResponse(): Promise<ExtensionResponse> {
  try {
    const [activeSession, latestSession] = await Promise.all([
      getActiveScanSession(),
      getLatestScanSession(),
    ]);
    currentScanState = await hydratePersistedScanState(currentScanState);

    return {
      ok: true,
      type: "SCAN_SESSIONS",
      activeSession,
      latestSession,
      scan: currentScanState,
    };
  } catch (error) {
    logDebugError("Could not read scan sessions", error);
    return {
      ok: false,
      type: "ERROR",
      message: "Could not read scan sessions.",
      errorCode: "storage_failed",
    };
  }
}

async function getArtifactPresenceResponse(): Promise<ExtensionResponse> {
  try {
    return {
      ok: true,
      type: "ARTIFACT_PRESENCE",
      presence: await getArtifactPresenceMap(),
    };
  } catch (error) {
    logDebugError("Could not read artifact presence", error);
    return {
      ok: false,
      type: "ERROR",
      message: "Could not read artifact presence.",
      errorCode: "storage_failed",
    };
  }
}

async function getCustomScoreSettingsResponse(): Promise<ExtensionResponse> {
  try {
    return {
      ok: true,
      type: "CUSTOM_SCORE_SETTINGS",
      settings: await getCustomScoreSettings(),
    };
  } catch (error) {
    logDebugError("Could not read custom score settings", error);
    return storageErrorResponse("Could not read custom score settings.");
  }
}

async function saveCustomScoreSettingsResponse(
  settings: CustomScoreSettings,
): Promise<ExtensionResponse> {
  const validationError = validateCustomScoreSettings(settings);

  if (validationError !== null) {
    return validationMessageResponse(validationError);
  }

  try {
    await saveCustomScoreSettings(settings);

    return {
      ok: true,
      type: "SAVE_CUSTOM_SCORE_SETTINGS_RESULT",
      settings,
    };
  } catch (error) {
    logDebugError("Could not save custom score settings", error);
    return storageErrorResponse("Could not save custom score settings.");
  }
}

async function getUnwantedSkillConfigResponse(): Promise<ExtensionResponse> {
  try {
    return {
      ok: true,
      type: "UNWANTED_SKILL_CONFIG",
      config: await getUnwantedSkillConfig(),
    };
  } catch (error) {
    logDebugError("Could not read unwanted skill config", error);
    return storageErrorResponse("Could not read unwanted skill config.");
  }
}

async function saveUnwantedSkillConfigResponse(
  config: UnwantedSkillConfig,
): Promise<ExtensionResponse> {
  const validationError = validateUnwantedSkillConfig(config);

  if (validationError !== null) {
    return validationMessageResponse(validationError);
  }

  try {
    await saveUnwantedSkillConfig(config);

    return {
      ok: true,
      type: "SAVE_UNWANTED_SKILL_CONFIG_RESULT",
      config,
    };
  } catch (error) {
    logDebugError("Could not save unwanted skill config", error);
    return storageErrorResponse("Could not save unwanted skill config.");
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
      return validationErrorResponse();
    }

    logDebugError("Artifact list validation failed", error);
    return validationErrorResponse();
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

async function ensureActiveScanSession(
  startedAt: string,
): Promise<ScanSession> {
  const activeSession = await getActiveScanSession();

  if (activeSession !== null) {
    return activeSession;
  }

  const session: ScanSession = {
    id: createScanSessionId(startedAt),
    startedAt,
    observedPages: [],
    observedArtifactCount: 0,
    isFullScan: false,
  };

  await createScanSession(session);
  return session;
}

async function updateSessionForObservedPage(
  session: ScanSession,
  artifactList: ArtifactListResponse,
): Promise<ScanSession> {
  const presenceMap = await getArtifactPresenceMap();
  const observedArtifactCount = Object.values(presenceMap).filter(
    (presence) => presence.lastSeenSessionId === session.id,
  ).length;
  const updatedSession: ScanSession = {
    ...session,
    observedPages: addScannedPage(session.observedPages, artifactList.current),
    expectedLastPage: artifactList.last,
    observedArtifactCount,
    isFullScan: false,
  };

  await updateScanSession(updatedSession);
  return updatedSession;
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
  const [artifacts, metadata, activeSession, latestSession] = await Promise.all(
    [
      getAllArtifacts(),
      getScanMetadata(),
      getActiveScanSession(),
      getLatestScanSession(),
    ],
  );
  const session = activeSession ?? latestSession;
  const sessionState = {
    activeScanSessionId: activeSession?.id ?? null,
    latestScanSessionId: latestSession?.id ?? null,
    observedPages: session?.observedPages ?? scanState.observedPages,
    expectedLastPage:
      session?.expectedLastPage ?? scanState.expectedLastPage ?? null,
    observedArtifactCount:
      session?.observedArtifactCount ?? scanState.observedArtifactCount,
    isFullScan: session?.isFullScan ?? scanState.isFullScan,
  };

  if (metadata === null) {
    return {
      ...scanState,
      persistedArtifactCount: artifacts.length,
      ...sessionState,
    };
  }

  return {
    ...scanState,
    persistedArtifactCount: artifacts.length,
    lastScannedPage: metadata.scannedPage,
    lastScanArtifactCount: metadata.artifactCount,
    lastScannedAt: metadata.scannedAt,
    ...sessionState,
  };
}

function createScanSessionId(dateText: string): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `scan-${dateText}-${Math.random().toString(16).slice(2)}`;
}

function indexReviewsByOwnedId(
  reviews: ArtifactUserReview[],
): Record<number, ArtifactUserReview> {
  const reviewsByOwnedId: Record<number, ArtifactUserReview> = {};

  for (const review of reviews) {
    reviewsByOwnedId[review.ownedId] = review;
  }

  return reviewsByOwnedId;
}

function createDisplayArtifactItem(
  artifact: Artifact,
  review: ArtifactUserReview | null,
  presence: ArtifactPresence | null,
): DisplayArtifactItem {
  return {
    ownedId: artifact.ownedId,
    name: artifact.name,
    rating: review?.rating ?? 0,
    memo: review?.memo ?? "",
    isPossiblyDeleted: presence?.isPossiblyDeleted ?? false,
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

function storageErrorResponse(message: string): ErrorResponse {
  return {
    ok: false,
    type: "ERROR",
    message,
    errorCode: "storage_failed",
  };
}

function validationMessageResponse(message: string): ErrorResponse {
  return {
    ok: false,
    type: "ERROR",
    message,
    errorCode: "unexpected_response",
  };
}

function validateCustomScoreSettings(settings: unknown): string | null {
  if (typeof settings !== "object" || settings === null) {
    return "Custom score settings are required.";
  }

  const idealSkillConfigurations = Reflect.get(
    settings,
    "idealSkillConfigurations",
  );
  const idealMatchScores = Reflect.get(settings, "idealMatchScores");
  const skillScores = Reflect.get(settings, "skillScores");
  const tableRankPenalties = Reflect.get(settings, "tableRankPenalties");
  const updatedAt = Reflect.get(settings, "updatedAt");
  const idealSkillConfigurationError = validateIdealSkillConfigurations(
    idealSkillConfigurations,
  );

  if (idealSkillConfigurationError !== null) {
    return idealSkillConfigurationError;
  }

  const idealMatchScoreError = validateIdealMatchScores(idealMatchScores);

  if (idealMatchScoreError !== null) {
    return idealMatchScoreError;
  }

  const skillScoreError = validateSkillScores(skillScores);

  if (skillScoreError !== null) {
    return skillScoreError;
  }

  const tableRankPenaltyError = validateTableRankPenalties(tableRankPenalties);

  if (tableRankPenaltyError !== null) {
    return tableRankPenaltyError;
  }

  if (!isNonEmptyString(updatedAt)) {
    return "Custom score settings update time is required.";
  }

  return null;
}

function validateUnwantedSkillConfig(
  config: UnwantedSkillConfig,
): string | null {
  if (!config.skillKeys.every(isNonEmptyString)) {
    return "Unwanted skill keys must be non-empty strings.";
  }

  return null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function displayErrorResponse(
  errorCode: ScanErrorCode,
  message: string,
): ErrorResponse {
  return {
    ok: false,
    type: "ERROR",
    message,
    errorCode,
    display: currentDisplayState,
  };
}

function validationErrorResponse(): ErrorResponse {
  return {
    ok: false,
    type: "ERROR",
    message: "Artifact list response did not match the expected shape.",
    errorCode: "api_validation_failed",
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

function logBridgeError(
  context: string,
  error: unknown,
  details: {
    tabId: number;
    phase: ContentBridgePhase;
  },
) {
  console.error("[GBF Artifact Manager]", context, {
    ...details,
    error: normalizeErrorForLog(error),
  });
}

function normalizeErrorForLog(error: unknown): {
  name?: string;
  message: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  if (typeof error === "object" && error !== null) {
    try {
      return {
        message: JSON.stringify(error),
      };
    } catch {
      return {
        message: String(error),
      };
    }
  }

  return {
    message: String(error),
  };
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

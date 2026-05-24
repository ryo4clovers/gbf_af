import { useEffect, useState } from "react";
import type { DisplayArtifactItem, DisplayState } from "../domain/displayMode";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import type { ErrorResponse, ExtensionResponse } from "../shared/messages";
import {
  type AppMode,
  type ScanState,
  type ScanStatus,
  useAppStore,
} from "../state/appState";

export function ExtensionPanel() {
  const { mode, scan, display, setMode, setScanState, setDisplayState } =
    useAppStore();
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const hasActiveSession = scan.activeScanSessionId !== null;

  useEffect(() => {
    sendRuntimeMessage({ type: "GET_APP_STATE" }).then((response) => {
      if (response.ok && response.type === "APP_STATE") {
        setMode(response.mode);
        setScanState(response.scan);
        setDisplayState(response.display);
      }
    });

    const handleRuntimeMessage = (message: unknown) => {
      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "OBSERVATION_CAPTURED_UPDATE" &&
        "scan" in message
      ) {
        setScanState(message.scan as ScanState);
        setStatusMessage("Captured artifact list response.");
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "DISPLAY_CAPTURED_UPDATE" &&
        "display" in message
      ) {
        setDisplayState(message.display as DisplayState);
        setStatusMessage("Display page updated.");
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [setDisplayState, setMode, setScanState]);

  const changeMode = async (nextMode: AppMode) => {
    const response = await sendRuntimeMessage({
      type: "SET_APP_MODE",
      mode: nextMode,
    });
    handleResponse(response);
  };

  const startObserving = async () => {
    setScanState({
      ...scan,
      status: "observing",
      errorCode: null,
      errorMessage: null,
    });
    setStatusMessage("Observing artifact list responses...");

    const response = await sendRuntimeMessage({ type: "START_OBSERVING" });
    handleResponse(response);
  };

  const stopObserving = async () => {
    const response = await sendRuntimeMessage({ type: "STOP_OBSERVING" });
    handleResponse(response);
  };

  const startDisplayMode = async () => {
    setStatusMessage("Starting display mode...");

    const response = await sendRuntimeMessage({ type: "START_DISPLAY_MODE" });
    handleResponse(response);
  };

  const stopDisplayMode = async () => {
    const response = await sendRuntimeMessage({ type: "STOP_DISPLAY_MODE" });
    handleResponse(response);
  };

  const openDashboard = async () => {
    const response = await sendRuntimeMessage({ type: "OPEN_DASHBOARD" });
    handleResponse(response);
  };

  const clearStoredData = async () => {
    const response = await sendRuntimeMessage({
      type: "CLEAR_STORED_ARTIFACTS",
    });
    handleResponse(response);
  };

  const handleResponse = (response: ExtensionResponse) => {
    if (!response.ok) {
      if (response.scan !== undefined) {
        setScanState(response.scan);
      }
      if (response.display !== undefined) {
        setDisplayState(response.display);
      }
      setStatusMessage(getPanelErrorMessage(response));
      return;
    }

    if (response.type === "APP_STATE") {
      setMode(response.mode);
      setScanState(response.scan);
      setDisplayState(response.display);
      setStatusMessage(`Mode changed to ${response.mode}.`);
      return;
    }

    if (response.type === "OBSERVATION_STATUS") {
      setScanState(response.scan);
      setStatusMessage(response.message);
      return;
    }

    if (response.type === "ARTIFACT_LIST_OBSERVED_RESULT") {
      setScanState(response.scan);
      setStatusMessage(response.message);
      return;
    }

    if (response.type === "DISPLAY_STATUS") {
      setDisplayState(response.display);
      setStatusMessage(response.message);
      return;
    }

    if (response.type === "DISPLAY_STATE") {
      setDisplayState(response.display);
      setStatusMessage("Display state loaded.");
      return;
    }

    if (response.type === "STORED_ARTIFACT_COUNT") {
      setScanState(response.scan);
      setStatusMessage(`Stored artifacts: ${response.artifactCount}.`);
      return;
    }

    if (response.type === "CLEAR_STORED_ARTIFACTS_RESULT") {
      setScanState(response.scan);
      setStatusMessage("Stored artifact data cleared.");
      return;
    }

    if (response.type === "OPEN_DASHBOARD_RESULT") {
      setStatusMessage("Dashboard opened.");
    }
  };

  return (
    <main className="extensionPanel">
      <header>
        <h1>GBF Artifacts</h1>
        <p>Read-only local artifact manager</p>
      </header>

      <section aria-label="Mode">
        <div className="modeButtons">
          <button
            className={mode === "scan" ? "active" : ""}
            type="button"
            onClick={() => changeMode("scan")}
          >
            Scan
          </button>
          <button
            className={mode === "manage" ? "active" : ""}
            type="button"
            onClick={() => changeMode("manage")}
          >
            Manage
          </button>
          <button
            className={mode === "display" ? "active" : ""}
            type="button"
            onClick={() => changeMode("display")}
          >
            Display
          </button>
        </div>
      </section>

      {mode === "scan" && (
        <>
          <ScanSummary scan={scan} />

          <section className="actions" aria-label="Scan actions">
            <button
              type="button"
              onClick={startObserving}
              disabled={hasActiveSession || display.isEnabled}
            >
              Start Observing
            </button>
            <button
              type="button"
              onClick={stopObserving}
              disabled={!hasActiveSession}
            >
              Stop Observing
            </button>
            <button type="button" onClick={openDashboard}>
              Open Dashboard
            </button>
            <button
              type="button"
              onClick={clearStoredData}
              disabled={hasActiveSession || display.isEnabled}
            >
              Clear Stored Data
            </button>
          </section>
        </>
      )}

      {mode === "manage" && (
        <section className="actions" aria-label="Manage actions">
          <button type="button" onClick={openDashboard}>
            Open Dashboard
          </button>
          <button
            type="button"
            onClick={clearStoredData}
            disabled={hasActiveSession || display.isEnabled}
          >
            Clear Stored Data
          </button>
        </section>
      )}

      {mode === "display" && (
        <DisplayModeSection
          display={display}
          hasActiveSession={hasActiveSession}
          onStart={startDisplayMode}
          onStop={stopDisplayMode}
        />
      )}

      <p className={`status ${scan.status}`}>{statusMessage}</p>
    </main>
  );
}

function ScanSummary({ scan }: { scan: ScanState }) {
  return (
    <section aria-label="Scan summary" className="summary">
      <div>
        <span>Status</span>
        <strong>{formatScanStatus(scan.status)}</strong>
      </div>
      <div>
        <span>Latest page</span>
        <strong>{scan.lastScannedPage ?? "-"}</strong>
      </div>
      <div>
        <span>Observed pages</span>
        <strong>
          {scan.observedPages.length > 0 ? scan.observedPages.join(", ") : "-"}
        </strong>
      </div>
      <div>
        <span>Expected last</span>
        <strong>{scan.expectedLastPage ?? "-"}</strong>
      </div>
      <div>
        <span>Full scan</span>
        <strong>{scan.isFullScan ? "Yes" : "No"}</strong>
      </div>
      <div>
        <span>Observed artifacts</span>
        <strong>{scan.observedArtifactCount}</strong>
      </div>
      <div>
        <span>Persisted</span>
        <strong>{scan.persistedArtifactCount}</strong>
      </div>
    </section>
  );
}

function DisplayModeSection({
  display,
  hasActiveSession,
  onStart,
  onStop,
}: {
  display: DisplayState;
  hasActiveSession: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  return (
    <section aria-label="Display mode" className="displaySection">
      <div className="actions">
        <button
          type="button"
          onClick={onStart}
          disabled={display.isEnabled || hasActiveSession}
        >
          Start Display Mode
        </button>
        <button type="button" onClick={onStop} disabled={!display.isEnabled}>
          Stop Display Mode
        </button>
      </div>

      <section aria-label="Display summary" className="summary">
        <div>
          <span>Status</span>
          <strong>{display.isEnabled ? "Enabled" : "Stopped"}</strong>
        </div>
        <div>
          <span>Page</span>
          <strong>{display.currentPage ?? "-"}</strong>
        </div>
        <div>
          <span>Captured</span>
          <strong>{display.capturedAt ?? "-"}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>{display.itemCount}</strong>
        </div>
      </section>

      {display.items.length === 0 ? (
        <p className="emptyDisplay">Open an artifact list page in GBF.</p>
      ) : (
        <div className="displayGrid">
          {display.items.map((item) => (
            <DisplayArtifactCard key={item.ownedId} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}

function DisplayArtifactCard({ item }: { item: DisplayArtifactItem }) {
  return (
    <div className="displayCard" title={item.memo}>
      <div className="displayCardHeader">
        <span className="ownedId">#{item.ownedId}</span>
        {item.isPossiblyDeleted && (
          <span
            className="warningMarker"
            role="img"
            aria-label="Possibly deleted"
          >
            !
          </span>
        )}
      </div>
      <strong>{item.name}</strong>
      <span className={item.rating === 0 ? "rating unrated" : "rating"}>
        {formatRating(item.rating)}
      </span>
    </div>
  );
}

function getPanelErrorMessage(response: ErrorResponse): string {
  switch (response.errorCode) {
    case "not_on_artifact_page":
      return "Open a GBF artifact page before scanning.";
    case "page_number_not_detected":
      return "Could not detect the current artifact page number.";
    case "api_validation_failed":
      return "Artifact API response format was not recognized.";
    case "request_failed":
      return "Artifact list response capture failed.";
    case "storage_failed":
      return "Stored artifact data could not be updated.";
    case "content_bridge_unavailable":
      return "Could not connect to the GBF page. Please reload the GBF tab and try again.";
    case "active_tab_unavailable":
      return "Active tab could not be identified.";
    case "unexpected_response":
      return "Unexpected extension response.";
    default:
      return response.message;
  }
}

function formatScanStatus(status: ScanStatus) {
  switch (status) {
    case "idle":
      return "Idle";
    case "scanning":
      return "Scanning";
    case "observing":
      return "Observing";
    case "captured":
      return "Captured";
    case "stopped":
      return "Stopped";
    case "success":
      return "Success";
    case "error":
      return "Error";
  }
}

function formatRating(rating: DisplayArtifactItem["rating"]): string {
  if (rating === 0) {
    return "Unrated";
  }

  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

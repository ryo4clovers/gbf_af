import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import type { ErrorResponse, ExtensionResponse } from "../shared/messages";
import {
  type AppMode,
  type ScanState,
  type ScanStatus,
  useAppStore,
} from "../state/appState";
import "./style.css";

function Popup() {
  const { mode, scan, setMode, setScanState } = useAppStore();
  const [statusMessage, setStatusMessage] = useState("Ready.");
  const hasActiveSession = scan.activeScanSessionId !== null;

  useEffect(() => {
    sendRuntimeMessage({ type: "GET_APP_STATE" }).then((response) => {
      if (response.ok && response.type === "APP_STATE") {
        setMode(response.mode);
        setScanState(response.scan);
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
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [setMode, setScanState]);

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
      setStatusMessage(getPopupErrorMessage(response));
      return;
    }

    if (response.type === "APP_STATE") {
      setMode(response.mode);
      setScanState(response.scan);
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
    <main className="popup">
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
        </div>
      </section>

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
            {scan.observedPages.length > 0
              ? scan.observedPages.join(", ")
              : "-"}
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

      <section className="actions" aria-label="Actions">
        <button
          type="button"
          onClick={startObserving}
          disabled={hasActiveSession}
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
          disabled={hasActiveSession}
        >
          Clear Stored Data
        </button>
      </section>

      <p className={`status ${scan.status}`}>{statusMessage}</p>
    </main>
  );
}

function getPopupErrorMessage(response: ErrorResponse): string {
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

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
  );
}

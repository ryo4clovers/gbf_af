import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import type { ExtensionResponse } from "../shared/messages";
import { type AppMode, useAppStore } from "../state/appState";
import "./style.css";

function Popup() {
  const { mode, scan, setMode, setScanState } = useAppStore();
  const [statusMessage, setStatusMessage] = useState("Ready.");

  useEffect(() => {
    sendRuntimeMessage({ type: "GET_APP_STATE" }).then((response) => {
      if (response.ok && response.type === "APP_STATE") {
        setMode(response.mode);
        setScanState(response.scan);
      }
    });
  }, [setMode, setScanState]);

  const changeMode = async (nextMode: AppMode) => {
    const response = await sendRuntimeMessage({
      type: "SET_APP_MODE",
      mode: nextMode,
    });
    handleResponse(response);
  };

  const scanCurrentPage = async () => {
    const response = await sendRuntimeMessage({ type: "SCAN_CURRENT_PAGE" });
    handleResponse(response);
  };

  const openDashboard = async () => {
    const response = await sendRuntimeMessage({ type: "OPEN_DASHBOARD" });
    handleResponse(response);
  };

  const handleResponse = (response: ExtensionResponse) => {
    if (!response.ok) {
      setStatusMessage(response.message);
      return;
    }

    if (response.type === "APP_STATE") {
      setMode(response.mode);
      setScanState(response.scan);
      setStatusMessage(`Mode changed to ${response.mode}.`);
      return;
    }

    if (response.type === "SCAN_CURRENT_PAGE_RESULT") {
      setScanState(response.scan);
      setStatusMessage(response.message);
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
          <span>Current page</span>
          <strong>{scan.currentPage ?? "-"}</strong>
        </div>
        <div>
          <span>Scanned pages</span>
          <strong>{scan.scannedPages.length}</strong>
        </div>
        <div>
          <span>Artifacts scanned</span>
          <strong>{scan.scannedArtifactCount}</strong>
        </div>
      </section>

      <section className="actions" aria-label="Actions">
        <button type="button" onClick={scanCurrentPage}>
          Scan Current Page
        </button>
        <button type="button" onClick={openDashboard}>
          Open Dashboard
        </button>
      </section>

      <p className="status">{statusMessage}</p>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Popup />
    </React.StrictMode>,
  );
}

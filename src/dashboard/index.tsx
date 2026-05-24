import React from "react";
import { createRoot } from "react-dom/client";
import { useAppStore } from "../state/appState";
import "./style.css";

function Dashboard() {
  const { mode, scan, setMode } = useAppStore();

  return (
    <main className="dashboard">
      <header className="topBar">
        <div>
          <h1>GBF Artifact Manager</h1>
          <p>Local read-only artifact management workspace</p>
        </div>
        <fieldset className="modeSwitch">
          <legend>Mode</legend>
          <button
            className={mode === "scan" ? "active" : ""}
            type="button"
            onClick={() => setMode("scan")}
          >
            Scan
          </button>
          <button
            className={mode === "manage" ? "active" : ""}
            type="button"
            onClick={() => setMode("manage")}
          >
            Manage
          </button>
        </fieldset>
      </header>

      <section className="statusGrid" aria-label="Scan status">
        <div>
          <span>Current page</span>
          <strong>{scan.currentPage ?? "-"}</strong>
        </div>
        <div>
          <span>Last page</span>
          <strong>{scan.lastPage ?? "-"}</strong>
        </div>
        <div>
          <span>Total artifacts</span>
          <strong>{scan.totalCount ?? "-"}</strong>
        </div>
        <div>
          <span>Last scanned</span>
          <strong>{scan.lastScannedAt ?? "-"}</strong>
        </div>
      </section>

      <section className="workspace" aria-label="Artifact management">
        <div className="panel">
          <h2>Artifacts</h2>
          <p>No local artifacts have been scanned yet.</p>
        </div>
        <div className="panel">
          <h2>Score Rules</h2>
          <p>
            Custom score rule editing will be added after local storage is in
            place.
          </p>
        </div>
        <div className="panel">
          <h2>CSV Export</h2>
          <p>CSV export will use only locally stored artifact data.</p>
        </div>
      </section>
    </main>
  );
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Dashboard />
    </React.StrictMode>,
  );
}

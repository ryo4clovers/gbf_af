import React from "react";
import { createRoot } from "react-dom/client";
import { ExtensionPanel } from "../panel/ExtensionPanel";
import "./style.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <ExtensionPanel />
    </React.StrictMode>,
  );
}

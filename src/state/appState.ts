import { create } from "zustand";
import { type DisplayState, initialDisplayState } from "../domain/displayMode";

export type AppMode = "scan" | "display";

export type ScanStatus =
  | "idle"
  | "scanning"
  | "observing"
  | "captured"
  | "stopped"
  | "success"
  | "error";

export type ScanErrorCode =
  | "not_on_artifact_page"
  | "page_number_not_detected"
  | "api_validation_failed"
  | "request_failed"
  | "storage_failed"
  | "content_bridge_unavailable"
  | "active_tab_unavailable"
  | "unexpected_response";

export type ScanState = {
  status: ScanStatus;
  currentPage: number | null;
  lastPage: number | null;
  totalCount: number | null;
  scannedArtifactCount: number;
  persistedArtifactCount: number;
  lastScannedPage: number | null;
  lastScanArtifactCount: number;
  scannedPages: number[];
  lastScannedAt: string | null;
  activeScanSessionId: string | null;
  latestScanSessionId: string | null;
  observedPages: number[];
  expectedLastPage: number | null;
  observedArtifactCount: number;
  isFullScan: boolean;
  errorCode: ScanErrorCode | null;
  errorMessage: string | null;
};

export type AppState = {
  mode: AppMode;
  scan: ScanState;
  display: DisplayState;
  setMode: (mode: AppMode) => void;
  setScanState: (scan: ScanState) => void;
  setDisplayState: (display: DisplayState) => void;
  resetScanState: () => void;
};

export const initialScanState: ScanState = {
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
};

export const useAppStore = create<AppState>((set) => ({
  mode: "scan",
  scan: initialScanState,
  display: initialDisplayState,
  setMode: (mode) => set({ mode }),
  setScanState: (scan) => set({ scan }),
  setDisplayState: (display) => set({ display }),
  resetScanState: () => set({ scan: initialScanState }),
}));

import { create } from "zustand";

export type AppMode = "scan" | "manage";

export type ScanStatus = "idle" | "scanning" | "success" | "error";

export type ScanErrorCode =
  | "not_on_artifact_page"
  | "page_number_not_detected"
  | "api_validation_failed"
  | "request_failed"
  | "active_tab_unavailable"
  | "unexpected_response";

export type ScanState = {
  status: ScanStatus;
  currentPage: number | null;
  lastPage: number | null;
  totalCount: number | null;
  scannedArtifactCount: number;
  lastScannedPage: number | null;
  lastScanArtifactCount: number;
  scannedPages: number[];
  lastScannedAt: string | null;
  errorCode: ScanErrorCode | null;
  errorMessage: string | null;
};

export type AppState = {
  mode: AppMode;
  scan: ScanState;
  setMode: (mode: AppMode) => void;
  setScanState: (scan: ScanState) => void;
  resetScanState: () => void;
};

export const initialScanState: ScanState = {
  status: "idle",
  currentPage: null,
  lastPage: null,
  totalCount: null,
  scannedArtifactCount: 0,
  lastScannedPage: null,
  lastScanArtifactCount: 0,
  scannedPages: [],
  lastScannedAt: null,
  errorCode: null,
  errorMessage: null,
};

export const useAppStore = create<AppState>((set) => ({
  mode: "scan",
  scan: initialScanState,
  setMode: (mode) => set({ mode }),
  setScanState: (scan) => set({ scan }),
  resetScanState: () => set({ scan: initialScanState }),
}));

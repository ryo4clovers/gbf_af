import { create } from "zustand";

export type AppMode = "scan" | "manage";

export type ScanState = {
  currentPage: number | null;
  lastPage: number | null;
  totalCount: number | null;
  scannedArtifactCount: number;
  scannedPages: number[];
  lastScannedAt: string | null;
};

export type AppState = {
  mode: AppMode;
  scan: ScanState;
  setMode: (mode: AppMode) => void;
  setScanState: (scan: ScanState) => void;
  resetScanState: () => void;
};

export const initialScanState: ScanState = {
  currentPage: null,
  lastPage: null,
  totalCount: null,
  scannedArtifactCount: 0,
  scannedPages: [],
  lastScannedAt: null,
};

export const useAppStore = create<AppState>((set) => ({
  mode: "scan",
  scan: initialScanState,
  setMode: (mode) => set({ mode }),
  setScanState: (scan) => set({ scan }),
  resetScanState: () => set({ scan: initialScanState }),
}));

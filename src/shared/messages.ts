import type { Artifact } from "../domain/artifact";
import type { AppMode, ScanErrorCode, ScanState } from "../state/appState";

export type ExtensionMessage =
  | GetAppStateMessage
  | SetAppModeMessage
  | ScanCurrentPageMessage
  | GetStoredArtifactCountMessage
  | GetStoredArtifactsMessage
  | ClearStoredArtifactsMessage
  | OpenDashboardMessage
  | GetPageInfoMessage;

export type ExtensionResponse =
  | AppStateResponse
  | PageInfoResponse
  | ScanCurrentPageResponse
  | StoredArtifactCountResponse
  | StoredArtifactsResponse
  | ClearStoredArtifactsResponse
  | OpenDashboardResponse
  | ErrorResponse;

export type GetAppStateMessage = {
  type: "GET_APP_STATE";
};

export type SetAppModeMessage = {
  type: "SET_APP_MODE";
  mode: AppMode;
};

export type ScanCurrentPageMessage = {
  type: "SCAN_CURRENT_PAGE";
};

export type GetStoredArtifactCountMessage = {
  type: "GET_STORED_ARTIFACT_COUNT";
};

export type GetStoredArtifactsMessage = {
  type: "GET_STORED_ARTIFACTS";
};

export type ClearStoredArtifactsMessage = {
  type: "CLEAR_STORED_ARTIFACTS";
};

export type OpenDashboardMessage = {
  type: "OPEN_DASHBOARD";
};

export type GetPageInfoMessage = {
  type: "GET_PAGE_INFO";
};

export type AppStateResponse = {
  ok: true;
  type: "APP_STATE";
  mode: AppMode;
  scan: ScanState;
};

export type PageInfoResponse = {
  ok: true;
  type: "PAGE_INFO";
  url: string;
  isGranblueFantasyPage: boolean;
  isArtifactPage: boolean;
  artifactPage: number | null;
};

export type ScanCurrentPageResponse = {
  ok: true;
  type: "SCAN_CURRENT_PAGE_RESULT";
  message: string;
  artifactCount: number;
  page: number;
  scan: ScanState;
};

export type StoredArtifactCountResponse = {
  ok: true;
  type: "STORED_ARTIFACT_COUNT";
  artifactCount: number;
  scan: ScanState;
};

export type StoredArtifactsResponse = {
  ok: true;
  type: "STORED_ARTIFACTS";
  artifacts: Artifact[];
  artifactCount: number;
  scan: ScanState;
};

export type ClearStoredArtifactsResponse = {
  ok: true;
  type: "CLEAR_STORED_ARTIFACTS_RESULT";
  artifactCount: number;
  scan: ScanState;
};

export type OpenDashboardResponse = {
  ok: true;
  type: "OPEN_DASHBOARD_RESULT";
};

export type ErrorResponse = {
  ok: false;
  type: "ERROR";
  message: string;
  errorCode?: ScanErrorCode;
  scan?: ScanState;
};

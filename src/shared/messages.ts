import type { Artifact } from "../domain/artifact";
import type { AppMode, ScanErrorCode, ScanState } from "../state/appState";

export type ExtensionMessage =
  | GetAppStateMessage
  | SetAppModeMessage
  | StartObservingMessage
  | StopObservingMessage
  | ArtifactListObservedMessage
  | ObservationCapturedUpdateMessage
  | GetStoredArtifactCountMessage
  | GetStoredArtifactsMessage
  | ClearStoredArtifactsMessage
  | OpenDashboardMessage
  | GetPageInfoMessage;

export type ExtensionResponse =
  | AppStateResponse
  | PageInfoResponse
  | ObservationStatusResponse
  | ArtifactListObservedResponse
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

export type StartObservingMessage = {
  type: "START_OBSERVING";
};

export type StopObservingMessage = {
  type: "STOP_OBSERVING";
};

export type ArtifactListObservedMessage = {
  type: "ARTIFACT_LIST_OBSERVED";
  url: string;
  page: number | null;
  payload: unknown;
};

export type ObservationCapturedUpdateMessage = {
  type: "OBSERVATION_CAPTURED_UPDATE";
  scan: ScanState;
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

export type ObservationStatusResponse = {
  ok: true;
  type: "OBSERVATION_STATUS";
  message: string;
  observing: boolean;
  scan: ScanState;
};

export type ArtifactListObservedResponse = {
  ok: true;
  type: "ARTIFACT_LIST_OBSERVED_RESULT";
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

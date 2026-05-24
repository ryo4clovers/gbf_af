import type { Artifact } from "../domain/artifact";
import type { ArtifactUserReview } from "../domain/artifactUserReview";
import type { DisplayState } from "../domain/displayMode";
import type { ArtifactPresence, ScanSession } from "../domain/scanSession";
import type { AppMode, ScanErrorCode, ScanState } from "../state/appState";

export type ExtensionMessage =
  | GetAppStateMessage
  | SetAppModeMessage
  | PingContentBridgeMessage
  | StartObservingMessage
  | StopObservingMessage
  | StartDisplayModeMessage
  | StopDisplayModeMessage
  | GetDisplayStateMessage
  | ArtifactListObservedMessage
  | ObservationCapturedUpdateMessage
  | DisplayCapturedUpdateMessage
  | GetStoredArtifactCountMessage
  | GetStoredArtifactsMessage
  | ClearStoredArtifactsMessage
  | GetArtifactUserReviewsMessage
  | SaveArtifactUserReviewMessage
  | ClearArtifactUserReviewsMessage
  | GetScanSessionsMessage
  | GetArtifactPresenceMessage
  | OpenDashboardMessage
  | GetPageInfoMessage;

export type ExtensionResponse =
  | AppStateResponse
  | PageInfoResponse
  | PongContentBridgeResponse
  | ObservationStatusResponse
  | DisplayStatusResponse
  | DisplayStateResponse
  | ArtifactListObservedResponse
  | StoredArtifactCountResponse
  | StoredArtifactsResponse
  | ClearStoredArtifactsResponse
  | ArtifactUserReviewsResponse
  | SaveArtifactUserReviewResponse
  | ClearArtifactUserReviewsResponse
  | ScanSessionsResponse
  | ArtifactPresenceResponse
  | OpenDashboardResponse
  | ErrorResponse;

export type GetAppStateMessage = {
  type: "GET_APP_STATE";
};

export type SetAppModeMessage = {
  type: "SET_APP_MODE";
  mode: AppMode;
};

export type PingContentBridgeMessage = {
  type: "PING_CONTENT_BRIDGE";
};

export type StartObservingMessage = {
  type: "START_OBSERVING";
};

export type StopObservingMessage = {
  type: "STOP_OBSERVING";
};

export type StartDisplayModeMessage = {
  type: "START_DISPLAY_MODE";
};

export type StopDisplayModeMessage = {
  type: "STOP_DISPLAY_MODE";
};

export type GetDisplayStateMessage = {
  type: "GET_DISPLAY_STATE";
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

export type DisplayCapturedUpdateMessage = {
  type: "DISPLAY_CAPTURED_UPDATE";
  display: DisplayState;
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

export type GetArtifactUserReviewsMessage = {
  type: "GET_ARTIFACT_USER_REVIEWS";
};

export type SaveArtifactUserReviewMessage = {
  type: "SAVE_ARTIFACT_USER_REVIEW";
  review: ArtifactUserReview;
};

export type ClearArtifactUserReviewsMessage = {
  type: "CLEAR_ARTIFACT_USER_REVIEWS";
};

export type GetScanSessionsMessage = {
  type: "GET_SCAN_SESSIONS";
};

export type GetArtifactPresenceMessage = {
  type: "GET_ARTIFACT_PRESENCE";
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
  display: DisplayState;
};

export type PageInfoResponse = {
  ok: true;
  type: "PAGE_INFO";
  url: string;
  isGranblueFantasyPage: boolean;
  isArtifactPage: boolean;
  artifactPage: number | null;
};

export type PongContentBridgeResponse = {
  ok: true;
  type: "PONG_CONTENT_BRIDGE";
};

export type ObservationStatusResponse = {
  ok: true;
  type: "OBSERVATION_STATUS";
  message: string;
  observing: boolean;
  scan: ScanState;
};

export type DisplayStatusResponse = {
  ok: true;
  type: "DISPLAY_STATUS";
  message: string;
  display: DisplayState;
};

export type DisplayStateResponse = {
  ok: true;
  type: "DISPLAY_STATE";
  display: DisplayState;
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

export type ArtifactUserReviewsResponse = {
  ok: true;
  type: "ARTIFACT_USER_REVIEWS";
  reviews: ArtifactUserReview[];
};

export type SaveArtifactUserReviewResponse = {
  ok: true;
  type: "SAVE_ARTIFACT_USER_REVIEW_RESULT";
  review: ArtifactUserReview;
};

export type ClearArtifactUserReviewsResponse = {
  ok: true;
  type: "CLEAR_ARTIFACT_USER_REVIEWS_RESULT";
};

export type ScanSessionsResponse = {
  ok: true;
  type: "SCAN_SESSIONS";
  activeSession: ScanSession | null;
  latestSession: ScanSession | null;
  scan: ScanState;
};

export type ArtifactPresenceResponse = {
  ok: true;
  type: "ARTIFACT_PRESENCE";
  presence: Record<number, ArtifactPresence>;
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
  display?: DisplayState;
};

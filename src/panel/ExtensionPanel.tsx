import { useEffect, useState } from "react";
import type { DisplayArtifactItem, DisplayState } from "../domain/displayMode";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import type { ErrorResponse, ExtensionResponse } from "../shared/messages";
import {
  type AppMode,
  type ScanState,
  type ScanStatus,
  useAppStore,
} from "../state/appState";

type PanelTheme = "fantasy" | "cyber";
type MaterialIconName = "dashboard" | "display" | "pause" | "play" | "scan";

const DASHBOARD_THEME_STORAGE_KEY = "gbf-af-dashboard-theme";
const DISPLAY_SLOT_COUNT = 20;
const DISPLAY_SLOT_IDS = Array.from(
  { length: DISPLAY_SLOT_COUNT },
  (_, index) => `display-slot-${index + 1}`,
);
const MATERIAL_ICON_PATHS: Record<MaterialIconName, string> = {
  dashboard: "M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z",
  display:
    "M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6Zm2 16H8v-2h8v2Zm0-4H8v-2h8v2Zm-3-5V3.5L18.5 9H13Z",
  pause: "M6 19h4V5H6v14Zm8-14v14h4V5h-4Z",
  play: "M8 5v14l11-7L8 5Z",
  scan: "M7 3H5c-1.1 0-2 .9-2 2v4h2V5h2V3Zm12 6V5c0-1.1-.9-2-2-2h-2v2h2v4h2Zm-2 10h-2v2h2c1.1 0 2-.9 2-2v-4h-2v4ZM5 15H3v4c0 1.1.9 2 2 2h2v-2H5v-4Zm2-4h10v2H7v-2Z",
};

function getStoredPanelTheme(): PanelTheme {
  return window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY) === "cyber"
    ? "cyber"
    : "fantasy";
}

export function ExtensionPanel() {
  const { mode, scan, display, setMode, setScanState, setDisplayState } =
    useAppStore();
  const [statusMessage, setStatusMessage] = useState("準備完了");
  const [isModeChanging, setIsModeChanging] = useState(false);
  const hasActiveSession = scan.activeScanSessionId !== null;

  useEffect(() => {
    const applyStoredTheme = () => {
      document.documentElement.dataset.theme = getStoredPanelTheme();
    };
    const handleThemeStorageChange = (event: StorageEvent) => {
      if (event.key === DASHBOARD_THEME_STORAGE_KEY || event.key === null) {
        applyStoredTheme();
      }
    };

    applyStoredTheme();
    window.addEventListener("storage", handleThemeStorageChange);

    return () => {
      window.removeEventListener("storage", handleThemeStorageChange);
    };
  }, []);

  useEffect(() => {
    sendRuntimeMessage({ type: "GET_APP_STATE" }).then((response) => {
      if (response.ok && response.type === "APP_STATE") {
        setMode(normalizeAppMode(response.mode));
        setScanState(response.scan);
        setDisplayState(response.display);
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
        setStatusMessage("アーティファクト一覧を取得しました。");
      }

      if (
        typeof message === "object" &&
        message !== null &&
        "type" in message &&
        message.type === "DISPLAY_CAPTURED_UPDATE" &&
        "display" in message
      ) {
        setDisplayState(message.display as DisplayState);
        setStatusMessage("表示ページを更新しました。");
      }
    };

    chrome.runtime.onMessage.addListener(handleRuntimeMessage);

    return () => {
      chrome.runtime.onMessage.removeListener(handleRuntimeMessage);
    };
  }, [setDisplayState, setMode, setScanState]);

  const handleResponse = (response: ExtensionResponse): boolean => {
    if (!response.ok) {
      if (response.scan !== undefined) {
        setScanState(response.scan);
      }
      if (response.display !== undefined) {
        setDisplayState(response.display);
      }
      setStatusMessage(getPanelErrorMessage(response));
      return false;
    }

    if (response.type === "APP_STATE") {
      const normalizedMode = normalizeAppMode(response.mode);

      setMode(normalizedMode);
      setScanState(response.scan);
      setDisplayState(response.display);
      setStatusMessage(
        `モードを「${formatMode(normalizedMode)}」に変更しました。`,
      );
      return true;
    }

    if (response.type === "OBSERVATION_STATUS") {
      setScanState(response.scan);
      setStatusMessage(
        response.observing
          ? "スキャンを開始しました。"
          : "スキャンを停止しました。",
      );
      return true;
    }

    if (response.type === "ARTIFACT_LIST_OBSERVED_RESULT") {
      setScanState(response.scan);
      setStatusMessage(
        `ページ${response.page}から${response.artifactCount}件のアーティファクトを取得しました。`,
      );
      return true;
    }

    if (response.type === "DISPLAY_STATUS") {
      setDisplayState(response.display);
      setStatusMessage(
        response.display.isEnabled
          ? response.display.currentPage === undefined
            ? "表示モードを開始しました。"
            : `表示ページを更新しました（ページ${response.display.currentPage}）。`
          : "表示モードを停止しました。",
      );
      return true;
    }

    if (response.type === "DISPLAY_STATE") {
      setDisplayState(response.display);
      setStatusMessage("表示状態を読み込みました。");
      return true;
    }

    if (response.type === "STORED_ARTIFACT_COUNT") {
      setScanState(response.scan);
      setStatusMessage(`保存済みアーティファクト：${response.artifactCount}件`);
      return true;
    }

    if (response.type === "CLEAR_STORED_ARTIFACTS_RESULT") {
      setScanState(response.scan);
      setStatusMessage("保存済みアーティファクトを削除しました。");
      return true;
    }

    if (response.type === "OPEN_DASHBOARD_RESULT") {
      setStatusMessage("管理画面を開きました。");
      return true;
    }

    return true;
  };

  const setBackgroundMode = async (nextMode: AppMode): Promise<boolean> => {
    const response = await sendRuntimeMessage({
      type: "SET_APP_MODE",
      mode: nextMode,
    });
    return handleResponse(response);
  };

  const selectMode = async (nextMode: AppMode) => {
    const isModeAlreadyReady =
      nextMode === mode &&
      (nextMode === "scan" ? !display.isEnabled : display.isEnabled);

    if (isModeAlreadyReady || isModeChanging) {
      return;
    }

    setIsModeChanging(true);

    try {
      if (nextMode === "display") {
        if (hasActiveSession) {
          const stopResponse = await sendRuntimeMessage({
            type: "STOP_OBSERVING",
          });

          if (!handleResponse(stopResponse)) {
            return;
          }
        }

        if (!(await setBackgroundMode("display"))) {
          return;
        }

        if (!display.isEnabled) {
          setStatusMessage("表示モードを開始しています...");
          handleResponse(
            await sendRuntimeMessage({ type: "START_DISPLAY_MODE" }),
          );
        }
        return;
      }

      if (display.isEnabled) {
        const stopResponse = await sendRuntimeMessage({
          type: "STOP_DISPLAY_MODE",
        });

        if (!handleResponse(stopResponse)) {
          return;
        }
      }

      await setBackgroundMode("scan");
    } finally {
      setIsModeChanging(false);
    }
  };

  const toggleScan = async () => {
    if (isModeChanging) {
      return;
    }

    setIsModeChanging(true);

    try {
      if (hasActiveSession) {
        handleResponse(await sendRuntimeMessage({ type: "STOP_OBSERVING" }));
        return;
      }

      setScanState({
        ...scan,
        status: "observing",
        errorCode: null,
        errorMessage: null,
      });
      setStatusMessage("アーティファクト一覧を監視しています...");
      handleResponse(await sendRuntimeMessage({ type: "START_OBSERVING" }));
    } finally {
      setIsModeChanging(false);
    }
  };

  const openDashboard = async () => {
    handleResponse(await sendRuntimeMessage({ type: "OPEN_DASHBOARD" }));
  };

  return (
    <main className="extensionPanel">
      <header className="panelHeader">
        <div>
          <h1>GBF AF Manager</h1>
          <p>読み取り専用のローカル管理ツール</p>
        </div>
        <button
          className="dashboardButton"
          type="button"
          onClick={openDashboard}
        >
          <MaterialIcon name="dashboard" />
          管理画面
        </button>
      </header>

      <div className="modeTabs" aria-label="モード" role="tablist">
        <button
          aria-controls="sidepanel-mode-content"
          aria-selected={mode === "scan"}
          className={mode === "scan" ? "active" : undefined}
          disabled={isModeChanging}
          id="sidepanel-tab-scan"
          role="tab"
          type="button"
          onClick={() => void selectMode("scan")}
        >
          <MaterialIcon name="scan" />
          スキャン
        </button>
        <button
          aria-controls="sidepanel-mode-content"
          aria-selected={mode === "display"}
          className={mode === "display" ? "active" : undefined}
          disabled={isModeChanging}
          id="sidepanel-tab-display"
          role="tab"
          type="button"
          onClick={() => void selectMode("display")}
        >
          <MaterialIcon name="display" />
          表示
        </button>
      </div>

      <section
        aria-labelledby={`sidepanel-tab-${mode}`}
        className="modeContent"
        id="sidepanel-mode-content"
        role="tabpanel"
      >
        {mode === "scan" ? (
          <ScanModeSection
            isActive={hasActiveSession}
            isDisabled={display.isEnabled || isModeChanging}
            scan={scan}
            onToggle={() => void toggleScan()}
          />
        ) : (
          <DisplayModeSection display={display} />
        )}
      </section>

      <p className={`status ${scan.status}`} aria-live="polite">
        {statusMessage}
      </p>
    </main>
  );
}

function ScanModeSection({
  isActive,
  isDisabled,
  onToggle,
  scan,
}: {
  isActive: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  scan: ScanState;
}) {
  const pageNumbers = createPageNumbers(scan);
  const observedPages = new Set(scan.observedPages);

  return (
    <section aria-label="スキャンモード" className="scanModeSection">
      <button
        className="primaryModeAction"
        disabled={isDisabled}
        type="button"
        onClick={onToggle}
      >
        <MaterialIcon name={isActive ? "pause" : "play"} />
        {isActive ? "停止" : "スキャン"}
      </button>

      <dl className="scanFacts">
        <div>
          <dt>状態</dt>
          <dd>{formatScanStatus(scan.status)}</dd>
        </div>
        <div>
          <dt>アーティファクト数</dt>
          <dd>{scan.observedArtifactCount}件</dd>
        </div>
        <div>
          <dt>最終スキャン日時</dt>
          <dd>{formatLocalDateTime(scan.lastScannedAt)}</dd>
        </div>
      </dl>

      {pageNumbers.length > 0 ? (
        <ol className="pageProgress" aria-label="ページ別スキャン状況">
          {pageNumbers.map((pageNumber) => (
            <li
              className={observedPages.has(pageNumber) ? "captured" : undefined}
              key={pageNumber}
              title={
                observedPages.has(pageNumber) ? "スキャン済み" : "未スキャン"
              }
            >
              {pageNumber}
            </li>
          ))}
        </ol>
      ) : (
        <p className="emptyHint">
          スキャンを開始するとページごとの進捗を表示します。
        </p>
      )}
    </section>
  );
}

function DisplayModeSection({ display }: { display: DisplayState }) {
  const displaySlots = DISPLAY_SLOT_IDS.map((id, index) => ({
    id,
    item: display.items[index] ?? null,
  }));

  return (
    <section aria-label="表示モード" className="displaySection">
      <div className="displayMeta">
        <span>{display.isEnabled ? "本家ページと連動中" : "連動停止中"}</span>
        <span>
          ページ {display.currentPage ?? "-"} ・ {display.itemCount}件
        </span>
      </div>

      <ul aria-label="アーティファクト表示一覧" className="displayGrid">
        {displaySlots.map((slot) =>
          slot.item === null ? (
            <li
              aria-hidden="true"
              className="displayCard displayCardPlaceholder"
              key={slot.id}
            />
          ) : (
            <DisplayArtifactCard key={slot.id} item={slot.item} />
          ),
        )}
      </ul>

      {display.items.length === 0 && (
        <p className="emptyDisplay">
          GBFでアーティファクト一覧ページを開いてください。
        </p>
      )}
    </section>
  );
}

function DisplayArtifactCard({ item }: { item: DisplayArtifactItem }) {
  return (
    <li className="displayCard" title={item.memo}>
      <div className="displayCardHeader">
        <span className="ownedId">#{item.ownedId}</span>
        {item.isPossiblyDeleted && (
          <span
            aria-label="削除された可能性あり"
            className="warningMarker"
            role="img"
          >
            !
          </span>
        )}
      </div>
      <strong>{item.name}</strong>
      <span className={item.rating === 0 ? "rating unrated" : "rating"}>
        {formatRating(item.rating)}
      </span>
    </li>
  );
}

function MaterialIcon({ name }: { name: MaterialIconName }) {
  return (
    <svg
      aria-hidden="true"
      className="materialIcon"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={MATERIAL_ICON_PATHS[name]} />
    </svg>
  );
}

function createPageNumbers(scan: ScanState): number[] {
  const inferredLastPage = Math.max(
    scan.expectedLastPage ?? 0,
    scan.lastPage ?? 0,
    scan.lastScannedPage ?? 0,
    ...scan.observedPages,
  );

  return Array.from({ length: inferredLastPage }, (_, index) => index + 1);
}

function formatLocalDateTime(value: string | null): string {
  if (value === null) {
    return "未実施";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "未実施";
  }

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function getPanelErrorMessage(response: ErrorResponse): string {
  switch (response.errorCode) {
    case "not_on_artifact_page":
      return "操作を開始する前に、GBFのアーティファクトページを開いてください。";
    case "page_number_not_detected":
      return "現在のアーティファクトページ番号を取得できませんでした。";
    case "api_validation_failed":
      return "アーティファクトAPIのレスポンス形式を認識できませんでした。";
    case "request_failed":
      return "アーティファクト一覧の取得に失敗しました。";
    case "storage_failed":
      return "保存済みアーティファクトを更新できませんでした。";
    case "content_bridge_unavailable":
      return "GBFページへ接続できませんでした。GBFのタブを再読み込みして、もう一度お試しください。";
    case "active_tab_unavailable":
      return "現在のタブを特定できませんでした。";
    case "unexpected_response":
      return "拡張機能から予期しない応答がありました。";
    default:
      return response.message;
  }
}

function formatMode(mode: AppMode): string {
  return mode === "scan" ? "スキャン" : "表示";
}

function normalizeAppMode(mode: unknown): AppMode {
  return mode === "display" ? "display" : "scan";
}

function formatScanStatus(status: ScanStatus): string {
  switch (status) {
    case "idle":
      return "待機中";
    case "scanning":
      return "スキャン中";
    case "observing":
      return "監視中";
    case "captured":
      return "取得済み";
    case "stopped":
      return "停止中";
    case "success":
      return "完了";
    case "error":
      return "エラー";
  }
}

function formatRating(rating: DisplayArtifactItem["rating"]): string {
  if (rating === 0) {
    return "未評価";
  }

  return `${"★".repeat(rating)}${"☆".repeat(5 - rating)}`;
}

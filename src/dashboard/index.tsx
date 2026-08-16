import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { Artifact } from "../domain/artifact";
import type {
  ArtifactUserRating,
  ArtifactUserReview,
} from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";
import {
  type CustomScoreSettings,
  DEFAULT_CUSTOM_SCORE_SETTINGS,
  type IdealMatchScores,
  type SkillScores,
  type TableRankPenalties,
  validateIdealMatchScores,
  validateSkillScores,
  validateTableRankPenalties,
  withCustomScoreSettingsDefaults,
} from "../domain/score/customScoreSettings";
import { evaluateCustomScore } from "../domain/score/evaluateCustomScore";
import {
  ARTIFACT_ATTRIBUTE_OPTIONS,
  ARTIFACT_KIND_OPTIONS,
  createEmptyIdealSkillConfiguration,
  IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  IDEAL_FOURTH_SLOT_OPTIONS,
  IDEAL_THIRD_SLOT_OPTIONS,
  type IdealSkillConfiguration,
  type IdealSkillOption,
  validateIdealSkillConfigurations,
} from "../domain/score/idealSkillConfiguration";
import type { ScoreReason, ScoreResult } from "../domain/score/scoreResult";
import { inferTableRank } from "../domain/skill/inferTableRank";
import type { NormalizedSkillKey } from "../domain/skill/normalizedSkill";
import { normalizeArtifactSkill } from "../domain/skill/normalizeSkill";
import {
  DEFAULT_SKILL_HIGHLIGHT_COLOR,
  normalizeSkillHighlightSettings,
  type SkillHighlightSettings,
} from "../domain/skill/skillHighlightSettings";
import { createArtifactJson, parseArtifactJson } from "../json/artifactJson";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import { useAppStore } from "../state/appState";
import {
  type ArtifactStatistics,
  calculateArtifactStatistics,
} from "../statistics/artifactStatistics";
import {
  type ArtifactFilters,
  createDefaultArtifactFilters,
  type EquippedFilter,
  type LifecycleFilter,
  type LockedFilter,
  matchesArtifactFilters,
  type SkillFilterCondition,
} from "./artifactFilters";
import "./style.css";

type SortKey =
  | "totalScore"
  | "ownedId"
  | "rating"
  | "customScore"
  | "attributeOrder"
  | "kindOrder";
type SortDirection = "asc" | "desc";
type DashboardTab = "list" | "scoreSettings" | "statistics";
type DashboardIconName =
  | "add"
  | "chart"
  | "delete"
  | "download"
  | "filter"
  | "help"
  | "highlight"
  | "list"
  | "refresh"
  | "save"
  | "score"
  | "sort"
  | "upload";

const DASHBOARD_ICON_PATHS: Record<DashboardIconName, string> = {
  add: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2Z",
  chart:
    "M3 3v18h18v-2H5V3H3Zm4 12h3v2H7v-2Zm0-4h3v3H7v-3Zm5-4h3v10h-3V7Zm5 3h3v7h-3v-7Z",
  delete:
    "M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12Zm3.46-7.12 1.41-1.41L12 11.59l1.12-1.12 1.41 1.41L13.41 13l1.12 1.12-1.41 1.41L12 14.41l-1.12 1.12-1.41-1.41L10.59 13l-1.13-1.12ZM15.5 4l-1-1h-5l-1 1H5v2h14V4h-3.5Z",
  download: "M19 9h-4V3H9v6H5l7 7 7-7ZM5 18v2h14v-2H5Z",
  filter: "M10 18h4v-2h-4v2ZM3 6v2h18V6H3Zm3 7h12v-2H6v2Z",
  help: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 17h-2v-2h2v2Zm2.07-7.25-.9.92A3.49 3.49 0 0 0 13 15h-2v-.5c0-.8.32-1.57.88-2.12l1.24-1.26A1.71 1.71 0 0 0 13.5 9 1.5 1.5 0 0 0 12 7.5 1.5 1.5 0 0 0 10.5 9h-2a3.5 3.5 0 1 1 6.57 2.75Z",
  highlight:
    "m17.5 2.5 4 4-10 10-5 1 1-5 10-10Zm-11 13 4.15-.83 8.02-8.02-1.32-1.32-8.02 8.02L8.5 17.5l-2-2ZM3 20h18v2H3v-2Z",
  list: "M3 13h2v-2H3v2Zm0 4h2v-2H3v2Zm0-8h2V7H3v2Zm4 4h14v-2H7v2Zm0 4h14v-2H7v2ZM7 7v2h14V7H7Z",
  refresh:
    "M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h8V3l-3.35 3.35Z",
  save: "M17 3H5a2 2 0 0 0-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4Zm-5 16a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm3-10H5V5h10v4Z",
  score:
    "M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Zm7.43-2.53c.04-.32.07-.64.07-.97s-.03-.65-.08-.97l2.11-1.65-2-3.46-2.49 1a7.31 7.31 0 0 0-1.68-.98L15 3.27h-4l-.37 2.67c-.61.25-1.17.58-1.69.98l-2.49-1-2 3.46 2.12 1.65c-.05.32-.08.65-.08.97s.03.65.08.97l-2.12 1.65 2 3.46 2.49-1c.52.4 1.08.73 1.69.98l.37 2.67h4l.37-2.67c.61-.25 1.17-.58 1.68-.98l2.49 1 2-3.46-2.11-1.65Z",
  sort: "M3 18h6v-2H3v2Zm0-5h12v-2H3v2Zm0-7v2h18V6H3Z",
  upload: "M9 16h6v-6h4l-7-7-7 7h4v6Zm-4 2v2h14v-2H5Z",
};
type DashboardTheme = "fantasy" | "cyber";

type ArtifactSort = {
  key: SortKey;
  direction: SortDirection;
};

type ReviewedArtifactRow = {
  artifact: Artifact;
  review: ArtifactUserReview | null;
  presence: ArtifactPresence | null;
  customScore: ScoreResult;
};

const DASHBOARD_THEME_STORAGE_KEY = "gbf-af-dashboard-theme";
const SKILL_HIGHLIGHT_STORAGE_KEY = "gbf-af-skill-highlights";
const DASHBOARD_TABS: DashboardTab[] = ["list", "scoreSettings", "statistics"];
const DASHBOARD_TAB_IDS: Record<DashboardTab, string> = {
  list: "dashboard-tab-list",
  scoreSettings: "dashboard-tab-score-settings",
  statistics: "dashboard-tab-statistics",
};
const ATTRIBUTE_ORDER = ["火", "水", "土", "風", "光", "闇"] as const;
const ATTRIBUTE_ICON_FILE_NAMES: Record<string, string> = {
  "1": "fire.png",
  "2": "water.png",
  "3": "earth.png",
  "4": "wind.png",
  "5": "light.png",
  "6": "dark.png",
};
const WEAPON_ICON_FILE_NAMES: Record<string, string> = {
  "1": "sabre.png",
  "2": "dagger.png",
  "3": "spear.png",
  "4": "axe.png",
  "5": "staff.png",
  "6": "gun.png",
  "7": "melee.png",
  "8": "bow.png",
  "9": "harp.png",
  "10": "katana.png",
};
const KIND_ORDER = [
  "kind-1",
  "kind-2",
  "kind-3",
  "kind-4",
  "kind-5",
  "kind-6",
  "kind-7",
  "kind-8",
  "kind-9",
  "kind-10",
] as const;
const KIND_LABELS: Record<string, string> = {
  "kind-1": "剣",
  "kind-2": "短剣",
  "kind-3": "槍",
  "kind-4": "斧",
  "kind-5": "杖",
  "kind-6": "銃",
  "kind-7": "格闘",
  "kind-8": "弓",
  "kind-9": "楽器",
  "kind-10": "刀",
};

function getInitialDashboardTheme(): DashboardTheme {
  const savedTheme = window.localStorage.getItem(DASHBOARD_THEME_STORAGE_KEY);

  return savedTheme === "cyber" || savedTheme === "fantasy"
    ? savedTheme
    : "fantasy";
}

function getInitialSkillHighlightSettings(): SkillHighlightSettings {
  try {
    const savedSettings = window.localStorage.getItem(
      SKILL_HIGHLIGHT_STORAGE_KEY,
    );
    return savedSettings === null
      ? {}
      : normalizeSkillHighlightSettings(JSON.parse(savedSettings));
  } catch {
    return {};
  }
}

function Dashboard() {
  const { scan, setScanState } = useAppStore();
  const [dashboardTheme, setDashboardTheme] = useState<DashboardTheme>(
    getInitialDashboardTheme,
  );
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [reviewsByOwnedId, setReviewsByOwnedId] = useState<
    Record<number, ArtifactUserReview>
  >({});
  const [presenceByOwnedId, setPresenceByOwnedId] = useState<
    Record<number, ArtifactPresence>
  >({});
  const [customScoreSettings, setCustomScoreSettings] =
    useState<CustomScoreSettings>(DEFAULT_CUSTOM_SCORE_SETTINGS);
  const [scoreSettingsError, setScoreSettingsError] = useState<string | null>(
    null,
  );
  const [idealSkillError, setIdealSkillError] = useState<string | null>(null);
  const [idealMatchScoreError, setIdealMatchScoreError] = useState<
    string | null
  >(null);
  const [prioritySkillError, setPrioritySkillError] = useState<string | null>(
    null,
  );
  const [tableRankPenaltyError, setTableRankPenaltyError] = useState<
    string | null
  >(null);
  const [isScoreSettingsSaving, setIsScoreSettingsSaving] = useState(false);
  const scoreSettingsSaveInFlightRef = useRef(false);
  const [filters, setFilters] = useState<ArtifactFilters>(
    createDefaultArtifactFilters,
  );
  const [sort, setSort] = useState<ArtifactSort>({
    key: "totalScore",
    direction: "desc",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading artifacts...");
  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardTab>("list");
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isHighlightDialogOpen, setIsHighlightDialogOpen] = useState(false);
  const [highlightSettingsError, setHighlightSettingsError] = useState<
    string | null
  >(null);
  const [skillHighlightSettings, setSkillHighlightSettings] =
    useState<SkillHighlightSettings>(getInitialSkillHighlightSettings);
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const artifactRows = artifacts.map((artifact) =>
    buildArtifactScoreViewModel({
      artifact,
      review: reviewsByOwnedId[artifact.ownedId] ?? null,
      presence: presenceByOwnedId[artifact.ownedId] ?? null,
      scoreSettings: customScoreSettings,
    }),
  );
  const statistics = calculateArtifactStatistics({
    artifacts,
    userReviews: Object.values(reviewsByOwnedId),
    artifactPresence: Object.values(presenceByOwnedId),
  });
  const filteredRows = getFilteredAndSortedArtifactRows(
    artifactRows,
    filters,
    sort,
  );

  useEffect(() => {
    document.documentElement.dataset.theme = dashboardTheme;
    window.localStorage.setItem(DASHBOARD_THEME_STORAGE_KEY, dashboardTheme);
  }, [dashboardTheme]);

  const loadArtifacts = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("Loading artifacts...");

    const [
      artifactResponse,
      reviewResponse,
      presenceResponse,
      customScoreSettingsResponse,
    ] = await Promise.all([
      sendRuntimeMessage({ type: "GET_STORED_ARTIFACTS" }),
      sendRuntimeMessage({ type: "GET_ARTIFACT_USER_REVIEWS" }),
      sendRuntimeMessage({ type: "GET_ARTIFACT_PRESENCE" }),
      sendRuntimeMessage({ type: "GET_CUSTOM_SCORE_SETTINGS" }),
    ]);

    if (!artifactResponse.ok) {
      if (artifactResponse.scan !== undefined) {
        setScanState(artifactResponse.scan);
      }

      setStatusMessage(artifactResponse.message);
      setIsLoading(false);
      return;
    }

    if (artifactResponse.type === "STORED_ARTIFACTS") {
      setArtifacts(artifactResponse.artifacts);
      setScanState(artifactResponse.scan);
    }

    if (!reviewResponse.ok) {
      setStatusMessage(reviewResponse.message);
      setIsLoading(false);
      return;
    }

    if (reviewResponse.type === "ARTIFACT_USER_REVIEWS") {
      setReviewsByOwnedId(indexReviewsByOwnedId(reviewResponse.reviews));
    }

    if (!presenceResponse.ok) {
      setStatusMessage(presenceResponse.message);
      setIsLoading(false);
      return;
    }

    if (presenceResponse.type === "ARTIFACT_PRESENCE") {
      setPresenceByOwnedId(presenceResponse.presence);
    }

    if (
      customScoreSettingsResponse.ok &&
      customScoreSettingsResponse.type === "CUSTOM_SCORE_SETTINGS"
    ) {
      setCustomScoreSettings(
        withCustomScoreSettingsDefaults(customScoreSettingsResponse.settings),
      );
    } else {
      setCustomScoreSettings(DEFAULT_CUSTOM_SCORE_SETTINGS);
      setScoreSettingsError("スコア設定を読み込めませんでした。");
    }

    if (customScoreSettingsResponse.ok) {
      setScoreSettingsError(null);
    }

    setStatusMessage(
      `Loaded ${artifactResponse.type === "STORED_ARTIFACTS" ? artifactResponse.artifactCount : 0} stored artifacts.`,
    );
    setIsLoading(false);
  }, [setScanState]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const exportJson = () => {
    if (filteredRows.length === 0) {
      setStatusMessage("No artifacts match the current filters.");
      return;
    }

    const exportedAt = new Date();
    downloadJsonFile(
      createArtifactJson(
        {
          artifacts: filteredRows.map((row) => row.artifact),
          reviews: filteredRows.flatMap((row) =>
            row.review === null ? [] : [row.review],
          ),
          presence: filteredRows.flatMap((row) =>
            row.presence === null ? [] : [row.presence],
          ),
        },
        exportedAt.toISOString(),
      ),
      createArtifactJsonFileName(exportedAt),
    );
    setStatusMessage(`Exported ${filteredRows.length} artifacts.`);
  };

  const importArtifactData = async (file: File) => {
    try {
      const text = await file.text();
      const imported = parseArtifactJson(text);
      if (imported.artifacts.length === 0) {
        setStatusMessage("インポート対象のアーティファクトがありません。");
        return;
      }
      const response = await sendRuntimeMessage({
        type: "IMPORT_ARTIFACT_DATA",
        ...imported,
      });
      if (!response.ok) {
        setStatusMessage(response.message);
        return;
      }
      if (response.type !== "IMPORT_ARTIFACT_DATA_RESULT") {
        setStatusMessage("インポート処理から予期しない応答がありました。");
        return;
      }
      setStatusMessage(`${response.artifactCount}件をインポートしました。`);
      await loadArtifacts();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? `データをインポートできませんでした: ${error.message}`
          : "データをインポートできませんでした。",
      );
    } finally {
      if (importFileInputRef.current !== null) {
        importFileInputRef.current.value = "";
      }
    }
  };

  const clearListData = async () => {
    const artifactResponse = await sendRuntimeMessage({
      type: "CLEAR_STORED_ARTIFACTS",
    });
    if (!artifactResponse.ok) {
      setStatusMessage(artifactResponse.message);
      return;
    }
    if (artifactResponse.type !== "CLEAR_STORED_ARTIFACTS_RESULT") {
      setStatusMessage("初期化処理から予期しない応答がありました。");
      return;
    }
    setArtifacts([]);
    setReviewsByOwnedId({});
    setPresenceByOwnedId({});
    setScanState(artifactResponse.scan);
    setIsResetDialogOpen(false);
    setStatusMessage("リストデータを初期化しました。");
  };

  const saveReview = async (
    ownedId: number,
    rating: ArtifactUserRating,
    memo: string,
  ) => {
    const review: ArtifactUserReview = {
      ownedId,
      rating,
      memo,
      updatedAt: new Date().toISOString(),
    };

    setReviewsByOwnedId((current) => ({
      ...current,
      [ownedId]: review,
    }));

    const response = await sendRuntimeMessage({
      type: "SAVE_ARTIFACT_USER_REVIEW",
      review,
    });

    if (!response.ok) {
      setStatusMessage(response.message);
      return;
    }

    if (response.type === "SAVE_ARTIFACT_USER_REVIEW_RESULT") {
      setReviewsByOwnedId((current) => ({
        ...current,
        [response.review.ownedId]: response.review,
      }));
      setStatusMessage(`Saved review for ${response.review.ownedId}.`);
    }
  };

  const saveScoreSettings = async (
    settings: CustomScoreSettings,
    setError: (message: string | null) => void,
    errorMessage: string,
  ): Promise<boolean> => {
    if (scoreSettingsSaveInFlightRef.current) {
      return false;
    }

    scoreSettingsSaveInFlightRef.current = true;
    setIsScoreSettingsSaving(true);
    setError(null);

    try {
      const response = await sendRuntimeMessage({
        type: "SAVE_CUSTOM_SCORE_SETTINGS",
        settings: withCustomScoreSettingsDefaults(settings),
      });

      if (!response.ok) {
        setError(`${errorMessage} ${response.message}`);
        return false;
      }

      if (response.type === "SAVE_CUSTOM_SCORE_SETTINGS_RESULT") {
        setCustomScoreSettings(
          withCustomScoreSettingsDefaults(response.settings),
        );
      }

      return true;
    } finally {
      scoreSettingsSaveInFlightRef.current = false;
      setIsScoreSettingsSaving(false);
    }
  };

  const saveIdealMatchScores = async (
    scores: IdealMatchScores,
  ): Promise<boolean> => {
    const validationError = validateIdealMatchScores(scores);

    if (validationError !== null) {
      setIdealMatchScoreError(
        "スコアは0～100の整数で、一致数が増えるほど低くならないように設定してください。",
      );
      return false;
    }

    setIdealMatchScoreError(null);
    const settings: CustomScoreSettings = {
      ...customScoreSettings,
      idealMatchScores: scores,
      updatedAt: new Date().toISOString(),
    };

    return saveScoreSettings(
      settings,
      setIdealMatchScoreError,
      "一致数スコアを保存できませんでした。",
    );
  };

  const saveIdealSkillConfigurations = async (
    configurations: IdealSkillConfiguration[],
  ): Promise<boolean> => {
    const validationError = validateIdealSkillConfigurations(configurations);

    if (validationError !== null) {
      setIdealSkillError(
        validationError.includes("overlap")
          ? "属性と武器種の適用範囲が、ほかの理想構成と重複しています。"
          : "各構成では属性と武器種を1つ以上選択してください。",
      );
      return false;
    }

    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      idealSkillConfigurations: configurations,
      updatedAt: new Date().toISOString(),
    };

    return saveScoreSettings(
      nextSettings,
      setIdealSkillError,
      "理想構成を保存できませんでした。",
    );
  };

  const saveSkillScores = async (
    skillScores: SkillScores,
  ): Promise<boolean> => {
    const validationError = validateSkillScores(skillScores);

    if (validationError !== null) {
      setPrioritySkillError("各スキルの点数を0～25の整数で設定してください。");
      return false;
    }

    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      skillScores,
      updatedAt: new Date().toISOString(),
    };

    return saveScoreSettings(
      nextSettings,
      setPrioritySkillError,
      "スキルスコアを保存できませんでした。",
    );
  };

  const saveTableRankPenalties = async (
    tableRankPenalties: TableRankPenalties,
  ): Promise<boolean> => {
    const validationError = validateTableRankPenalties(tableRankPenalties);

    if (validationError !== null) {
      setTableRankPenaltyError(
        "減点幅は0～25の整数で、A ≦ B ≦ C ≦ D ≦ Eとなるように設定してください。",
      );
      return false;
    }

    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      tableRankPenalties,
      updatedAt: new Date().toISOString(),
    };

    return saveScoreSettings(
      nextSettings,
      setTableRankPenaltyError,
      "スキルクオリティ減点を保存できませんでした。",
    );
  };

  const updateMemoDraft = (ownedId: number, memo: string) => {
    setReviewsByOwnedId((current) => {
      const currentReview = current[ownedId];

      return {
        ...current,
        [ownedId]: {
          ownedId,
          rating: currentReview?.rating ?? 0,
          memo,
          updatedAt: currentReview?.updatedAt ?? "",
        },
      };
    });
  };

  const handleDashboardTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentTab: DashboardTab,
  ) => {
    const currentIndex = DASHBOARD_TABS.indexOf(currentTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % DASHBOARD_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + DASHBOARD_TABS.length) % DASHBOARD_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = DASHBOARD_TABS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = DASHBOARD_TABS[nextIndex];
    if (nextTab === undefined) return;
    setActiveDashboardTab(nextTab);
    document.getElementById(DASHBOARD_TAB_IDS[nextTab])?.focus();
  };

  return (
    <main className="dashboard">
      <header className="topBar">
        <h1>GBF AF Manager</h1>
        <div className="topBarActions">
          <label className="themeSelector">
            <span className="visuallyHidden">テーマ</span>
            <select
              value={dashboardTheme}
              onChange={(event) =>
                setDashboardTheme(event.currentTarget.value as DashboardTheme)
              }
            >
              <option value="fantasy">Fantasy</option>
              <option value="cyber">Cyber</option>
            </select>
          </label>
          <button
            className="iconOnlyButton"
            type="button"
            onClick={() => setIsHelpDialogOpen(true)}
            aria-label="ヘルプ"
          >
            <DashboardIcon name="help" />
          </button>
        </div>
      </header>

      <section className="scanResultSummary" aria-label="スキャン結果">
        <h2>スキャン結果</h2>
        <div className="statusGrid">
          <div>
            <span>アーティファクト数</span>
            <strong>{artifacts.length}</strong>
          </div>
          <div>
            <span>最終スキャン日時</span>
            <strong>{formatLocalDateTime(scan.lastScannedAt)}</strong>
          </div>
        </div>
      </section>

      <section className="workspace" aria-label="Artifact management">
        <div className="panel">
          <h2>アーティファクト</h2>

          <div
            className="dashboardTabs"
            role="tablist"
            aria-label="Dashboard sections"
          >
            <button
              id="dashboard-tab-list"
              className={getDashboardTabClassName(
                activeDashboardTab === "list",
              )}
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "list"}
              aria-controls="dashboard-tabpanel-list"
              tabIndex={activeDashboardTab === "list" ? 0 : -1}
              onClick={() => setActiveDashboardTab("list")}
              onKeyDown={(event) => handleDashboardTabKeyDown(event, "list")}
            >
              <DashboardIcon name="list" />
              リスト
            </button>
            <button
              id="dashboard-tab-score-settings"
              className={getDashboardTabClassName(
                activeDashboardTab === "scoreSettings",
              )}
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "scoreSettings"}
              aria-controls="dashboard-tabpanel-score-settings"
              tabIndex={activeDashboardTab === "scoreSettings" ? 0 : -1}
              onClick={() => setActiveDashboardTab("scoreSettings")}
              onKeyDown={(event) =>
                handleDashboardTabKeyDown(event, "scoreSettings")
              }
            >
              <DashboardIcon name="score" />
              スコア設定
            </button>
            <button
              id="dashboard-tab-statistics"
              className={getDashboardTabClassName(
                activeDashboardTab === "statistics",
              )}
              type="button"
              role="tab"
              aria-selected={activeDashboardTab === "statistics"}
              aria-controls="dashboard-tabpanel-statistics"
              tabIndex={activeDashboardTab === "statistics" ? 0 : -1}
              onClick={() => setActiveDashboardTab("statistics")}
              onKeyDown={(event) =>
                handleDashboardTabKeyDown(event, "statistics")
              }
            >
              <DashboardIcon name="chart" />
              統計
            </button>
          </div>

          {activeDashboardTab === "list" && (
            <section
              id="dashboard-tabpanel-list"
              className="dashboardTabPanel"
              role="tabpanel"
              aria-labelledby="dashboard-tab-list"
            >
              <div className="listToolbar">
                <div className="listToolbarPrimary">
                  <button
                    type="button"
                    onClick={() => setIsFilterDialogOpen(true)}
                  >
                    <DashboardIcon name="filter" />
                    絞り込み
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHighlightSettingsError(null);
                      setIsHighlightDialogOpen(true);
                    }}
                  >
                    <DashboardIcon name="highlight" />
                    強調表示
                  </button>
                  <div className="sortControl">
                    <DashboardIcon name="sort" />
                    <span className="visuallyHidden">並び替え</span>
                    <SortSelect sort={sort} onSortChange={setSort} />
                  </div>
                  <span className="resultCount">
                    表示中 {filteredRows.length} / {artifacts.length}
                  </span>
                </div>
                <div className="listToolbarSecondary">
                  <input
                    ref={importFileInputRef}
                    className="visuallyHidden"
                    type="file"
                    accept=".json,application/json"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      if (file !== undefined) void importArtifactData(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => importFileInputRef.current?.click()}
                  >
                    <DashboardIcon name="upload" />
                    インポート
                  </button>
                  <button
                    type="button"
                    onClick={exportJson}
                    disabled={filteredRows.length === 0}
                  >
                    <DashboardIcon name="download" />
                    エクスポート
                  </button>
                  <button
                    className="dangerButton"
                    type="button"
                    onClick={() => setIsResetDialogOpen(true)}
                    disabled={artifacts.length === 0}
                  >
                    <DashboardIcon name="delete" />
                    初期化
                  </button>
                  <button
                    className="iconOnlyButton"
                    type="button"
                    onClick={loadArtifacts}
                    disabled={isLoading}
                    aria-label="再読み込み"
                  >
                    <DashboardIcon name="refresh" />
                  </button>
                </div>
              </div>
              <p className="statusMessage" role="status">
                {statusMessage}
              </p>

              {artifacts.length === 0 ? (
                <p className="emptyState">
                  保存済みのアーティファクトはありません。
                </p>
              ) : (
                <ArtifactTable
                  skillHighlightSettings={skillHighlightSettings}
                  rows={filteredRows}
                  onMemoBlur={(row) =>
                    saveReview(
                      row.artifact.ownedId,
                      row.review?.rating ?? 0,
                      row.review?.memo ?? "",
                    )
                  }
                  onMemoChange={updateMemoDraft}
                  onRatingChange={(row, rating) =>
                    saveReview(
                      row.artifact.ownedId,
                      rating,
                      row.review?.memo ?? "",
                    )
                  }
                />
              )}
            </section>
          )}

          {activeDashboardTab === "scoreSettings" && (
            <section
              id="dashboard-tabpanel-score-settings"
              className="dashboardTabPanel"
              role="tabpanel"
              aria-labelledby="dashboard-tab-score-settings"
            >
              <fieldset
                className="scoreSettingsFieldset"
                disabled={isScoreSettingsSaving}
              >
                <legend className="visuallyHidden">スコア設定</legend>
                {scoreSettingsError !== null && (
                  <p className="errorText">{scoreSettingsError}</p>
                )}
                <IdealSkillEditor
                  configurations={customScoreSettings.idealSkillConfigurations}
                  errorMessage={idealSkillError}
                  idealMatchScoreError={idealMatchScoreError}
                  onSaveConfigurations={saveIdealSkillConfigurations}
                  onSaveIdealMatchScores={saveIdealMatchScores}
                  settings={customScoreSettings}
                />
                <SkillScoreEditor
                  errorMessage={prioritySkillError}
                  onSave={saveSkillScores}
                  skillScores={customScoreSettings.skillScores}
                />
                <TableRankPenaltySettings
                  errorMessage={tableRankPenaltyError}
                  onSave={saveTableRankPenalties}
                  penalties={customScoreSettings.tableRankPenalties}
                />
              </fieldset>
            </section>
          )}

          {activeDashboardTab === "statistics" && (
            <section
              id="dashboard-tabpanel-statistics"
              className="dashboardTabPanel"
              role="tabpanel"
              aria-labelledby="dashboard-tab-statistics"
            >
              <StatisticsSummary statistics={statistics} />
            </section>
          )}
        </div>
      </section>

      {isFilterDialogOpen && (
        <DashboardDialog
          title="絞り込み"
          onClose={() => setIsFilterDialogOpen(false)}
        >
          <ArtifactFilterEditor
            filters={filters}
            onCancel={() => setIsFilterDialogOpen(false)}
            onApply={(nextFilters) => {
              setFilters(nextFilters);
              setIsFilterDialogOpen(false);
            }}
          />
        </DashboardDialog>
      )}

      {isHighlightDialogOpen && (
        <DashboardDialog
          title="スキルの強調表示"
          onClose={() => setIsHighlightDialogOpen(false)}
        >
          <SkillHighlightEditor
            errorMessage={highlightSettingsError}
            settings={skillHighlightSettings}
            onCancel={() => setIsHighlightDialogOpen(false)}
            onSave={(settings) => {
              try {
                window.localStorage.setItem(
                  SKILL_HIGHLIGHT_STORAGE_KEY,
                  JSON.stringify(settings),
                );
                setSkillHighlightSettings(settings);
                setHighlightSettingsError(null);
                setIsHighlightDialogOpen(false);
              } catch {
                setHighlightSettingsError(
                  "強調表示の設定を保存できませんでした。",
                );
              }
            }}
          />
        </DashboardDialog>
      )}

      {isResetDialogOpen && (
        <DashboardDialog
          title="リストデータの初期化"
          onClose={() => setIsResetDialogOpen(false)}
        >
          <p>
            保存済みアーティファクト、評価、コメント、スキャン履歴を削除します。この操作は元に戻せません。
          </p>
          <div className="dialogActions">
            <button type="button" onClick={() => setIsResetDialogOpen(false)}>
              キャンセル
            </button>
            <button
              className="dangerButton"
              type="button"
              onClick={clearListData}
            >
              初期化
            </button>
          </div>
        </DashboardDialog>
      )}

      {isHelpDialogOpen && (
        <DashboardDialog
          title="GBF AF Managerについて"
          onClose={() => setIsHelpDialogOpen(false)}
        >
          <div className="helpLinks">
            <p>
              GBF AF
              Managerは、取得したアーティファクト情報をPC内で管理するツールです。
            </p>
            <p>
              問い合わせ先やライセンス、利用規約、プライバシーポリシーは公開準備後にここへ掲載します。
            </p>
          </div>
          <div className="dialogActions">
            <button type="button" onClick={() => setIsHelpDialogOpen(false)}>
              閉じる
            </button>
          </div>
        </DashboardDialog>
      )}
    </main>
  );
}

function StatisticsSummary({ statistics }: { statistics: ArtifactStatistics }) {
  const topSkillCounts = statistics.skillCounts.slice(0, 10);

  return (
    <section className="statisticsSection" aria-label="Artifact statistics">
      <div className="sectionHeader">
        <div>
          <h3>Statistics</h3>
          <p>Statistics are based on all stored artifacts.</p>
        </div>
      </div>

      <div className="summaryCards">
        <SummaryCard
          label="Stored"
          value={statistics.overall.totalArtifactCount}
        />
        <SummaryCard
          label="Active"
          value={statistics.overall.activeArtifactCount}
        />
        <SummaryCard
          label="Possibly deleted"
          value={statistics.overall.possiblyDeletedArtifactCount}
        />
        <SummaryCard
          label="Unrated"
          value={statistics.overall.unratedArtifactCount}
        />
        <SummaryCard
          label="Average score"
          value={formatOptionalNumber(statistics.overall.averageGameTotalScore)}
        />
        <SummaryCard
          label="Highest score"
          value={statistics.overall.highestGameTotalScore ?? "-"}
        />
        <SummaryCard
          label="Locked"
          value={statistics.overall.lockedArtifactCount}
        />
        <SummaryCard
          label="Equipped"
          value={statistics.overall.equippedArtifactCount}
        />
      </div>

      <div className="statisticsTables">
        <RatingDistributionTable statistics={statistics} />
        <DistributionTable
          title="Attributes"
          rows={statistics.attributeCounts}
        />
        <DistributionTable title="Kinds" rows={statistics.kindCounts} />
        <SkillStatisticsTable rows={topSkillCounts} />
      </div>
    </section>
  );
}

function DashboardIcon({ name }: { name: DashboardIconName }) {
  return (
    <svg
      className="dashboardIcon"
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path d={DASHBOARD_ICON_PATHS[name]} />
    </svg>
  );
}

function DashboardDialog({
  children,
  onClose,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="dashboardDialog"
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <header>
        <h2>{title}</h2>
        <button
          className="dialogClose"
          type="button"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
      </header>
      <div className="dialogBody">{children}</div>
    </dialog>
  );
}

function formatLocalDateTime(value: string | null): string {
  if (value === null) return "未実施";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未実施";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function IdealSkillEditor({
  configurations,
  errorMessage,
  idealMatchScoreError,
  onSaveConfigurations,
  onSaveIdealMatchScores,
  settings,
}: {
  configurations: IdealSkillConfiguration[];
  errorMessage: string | null;
  idealMatchScoreError: string | null;
  onSaveConfigurations: (
    configurations: IdealSkillConfiguration[],
  ) => Promise<boolean>;
  onSaveIdealMatchScores: (scores: IdealMatchScores) => Promise<boolean>;
  settings: CustomScoreSettings;
}) {
  const idealMatchScoreDialogRef = useRef<HTMLDialogElement>(null);
  const [draftConfigurations, setDraftConfigurations] = useState<
    IdealSkillConfiguration[]
  >(() => configurations.map(cloneIdealSkillConfiguration));
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (!isDirty) {
      setDraftConfigurations(configurations.map(cloneIdealSkillConfiguration));
    }
  }, [configurations, isDirty]);

  const updateConfiguration = (
    configurationId: string,
    update: (configuration: IdealSkillConfiguration) => IdealSkillConfiguration,
  ) => {
    setIsDirty(true);
    setDraftConfigurations((current) =>
      current.map((configuration) =>
        configuration.id === configurationId
          ? update(configuration)
          : configuration,
      ),
    );
  };

  const toggleAttribute = (
    configurationId: string,
    attributeKey: IdealSkillConfiguration["attributeKeys"][number],
  ) => {
    updateConfiguration(configurationId, (configuration) => ({
      ...configuration,
      attributeKeys: toggleSelectedValue(
        configuration.attributeKeys,
        attributeKey,
      ),
    }));
  };

  const toggleKind = (
    configurationId: string,
    kindKey: IdealSkillConfiguration["kindKeys"][number],
  ) => {
    updateConfiguration(configurationId, (configuration) => ({
      ...configuration,
      kindKeys: toggleSelectedValue(configuration.kindKeys, kindKey),
    }));
  };

  const addConfiguration = () => {
    setIsDirty(true);
    setDraftConfigurations((current) => [
      ...current,
      createEmptyIdealSkillConfiguration(`ideal-${crypto.randomUUID()}`),
    ]);
  };

  const saveConfigurations = async () => {
    if (await onSaveConfigurations(draftConfigurations)) {
      setIsDirty(false);
    }
  };

  const saveMatchScores = async (scores: IdealMatchScores) => {
    if (await onSaveIdealMatchScores(scores)) {
      idealMatchScoreDialogRef.current?.close();
    }
  };

  return (
    <section className="idealSkillEditor" aria-label="理想スキル">
      <div className="idealSkillEditorHeader">
        <div>
          <h3>理想スキル構成</h3>
          <p className="mutedText">
            未選択のスキル枠は、どのスキルでも一致として扱います。
          </p>
        </div>
        <div className="idealSkillEditorActions">
          <button
            type="button"
            onClick={() => idealMatchScoreDialogRef.current?.showModal()}
          >
            <DashboardIcon name="score" />
            一致数スコア設定
          </button>
          <button type="button" onClick={addConfiguration}>
            <DashboardIcon name="add" />
            構成を追加
          </button>
        </div>
      </div>
      <dialog
        className="idealMatchScoreDialog"
        ref={idealMatchScoreDialogRef}
        aria-labelledby="ideal-match-score-dialog-title"
      >
        <div className="idealMatchScoreDialogHeader">
          <h3 id="ideal-match-score-dialog-title">一致数スコア設定</h3>
          <button
            type="button"
            onClick={() => idealMatchScoreDialogRef.current?.close()}
          >
            閉じる
          </button>
        </div>
        <IdealMatchScoreEditor
          errorMessage={idealMatchScoreError}
          onSave={saveMatchScores}
          settings={settings}
        />
      </dialog>
      {draftConfigurations.length === 0 ? (
        <p className="mutedText">理想構成が登録されていません。</p>
      ) : (
        <div className="tableScroller idealConfigurationTableScroller">
          <table className="idealConfigurationTable">
            <thead>
              <tr>
                <th>操作</th>
                <th>No.</th>
                <th>属性</th>
                <th>武器種</th>
                <th>1～2枠①</th>
                <th>1～2枠②</th>
                <th>3枠</th>
                <th>4枠</th>
                <th>コメント</th>
              </tr>
            </thead>
            <tbody>
              {draftConfigurations.map((configuration, index) => (
                <tr key={configuration.id}>
                  <td>
                    <button
                      className="iconOnlyButton"
                      aria-label={`理想構成${index + 1}を削除`}
                      type="button"
                      onClick={() => {
                        setIsDirty(true);
                        setDraftConfigurations((current) =>
                          current.filter(
                            (item) => item.id !== configuration.id,
                          ),
                        );
                      }}
                    >
                      <DashboardIcon name="delete" />
                    </button>
                  </td>
                  <td className="idealConfigurationNumber">{index + 1}</td>
                  <td>
                    <IdealConditionSelector
                      label="属性"
                      options={ARTIFACT_ATTRIBUTE_OPTIONS}
                      selectedKeys={configuration.attributeKeys}
                      onToggle={(key) => toggleAttribute(configuration.id, key)}
                    />
                  </td>
                  <td>
                    <IdealConditionSelector
                      label="武器種"
                      options={ARTIFACT_KIND_OPTIONS}
                      selectedKeys={configuration.kindKeys}
                      onToggle={(key) => toggleKind(configuration.id, key)}
                    />
                  </td>
                  <td>
                    <IdealSkillSelect
                      label="1～2枠（1つ目）"
                      options={IDEAL_FIRST_SECOND_SLOT_OPTIONS}
                      value={configuration.firstSecondSlotSkillKeys[0]}
                      onChange={(skillKey) =>
                        updateConfiguration(configuration.id, (current) => ({
                          ...current,
                          firstSecondSlotSkillKeys: [
                            skillKey,
                            current.firstSecondSlotSkillKeys[1],
                          ],
                        }))
                      }
                    />
                  </td>
                  <td>
                    <IdealSkillSelect
                      label="1～2枠（2つ目）"
                      options={IDEAL_FIRST_SECOND_SLOT_OPTIONS}
                      value={configuration.firstSecondSlotSkillKeys[1]}
                      onChange={(skillKey) =>
                        updateConfiguration(configuration.id, (current) => ({
                          ...current,
                          firstSecondSlotSkillKeys: [
                            current.firstSecondSlotSkillKeys[0],
                            skillKey,
                          ],
                        }))
                      }
                    />
                  </td>
                  <td>
                    <IdealSkillSelect
                      label="3枠"
                      options={IDEAL_THIRD_SLOT_OPTIONS}
                      value={configuration.thirdSlotSkillKey}
                      onChange={(skillKey) =>
                        updateConfiguration(configuration.id, (current) => ({
                          ...current,
                          thirdSlotSkillKey: skillKey,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <IdealSkillSelect
                      label="4枠"
                      options={IDEAL_FOURTH_SLOT_OPTIONS}
                      value={configuration.fourthSlotSkillKey}
                      onChange={(skillKey) =>
                        updateConfiguration(configuration.id, (current) => ({
                          ...current,
                          fourthSlotSkillKey: skillKey,
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      className="idealConfigurationComment"
                      type="text"
                      value={configuration.comment}
                      placeholder="コメントを入力"
                      aria-label={`理想構成${index + 1}のコメント`}
                      onChange={(event) =>
                        updateConfiguration(configuration.id, (current) => ({
                          ...current,
                          comment: event.currentTarget.value,
                        }))
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <button
        className="scoreSaveButton"
        type="button"
        onClick={() => void saveConfigurations()}
      >
        <DashboardIcon name="save" />
        理想構成を保存
      </button>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
}

function IdealConditionSelector<T extends string>({
  label,
  onToggle,
  options,
  selectedKeys,
}: {
  label: string;
  onToggle: (key: T) => void;
  options: ReadonlyArray<{ key: T; label: string }>;
  selectedKeys: T[];
}) {
  const selectedLabels = options
    .filter((option) => selectedKeys.includes(option.key))
    .map((option) => option.label);
  const summary =
    selectedLabels.length === options.length
      ? "すべて"
      : selectedLabels.length === 0
        ? "未選択"
        : selectedLabels.join("・");

  return (
    <details className="idealConditionSelector">
      <summary title={`${label}: ${summary}`}>{summary}</summary>
      <fieldset className="idealConditionOptions">
        <legend className="visuallyHidden">{label}</legend>
        {options.map((option) => (
          <label key={option.key}>
            <input
              checked={selectedKeys.includes(option.key)}
              type="checkbox"
              onChange={() => onToggle(option.key)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </details>
  );
}

function IdealSkillSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (skillKey: string | null) => void;
  options: readonly IdealSkillOption[];
  value: string | null;
}) {
  return (
    <label className="idealSkillTableSelect">
      <span className="visuallyHidden">{label}</span>
      <select
        title={label}
        value={value ?? ""}
        onChange={(event) =>
          onChange(
            event.currentTarget.value.length === 0
              ? null
              : event.currentTarget.value,
          )
        }
      >
        <option value="">未選択（どのスキルでも一致）</option>
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label.replaceAll("&", "/")}
          </option>
        ))}
      </select>
    </label>
  );
}

function cloneIdealSkillConfiguration(
  configuration: IdealSkillConfiguration,
): IdealSkillConfiguration {
  return {
    ...configuration,
    attributeKeys: [...configuration.attributeKeys],
    kindKeys: [...configuration.kindKeys],
    firstSecondSlotSkillKeys: [
      configuration.firstSecondSlotSkillKeys[0],
      configuration.firstSecondSlotSkillKeys[1],
    ],
  };
}

function toggleSelectedValue<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((current) => current !== value)
    : [...values, value];
}

function IdealMatchScoreEditor({
  errorMessage,
  onSave,
  settings,
}: {
  errorMessage: string | null;
  onSave: (scores: IdealMatchScores) => Promise<void>;
  settings: CustomScoreSettings;
}) {
  const [draftScores, setDraftScores] = useState<IdealMatchScores>(() => ({
    ...settings.idealMatchScores,
  }));

  useEffect(() => {
    setDraftScores({ ...settings.idealMatchScores });
  }, [settings.idealMatchScores]);

  const updateDraftScore = (matchCount: 1 | 2 | 3 | 4, value: string) => {
    const parsedValue = Number.parseInt(value, 10);

    setDraftScores((current) => ({
      ...current,
      [matchCount]: Number.isNaN(parsedValue) ? 0 : parsedValue,
    }));
  };

  return (
    <section className="idealMatchScoreEditor" aria-label="一致数スコア">
      <p className="mutedText">
        理想スキルの一致数ごとの基礎スコアです。スキルクオリティ補正は、この基礎スコアへ後から適用されます。
      </p>
      <div className="idealMatchScoreGrid">
        {([1, 2, 3, 4] as const).map((matchCount) => (
          <label key={matchCount}>
            {matchCount} / 4 一致
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={draftScores[matchCount]}
              onChange={(event) =>
                updateDraftScore(matchCount, event.currentTarget.value)
              }
            />
          </label>
        ))}
      </div>
      <button type="button" onClick={() => onSave({ ...draftScores })}>
        一致数スコアを保存
      </button>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
}

const TABLE_RANKS = ["a", "b", "c", "d", "e"] as const;

function TableRankPenaltySettings({
  errorMessage,
  onSave,
  penalties,
}: {
  errorMessage: string | null;
  onSave: (penalties: TableRankPenalties) => Promise<boolean>;
  penalties: TableRankPenalties;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draftPenalties, setDraftPenalties] = useState<TableRankPenalties>({
    ...penalties,
  });
  const [isSaving, setIsSaving] = useState(false);

  const openDialog = () => {
    setDraftPenalties({ ...penalties });
    dialogRef.current?.showModal();
  };

  const savePenalties = async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      if (await onSave({ ...draftPenalties })) {
        dialogRef.current?.close();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="tableRankPenaltySettings" aria-label="共通補正">
      <div>
        <h3>共通補正スコア</h3>
        <p className="mutedText">
          スキルクオリティに応じた減点を、理想構成とスキルスコアの両方へ適用します。
        </p>
      </div>
      <button type="button" onClick={openDialog}>
        <DashboardIcon name="score" />
        スキルクオリティ減点を設定
      </button>
      <dialog
        aria-labelledby="table-rank-penalty-dialog-title"
        className="tableRankPenaltyDialog"
        onCancel={(event) => {
          if (isSaving) {
            event.preventDefault();
          }
        }}
        ref={dialogRef}
      >
        <div className="idealMatchScoreDialogHeader">
          <div>
            <p className="eyebrow">共通補正</p>
            <h3 id="table-rank-penalty-dialog-title">スキルクオリティ減点</h3>
          </div>
          <button
            aria-label="閉じる"
            className="dialogCloseButton"
            disabled={isSaving}
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <p className="mutedText">
          Aは減点なしです。B～Eは各スキルの基礎点から減算し、スコアは0未満になりません。A
          ≦ B ≦ C ≦ D ≦ Eの順で設定してください。
        </p>
        <div className="tableRankPenaltyGrid">
          {TABLE_RANKS.map((rank) => (
            <label className="skillScoreSlider" key={rank}>
              <span>クオリティ {rank.toUpperCase()}</span>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                disabled={isSaving || rank === "a"}
                value={draftPenalties[rank]}
                onChange={(event) =>
                  setDraftPenalties((current) => ({
                    ...current,
                    [rank]: Number.parseInt(event.currentTarget.value, 10),
                  }))
                }
              />
              <output>{rank === "a" ? 0 : draftPenalties[rank]}</output>
            </label>
          ))}
        </div>
        {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
        <div className="idealMatchScoreDialogActions">
          <button
            type="button"
            disabled={isSaving}
            onClick={() => dialogRef.current?.close()}
          >
            キャンセル
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void savePenalties()}
          >
            {isSaving ? "保存中..." : "保存"}
          </button>
        </div>
      </dialog>
    </section>
  );
}

function SkillScoreEditor({
  errorMessage,
  onSave,
  skillScores,
}: {
  errorMessage: string | null;
  onSave: (skillScores: SkillScores) => Promise<boolean>;
  skillScores: SkillScores;
}) {
  const [activeTab, setActiveTab] =
    useState<keyof SkillScores>("firstSecondSlot");
  const [draftSkillScores, setDraftSkillScores] = useState<SkillScores>(() =>
    cloneSkillScores(skillScores),
  );
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const draftRevisionRef = useRef(0);
  const activeOptions = getSkillScoreOptions(activeTab);
  const activeEntries = draftSkillScores[activeTab];

  useEffect(() => {
    if (!isDirty) {
      setDraftSkillScores(cloneSkillScores(skillScores));
      draftRevisionRef.current = 0;
    }
  }, [isDirty, skillScores]);

  const updateScore = (skillKey: string, score: number) => {
    draftRevisionRef.current += 1;
    setIsDirty(true);
    setDraftSkillScores((current) => ({
      ...current,
      [activeTab]: current[activeTab].map((entry) =>
        entry.skillKey === skillKey ? { ...entry, score } : entry,
      ),
    }));
  };

  const saveScores = async () => {
    if (isSaving) {
      return;
    }

    const submittedRevision = draftRevisionRef.current;
    setIsSaving(true);

    try {
      if (
        (await onSave(draftSkillScores)) &&
        draftRevisionRef.current === submittedRevision
      ) {
        setIsDirty(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkillScoreTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % SKILL_SCORE_TABS.length;
    } else if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + SKILL_SCORE_TABS.length) % SKILL_SCORE_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = SKILL_SCORE_TABS.length - 1;
    }

    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = SKILL_SCORE_TABS[nextIndex];
    if (nextTab === undefined) return;
    setActiveTab(nextTab.key);
    document.getElementById(`skill-score-tab-${nextTab.key}`)?.focus();
  };

  return (
    <section className="skillScoreEditor" aria-label="スキルスコア">
      <h3>スキル別スコア</h3>
      <p className="mutedText">
        各スキルの基礎点を0～25で設定します。4枠の合計基礎点は最大100です。
      </p>
      <div className="skillScoreTabs" role="tablist" aria-label="スキル枠">
        {SKILL_SCORE_TABS.map((tab, index) => (
          <button
            id={`skill-score-tab-${tab.key}`}
            className={tab.key === activeTab ? "active" : undefined}
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === activeTab}
            aria-controls={`skill-score-panel-${tab.key}`}
            tabIndex={tab.key === activeTab ? 0 : -1}
            onClick={() => setActiveTab(tab.key)}
            onKeyDown={(event) => handleSkillScoreTabKeyDown(event, index)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        id={`skill-score-panel-${activeTab}`}
        className="skillScoreGrid"
        role="tabpanel"
        aria-labelledby={`skill-score-tab-${activeTab}`}
      >
        {activeOptions.map((option) => {
          const score =
            activeEntries.find((entry) => entry.skillKey === option.key)
              ?.score ?? 0;

          return (
            <label className="skillScoreSlider" key={option.key}>
              <span title={option.label}>{option.label}</span>
              <input
                type="range"
                min={0}
                max={25}
                step={1}
                value={score}
                onChange={(event) =>
                  updateScore(
                    option.key,
                    Number.parseInt(event.currentTarget.value, 10),
                  )
                }
              />
              <output>{score}</output>
            </label>
          );
        })}
      </div>
      <button
        className="scoreSaveButton"
        type="button"
        disabled={isSaving}
        onClick={() => void saveScores()}
      >
        <DashboardIcon name="save" />
        {isSaving ? "保存中..." : "スキルスコアを保存"}
      </button>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
}

const SKILL_SCORE_TABS: ReadonlyArray<{
  key: keyof SkillScores;
  label: string;
}> = [
  { key: "firstSecondSlot", label: "1～2枠" },
  { key: "thirdSlot", label: "3枠" },
  { key: "fourthSlot", label: "4枠" },
];

function getSkillScoreOptions(
  tab: keyof SkillScores,
): readonly IdealSkillOption[] {
  if (tab === "firstSecondSlot") {
    return IDEAL_FIRST_SECOND_SLOT_OPTIONS;
  }
  if (tab === "thirdSlot") {
    return IDEAL_THIRD_SLOT_OPTIONS;
  }

  return IDEAL_FOURTH_SLOT_OPTIONS;
}

function cloneSkillScores(skillScores: SkillScores): SkillScores {
  return {
    firstSecondSlot: skillScores.firstSecondSlot.map((entry) => ({ ...entry })),
    thirdSlot: skillScores.thirdSlot.map((entry) => ({ ...entry })),
    fourthSlot: skillScores.fourthSlot.map((entry) => ({ ...entry })),
  };
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="summaryCard">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function RatingDistributionTable({
  statistics,
}: {
  statistics: ArtifactStatistics;
}) {
  return (
    <div className="compactTable">
      <h4>Ratings</h4>
      <table>
        <thead>
          <tr>
            <th>Rating</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          {([0, 1, 2, 3, 4, 5] as const).map((rating) => (
            <tr key={rating}>
              <td>{rating}</td>
              <td>{statistics.ratingCounts[rating]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DistributionTable({
  title,
  rows,
}: {
  title: string;
  rows: ArtifactStatistics["attributeCounts"];
}) {
  return (
    <div className="compactTable">
      <h4>{title}</h4>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Total</th>
            <th>Possibly deleted</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={3}>No data</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{row.count}</td>
                <td>{row.possiblyDeletedCount}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function SkillStatisticsTable({
  rows,
}: {
  rows: ArtifactStatistics["skillCounts"];
}) {
  return (
    <div className="compactTable">
      <h4>Top Skills</h4>
      <table>
        <thead>
          <tr>
            <th>Skill</th>
            <th>Count</th>
            <th>Max</th>
            <th>Average</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4}>No data</td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.count}</td>
                <td>{formatOptionalNumber(row.maxNumericEffectValue)}</td>
                <td>{formatOptionalNumber(row.averageNumericEffectValue)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

type FilterSkillGroup = "firstSecondSlot" | "thirdSlot" | "fourthSlot";

const FILTER_SKILL_GROUPS: ReadonlyArray<{
  key: FilterSkillGroup;
  conditionKey: keyof SkillFilterCondition;
  label: string;
  options: readonly IdealSkillOption[];
}> = [
  {
    key: "firstSecondSlot",
    conditionKey: "firstSecondSlotKeys",
    label: "枠1～2",
    options: IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  },
  {
    key: "thirdSlot",
    conditionKey: "thirdSlotKeys",
    label: "枠3",
    options: IDEAL_THIRD_SLOT_OPTIONS,
  },
  {
    key: "fourthSlot",
    conditionKey: "fourthSlotKeys",
    label: "枠4",
    options: IDEAL_FOURTH_SLOT_OPTIONS,
  },
];
const FILTER_CONDITION_IDS = [
  "condition-1",
  "condition-2",
  "condition-3",
] as const;

function ArtifactFilterEditor({
  filters,
  onApply,
  onCancel,
}: {
  filters: ArtifactFilters;
  onApply: (filters: ArtifactFilters) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState<ArtifactFilters>(filters);
  const [activeSkillGroups, setActiveSkillGroups] = useState<
    [FilterSkillGroup, FilterSkillGroup, FilterSkillGroup]
  >(["firstSecondSlot", "firstSecondSlot", "firstSecondSlot"]);

  const toggleSelection = (
    field: "attributeKeys" | "kindKeys",
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      [field]: current[field].includes(value)
        ? current[field].filter((candidate) => candidate !== value)
        : [...current[field], value],
    }));
  };

  const updateSkillCondition = (
    conditionIndex: number,
    conditionKey: keyof SkillFilterCondition,
    skillKey: NormalizedSkillKey,
  ) => {
    setDraft((current) => {
      const condition = current.skillConditions[conditionIndex];
      if (condition === undefined) return current;
      const selectedKeys = condition[conditionKey];
      const nextCondition = {
        ...condition,
        [conditionKey]: selectedKeys.includes(skillKey)
          ? selectedKeys.filter((candidate) => candidate !== skillKey)
          : [...selectedKeys, skillKey],
      };
      const [first, second, third] = current.skillConditions;
      const skillConditions: ArtifactFilters["skillConditions"] =
        conditionIndex === 0
          ? [nextCondition, second, third]
          : conditionIndex === 1
            ? [first, nextCondition, third]
            : [first, second, nextCondition];
      return { ...current, skillConditions };
    });
  };

  return (
    <section
      className="artifactFilterEditor"
      aria-label="アーティファクトの絞り込み"
    >
      <FilterOptionSection title="属性">
        {ARTIFACT_ATTRIBUTE_OPTIONS.map((option) => (
          <FilterCheckbox
            checked={draft.attributeKeys.includes(option.key)}
            iconPath={`elements/${ATTRIBUTE_ICON_FILE_NAMES[option.key]}`}
            key={option.key}
            label={option.label}
            onChange={() => toggleSelection("attributeKeys", option.key)}
          />
        ))}
      </FilterOptionSection>

      <FilterOptionSection title="武器種">
        {ARTIFACT_KIND_OPTIONS.map((option) => (
          <FilterCheckbox
            checked={draft.kindKeys.includes(option.key)}
            iconPath={`weapons/${WEAPON_ICON_FILE_NAMES[option.key]}`}
            key={option.key}
            label={option.label}
            onChange={() => toggleSelection("kindKeys", option.key)}
          />
        ))}
      </FilterOptionSection>

      <DualRangeFilter
        label="スコア"
        min={0}
        max={100}
        value={draft.scoreRange}
        onChange={(scoreRange) =>
          setDraft((current) => ({ ...current, scoreRange }))
        }
      />
      <DualRangeFilter
        label="評価"
        min={0}
        max={5}
        value={draft.ratingRange}
        valueFormatter={(value) => (value === 0 ? "未評価" : `★${value}`)}
        onChange={(ratingRange) =>
          setDraft((current) => ({ ...current, ratingRange }))
        }
      />

      <section className="filterSkillSection">
        <h3>スキル</h3>
        {draft.skillConditions.map((condition, conditionIndex) => {
          const activeGroup =
            activeSkillGroups[conditionIndex] ?? "firstSecondSlot";
          const group = FILTER_SKILL_GROUPS.find(
            (candidate) => candidate.key === activeGroup,
          );
          if (group === undefined) return null;
          const selectedCount = Object.values(condition).flat().length;

          return (
            <details
              key={FILTER_CONDITION_IDS[conditionIndex]}
              open={conditionIndex === 0}
            >
              <summary>
                条件{conditionIndex + 1}
                {selectedCount > 0 ? `（${selectedCount}件）` : ""}
              </summary>
              <div className="filterSkillCondition">
                <div
                  className="filterSkillTabs"
                  role="tablist"
                  aria-label={`条件${conditionIndex + 1}の枠`}
                >
                  {FILTER_SKILL_GROUPS.map((candidate) => (
                    <button
                      className={candidate.key === activeGroup ? "active" : ""}
                      key={candidate.key}
                      type="button"
                      role="tab"
                      aria-selected={candidate.key === activeGroup}
                      onClick={() =>
                        setActiveSkillGroups((current) => {
                          const [first, second, third] = current;
                          return conditionIndex === 0
                            ? [candidate.key, second, third]
                            : conditionIndex === 1
                              ? [first, candidate.key, third]
                              : [first, second, candidate.key];
                        })
                      }
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
                <div className="filterSkillOptions">
                  {group.options.map((option) => (
                    <label key={option.key}>
                      <input
                        type="checkbox"
                        checked={condition[group.conditionKey].includes(
                          option.key,
                        )}
                        onChange={() =>
                          updateSkillCondition(
                            conditionIndex,
                            group.conditionKey,
                            option.key,
                          )
                        }
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
                <p className="filterHint">
                  この条件内では、選択したスキルのいずれかに一致（OR）
                </p>
              </div>
            </details>
          );
        })}
        <p className="filterHint">
          条件1～3のうち、設定された条件はすべて一致（AND）
        </p>
      </section>

      <details className="filterOtherConditions">
        <summary>その他の条件</summary>
        <div className="filterGrid">
          <label>
            検索
            <input
              type="search"
              value={draft.searchText}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  searchText: event.currentTarget.value,
                }))
              }
              placeholder="名前、スキル、装備キャラ"
            />
          </label>
          <FilterSelect
            label="お気に入り（ゲーム内）"
            value={draft.locked}
            options={[
              ["all", "すべて"],
              ["locked", "お気に入り"],
              ["unlocked", "お気に入り以外"],
            ]}
            onChange={(locked) =>
              setDraft((current) => ({
                ...current,
                locked: locked as LockedFilter,
              }))
            }
          />
          <FilterSelect
            label="装備状態（ゲーム内）"
            value={draft.equipped}
            options={[
              ["all", "すべて"],
              ["equipped", "装備中"],
              ["unequipped", "未装備"],
            ]}
            onChange={(equipped) =>
              setDraft((current) => ({
                ...current,
                equipped: equipped as EquippedFilter,
              }))
            }
          />
          <FilterSelect
            label="所持状態"
            value={draft.lifecycle}
            options={[
              ["all", "すべて"],
              ["active", "所持中"],
              ["possiblyDeleted", "解体済み?"],
            ]}
            onChange={(lifecycle) =>
              setDraft((current) => ({
                ...current,
                lifecycle: lifecycle as LifecycleFilter,
              }))
            }
          />
        </div>
      </details>

      <div className="dialogActions">
        <button
          type="button"
          onClick={() => setDraft(createDefaultArtifactFilters())}
        >
          デフォルト
        </button>
        <button type="button" onClick={() => onApply(draft)}>
          適用
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </section>
  );
}

function FilterOptionSection({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <fieldset className="filterOptionSection">
      <legend>{title}</legend>
      <div className="filterOptionGrid">{children}</div>
    </fieldset>
  );
}

function FilterCheckbox({
  checked,
  iconPath,
  label,
  onChange,
}: {
  checked: boolean;
  iconPath: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="filterIconOption">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <img src={chrome.runtime.getURL(iconPath)} alt="" />
      <span>{label}</span>
    </label>
  );
}

function DualRangeFilter({
  label,
  max,
  min,
  onChange,
  value,
  valueFormatter = String,
}: {
  label: string;
  max: number;
  min: number;
  onChange: (value: [number, number]) => void;
  value: [number, number];
  valueFormatter?: (value: number) => string;
}) {
  const lowerPosition = ((value[0] - min) / (max - min)) * 100;
  const upperPosition = ((value[1] - min) / (max - min)) * 100;

  return (
    <section className="dualRangeFilter">
      <div className="dualRangeHeader">
        <h3>{label}</h3>
        <output>
          {valueFormatter(value[0])}以上 {valueFormatter(value[1])}以下
        </output>
      </div>
      <div className="dualRangeControl">
        <div className="dualRangeRail" />
        <div
          className="dualRangeSelection"
          style={{
            left: `${lowerPosition}%`,
            right: `${100 - upperPosition}%`,
          }}
        />
        <input
          type="range"
          aria-label={`${label}の下限`}
          min={min}
          max={max}
          value={value[0]}
          onChange={(event) =>
            onChange([
              Math.min(Number(event.currentTarget.value), value[1]),
              value[1],
            ])
          }
        />
        <input
          type="range"
          aria-label={`${label}の上限`}
          min={min}
          max={max}
          value={value[1]}
          onChange={(event) =>
            onChange([
              value[0],
              Math.max(Number(event.currentTarget.value), value[0]),
            ])
          }
        />
      </div>
    </section>
  );
}

function FilterSelect({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<readonly [string, string]>;
  value: string;
}) {
  return (
    <label>
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option value={optionValue} key={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function SortSelect({
  onSortChange,
  sort,
}: {
  onSortChange: (sort: ArtifactSort) => void;
  sort: ArtifactSort;
}) {
  return (
    <select
      aria-label="並び替え"
      value={`${sort.key}:${sort.direction}`}
      onChange={(event) => {
        const [key, direction] = event.currentTarget.value.split(":");
        onSortChange({
          key: key as SortKey,
          direction: direction as SortDirection,
        });
      }}
    >
      <option value="totalScore:desc">ゲーム内スコア降順</option>
      <option value="totalScore:asc">ゲーム内スコア昇順</option>
      <option value="ownedId:desc">最近入手した順</option>
      <option value="ownedId:asc">古い順</option>
      <option value="rating:asc">評価昇順</option>
      <option value="rating:desc">評価降順</option>
      <option value="customScore:desc">カスタムスコア降順</option>
      <option value="customScore:asc">カスタムスコア昇順</option>
      <option value="attributeOrder:asc">属性順(火→闇)</option>
      <option value="kindOrder:asc">武器種順(剣→刀)</option>
    </select>
  );
}

type SkillHighlightGroup = "firstSecondSlot" | "thirdSlot" | "fourthSlot";

const SKILL_HIGHLIGHT_GROUPS: ReadonlyArray<{
  key: SkillHighlightGroup;
  label: string;
  options: readonly IdealSkillOption[];
}> = [
  {
    key: "firstSecondSlot",
    label: "1～2枠",
    options: IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  },
  { key: "thirdSlot", label: "3枠", options: IDEAL_THIRD_SLOT_OPTIONS },
  { key: "fourthSlot", label: "4枠", options: IDEAL_FOURTH_SLOT_OPTIONS },
];

function SkillHighlightEditor({
  errorMessage,
  onCancel,
  onSave,
  settings,
}: {
  errorMessage: string | null;
  onCancel: () => void;
  onSave: (settings: SkillHighlightSettings) => void;
  settings: SkillHighlightSettings;
}) {
  const [activeGroup, setActiveGroup] =
    useState<SkillHighlightGroup>("firstSecondSlot");
  const [draftSettings, setDraftSettings] =
    useState<SkillHighlightSettings>(settings);
  const activeOptions =
    SKILL_HIGHLIGHT_GROUPS.find((group) => group.key === activeGroup)
      ?.options ?? [];

  const handleTabKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    currentGroup: SkillHighlightGroup,
  ) => {
    const currentIndex = SKILL_HIGHLIGHT_GROUPS.findIndex(
      (group) => group.key === currentGroup,
    );
    let nextIndex = currentIndex;

    if (event.key === "ArrowRight") nextIndex = currentIndex + 1;
    else if (event.key === "ArrowLeft") nextIndex = currentIndex - 1;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = SKILL_HIGHLIGHT_GROUPS.length - 1;
    else return;

    event.preventDefault();
    const nextGroup =
      SKILL_HIGHLIGHT_GROUPS[
        (nextIndex + SKILL_HIGHLIGHT_GROUPS.length) %
          SKILL_HIGHLIGHT_GROUPS.length
      ];
    if (nextGroup === undefined) return;
    setActiveGroup(nextGroup.key);
    document.getElementById(`skill-highlight-tab-${nextGroup.key}`)?.focus();
  };

  const updateHighlight = (
    skillKey: NormalizedSkillKey,
    color: string | null,
  ) => {
    setDraftSettings((current) => {
      const next = { ...current };

      if (color === null) {
        delete next[skillKey];
      } else {
        next[skillKey] = color;
      }

      return next;
    });
  };

  return (
    <div className="skillHighlightEditor">
      <p className="mutedText">
        強調するスキルを有効にし、スキルごとの背景色を選択してください。
      </p>
      {errorMessage !== null && (
        <p className="errorText" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="skillHighlightTabs" role="tablist" aria-label="スキル枠">
        {SKILL_HIGHLIGHT_GROUPS.map((group) => (
          <button
            id={`skill-highlight-tab-${group.key}`}
            className={activeGroup === group.key ? "active" : ""}
            type="button"
            role="tab"
            aria-controls="skill-highlight-panel"
            aria-selected={activeGroup === group.key}
            tabIndex={activeGroup === group.key ? 0 : -1}
            key={group.key}
            onClick={() => setActiveGroup(group.key)}
            onKeyDown={(event) => handleTabKeyDown(event, group.key)}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div
        id="skill-highlight-panel"
        className="skillHighlightList"
        role="tabpanel"
        aria-labelledby={`skill-highlight-tab-${activeGroup}`}
      >
        {activeOptions.map((option) => {
          const color = draftSettings[option.key];
          const isEnabled = color !== undefined;

          return (
            <div className="skillHighlightRow" key={option.key}>
              <label>
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(event) =>
                    updateHighlight(
                      option.key,
                      event.currentTarget.checked
                        ? DEFAULT_SKILL_HIGHLIGHT_COLOR
                        : null,
                    )
                  }
                />
                <span>{option.label}</span>
              </label>
              <input
                type="color"
                aria-label={`${option.label}のハイライトカラー`}
                disabled={!isEnabled}
                value={color ?? DEFAULT_SKILL_HIGHLIGHT_COLOR}
                onChange={(event) =>
                  updateHighlight(option.key, event.currentTarget.value)
                }
              />
            </div>
          );
        })}
      </div>
      <div className="dialogActions">
        <button type="button" onClick={() => setDraftSettings({})}>
          すべて解除
        </button>
        <button type="button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="button" onClick={() => onSave(draftSettings)}>
          適用
        </button>
      </div>
    </div>
  );
}

function ArtifactTable({
  rows,
  skillHighlightSettings,
  onMemoBlur,
  onMemoChange,
  onRatingChange,
}: {
  rows: ReviewedArtifactRow[];
  skillHighlightSettings: SkillHighlightSettings;
  onMemoBlur: (row: ReviewedArtifactRow) => void;
  onMemoChange: (ownedId: number, memo: string) => void;
  onRatingChange: (
    row: ReviewedArtifactRow,
    rating: ArtifactUserRating,
  ) => void;
}) {
  return (
    <div className="tableScroller artifactTableScroller">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th aria-label="アイコン" />
            <th>Lv</th>
            <th>スキル</th>
            <th>スコア</th>
            <th>評価</th>
            <th>コメント</th>
            <th>latest</th>
            <th>装備キャラ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { artifact, review } = row;

            return (
              <tr key={artifact.ownedId}>
                <td>{artifact.ownedId}</td>
                <td>
                  <ArtifactThumbnail artifact={artifact} />
                </td>
                <td>{artifact.level}</td>
                <td>
                  <ul className="skillList">
                    {artifact.skills.map((skill) => {
                      const highlightColor =
                        skillHighlightSettings[
                          normalizeArtifactSkill(skill).normalizedKey
                        ];

                      return (
                        <li
                          key={skill.slot}
                          className={
                            highlightColor === undefined
                              ? undefined
                              : "highlightedSkill"
                          }
                          style={{
                            backgroundColor: highlightColor,
                            color: getHighlightTextColor(highlightColor),
                          }}
                        >
                          <span className="skillQualityMarker">
                            {formatDisplayedSkillQuality(skill)}.
                          </span>
                          <span>
                            {skill.name} <small>{skill.effectValueText}</small>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </td>
                <td>
                  <CustomScoreCell score={row.customScore} />
                  <small className="gameScore">
                    game {artifact.gameScore.total}
                  </small>
                </td>
                <td>
                  <select
                    className="ratingSelect"
                    aria-label={`${artifact.ownedId}の評価`}
                    value={review?.rating ?? 0}
                    onChange={(event) =>
                      onRatingChange(
                        row,
                        Number.parseInt(
                          event.currentTarget.value,
                          10,
                        ) as ArtifactUserRating,
                      )
                    }
                  >
                    <option value={0}>☆☆☆☆☆</option>
                    <option value={1}>★☆☆☆☆</option>
                    <option value={2}>★★☆☆☆</option>
                    <option value={3}>★★★☆☆</option>
                    <option value={4}>★★★★☆</option>
                    <option value={5}>★★★★★</option>
                  </select>
                </td>
                <td>
                  <input
                    className="memoInput"
                    type="text"
                    value={review?.memo ?? ""}
                    onBlur={() => onMemoBlur(row)}
                    onChange={(event) =>
                      onMemoChange(artifact.ownedId, event.currentTarget.value)
                    }
                  />
                </td>
                <td>{formatLocalDateTime(row.presence?.lastSeenAt ?? null)}</td>
                <td>{artifact.equippedCharacter?.name ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ArtifactThumbnail({ artifact }: { artifact: Artifact }) {
  const [hasImageError, setHasImageError] = useState(false);
  const imageUrl = chrome.runtime.getURL(
    `artifacts/${artifact.artifactTypeId}.png`,
  );
  const attributeIconFileName =
    ATTRIBUTE_ICON_FILE_NAMES[artifact.attribute.raw];
  const weaponIconFileName = WEAPON_ICON_FILE_NAMES[artifact.kind.raw];

  return (
    <div
      className="artifactThumbnail"
      title={`${artifact.attribute.label} / ${formatKindLabel(artifact.kind.label)} / ${artifact.name}`}
    >
      {hasImageError ? (
        <DashboardIcon name="score" />
      ) : (
        <img src={imageUrl} alt="" onError={() => setHasImageError(true)} />
      )}
      {attributeIconFileName === undefined ? (
        <span className="attributeBadge">{artifact.attribute.label}</span>
      ) : (
        <span className="attributeBadge attributeImageBadge">
          <img
            src={chrome.runtime.getURL(`elements/${attributeIconFileName}`)}
            alt={artifact.attribute.label}
          />
        </span>
      )}
      {weaponIconFileName === undefined ? (
        <span className="kindBadge">
          {formatKindLabel(artifact.kind.label).slice(0, 1)}
        </span>
      ) : (
        <span className="kindBadge weaponImageBadge">
          <img
            src={chrome.runtime.getURL(`weapons/${weaponIconFileName}`)}
            alt={formatKindLabel(artifact.kind.label)}
          />
        </span>
      )}
      {(artifact.isLocked || artifact.isMarkedUnnecessaryInGame) && (
        <span className="stateBadge">{artifact.isLocked ? "★" : "!"}</span>
      )}
    </div>
  );
}

function CustomScoreCell({ score }: { score: ScoreResult }) {
  return (
    <div className="customScoreCell" title={formatScoreReasonTitle(score)}>
      <strong>{score.total}</strong>
      <span>{formatScoreRouteLabel(score.selectedRoute)}</span>
      <small>{formatShortScoreReasons(score.reasons)}</small>
    </div>
  );
}

function getFilteredAndSortedArtifactRows(
  rows: ReviewedArtifactRow[],
  filters: ArtifactFilters,
  sort: ArtifactSort,
): ReviewedArtifactRow[] {
  return rows
    .filter((row) => matchesFilters(row, filters))
    .sort((left, right) => compareArtifacts(left, right, sort));
}

function matchesFilters(
  row: ReviewedArtifactRow,
  filters: ArtifactFilters,
): boolean {
  return matchesArtifactFilters(
    {
      artifact: row.artifact,
      customScore: row.customScore.total,
      rating: row.review?.rating ?? 0,
      isPossiblyDeleted: row.presence?.isPossiblyDeleted ?? false,
    },
    filters,
  );
}

function compareArtifacts(
  left: ReviewedArtifactRow,
  right: ReviewedArtifactRow,
  sort: ArtifactSort,
): number {
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "totalScore") {
    return (
      (left.artifact.gameScore.total - right.artifact.gameScore.total) *
      directionMultiplier
    );
  }

  if (sort.key === "ownedId") {
    return (
      (left.artifact.ownedId - right.artifact.ownedId) * directionMultiplier
    );
  }

  if (sort.key === "rating") {
    return (
      ((left.review?.rating ?? 0) - (right.review?.rating ?? 0)) *
      directionMultiplier
    );
  }

  if (sort.key === "customScore") {
    return (
      (left.customScore.total - right.customScore.total) * directionMultiplier
    );
  }

  if (sort.key === "attributeOrder") {
    return (
      compareOrderedValues(
        getAttributeOrder(left.artifact.attribute.label),
        getAttributeOrder(right.artifact.attribute.label),
        left.artifact.ownedId,
        right.artifact.ownedId,
      ) * directionMultiplier
    );
  }

  return (
    compareOrderedValues(
      getKindOrder(left.artifact.kind.label),
      getKindOrder(right.artifact.kind.label),
      left.artifact.ownedId,
      right.artifact.ownedId,
    ) * directionMultiplier
  );
}

function buildArtifactScoreViewModel(args: {
  artifact: Artifact;
  review: ArtifactUserReview | null;
  presence: ArtifactPresence | null;
  scoreSettings: CustomScoreSettings;
}): ReviewedArtifactRow {
  return {
    artifact: args.artifact,
    review: args.review,
    presence: args.presence,
    customScore: evaluateCustomScore({
      artifact: args.artifact,
      settings: args.scoreSettings,
    }),
  };
}

function getDashboardTabClassName(isActive: boolean): string {
  return isActive ? "dashboardTab active" : "dashboardTab";
}

function formatShortScoreReasons(reasons: ScoreReason[]): string {
  const meaningfulReasons = reasons.filter((reason) => reason.delta !== 0);

  if (meaningfulReasons.length === 0) {
    return "-";
  }

  return meaningfulReasons
    .slice(0, 2)
    .map((reason) => reason.label)
    .join(", ");
}

function formatScoreReasonTitle(score: ScoreResult): string {
  if (score.reasons.length === 0) {
    return `ルート: ${formatScoreRouteLabel(score.selectedRoute)}`;
  }

  return score.reasons
    .map((reason) => `${formatSignedDelta(reason.delta)} ${reason.label}`)
    .join("\n");
}

function formatSignedDelta(delta: number): string {
  if (delta > 0) {
    return `+${delta}`;
  }

  return String(delta);
}

function indexReviewsByOwnedId(
  reviews: ArtifactUserReview[],
): Record<number, ArtifactUserReview> {
  const result: Record<number, ArtifactUserReview> = {};

  for (const review of reviews) {
    result[review.ownedId] = review;
  }

  return result;
}

function getAttributeOrder(attributeLabel: string): number {
  const index = ATTRIBUTE_ORDER.indexOf(
    attributeLabel as (typeof ATTRIBUTE_ORDER)[number],
  );

  return index >= 0 ? index : ATTRIBUTE_ORDER.length;
}

function getKindOrder(kindLabel: string): number {
  const index = KIND_ORDER.indexOf(kindLabel as (typeof KIND_ORDER)[number]);

  return index >= 0 ? index : KIND_ORDER.length;
}

function compareOrderedValues(
  leftOrder: number,
  rightOrder: number,
  leftFallback: number,
  rightFallback: number,
): number {
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return rightFallback - leftFallback;
}

function formatKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

function formatDisplayedSkillQuality(
  skill: Pick<Artifact["skills"][number], "isMaxQuality" | "quality">,
): string {
  const quality = inferTableRank(skill);
  return quality?.toUpperCase() ?? "A";
}

function getHighlightTextColor(backgroundColor: string | undefined): string {
  if (backgroundColor === undefined) return "inherit";
  const red = Number.parseInt(backgroundColor.slice(1, 3), 16);
  const green = Number.parseInt(backgroundColor.slice(3, 5), 16);
  const blue = Number.parseInt(backgroundColor.slice(5, 7), 16);
  const luminance = (red * 299 + green * 587 + blue * 114) / 1000;
  return luminance >= 150 ? "#17202a" : "#ffffff";
}

function formatScoreRouteLabel(route: ScoreResult["selectedRoute"]): string {
  if (route === "quirk") {
    return "クァーキー";
  }

  return route === "ideal" ? "理想" : "優先度";
}

function downloadJsonFile(json: string, fileName: string) {
  const blob = new Blob([json], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function createArtifactJsonFileName(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());

  return `gbf-artifacts-${year}${month}${day}-${hours}${minutes}${seconds}.json`;
}

function formatOptionalNumber(value: number | null): string {
  if (value === null) {
    return "-";
  }

  if (Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <React.StrictMode>
      <Dashboard />
    </React.StrictMode>,
  );
}

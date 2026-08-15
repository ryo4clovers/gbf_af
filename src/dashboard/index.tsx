import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertArtifactRowsToCsv } from "../csv/artifactCsv";
import type { Artifact } from "../domain/artifact";
import type {
  ArtifactUserRating,
  ArtifactUserReview,
} from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";
import {
  type CustomScoreSettings,
  DEFAULT_CUSTOM_SCORE_SETTINGS,
  DEFAULT_UNWANTED_SKILL_CONFIG,
  type IdealMatchScores,
  type UnwantedSkillConfig,
  validateIdealMatchScores,
} from "../domain/score/customScoreSettings";
import { evaluateCustomScore } from "../domain/score/evaluateCustomScore";
import type { ScoreReason, ScoreResult } from "../domain/score/scoreResult";
import {
  getSkillCatalogOptions,
  type SkillCatalogOption,
} from "../domain/skill/skillCatalog";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import { useAppStore } from "../state/appState";
import {
  type ArtifactStatistics,
  calculateArtifactStatistics,
} from "../statistics/artifactStatistics";
import "./style.css";

type LockedFilter = "all" | "locked" | "unlocked";
type EquippedFilter = "all" | "equipped" | "unequipped";
type RatingFilter = "all" | "unrated" | "1" | "2" | "3" | "4" | "5";
type LifecycleFilter = "all" | "active" | "possiblyDeleted";
type SortKey =
  | "totalScore"
  | "ownedId"
  | "rating"
  | "customScore"
  | "attributeOrder"
  | "kindOrder";
type SortDirection = "asc" | "desc";
type DashboardTab = "list" | "scoreSettings" | "statistics";
type DashboardTheme = "fantasy" | "cyber";

type ArtifactFilters = {
  searchText: string;
  attribute: string;
  kind: string;
  locked: LockedFilter;
  equipped: EquippedFilter;
  rating: RatingFilter;
  lifecycle: LifecycleFilter;
};

type ArtifactSort = {
  key: SortKey;
  direction: SortDirection;
};

const initialFilters: ArtifactFilters = {
  searchText: "",
  attribute: "all",
  kind: "all",
  locked: "all",
  equipped: "all",
  rating: "all",
  lifecycle: "all",
};

type ReviewedArtifactRow = {
  artifact: Artifact;
  review: ArtifactUserReview | null;
  presence: ArtifactPresence | null;
  customScore: ScoreResult;
};

const skillCatalogOptions = getSkillCatalogOptions();
const DASHBOARD_THEME_STORAGE_KEY = "gbf-af-dashboard-theme";
const ATTRIBUTE_ORDER = ["火", "水", "土", "風", "光", "闇"] as const;
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
  const [unwantedSkillConfig, setUnwantedSkillConfig] =
    useState<UnwantedSkillConfig>(DEFAULT_UNWANTED_SKILL_CONFIG);
  const [scoreSettingsError, setScoreSettingsError] = useState<string | null>(
    null,
  );
  const [selectedIdealSkillKey, setSelectedIdealSkillKey] = useState("");
  const [idealSkillError, setIdealSkillError] = useState<string | null>(null);
  const [idealMatchScoreError, setIdealMatchScoreError] = useState<
    string | null
  >(null);
  const [selectedPrioritySkillKey, setSelectedPrioritySkillKey] = useState("");
  const [prioritySkillError, setPrioritySkillError] = useState<string | null>(
    null,
  );
  const [selectedUnwantedSkillKey, setSelectedUnwantedSkillKey] = useState("");
  const [unwantedSkillError, setUnwantedSkillError] = useState<string | null>(
    null,
  );
  const [filters, setFilters] = useState<ArtifactFilters>(initialFilters);
  const [sort, setSort] = useState<ArtifactSort>({
    key: "totalScore",
    direction: "desc",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading artifacts...");
  const [activeDashboardTab, setActiveDashboardTab] =
    useState<DashboardTab>("list");
  const artifactRows = artifacts.map((artifact) =>
    buildArtifactScoreViewModel({
      artifact,
      review: reviewsByOwnedId[artifact.ownedId] ?? null,
      presence: presenceByOwnedId[artifact.ownedId] ?? null,
      scoreSettings: customScoreSettings,
      unwantedSkillConfig,
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
  const attributeOptions = getAttributeOptions(artifacts);
  const kindOptions = getKindOptions(artifacts);

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
      unwantedSkillConfigResponse,
    ] = await Promise.all([
      sendRuntimeMessage({ type: "GET_STORED_ARTIFACTS" }),
      sendRuntimeMessage({ type: "GET_ARTIFACT_USER_REVIEWS" }),
      sendRuntimeMessage({ type: "GET_ARTIFACT_PRESENCE" }),
      sendRuntimeMessage({ type: "GET_CUSTOM_SCORE_SETTINGS" }),
      sendRuntimeMessage({ type: "GET_UNWANTED_SKILL_CONFIG" }),
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
      setCustomScoreSettings(customScoreSettingsResponse.settings);
    } else {
      setCustomScoreSettings(DEFAULT_CUSTOM_SCORE_SETTINGS);
      setScoreSettingsError("スコア設定を読み込めませんでした。");
    }

    if (
      unwantedSkillConfigResponse.ok &&
      unwantedSkillConfigResponse.type === "UNWANTED_SKILL_CONFIG"
    ) {
      setUnwantedSkillConfig(unwantedSkillConfigResponse.config);
    } else {
      setUnwantedSkillConfig(DEFAULT_UNWANTED_SKILL_CONFIG);
      setUnwantedSkillError("不要スキル設定を読み込めませんでした。");
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

  const exportCsv = () => {
    if (filteredRows.length === 0) {
      setStatusMessage("No artifacts match the current filters.");
      return;
    }

    downloadCsvFile(
      convertArtifactRowsToCsv(
        filteredRows.map((row) => ({
          artifact: row.artifact,
          review: row.review ?? undefined,
          presence: row.presence ?? undefined,
        })),
      ),
      createArtifactCsvFileName(new Date()),
    );
    setStatusMessage(`Exported ${filteredRows.length} artifacts.`);
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
    setError(null);

    const response = await sendRuntimeMessage({
      type: "SAVE_CUSTOM_SCORE_SETTINGS",
      settings,
    });

    if (!response.ok) {
      setError(errorMessage);
      return false;
    }

    if (response.type === "SAVE_CUSTOM_SCORE_SETTINGS_RESULT") {
      setCustomScoreSettings(response.settings);
    }

    return true;
  };

  const saveIdealMatchScores = async (scores: IdealMatchScores) => {
    const validationError = validateIdealMatchScores(scores);

    if (validationError !== null) {
      setIdealMatchScoreError(
        "スコアは0～100の整数で、一致数が増えるほど低くならないように設定してください。",
      );
      return;
    }

    setIdealMatchScoreError(null);
    const settings: CustomScoreSettings = {
      ...customScoreSettings,
      idealMatchScores: scores,
      updatedAt: new Date().toISOString(),
    };

    await saveScoreSettings(
      settings,
      setIdealMatchScoreError,
      "一致数スコアを保存できませんでした。",
    );
  };

  const addIdealSkill = async () => {
    if (selectedIdealSkillKey.length === 0) {
      setIdealSkillError("追加するスキルを選択してください。");
      return;
    }

    if (customScoreSettings.idealSkillKeys.includes(selectedIdealSkillKey)) {
      setIdealSkillError("このスキルはすでに選択されています。");
      return;
    }

    if (customScoreSettings.idealSkillKeys.length >= 4) {
      setIdealSkillError("理想スキルは4つまで選択できます。");
      return;
    }

    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      idealSkillKeys: [
        ...customScoreSettings.idealSkillKeys,
        selectedIdealSkillKey,
      ],
      updatedAt: new Date().toISOString(),
    };

    const didSave = await saveScoreSettings(
      nextSettings,
      setIdealSkillError,
      "理想スキルを保存できませんでした。",
    );

    if (didSave) {
      setSelectedIdealSkillKey("");
    }
  };

  const removeIdealSkill = async (skillKey: string) => {
    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      idealSkillKeys: customScoreSettings.idealSkillKeys.filter(
        (currentSkillKey) => currentSkillKey !== skillKey,
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveScoreSettings(
      nextSettings,
      setIdealSkillError,
      "理想スキルを保存できませんでした。",
    );
  };

  const addPrioritySkill = async () => {
    if (selectedPrioritySkillKey.length === 0) {
      setPrioritySkillError("追加するスキルを選択してください。");
      return;
    }

    if (
      customScoreSettings.skillPriority.some(
        (entry) => entry.skillKey === selectedPrioritySkillKey,
      )
    ) {
      setPrioritySkillError("このスキルはすでに選択されています。");
      return;
    }

    const nextSkillPriority = reassignSkillPriorityRanks([
      ...getSortedSkillPriorityEntries(customScoreSettings.skillPriority),
      {
        skillKey: selectedPrioritySkillKey,
        rank: customScoreSettings.skillPriority.length + 1,
      },
    ]);
    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      skillPriority: nextSkillPriority,
      updatedAt: new Date().toISOString(),
    };

    const didSave = await saveScoreSettings(
      nextSettings,
      setPrioritySkillError,
      "スキル優先度を保存できませんでした。",
    );

    if (didSave) {
      setSelectedPrioritySkillKey("");
    }
  };

  const removePrioritySkill = async (skillKey: string) => {
    const nextSkillPriority = reassignSkillPriorityRanks(
      getSortedSkillPriorityEntries(customScoreSettings.skillPriority).filter(
        (entry) => entry.skillKey !== skillKey,
      ),
    );
    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      skillPriority: nextSkillPriority,
      updatedAt: new Date().toISOString(),
    };

    await saveScoreSettings(
      nextSettings,
      setPrioritySkillError,
      "スキル優先度を保存できませんでした。",
    );
  };

  const movePrioritySkill = async (skillKey: string, direction: -1 | 1) => {
    const sortedSkillPriority = getSortedSkillPriorityEntries(
      customScoreSettings.skillPriority,
    );
    const currentIndex = sortedSkillPriority.findIndex(
      (entry) => entry.skillKey === skillKey,
    );
    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= sortedSkillPriority.length
    ) {
      return;
    }

    const reorderedSkillPriority = [...sortedSkillPriority];
    const currentEntry = reorderedSkillPriority[currentIndex];
    const nextEntry = reorderedSkillPriority[nextIndex];

    if (currentEntry === undefined || nextEntry === undefined) {
      return;
    }

    reorderedSkillPriority[currentIndex] = nextEntry;
    reorderedSkillPriority[nextIndex] = currentEntry;

    const nextSettings: CustomScoreSettings = {
      ...customScoreSettings,
      skillPriority: reassignSkillPriorityRanks(reorderedSkillPriority),
      updatedAt: new Date().toISOString(),
    };

    await saveScoreSettings(
      nextSettings,
      setPrioritySkillError,
      "スキル優先度を保存できませんでした。",
    );
  };

  const saveUnwantedSkills = async (
    config: UnwantedSkillConfig,
  ): Promise<boolean> => {
    setUnwantedSkillError(null);

    const response = await sendRuntimeMessage({
      type: "SAVE_UNWANTED_SKILL_CONFIG",
      config,
    });

    if (!response.ok) {
      setUnwantedSkillError("不要スキルを保存できませんでした。");
      return false;
    }

    if (response.type === "SAVE_UNWANTED_SKILL_CONFIG_RESULT") {
      setUnwantedSkillConfig(response.config);
    }

    return true;
  };

  const addUnwantedSkill = async () => {
    if (selectedUnwantedSkillKey.length === 0) {
      setUnwantedSkillError("追加するスキルを選択してください。");
      return;
    }

    if (unwantedSkillConfig.skillKeys.includes(selectedUnwantedSkillKey)) {
      setUnwantedSkillError("このスキルはすでに選択されています。");
      return;
    }

    const nextConfig: UnwantedSkillConfig = {
      skillKeys: [...unwantedSkillConfig.skillKeys, selectedUnwantedSkillKey],
      updatedAt: new Date().toISOString(),
    };

    const didSave = await saveUnwantedSkills(nextConfig);

    if (didSave) {
      setSelectedUnwantedSkillKey("");
    }
  };

  const removeUnwantedSkill = async (skillKey: string) => {
    const nextConfig: UnwantedSkillConfig = {
      skillKeys: unwantedSkillConfig.skillKeys.filter(
        (currentSkillKey) => currentSkillKey !== skillKey,
      ),
      updatedAt: new Date().toISOString(),
    };

    await saveUnwantedSkills(nextConfig);
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

  return (
    <main className="dashboard">
      <header className="topBar">
        <div>
          <h1>GBF Artifact Manager</h1>
          <p>Local read-only artifact management workspace</p>
        </div>
        <div className="topBarActions">
          <label className="themeSelector">
            Theme
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
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
          >
            Export CSV
          </button>
        </div>
      </header>

      <section className="scanResultSummary" aria-label="スキャン結果">
        <h2>スキャン結果</h2>
        <div className="statusGrid">
          <div>
            <span>アーティファクト数</span>
            <strong>{scan.totalCount ?? "-"}</strong>
          </div>
          <div>
            <span>最終スキャン日時</span>
            <strong>{scan.lastScannedAt ?? "-"}</strong>
          </div>
        </div>
      </section>

      <section className="workspace" aria-label="Artifact management">
        <div className="panel">
          <h2>Artifacts</h2>

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
              onClick={() => setActiveDashboardTab("list")}
            >
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
              onClick={() => setActiveDashboardTab("scoreSettings")}
            >
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
              onClick={() => setActiveDashboardTab("statistics")}
            >
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
              <div className="panelHeader">
                <p>{statusMessage}</p>
                <button
                  type="button"
                  onClick={loadArtifacts}
                  disabled={isLoading}
                >
                  {isLoading ? "Loading..." : "Refresh"}
                </button>
              </div>

              <ArtifactControls
                artifactCount={artifacts.length}
                attributeOptions={attributeOptions}
                filteredCount={filteredRows.length}
                filters={filters}
                kindOptions={kindOptions}
                onFiltersChange={setFilters}
                onSortChange={setSort}
                sort={sort}
              />

              {artifacts.length === 0 ? (
                <p className="emptyState">No stored artifacts found.</p>
              ) : (
                <ArtifactTable
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
              {scoreSettingsError !== null && (
                <p className="errorText">{scoreSettingsError}</p>
              )}
              <IdealSkillEditor
                errorMessage={idealSkillError}
                idealSkillKeys={customScoreSettings.idealSkillKeys}
                onAddSkill={addIdealSkill}
                onRemoveSkill={removeIdealSkill}
                onSelectedSkillChange={setSelectedIdealSkillKey}
                options={skillCatalogOptions}
                selectedSkillKey={selectedIdealSkillKey}
              />
              <IdealMatchScoreEditor
                errorMessage={idealMatchScoreError}
                onSave={saveIdealMatchScores}
                settings={customScoreSettings}
              />
              <SkillPriorityEditor
                errorMessage={prioritySkillError}
                onAddSkill={addPrioritySkill}
                onMoveSkill={movePrioritySkill}
                onRemoveSkill={removePrioritySkill}
                onSelectedSkillChange={setSelectedPrioritySkillKey}
                options={skillCatalogOptions}
                selectedSkillKey={selectedPrioritySkillKey}
                skillPriority={customScoreSettings.skillPriority}
              />
              <UnwantedSkillEditor
                errorMessage={unwantedSkillError}
                onAddSkill={addUnwantedSkill}
                onRemoveSkill={removeUnwantedSkill}
                onSelectedSkillChange={setSelectedUnwantedSkillKey}
                options={skillCatalogOptions}
                selectedSkillKey={selectedUnwantedSkillKey}
                unwantedSkillKeys={unwantedSkillConfig.skillKeys}
              />
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

function IdealSkillEditor({
  errorMessage,
  idealSkillKeys,
  onAddSkill,
  onRemoveSkill,
  onSelectedSkillChange,
  options,
  selectedSkillKey,
}: {
  errorMessage: string | null;
  idealSkillKeys: string[];
  onAddSkill: () => void;
  onRemoveSkill: (skillKey: string) => void;
  onSelectedSkillChange: (skillKey: string) => void;
  options: SkillCatalogOption[];
  selectedSkillKey: string;
}) {
  return (
    <section className="idealSkillEditor" aria-label="理想スキル">
      <h3>理想スキル</h3>
      {idealSkillKeys.length === 0 ? (
        <p className="mutedText">理想スキルが選択されていません。</p>
      ) : (
        <div className="scoreSkillChips">
          {idealSkillKeys.map((skillKey) => (
            <button
              className="scoreSkillChip"
              key={skillKey}
              type="button"
              onClick={() => onRemoveSkill(skillKey)}
              title="理想スキルから削除"
            >
              {getSkillOptionLabel(skillKey, options)} ×
            </button>
          ))}
        </div>
      )}
      <div className="scoreSettingRow">
        <label>
          理想スキルを追加
          <select
            value={selectedSkillKey}
            onChange={(event) =>
              onSelectedSkillChange(event.currentTarget.value)
            }
          >
            <option value="">スキルを選択</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onAddSkill}>
          追加
        </button>
      </div>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
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
      <h3>一致数スコア</h3>
      <p className="mutedText">
        理想スキルの一致数ごとの基礎スコアです。テーブルランク補正は、この基礎スコアへ後から適用されます。
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

function UnwantedSkillEditor({
  errorMessage,
  onAddSkill,
  onRemoveSkill,
  onSelectedSkillChange,
  options,
  selectedSkillKey,
  unwantedSkillKeys,
}: {
  errorMessage: string | null;
  onAddSkill: () => void;
  onRemoveSkill: (skillKey: string) => void;
  onSelectedSkillChange: (skillKey: string) => void;
  options: SkillCatalogOption[];
  selectedSkillKey: string;
  unwantedSkillKeys: string[];
}) {
  return (
    <section className="unwantedSkillEditor" aria-label="不要スキル">
      <h3>不要スキル</h3>
      {unwantedSkillKeys.length === 0 ? (
        <p className="mutedText">不要スキルが選択されていません。</p>
      ) : (
        <div className="scoreSkillChips">
          {unwantedSkillKeys.map((skillKey) => (
            <button
              className="scoreSkillChip"
              key={skillKey}
              type="button"
              onClick={() => onRemoveSkill(skillKey)}
              title="不要スキルから削除"
            >
              {getSkillOptionLabel(skillKey, options)} ×
            </button>
          ))}
        </div>
      )}
      <div className="scoreSettingRow">
        <label>
          不要スキルを追加
          <select
            value={selectedSkillKey}
            onChange={(event) =>
              onSelectedSkillChange(event.currentTarget.value)
            }
          >
            <option value="">スキルを選択</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onAddSkill}>
          追加
        </button>
      </div>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
}

function SkillPriorityEditor({
  errorMessage,
  onAddSkill,
  onMoveSkill,
  onRemoveSkill,
  onSelectedSkillChange,
  options,
  selectedSkillKey,
  skillPriority,
}: {
  errorMessage: string | null;
  onAddSkill: () => void;
  onMoveSkill: (skillKey: string, direction: -1 | 1) => void;
  onRemoveSkill: (skillKey: string) => void;
  onSelectedSkillChange: (skillKey: string) => void;
  options: SkillCatalogOption[];
  selectedSkillKey: string;
  skillPriority: CustomScoreSettings["skillPriority"];
}) {
  const sortedSkillPriority = getSortedSkillPriorityEntries(skillPriority);

  return (
    <section className="skillPriorityEditor" aria-label="スキル優先度">
      <h3>スキル優先度</h3>
      {sortedSkillPriority.length === 0 ? (
        <p className="mutedText">優先スキルが選択されていません。</p>
      ) : (
        <ol className="skillPriorityList">
          {sortedSkillPriority.map((entry, index) => (
            <li key={entry.skillKey}>
              <span>
                {entry.rank}. {getSkillOptionLabel(entry.skillKey, options)}
              </span>
              <div className="skillPriorityActions">
                <button
                  type="button"
                  onClick={() => onMoveSkill(entry.skillKey, -1)}
                  disabled={index === 0}
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => onMoveSkill(entry.skillKey, 1)}
                  disabled={index === sortedSkillPriority.length - 1}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveSkill(entry.skillKey)}
                >
                  削除
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <div className="scoreSettingRow">
        <label>
          優先スキルを追加
          <select
            value={selectedSkillKey}
            onChange={(event) =>
              onSelectedSkillChange(event.currentTarget.value)
            }
          >
            <option value="">スキルを選択</option>
            {options.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onAddSkill}>
          追加
        </button>
      </div>
      {errorMessage !== null && <p className="errorText">{errorMessage}</p>}
    </section>
  );
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

function ArtifactControls({
  artifactCount,
  attributeOptions,
  filteredCount,
  filters,
  kindOptions,
  onFiltersChange,
  onSortChange,
  sort,
}: {
  artifactCount: number;
  attributeOptions: string[];
  filteredCount: number;
  filters: ArtifactFilters;
  kindOptions: string[];
  onFiltersChange: (filters: ArtifactFilters) => void;
  onSortChange: (sort: ArtifactSort) => void;
  sort: ArtifactSort;
}) {
  return (
    <section className="tableControls" aria-label="Artifact filters">
      <div className="filterGrid">
        <label>
          検索
          <input
            type="search"
            value={filters.searchText}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                searchText: event.currentTarget.value,
              })
            }
            placeholder="名前、スキル、装備キャラ"
          />
        </label>

        <label>
          属性
          <select
            value={filters.attribute}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                attribute: event.currentTarget.value,
              })
            }
          >
            <option value="all">すべて</option>
            {attributeOptions.map((attribute) => (
              <option key={attribute} value={attribute}>
                {attribute}
              </option>
            ))}
          </select>
        </label>

        <label>
          武器種
          <select
            value={filters.kind}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                kind: event.currentTarget.value,
              })
            }
          >
            <option value="all">すべて</option>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {formatKindLabel(kind)}
              </option>
            ))}
          </select>
        </label>

        <label>
          お気に入り(ゲーム内)
          <select
            value={filters.locked}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                locked: event.currentTarget.value as LockedFilter,
              })
            }
          >
            <option value="all">すべて</option>
            <option value="locked">お気に入り</option>
            <option value="unlocked">お気に入り以外</option>
          </select>
        </label>

        <label>
          装備状態(ゲーム内)
          <select
            value={filters.equipped}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                equipped: event.currentTarget.value as EquippedFilter,
              })
            }
          >
            <option value="all">すべて</option>
            <option value="equipped">装備中</option>
            <option value="unequipped">未装備</option>
          </select>
        </label>

        <label>
          評価
          <select
            value={filters.rating}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                rating: event.currentTarget.value as RatingFilter,
              })
            }
          >
            <option value="all">すべて</option>
            <option value="unrated">未評価</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>

        <label>
          所持状態
          <select
            value={filters.lifecycle}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                lifecycle: event.currentTarget.value as LifecycleFilter,
              })
            }
          >
            <option value="all">すべて</option>
            <option value="active">所持中</option>
            <option value="possiblyDeleted">解体済み?</option>
          </select>
        </label>

        <label>
          並び替え
          <select
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
        </label>
      </div>

      <div className="resultCount">
        表示中 {filteredCount} / {artifactCount}
      </div>
    </section>
  );
}

function ArtifactTable({
  rows,
  onMemoBlur,
  onMemoChange,
  onRatingChange,
}: {
  rows: ReviewedArtifactRow[];
  onMemoBlur: (row: ReviewedArtifactRow) => void;
  onMemoChange: (ownedId: number, memo: string) => void;
  onRatingChange: (
    row: ReviewedArtifactRow,
    rating: ArtifactUserRating,
  ) => void;
}) {
  return (
    <div className="tableScroller">
      <table>
        <thead>
          <tr>
            <th>所持ID</th>
            <th>アーティファクト名</th>
            <th>属性</th>
            <th>武器種</th>
            <th>レベル</th>
            <th>ゲーム内スコア</th>
            <th>カスタムスコア</th>
            <th>評価</th>
            <th>メモ</th>
            <th>最終確認日</th>
            <th>解体済み?</th>
            <th>お気に入り</th>
            <th>装備キャラ</th>
            <th>スキル</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const { artifact, review } = row;

            return (
              <tr key={artifact.ownedId}>
                <td>{artifact.ownedId}</td>
                <td>{artifact.name}</td>
                <td>{artifact.attribute.label}</td>
                <td>{formatKindLabel(artifact.kind.label)}</td>
                <td>
                  {artifact.level}/{artifact.maxLevel}
                </td>
                <td>{artifact.gameScore.total}</td>
                <td>
                  <CustomScoreCell score={row.customScore} />
                </td>
                <td>
                  <select
                    className="ratingSelect"
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
                    <option value={0}>0</option>
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
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
                <td>{row.presence?.lastSeenAt ?? "-"}</td>
                <td>{formatBooleanLabel(row.presence?.isPossiblyDeleted)}</td>
                <td>{formatBooleanLabel(artifact.isLocked)}</td>
                <td>{artifact.equippedCharacter?.name ?? "-"}</td>
                <td>
                  <ul className="skillList">
                    {artifact.skills.map((skill) => (
                      <li key={skill.slot}>
                        {skill.name}: {skill.effectValueText}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  const { artifact, review } = row;
  const searchText = filters.searchText.trim().toLowerCase();

  if (searchText.length > 0 && !matchesSearchText(artifact, searchText)) {
    return false;
  }

  if (
    filters.attribute !== "all" &&
    artifact.attribute.label !== filters.attribute
  ) {
    return false;
  }

  if (filters.kind !== "all" && artifact.kind.label !== filters.kind) {
    return false;
  }

  if (filters.locked === "locked" && !artifact.isLocked) {
    return false;
  }

  if (filters.locked === "unlocked" && artifact.isLocked) {
    return false;
  }

  if (filters.equipped === "equipped" && artifact.equippedCharacter === null) {
    return false;
  }

  if (
    filters.equipped === "unequipped" &&
    artifact.equippedCharacter !== null
  ) {
    return false;
  }

  if (filters.rating === "unrated" && (review?.rating ?? 0) !== 0) {
    return false;
  }

  if (
    filters.rating !== "all" &&
    filters.rating !== "unrated" &&
    review?.rating !== Number.parseInt(filters.rating, 10)
  ) {
    return false;
  }

  if (filters.lifecycle === "active" && row.presence?.isPossiblyDeleted) {
    return false;
  }

  if (
    filters.lifecycle === "possiblyDeleted" &&
    !row.presence?.isPossiblyDeleted
  ) {
    return false;
  }

  return true;
}

function matchesSearchText(artifact: Artifact, searchText: string): boolean {
  if (artifact.name.toLowerCase().includes(searchText)) {
    return true;
  }

  if (artifact.equippedCharacter?.name.toLowerCase().includes(searchText)) {
    return true;
  }

  return artifact.skills.some((skill) => {
    return skill.name.toLowerCase().includes(searchText);
  });
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
  unwantedSkillConfig: UnwantedSkillConfig;
}): ReviewedArtifactRow {
  return {
    artifact: args.artifact,
    review: args.review,
    presence: args.presence,
    customScore: evaluateCustomScore({
      artifact: args.artifact,
      settings: args.scoreSettings,
      unwantedSkillConfig: args.unwantedSkillConfig,
    }),
  };
}

function getDashboardTabClassName(isActive: boolean): string {
  return isActive ? "dashboardTab active" : "dashboardTab";
}

function getSortedSkillPriorityEntries(
  skillPriority: CustomScoreSettings["skillPriority"],
): CustomScoreSettings["skillPriority"] {
  return [...skillPriority].sort((left, right) => left.rank - right.rank);
}

function reassignSkillPriorityRanks(
  skillPriority: CustomScoreSettings["skillPriority"],
): CustomScoreSettings["skillPriority"] {
  return skillPriority.map((entry, index) => ({
    ...entry,
    rank: index + 1,
  }));
}

function getSkillOptionLabel(
  skillKey: string,
  options: SkillCatalogOption[],
): string {
  return options.find((option) => option.key === skillKey)?.label ?? skillKey;
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

function getAttributeOptions(artifacts: Artifact[]): string[] {
  return Array.from(
    new Set(artifacts.map((artifact) => artifact.attribute.label)),
  ).sort((left, right) =>
    compareOrderedValues(
      getAttributeOrder(left),
      getAttributeOrder(right),
      0,
      0,
    ),
  );
}

function getKindOptions(artifacts: Artifact[]): string[] {
  return Array.from(
    new Set(artifacts.map((artifact) => artifact.kind.label)),
  ).sort((left, right) =>
    compareOrderedValues(getKindOrder(left), getKindOrder(right), 0, 0),
  );
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

function formatBooleanLabel(value: boolean | undefined): string {
  return value ? "はい" : "いいえ";
}

function formatScoreRouteLabel(route: ScoreResult["selectedRoute"]): string {
  return route === "ideal" ? "理想" : "優先度";
}

function downloadCsvFile(csv: string, fileName: string) {
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function createArtifactCsvFileName(date: Date): string {
  const year = date.getFullYear();
  const month = padDatePart(date.getMonth() + 1);
  const day = padDatePart(date.getDate());
  const hours = padDatePart(date.getHours());
  const minutes = padDatePart(date.getMinutes());
  const seconds = padDatePart(date.getSeconds());

  return `gbf-artifacts-${year}${month}${day}-${hours}${minutes}${seconds}.csv`;
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

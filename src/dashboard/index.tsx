import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertArtifactRowsToCsv } from "../csv/artifactCsv";
import type { Artifact } from "../domain/artifact";
import type {
  ArtifactUserRating,
  ArtifactUserReview,
} from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";
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
type SortKey = "totalScore" | "ownedId" | "name" | "rating";
type SortDirection = "asc" | "desc";

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
};

function Dashboard() {
  const { mode, scan, setMode, setScanState } = useAppStore();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [reviewsByOwnedId, setReviewsByOwnedId] = useState<
    Record<number, ArtifactUserReview>
  >({});
  const [presenceByOwnedId, setPresenceByOwnedId] = useState<
    Record<number, ArtifactPresence>
  >({});
  const [filters, setFilters] = useState<ArtifactFilters>(initialFilters);
  const [sort, setSort] = useState<ArtifactSort>({
    key: "totalScore",
    direction: "desc",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading artifacts...");
  const artifactRows = artifacts.map((artifact) => ({
    artifact,
    review: reviewsByOwnedId[artifact.ownedId] ?? null,
    presence: presenceByOwnedId[artifact.ownedId] ?? null,
  }));
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

  const loadArtifacts = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("Loading artifacts...");

    const [artifactResponse, reviewResponse, presenceResponse] =
      await Promise.all([
        sendRuntimeMessage({ type: "GET_STORED_ARTIFACTS" }),
        sendRuntimeMessage({ type: "GET_ARTIFACT_USER_REVIEWS" }),
        sendRuntimeMessage({ type: "GET_ARTIFACT_PRESENCE" }),
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
        <fieldset className="modeSwitch">
          <legend>Mode</legend>
          <button
            className={mode === "scan" ? "active" : ""}
            type="button"
            onClick={() => setMode("scan")}
          >
            Scan
          </button>
          <button
            className={mode === "manage" ? "active" : ""}
            type="button"
            onClick={() => setMode("manage")}
          >
            Manage
          </button>
        </fieldset>
      </header>

      <section className="statusGrid" aria-label="Scan status">
        <div>
          <span>Current page</span>
          <strong>{scan.currentPage ?? "-"}</strong>
        </div>
        <div>
          <span>Last page</span>
          <strong>{scan.lastPage ?? "-"}</strong>
        </div>
        <div>
          <span>Total artifacts</span>
          <strong>{scan.totalCount ?? "-"}</strong>
        </div>
        <div>
          <span>Last scanned</span>
          <strong>{scan.lastScannedAt ?? "-"}</strong>
        </div>
      </section>

      <section className="workspace" aria-label="Artifact management">
        <div className="panel">
          <div className="panelHeader">
            <div>
              <h2>Artifacts</h2>
              <p>{statusMessage}</p>
            </div>
            <button type="button" onClick={loadArtifacts} disabled={isLoading}>
              {isLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          <StatisticsSummary statistics={statistics} />

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
                saveReview(row.artifact.ownedId, rating, row.review?.memo ?? "")
              }
            />
          )}
        </div>
        <div className="panel">
          <h2>Score Rules</h2>
          <p>
            Custom score rule editing will be added after local storage is in
            place.
          </p>
        </div>
        <div className="panel">
          <h2>CSV Export</h2>
          <p>Exports the current filtered artifact list.</p>
          <button
            className="panelAction"
            type="button"
            onClick={exportCsv}
            disabled={filteredRows.length === 0}
          >
            Export CSV
          </button>
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
          Search
          <input
            type="search"
            value={filters.searchText}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                searchText: event.currentTarget.value,
              })
            }
            placeholder="Name, skill, equipped character"
          />
        </label>

        <label>
          Attribute
          <select
            value={filters.attribute}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                attribute: event.currentTarget.value,
              })
            }
          >
            <option value="all">All</option>
            {attributeOptions.map((attribute) => (
              <option key={attribute} value={attribute}>
                {attribute}
              </option>
            ))}
          </select>
        </label>

        <label>
          Kind
          <select
            value={filters.kind}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                kind: event.currentTarget.value,
              })
            }
          >
            <option value="all">All</option>
            {kindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {kind}
              </option>
            ))}
          </select>
        </label>

        <label>
          Locked
          <select
            value={filters.locked}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                locked: event.currentTarget.value as LockedFilter,
              })
            }
          >
            <option value="all">All</option>
            <option value="locked">Locked</option>
            <option value="unlocked">Unlocked</option>
          </select>
        </label>

        <label>
          Equipped
          <select
            value={filters.equipped}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                equipped: event.currentTarget.value as EquippedFilter,
              })
            }
          >
            <option value="all">All</option>
            <option value="equipped">Equipped</option>
            <option value="unequipped">Unequipped</option>
          </select>
        </label>

        <label>
          Rating
          <select
            value={filters.rating}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                rating: event.currentTarget.value as RatingFilter,
              })
            }
          >
            <option value="all">All</option>
            <option value="unrated">Unrated</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </label>

        <label>
          Lifecycle
          <select
            value={filters.lifecycle}
            onChange={(event) =>
              onFiltersChange({
                ...filters,
                lifecycle: event.currentTarget.value as LifecycleFilter,
              })
            }
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="possiblyDeleted">Possibly deleted</option>
          </select>
        </label>

        <label>
          Sort
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
            <option value="totalScore:desc">Total score descending</option>
            <option value="totalScore:asc">Total score ascending</option>
            <option value="ownedId:desc">ownedId descending</option>
            <option value="ownedId:asc">ownedId ascending</option>
            <option value="name:asc">Name ascending</option>
            <option value="name:desc">Name descending</option>
            <option value="rating:asc">Rating ascending</option>
            <option value="rating:desc">Rating descending</option>
          </select>
        </label>
      </div>

      <div className="resultCount">
        Showing {filteredCount} / {artifactCount}
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
            <th>ownedId</th>
            <th>Name</th>
            <th>Attribute</th>
            <th>Kind</th>
            <th>Level</th>
            <th>Total score</th>
            <th>Rating</th>
            <th>Memo</th>
            <th>Last seen</th>
            <th>Possibly deleted</th>
            <th>Locked</th>
            <th>Equipped</th>
            <th>Skills</th>
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
                <td>{artifact.kind.label}</td>
                <td>
                  {artifact.level}/{artifact.maxLevel}
                </td>
                <td>{artifact.gameScore.total}</td>
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
                <td>{row.presence?.isPossiblyDeleted ? "Yes" : "No"}</td>
                <td>{artifact.isLocked ? "Yes" : "No"}</td>
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

  return (
    left.artifact.name.localeCompare(right.artifact.name) * directionMultiplier
  );
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
  ).sort((left, right) => left.localeCompare(right));
}

function getKindOptions(artifacts: Artifact[]): string[] {
  return Array.from(
    new Set(artifacts.map((artifact) => artifact.kind.label)),
  ).sort((left, right) => left.localeCompare(right));
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

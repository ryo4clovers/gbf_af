import React, { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { convertArtifactsToCsv } from "../csv/artifactCsv";
import type { Artifact } from "../domain/artifact";
import { sendRuntimeMessage } from "../shared/chromeMessages";
import type { ExtensionResponse } from "../shared/messages";
import { useAppStore } from "../state/appState";
import "./style.css";

type LockedFilter = "all" | "locked" | "unlocked";
type EquippedFilter = "all" | "equipped" | "unequipped";
type SortKey = "totalScore" | "ownedId" | "name";
type SortDirection = "asc" | "desc";

type ArtifactFilters = {
  searchText: string;
  attribute: string;
  kind: string;
  locked: LockedFilter;
  equipped: EquippedFilter;
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
};

function Dashboard() {
  const { mode, scan, setMode, setScanState } = useAppStore();
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [filters, setFilters] = useState<ArtifactFilters>(initialFilters);
  const [sort, setSort] = useState<ArtifactSort>({
    key: "totalScore",
    direction: "desc",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Loading artifacts...");
  const filteredArtifacts = getFilteredAndSortedArtifacts(
    artifacts,
    filters,
    sort,
  );
  const attributeOptions = getAttributeOptions(artifacts);
  const kindOptions = getKindOptions(artifacts);

  const handleStoredArtifactsResponse = useCallback(
    (response: ExtensionResponse) => {
      if (!response.ok) {
        if (response.scan !== undefined) {
          setScanState(response.scan);
        }

        setStatusMessage(response.message);
        return;
      }

      if (response.type === "STORED_ARTIFACTS") {
        setArtifacts(response.artifacts);
        setScanState(response.scan);
        setStatusMessage(`Loaded ${response.artifactCount} stored artifacts.`);
      }
    },
    [setScanState],
  );

  const loadArtifacts = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage("Loading artifacts...");

    const response = await sendRuntimeMessage({ type: "GET_STORED_ARTIFACTS" });
    handleStoredArtifactsResponse(response);
    setIsLoading(false);
  }, [handleStoredArtifactsResponse]);

  useEffect(() => {
    loadArtifacts();
  }, [loadArtifacts]);

  const exportCsv = () => {
    if (filteredArtifacts.length === 0) {
      setStatusMessage("No artifacts match the current filters.");
      return;
    }

    downloadCsvFile(
      convertArtifactsToCsv(filteredArtifacts),
      createArtifactCsvFileName(new Date()),
    );
    setStatusMessage(`Exported ${filteredArtifacts.length} artifacts.`);
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

          <ArtifactControls
            artifactCount={artifacts.length}
            attributeOptions={attributeOptions}
            filteredCount={filteredArtifacts.length}
            filters={filters}
            kindOptions={kindOptions}
            onFiltersChange={setFilters}
            onSortChange={setSort}
            sort={sort}
          />

          {artifacts.length === 0 ? (
            <p className="emptyState">No stored artifacts found.</p>
          ) : (
            <ArtifactTable artifacts={filteredArtifacts} />
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
            disabled={filteredArtifacts.length === 0}
          >
            Export CSV
          </button>
        </div>
      </section>
    </main>
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
          </select>
        </label>
      </div>

      <div className="resultCount">
        Showing {filteredCount} / {artifactCount}
      </div>
    </section>
  );
}

function ArtifactTable({ artifacts }: { artifacts: Artifact[] }) {
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
            <th>Locked</th>
            <th>Equipped</th>
            <th>Skills</th>
          </tr>
        </thead>
        <tbody>
          {artifacts.map((artifact) => (
            <tr key={artifact.ownedId}>
              <td>{artifact.ownedId}</td>
              <td>{artifact.name}</td>
              <td>{artifact.attribute.label}</td>
              <td>{artifact.kind.label}</td>
              <td>
                {artifact.level}/{artifact.maxLevel}
              </td>
              <td>{artifact.gameScore.total}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getFilteredAndSortedArtifacts(
  artifacts: Artifact[],
  filters: ArtifactFilters,
  sort: ArtifactSort,
): Artifact[] {
  return artifacts
    .filter((artifact) => matchesFilters(artifact, filters))
    .sort((left, right) => compareArtifacts(left, right, sort));
}

function matchesFilters(artifact: Artifact, filters: ArtifactFilters): boolean {
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
  left: Artifact,
  right: Artifact,
  sort: ArtifactSort,
): number {
  const directionMultiplier = sort.direction === "asc" ? 1 : -1;

  if (sort.key === "totalScore") {
    return (left.gameScore.total - right.gameScore.total) * directionMultiplier;
  }

  if (sort.key === "ownedId") {
    return (left.ownedId - right.ownedId) * directionMultiplier;
  }

  return left.name.localeCompare(right.name) * directionMultiplier;
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

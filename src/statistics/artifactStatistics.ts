import type { Artifact } from "../domain/artifact";
import type {
  ArtifactUserRating,
  ArtifactUserReview,
} from "../domain/artifactUserReview";
import type { ArtifactPresence } from "../domain/scanSession";

export type ArtifactStatisticsInput = {
  artifacts: Artifact[];
  userReviews: ArtifactUserReview[];
  artifactPresence: ArtifactPresence[];
};

export type ArtifactStatistics = {
  overall: ArtifactOverallStatistics;
  ratingCounts: Record<ArtifactUserRating, number>;
  attributeCounts: ArtifactDistributionItem[];
  kindCounts: ArtifactDistributionItem[];
  skillCounts: SkillStatisticsItem[];
};

export type ArtifactOverallStatistics = {
  totalArtifactCount: number;
  activeArtifactCount: number;
  possiblyDeletedArtifactCount: number;
  unratedArtifactCount: number;
  averageGameTotalScore: number | null;
  highestGameTotalScore: number | null;
  lockedArtifactCount: number;
  equippedArtifactCount: number;
};

export type ArtifactDistributionItem = {
  label: string;
  count: number;
  possiblyDeletedCount: number;
};

export type SkillStatisticsItem = {
  name: string;
  count: number;
  maxNumericEffectValue: number | null;
  averageNumericEffectValue: number | null;
};

export function calculateArtifactStatistics(
  input: ArtifactStatisticsInput,
): ArtifactStatistics {
  const reviewsByOwnedId = indexReviewsByOwnedId(input.userReviews);
  const presenceByOwnedId = indexPresenceByOwnedId(input.artifactPresence);
  const ratingCounts = createEmptyRatingCounts();
  const attributeCounts = new Map<string, ArtifactDistributionItem>();
  const kindCounts = new Map<string, ArtifactDistributionItem>();
  const skillCounts = new Map<string, SkillAccumulator>();
  let possiblyDeletedArtifactCount = 0;
  let lockedArtifactCount = 0;
  let equippedArtifactCount = 0;
  let gameTotalScoreSum = 0;
  let highestGameTotalScore: number | null = null;

  for (const artifact of input.artifacts) {
    const review = reviewsByOwnedId[artifact.ownedId];
    const rating = review?.rating ?? 0;
    const isPossiblyDeleted =
      presenceByOwnedId[artifact.ownedId]?.isPossiblyDeleted ?? false;

    ratingCounts[rating] += 1;
    gameTotalScoreSum += artifact.gameScore.total;
    highestGameTotalScore =
      highestGameTotalScore === null
        ? artifact.gameScore.total
        : Math.max(highestGameTotalScore, artifact.gameScore.total);

    if (isPossiblyDeleted) {
      possiblyDeletedArtifactCount += 1;
    }

    if (artifact.isLocked) {
      lockedArtifactCount += 1;
    }

    if (artifact.equippedCharacter !== null) {
      equippedArtifactCount += 1;
    }

    // Distribution totals include all stored artifacts. The separate
    // possiblyDeletedCount column makes lifecycle state visible without
    // changing the meaning of the total count.
    incrementDistributionCount(
      attributeCounts,
      artifact.attribute.label,
      isPossiblyDeleted,
    );
    incrementDistributionCount(
      kindCounts,
      artifact.kind.label,
      isPossiblyDeleted,
    );

    for (const skill of artifact.skills) {
      const accumulator = skillCounts.get(skill.name) ?? {
        name: skill.name,
        count: 0,
        numericValueCount: 0,
        numericValueSum: 0,
        maxNumericEffectValue: null,
      };

      accumulator.count += 1;

      if (skill.parsedValue !== null) {
        accumulator.numericValueCount += 1;
        accumulator.numericValueSum += skill.parsedValue.value;
        accumulator.maxNumericEffectValue =
          accumulator.maxNumericEffectValue === null
            ? skill.parsedValue.value
            : Math.max(
                accumulator.maxNumericEffectValue,
                skill.parsedValue.value,
              );
      }

      skillCounts.set(skill.name, accumulator);
    }
  }

  return {
    overall: {
      totalArtifactCount: input.artifacts.length,
      activeArtifactCount:
        input.artifacts.length - possiblyDeletedArtifactCount,
      possiblyDeletedArtifactCount,
      unratedArtifactCount: ratingCounts[0],
      averageGameTotalScore:
        input.artifacts.length === 0
          ? null
          : gameTotalScoreSum / input.artifacts.length,
      highestGameTotalScore,
      lockedArtifactCount,
      equippedArtifactCount,
    },
    ratingCounts,
    attributeCounts: sortDistributionItems(attributeCounts),
    kindCounts: sortDistributionItems(kindCounts),
    skillCounts: sortSkillItems(skillCounts),
  };
}

type SkillAccumulator = {
  name: string;
  count: number;
  numericValueCount: number;
  numericValueSum: number;
  maxNumericEffectValue: number | null;
};

function indexReviewsByOwnedId(
  reviews: ArtifactUserReview[],
): Record<number, ArtifactUserReview> {
  const reviewsByOwnedId: Record<number, ArtifactUserReview> = {};

  for (const review of reviews) {
    reviewsByOwnedId[review.ownedId] = review;
  }

  return reviewsByOwnedId;
}

function indexPresenceByOwnedId(
  presenceRecords: ArtifactPresence[],
): Record<number, ArtifactPresence> {
  const presenceByOwnedId: Record<number, ArtifactPresence> = {};

  for (const presence of presenceRecords) {
    presenceByOwnedId[presence.ownedId] = presence;
  }

  return presenceByOwnedId;
}

function createEmptyRatingCounts(): Record<ArtifactUserRating, number> {
  return {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };
}

function incrementDistributionCount(
  counts: Map<string, ArtifactDistributionItem>,
  label: string,
  isPossiblyDeleted: boolean,
) {
  const item =
    counts.get(label) ??
    ({
      label,
      count: 0,
      possiblyDeletedCount: 0,
    } satisfies ArtifactDistributionItem);

  item.count += 1;

  if (isPossiblyDeleted) {
    item.possiblyDeletedCount += 1;
  }

  counts.set(label, item);
}

function sortDistributionItems(
  counts: Map<string, ArtifactDistributionItem>,
): ArtifactDistributionItem[] {
  return Array.from(counts.values()).sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.label.localeCompare(right.label);
  });
}

function sortSkillItems(
  counts: Map<string, SkillAccumulator>,
): SkillStatisticsItem[] {
  return Array.from(counts.values())
    .map((item) => ({
      name: item.name,
      count: item.count,
      maxNumericEffectValue: item.maxNumericEffectValue,
      averageNumericEffectValue:
        item.numericValueCount === 0
          ? null
          : item.numericValueSum / item.numericValueCount,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      return left.name.localeCompare(right.name);
    });
}

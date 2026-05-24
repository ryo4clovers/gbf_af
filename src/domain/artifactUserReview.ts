export type ArtifactUserRating = 0 | 1 | 2 | 3 | 4 | 5;

export type ArtifactUserReview = {
  ownedId: number;
  rating: ArtifactUserRating;
  memo: string;
  updatedAt: string;
};

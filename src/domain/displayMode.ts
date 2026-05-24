import type { ArtifactUserRating } from "./artifactUserReview";

export type DisplayState = {
  isEnabled: boolean;
  currentPage?: number;
  capturedAt?: string;
  itemCount: number;
  items: DisplayArtifactItem[];
};

export type DisplayArtifactItem = {
  ownedId: number;
  name: string;
  rating: ArtifactUserRating;
  memo: string;
  isPossiblyDeleted: boolean;
};

export const initialDisplayState: DisplayState = {
  isEnabled: false,
  itemCount: 0,
  items: [],
};

import type { RawArtifact } from "../api/artifactListTypes";

export type Artifact = {
  ownedId: number;
  artifactTypeId: number;
  name: string;
  rarity: number;
  level: number;
  maxLevel: number;
  kind: ArtifactKind;
  attribute: Attribute;
  isLocked: boolean;
  isMarkedUnnecessaryInGame: boolean;
  userMark: UserArtifactMark;
  gameScore: GameScore;
  customScore: CustomScore | null;
  skills: ArtifactSkill[];
  equippedCharacter: EquippedCharacter | null;
  raw: RawArtifact;
  scannedAt: string;
};

export type ArtifactKind = {
  raw: string;
  label: string;
};

export type Attribute = {
  raw: string;
  label: string;
};

export type UserArtifactMark = "none" | "keep" | "trash" | "review";

export type GameScore = {
  attack: number;
  defense: number;
  special: number;
  total: number;
};

export type CustomScore = {
  total: number;
  attack: number;
  defense: number;
  special: number;
  reasons: CustomScoreReason[];
};

export type CustomScoreReason = {
  skillId: number;
  skillName: string;
  delta: number;
  message: string;
};

export type ArtifactSkill = {
  slot: 1 | 2 | 3 | 4;
  skillId: number;
  quality: number;
  level: number;
  name: string;
  isMaxQuality: boolean;
  effectValueText: string;
  parsedValue: ParsedEffectValue | null;
  iconImage: string;
  scoreCategory: ScoreCategory;
};

export type ParsedEffectValue = {
  value: number;
  unit: "percent" | "flat" | "times" | "count" | "unknown";
};

export type ScoreCategory = "attack" | "defense" | "special" | "unknown";

export type EquippedCharacter = {
  userNpcId: number;
  image: string;
  name: string;
};

export const ARTIFACT_KIND_LABELS: Record<string, string> = {
  "1": "kind-1",
  "2": "kind-2",
  "3": "kind-3",
  "4": "kind-4",
  "5": "kind-5",
  "6": "kind-6",
  "7": "kind-7",
  "8": "kind-8",
  "9": "kind-9",
  "10": "kind-10",
};

export const ATTRIBUTE_LABELS: Record<string, string> = {
  "1": "火",
  "2": "水",
  "3": "土",
  "4": "風",
  "5": "光",
  "6": "闇",
};

export const SCORE_CATEGORY_MAP: Record<string, ScoreCategory> = {
  "1": "attack",
  "2": "defense",
  "3": "special",
};

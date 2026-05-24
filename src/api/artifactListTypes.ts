export type ArtifactListResponse = {
  list: RawArtifact[];
  first: number;
  last: number;
  prev: number;
  next: number;
  count: number;
  current: number;
  options: ArtifactListOptions;
  default_selector: unknown;
  has_default_selector: boolean;
};

export type ArtifactListOptions = {
  max_number: number;
  number: number;
  sort: unknown;
  filter: unknown;
  tpl_type: "artifact" | string;
  status: number;
};

export type RawArtifact = {
  artifact_id: number;
  max_level: number;
  name: string;
  comment: string;
  rarity: string;
  is_quirk: boolean;
  score_info: RawScoreInfo;
  skill1_info: RawArtifactSkill;
  skill2_info: RawArtifactSkill;
  skill3_info: RawArtifactSkill;
  skill4_info: RawArtifactSkill;
  id: number;
  level: string;
  kind: string;
  attribute: string;
  next_exp: number;
  remain_next_exp: number;
  exp_width: number;
  is_locked: boolean;
  is_unnecessary: boolean;
  equip_npc_info: [] | RawEquipNpcInfo;
};

export type RawScoreInfo = {
  attack_score: number;
  defense_score: number;
  special_score: number;
  total_score: number;
};

export type RawArtifactSkill = {
  skill_id: number;
  skill_quality: number;
  level: number;
  name: string;
  is_max_quality: boolean;
  effect_value: string;
  icon_image: string;
  score_category: string;
};

export type RawEquipNpcInfo = {
  user_npc_id: number;
  image: string;
  name: string;
};

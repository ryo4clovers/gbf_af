import { z } from "zod";

z.config({ jitless: true });

const rawScoreInfoSchema = z.object({
  attack_score: z.number(),
  defense_score: z.number(),
  special_score: z.number(),
  total_score: z.number(),
});

const rawArtifactSkillSchema = z.object({
  skill_id: z.number(),
  skill_quality: z.number(),
  level: z.number(),
  name: z.string(),
  is_max_quality: z.boolean(),
  effect_value: z.string(),
  icon_image: z.string(),
  score_category: z.string(),
});

const rawEquipNpcInfoSchema = z.object({
  user_npc_id: z.number(),
  image: z.string(),
  name: z.string(),
});

const rawArtifactSchema = z.object({
  artifact_id: z.number(),
  max_level: z.number(),
  name: z.string(),
  comment: z.string(),
  rarity: z.string(),
  is_quirk: z.boolean(),
  score_info: rawScoreInfoSchema,
  skill1_info: rawArtifactSkillSchema,
  skill2_info: rawArtifactSkillSchema,
  skill3_info: rawArtifactSkillSchema,
  skill4_info: rawArtifactSkillSchema,
  id: z.number(),
  level: z.string(),
  kind: z.string(),
  attribute: z.string(),
  next_exp: z.number(),
  remain_next_exp: z.number(),
  exp_width: z.number(),
  is_locked: z.boolean(),
  is_unnecessary: z.boolean(),
  equip_npc_info: z.union([z.tuple([]), rawEquipNpcInfoSchema]),
});

export const artifactListResponseSchema = z.object({
  list: z.array(rawArtifactSchema),
  first: z.number(),
  last: z.number(),
  prev: z.number(),
  next: z.number(),
  count: z.number(),
  current: z.number(),
  options: z.object({
    max_number: z.number(),
    number: z.number(),
    sort: z.unknown(),
    filter: z.unknown(),
    tpl_type: z.string(),
    status: z.number(),
  }),
  default_selector: z.unknown(),
  has_default_selector: z.boolean(),
});

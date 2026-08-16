import type { RawArtifact, RawArtifactSkill } from "../api/artifactListTypes";
import {
  ARTIFACT_KIND_LABELS,
  type Artifact,
  type ArtifactSkill,
  ATTRIBUTE_LABELS,
  SCORE_CATEGORY_MAP,
} from "./artifact";
import { parseEffectValue } from "./parseEffectValue";

export function normalizeArtifact(
  raw: RawArtifact,
  scannedAt: string,
): Artifact {
  return {
    ownedId: raw.id,
    artifactTypeId: raw.artifact_id,
    name: raw.name,
    rarity: Number.parseInt(raw.rarity, 10),
    level: Number.parseInt(raw.level, 10),
    maxLevel: raw.max_level,
    kind: {
      raw: raw.kind,
      label: ARTIFACT_KIND_LABELS[raw.kind] ?? `kind-${raw.kind}`,
    },
    attribute: {
      raw: raw.attribute,
      label: ATTRIBUTE_LABELS[raw.attribute] ?? raw.attribute,
    },
    isLocked: raw.is_locked,
    isMarkedUnnecessaryInGame: raw.is_unnecessary,
    isQuirk: raw.is_quirk,
    userMark: "none",
    gameScore: {
      attack: raw.score_info.attack_score,
      defense: raw.score_info.defense_score,
      special: raw.score_info.special_score,
      total: raw.score_info.total_score,
    },
    customScore: null,
    skills: [
      normalizeSkill(1, raw.skill1_info),
      normalizeSkill(2, raw.skill2_info),
      normalizeSkill(3, raw.skill3_info),
      normalizeSkill(4, raw.skill4_info),
    ],
    equippedCharacter: Array.isArray(raw.equip_npc_info)
      ? null
      : {
          userNpcId: raw.equip_npc_info.user_npc_id,
          image: raw.equip_npc_info.image,
          name: raw.equip_npc_info.name,
        },
    raw,
    scannedAt,
  };
}

function normalizeSkill(
  slot: ArtifactSkill["slot"],
  raw: RawArtifactSkill,
): ArtifactSkill {
  return {
    slot,
    skillId: raw.skill_id,
    quality: raw.skill_quality,
    level: raw.level,
    name: raw.name,
    isMaxQuality: raw.is_max_quality,
    effectValueText: raw.effect_value,
    parsedValue: parseEffectValue(raw.effect_value),
    iconImage: raw.icon_image,
    scoreCategory: SCORE_CATEGORY_MAP[raw.score_category] ?? "unknown",
  };
}

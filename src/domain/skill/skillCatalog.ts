import type { NormalizedSkillKey, SkillCategory } from "./normalizedSkill";

export type SkillCatalogEntry = {
  normalizedKey: NormalizedSkillKey;
  label: string;
  category: SkillCategory;
};

export type SkillCatalogOption = {
  key: NormalizedSkillKey;
  label: string;
  category: SkillCategory;
};

const attackPower: SkillCatalogEntry = {
  normalizedKey: "attack_power",
  label: "攻撃力",
  category: "normal_attack",
};

const elementAttack: SkillCatalogEntry = {
  normalizedKey: "element_attack",
  label: "自属性攻撃力",
  category: "normal_attack",
};

const normalAttackCap: SkillCatalogEntry = {
  normalizedKey: "normal_attack_damage_cap",
  label: "通常攻撃ダメージ上限",
  category: "normal_attack",
};

const ougiDamage: SkillCatalogEntry = {
  normalizedKey: "ougi_damage",
  label: "奥義ダメージ",
  category: "ougi",
};

const ougiDamageCap: SkillCatalogEntry = {
  normalizedKey: "ougi_damage_cap",
  label: "奥義ダメージ上限",
  category: "ougi",
};

const abilityDamage: SkillCatalogEntry = {
  normalizedKey: "ability_damage",
  label: "アビリティダメージ",
  category: "ability",
};

const abilityDamageCap: SkillCatalogEntry = {
  normalizedKey: "ability_damage_cap",
  label: "アビリティダメージ上限",
  category: "ability",
};

const tripleAttackRate: SkillCatalogEntry = {
  normalizedKey: "triple_attack_rate",
  label: "トリプルアタック確率",
  category: "normal_attack",
};

const criticalRate: SkillCatalogEntry = {
  normalizedKey: "critical_rate",
  label: "クリティカル確率",
  category: "normal_attack",
};

const debuffResistance: SkillCatalogEntry = {
  normalizedKey: "debuff_resistance",
  label: "弱体耐性",
  category: "defense",
};

const healingPerformance: SkillCatalogEntry = {
  normalizedKey: "healing_performance",
  label: "回復性能",
  category: "healing",
};

const defense: SkillCatalogEntry = {
  normalizedKey: "defense",
  label: "防御",
  category: "defense",
};

const hpUpDefenseDown: SkillCatalogEntry = {
  normalizedKey: "hp_up_defense_down_70",
  label: "最大HP上昇/防御力-70%",
  category: "defense",
};

export const SKILL_CATALOG_BY_ID: Record<number, SkillCatalogEntry> = {
  10011: attackPower,
  10012: attackPower,
  10013: attackPower,
  10014: attackPower,
  10015: attackPower,

  30111: elementAttack,
  30112: elementAttack,
  30113: elementAttack,
  30114: elementAttack,
  30115: elementAttack,

  30131: normalAttackCap,
  30132: normalAttackCap,
  30133: normalAttackCap,
  30134: normalAttackCap,
  30135: normalAttackCap,

  30021: ougiDamage,
  30022: ougiDamage,
  30023: ougiDamage,
  30024: ougiDamage,
  30025: ougiDamage,

  30151: ougiDamageCap,
  30152: ougiDamageCap,
  30153: ougiDamageCap,
  30154: ougiDamageCap,
  30155: ougiDamageCap,

  30031: abilityDamage,
  30032: abilityDamage,
  30033: abilityDamage,
  30034: abilityDamage,
  30035: abilityDamage,

  30141: abilityDamageCap,
  30142: abilityDamageCap,
  30143: abilityDamageCap,
  30144: abilityDamageCap,
  30145: abilityDamageCap,

  30061: tripleAttackRate,
  30062: tripleAttackRate,
  30063: tripleAttackRate,
  30064: tripleAttackRate,
  30065: tripleAttackRate,

  30011: criticalRate,
  30012: criticalRate,
  30013: criticalRate,
  30014: criticalRate,
  30015: criticalRate,

  30081: debuffResistance,
  30082: debuffResistance,
  30083: debuffResistance,
  30084: debuffResistance,
  30085: debuffResistance,

  30101: healingPerformance,
  30102: healingPerformance,
  30103: healingPerformance,
  30104: healingPerformance,
  30105: healingPerformance,

  30071: defense,
  30072: defense,
  30073: defense,
  30074: defense,
  30075: defense,

  30271: hpUpDefenseDown,
  30272: hpUpDefenseDown,
  30273: hpUpDefenseDown,
  30274: hpUpDefenseDown,
  30275: hpUpDefenseDown,
};

export function getSkillCatalogEntry(
  skillId: number,
): SkillCatalogEntry | undefined {
  return SKILL_CATALOG_BY_ID[skillId];
}

export function getSkillCatalogOptions(): SkillCatalogOption[] {
  const optionsByKey: Record<NormalizedSkillKey, SkillCatalogOption> = {};

  for (const entry of Object.values(SKILL_CATALOG_BY_ID)) {
    if (optionsByKey[entry.normalizedKey] !== undefined) {
      continue;
    }

    optionsByKey[entry.normalizedKey] = {
      key: entry.normalizedKey,
      label: entry.label,
      category: entry.category,
    };
  }

  return Object.values(optionsByKey).sort((left, right) =>
    left.label.localeCompare(right.label, "ja"),
  );
}

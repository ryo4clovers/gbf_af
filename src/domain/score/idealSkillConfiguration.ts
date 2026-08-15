import type {
  NormalizedArtifactSkill,
  NormalizedSkillKey,
} from "../skill/normalizedSkill";

export type ArtifactAttributeKey = "1" | "2" | "3" | "4" | "5" | "6";

export type ArtifactKindKey =
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10";

export type IdealSkillConfiguration = {
  id: string;
  comment: string;
  attributeKeys: ArtifactAttributeKey[];
  kindKeys: ArtifactKindKey[];
  firstSecondSlotSkillKeys: [
    NormalizedSkillKey | null,
    NormalizedSkillKey | null,
  ];
  thirdSlotSkillKey: NormalizedSkillKey | null;
  fourthSlotSkillKey: NormalizedSkillKey | null;
};

export type IdealSkillOption = {
  key: NormalizedSkillKey;
  label: string;
  aliases?: string[];
};

export const ARTIFACT_ATTRIBUTE_OPTIONS: ReadonlyArray<{
  key: ArtifactAttributeKey;
  label: string;
}> = [
  { key: "1", label: "火" },
  { key: "2", label: "水" },
  { key: "3", label: "土" },
  { key: "4", label: "風" },
  { key: "5", label: "光" },
  { key: "6", label: "闇" },
];

export const ARTIFACT_KIND_OPTIONS: ReadonlyArray<{
  key: ArtifactKindKey;
  label: string;
}> = [
  { key: "1", label: "剣" },
  { key: "2", label: "短剣" },
  { key: "3", label: "槍" },
  { key: "4", label: "斧" },
  { key: "5", label: "杖" },
  { key: "6", label: "銃" },
  { key: "7", label: "格闘" },
  { key: "8", label: "弓" },
  { key: "9", label: "楽器" },
  { key: "10", label: "刀" },
];

export const IDEAL_FIRST_SECOND_SLOT_OPTIONS: readonly IdealSkillOption[] = [
  { key: "attack_power", label: "攻撃力" },
  { key: "hp", label: "HP" },
  { key: "critical_rate", label: "クリティカル確率" },
  { key: "ougi_damage", label: "奥義ダメージ" },
  { key: "ability_damage", label: "アビリティダメージ" },
  { key: "debuff_success_rate", label: "弱体成功率" },
  { key: "double_attack_rate", label: "ダブルアタック確率" },
  { key: "triple_attack_rate", label: "トリプルアタック確率" },
  { key: "defense", label: "防御" },
  { key: "debuff_resistance", label: "弱体耐性" },
  { key: "dodge_rate", label: "回避率", aliases: ["回避"] },
  { key: "healing_performance", label: "回復性能" },
  { key: "element_attack", label: "自属性攻撃力" },
  { key: "advantageous_element_damage_reduction", label: "有利属性軽減" },
];

export const IDEAL_THIRD_SLOT_OPTIONS: readonly IdealSkillOption[] = [
  { key: "normal_attack_damage_cap", label: "通常攻撃ダメージ上限" },
  { key: "ability_damage_cap", label: "アビリティダメージ上限" },
  { key: "ougi_damage_cap", label: "奥義ダメージ上限" },
  {
    key: "normal_attack_supplemental_damage",
    label: "通常攻撃の与ダメージ上昇",
  },
  {
    key: "ability_supplemental_damage",
    label: "アビリティ与ダメージ上昇",
  },
  { key: "ougi_supplemental_damage", label: "奥義与ダメージ上昇" },
  { key: "ougi_special_damage_cap", label: "奥義ダメージ特殊上限UP" },
  { key: "chain_supplemental_damage", label: "チェイン与ダメージUP" },
  { key: "turn_damage_reduction", label: "ターンダメージを軽減" },
  { key: "regeneration", label: "再生" },
  { key: "full_hp_damage_up", label: "HPが100%の時、与ダメージUP" },
  {
    key: "high_hp_triple_attack_rate_up",
    label: "HPが50%以上の時、トリプルアタック確率UP",
  },
  {
    key: "low_hp_damage_reduction",
    label: "HPが50%以下の時、被ダメージを軽減",
  },
  {
    key: "critical_damage_cap_up",
    label: "クリティカル発動時、ダメージ上限UP",
  },
  {
    key: "hp_up_defense_down_70",
    label: "最大HP上昇/防御力-70%",
  },
  {
    key: "normal_cap_up_other_caps_down",
    label:
      "通常攻撃ダメージ上限UP/アビリティダメージ上限-80%/奥義ダメージ上限-60%",
  },
  {
    key: "ability_cap_up_other_caps_down",
    label:
      "アビリティダメージ上限UP/通常攻撃ダメージ上限-20%/奥義ダメージ上限-60%",
  },
  {
    key: "ougi_cap_up_other_caps_down",
    label:
      "奥義ダメージ上限UP/通常攻撃ダメージ上限-20%/アビリティダメージ上限-80%",
  },
  {
    key: "chance_to_keep_buff",
    label: "確率で強化効果が無効化されない",
  },
  {
    key: "chance_to_clear_debuff_on_attack",
    label: "確率で攻撃開始時に自分の弱体効果を1つ回復",
  },
];

export const IDEAL_FOURTH_SLOT_OPTIONS: readonly IdealSkillOption[] = [
  {
    key: "debuff_ability_enemy_damage_taken_up",
    label: "弱体アビリティ使用時、敵に被ダメージUP(2回)",
  },
  {
    key: "healing_ability_next_ally_echo",
    label:
      "回復アビリティ使用時、自分の次に配置されたキャラに自属性追撃効果(1回)",
  },
  {
    key: "link_ability_cooldown_reduction",
    label:
      "リンクアビリティを一定回数使用時に自分のリンクアビリティの再使用間隔を1ターン短縮",
  },
  {
    key: "long_cooldown_ability_damage_up",
    label: "使用間隔が10ターン以上のアビリティ使用時、自分に与ダメージUP",
  },
  {
    key: "ability_use_damage_cap_up_stacking",
    label: "アビリティを一定回数使用する度に自分にダメージ上限UP(累積)",
  },
  {
    key: "ability_damage_supplemental_stacking",
    label:
      "アビリティダメージを一定量与える毎に自分にアビリティ与ダメージ上昇(累積)",
  },
  {
    key: "single_attack_random_buffs",
    label: "1回攻撃発動時、自分に一定個数ランダムな強化効果",
  },
  {
    key: "turn_end_hp_spent_plain_damage",
    label:
      "ターン終了時、自分がそのターン中に消費したHPに応じて敵に無属性ダメージ",
  },
  {
    key: "turn_end_charge_spent_damage_up",
    label:
      "ターン終了時、自分がそのターン中に消費した奥義ゲージ量に応じて自分に与ダメージ上昇",
  },
  {
    key: "attack_start_few_debuffs_block",
    label: "攻撃開始時に敵の弱体効果の数が3つ以下の時、自分にブロック効果",
  },
  {
    key: "turn_end_low_hp_enemy_heal_once",
    label: "ターン終了時にHPが50%以下の敵がいる時、一度だけ自分のHPを回復",
  },
  {
    key: "sub_member_periodic_random_debuff",
    label:
      "サブメンバー時、一定ターン毎に敵全体にランダムな弱体効果を1つ付与(重複不可)",
  },
  {
    key: "targeted_repeatedly_element_echo_once",
    label:
      "一定回数敵の攻撃行動のターゲットになった場合、一度だけ自分に自属性追撃(1回)効果",
  },
  {
    key: "no_attack_turn_end_random_buffs",
    label:
      "攻撃行動を行わなかった場合、ターン終了時に自分に一定個数ランダムな強化効果",
  },
  {
    key: "potion_fatal_chain_gauge_up",
    label:
      "キュアポーションまたはオールポーション使用時にフェイタルチェインゲージUP(重複不可)",
  },
  {
    key: "attack_count_wild_attack_once",
    label: "敵に一定回数攻撃を与えた時、一度だけ自分に乱撃(3ヒット)効果(1回)",
  },
  {
    key: "knockout_party_random_buffs_once",
    label: "戦闘不能になった時、一度だけ味方全体に一定個数ランダムな強化効果",
  },
  {
    key: "battle_entry_damage_up_once",
    label: "バトル登場時に一度だけ自分の与ダメージUP",
  },
  {
    key: "battle_start_random_buffs",
    label: "バトル開始時に自分に一定個数ランダムな強化効果",
  },
  {
    key: "battle_start_one_turn_damage_reduction",
    label: "バトル開始時から1ターンの間被ダメージ減少",
  },
  {
    key: "battle_start_periodic_barrier",
    label: "バトル開始時と5ターン毎に自分にバリア効果",
  },
  {
    key: "battle_start_hp_cost_delayed_damage_cap_up",
    label:
      "バトル開始時に最大HPの20%を消費するが3ターン後、自分にダメージ上限UP",
  },
  {
    key: "first_ability_hp_cost_cooldown_reduction",
    label:
      "1番目のアビリティ使用時にHPを一定割合消費するが、1番目のアビリティの使用間隔を1ターン短縮(レベルに応じて消費割合DOWN)",
  },
  {
    key: "attack_start_chance_wild_attack",
    label: "攻撃開始時、確率で自分に乱撃(6ヒット)効果(1回)",
  },
  {
    key: "chance_advance_five_turns",
    label: "確率でターンの進行時に経過ターンを5ターン進める(重複不可)",
  },
  {
    key: "turn_end_chance_dispel_all",
    label: "ターン終了時、確率で敵の強化効果を全て無効化(重複不可)",
  },
  {
    key: "item_drop_rate_up",
    label: "アイテムドロップ率UP(重複不可) ◆サブメンバーにいる場合でも発動",
  },
  {
    key: "experience_gain_up",
    label: "獲得経験値UP(重複不可) ◆サブメンバーにいる場合でも発動",
  },
  {
    key: "random_earring_drop",
    label:
      "バトル終了時にランダムな耳飾りを入手することがある(レベルに応じて入手確率UP/重複不可) ◆サブメンバーにいる場合でも発動",
  },
];

export const ALL_ARTIFACT_ATTRIBUTE_KEYS = ARTIFACT_ATTRIBUTE_OPTIONS.map(
  (option) => option.key,
);

export const ALL_ARTIFACT_KIND_KEYS = ARTIFACT_KIND_OPTIONS.map(
  (option) => option.key,
);

export function createDefaultIdealSkillConfiguration(
  id: string,
): IdealSkillConfiguration {
  return {
    id,
    comment: "",
    attributeKeys: [...ALL_ARTIFACT_ATTRIBUTE_KEYS],
    kindKeys: [...ALL_ARTIFACT_KIND_KEYS],
    firstSecondSlotSkillKeys: ["element_attack", "triple_attack_rate"],
    thirdSlotSkillKey: "normal_attack_damage_cap",
    fourthSlotSkillKey: null,
  };
}

export function createEmptyIdealSkillConfiguration(
  id: string,
): IdealSkillConfiguration {
  return {
    id,
    comment: "",
    attributeKeys: [...ALL_ARTIFACT_ATTRIBUTE_KEYS],
    kindKeys: [...ALL_ARTIFACT_KIND_KEYS],
    firstSecondSlotSkillKeys: [null, null],
    thirdSlotSkillKey: null,
    fourthSlotSkillKey: null,
  };
}

export function doesIdealSkillOptionMatch(
  optionKey: NormalizedSkillKey,
  skill: NormalizedArtifactSkill,
): boolean {
  const option = getIdealSkillOption(optionKey);

  if (option === undefined) {
    return optionKey === skill.normalizedKey;
  }

  if (option.key === skill.normalizedKey) {
    return true;
  }

  const normalizedRawName = normalizeSkillLabel(skill.rawName);
  return [option.label, ...(option.aliases ?? [])].some(
    (label) => normalizeSkillLabel(label) === normalizedRawName,
  );
}

export function getIdealSkillOption(
  optionKey: NormalizedSkillKey,
): IdealSkillOption | undefined {
  return ALL_IDEAL_SKILL_OPTIONS.find((option) => option.key === optionKey);
}

export function validateIdealSkillConfigurations(
  configurations: unknown,
): string | null {
  if (!Array.isArray(configurations)) {
    return "Ideal skill configurations are required.";
  }

  const ids = new Set<string>();
  const validatedConfigurations: IdealSkillConfiguration[] = [];

  for (const configuration of configurations) {
    if (typeof configuration !== "object" || configuration === null) {
      return "Ideal skill configurations are invalid.";
    }

    const id = Reflect.get(configuration, "id");
    const comment = Reflect.get(configuration, "comment");
    const attributeKeys = Reflect.get(configuration, "attributeKeys");
    const kindKeys = Reflect.get(configuration, "kindKeys");
    const firstSecondSlotSkillKeys = Reflect.get(
      configuration,
      "firstSecondSlotSkillKeys",
    );
    const thirdSlotSkillKey = Reflect.get(configuration, "thirdSlotSkillKey");
    const fourthSlotSkillKey = Reflect.get(configuration, "fourthSlotSkillKey");
    const firstSecondSlotSkillKey = Array.isArray(firstSecondSlotSkillKeys)
      ? firstSecondSlotSkillKeys[0]
      : undefined;
    const secondSlotSkillKey = Array.isArray(firstSecondSlotSkillKeys)
      ? firstSecondSlotSkillKeys[1]
      : undefined;

    if (typeof id !== "string" || id.trim().length === 0 || ids.has(id)) {
      return "Ideal skill configuration ids must be unique non-empty strings.";
    }

    if (typeof comment !== "string") {
      return "Ideal skill configuration comments must be strings.";
    }

    ids.add(id);

    if (
      !isValidSelection(attributeKeys, ALL_ARTIFACT_ATTRIBUTE_KEYS) ||
      attributeKeys.length === 0
    ) {
      return "Each ideal skill configuration requires at least one valid attribute.";
    }

    if (
      !isValidSelection(kindKeys, ALL_ARTIFACT_KIND_KEYS) ||
      kindKeys.length === 0
    ) {
      return "Each ideal skill configuration requires at least one valid weapon kind.";
    }

    if (
      !Array.isArray(firstSecondSlotSkillKeys) ||
      firstSecondSlotSkillKeys.length !== 2 ||
      !isValidOptionalSkillKey(
        firstSecondSlotSkillKey,
        IDEAL_FIRST_SECOND_SLOT_OPTIONS,
      ) ||
      !isValidOptionalSkillKey(
        secondSlotSkillKey,
        IDEAL_FIRST_SECOND_SLOT_OPTIONS,
      )
    ) {
      return "The first and second ideal skill slots are invalid.";
    }

    if (
      !isValidOptionalSkillKey(thirdSlotSkillKey, IDEAL_THIRD_SLOT_OPTIONS) ||
      !isValidOptionalSkillKey(fourthSlotSkillKey, IDEAL_FOURTH_SLOT_OPTIONS)
    ) {
      return "The third or fourth ideal skill slot is invalid.";
    }

    validatedConfigurations.push({
      id,
      comment,
      attributeKeys,
      kindKeys,
      firstSecondSlotSkillKeys: [firstSecondSlotSkillKey, secondSlotSkillKey],
      thirdSlotSkillKey,
      fourthSlotSkillKey,
    });
  }

  for (
    let leftIndex = 0;
    leftIndex < validatedConfigurations.length;
    leftIndex += 1
  ) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < validatedConfigurations.length;
      rightIndex += 1
    ) {
      const left = validatedConfigurations[leftIndex];
      const right = validatedConfigurations[rightIndex];

      if (
        left !== undefined &&
        right !== undefined &&
        selectionsOverlap(left.attributeKeys, right.attributeKeys) &&
        selectionsOverlap(left.kindKeys, right.kindKeys)
      ) {
        return "Ideal skill configuration attribute and weapon-kind ranges must not overlap.";
      }
    }
  }

  return null;
}

const ALL_IDEAL_SKILL_OPTIONS = [
  ...IDEAL_FIRST_SECOND_SLOT_OPTIONS,
  ...IDEAL_THIRD_SLOT_OPTIONS,
  ...IDEAL_FOURTH_SLOT_OPTIONS,
];

function normalizeSkillLabel(label: string): string {
  return label
    .trim()
    .replaceAll("&", "/")
    .replaceAll("％", "%")
    .replace(/[\s　]+/g, " ");
}

function isValidSelection<T extends string>(
  value: unknown,
  validValues: readonly T[],
): value is T[] {
  return (
    Array.isArray(value) &&
    new Set(value).size === value.length &&
    value.every(
      (item) =>
        typeof item === "string" &&
        validValues.some((validValue) => validValue === item),
    )
  );
}

function isValidOptionalSkillKey(
  value: unknown,
  options: readonly IdealSkillOption[],
): value is NormalizedSkillKey | null {
  return (
    value === null ||
    (typeof value === "string" &&
      options.some((option) => option.key === value))
  );
}

function selectionsOverlap<T>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  const leftValues = new Set(left);
  return right.some((value) => leftValues.has(value));
}

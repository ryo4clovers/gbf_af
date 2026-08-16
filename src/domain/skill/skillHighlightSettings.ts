import type { NormalizedSkillKey } from "./normalizedSkill";

export type SkillHighlightSettings = Partial<
  Record<NormalizedSkillKey, string>
>;

export const DEFAULT_SKILL_HIGHLIGHT_COLOR = "#fff1a8";

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

export function normalizeSkillHighlightSettings(
  value: unknown,
): SkillHighlightSettings {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  const settings: SkillHighlightSettings = {};

  for (const [skillKey, color] of Object.entries(value)) {
    if (typeof color === "string" && HEX_COLOR_PATTERN.test(color)) {
      settings[skillKey as NormalizedSkillKey] = color.toLowerCase();
    }
  }

  return settings;
}

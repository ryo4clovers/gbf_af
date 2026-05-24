import type { ParsedEffectValue } from "./artifact";

export function parseEffectValue(valueText: string): ParsedEffectValue | null {
  const normalized = valueText.trim().replace(/^\+/, "");

  if (normalized.length === 0) {
    return null;
  }

  const value = Number.parseFloat(normalized.replace(/[%倍回]/g, ""));

  if (Number.isNaN(value)) {
    return {
      value: 0,
      unit: "unknown",
    };
  }

  if (normalized.endsWith("%")) {
    return {
      value,
      unit: "percent",
    };
  }

  if (normalized.endsWith("倍")) {
    return {
      value,
      unit: "times",
    };
  }

  if (normalized.endsWith("回")) {
    return {
      value,
      unit: "count",
    };
  }

  return {
    value,
    unit: "flat",
  };
}

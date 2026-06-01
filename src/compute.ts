/**
 * shipcard — language breakdown computation.
 *
 * Pure helpers that turn raw byte/count maps (from the GitHub languages API or
 * a local file scan) into the normalized, color-tagged, percentage-bearing
 * slices the renderer consumes.
 */

import { colorForLanguage } from "./languages.js";
import type { CardLanguage } from "./render.js";

/**
 * Convert a `{ language: bytes }` map into ranked {@link CardLanguage} slices.
 *
 * Languages are sorted largest first, percentages are computed against the
 * total, and only the top `limit` are kept (so the bar and legend stay
 * readable). Percentages are rounded to one decimal but reflect the full set,
 * not just the kept slices, so a long tail reads as a smaller top bar rather
 * than being silently inflated.
 */
export function computeLanguages(
  bytesByLanguage: Record<string, number>,
  limit = 6,
): CardLanguage[] {
  const entries = Object.entries(bytesByLanguage).filter(([, b]) => b > 0);
  const total = entries.reduce((sum, [, b]) => sum + b, 0);
  if (total <= 0) return [];

  entries.sort((a, b) => b[1] - a[1]);

  return entries.slice(0, limit).map(([name, bytes]) => ({
    name,
    percent: Math.round((bytes / total) * 1000) / 10,
    color: colorForLanguage(name),
  }));
}

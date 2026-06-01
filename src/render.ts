/**
 * shiptag — the SVG card renderer.
 *
 * `renderCard` is a pure function: given normalized repo data it returns a
 * standalone, self-contained SVG string. No I/O, no network, no globals — which
 * makes it trivially testable and embeddable.
 */

/** A single language slice of the card's language bar. */
export interface CardLanguage {
  /** Display name, e.g. "TypeScript". */
  name: string;
  /** Share of the bar, 0–100. */
  percent: number;
  /** Hex color, e.g. "#3178c6". */
  color: string;
}

/** Normalized repo data the card is rendered from. */
export interface CardData {
  /** Repository name, e.g. "shiptag". */
  name: string;
  /** Owner / org, e.g. "abdulmunimjemal". */
  owner: string;
  /** One-line description (or AI summary). */
  description: string;
  /** Languages, largest first; percentages should roughly sum to 100. */
  languages: CardLanguage[];
  /** Star count, if known. */
  stars?: number;
  /** Fork count, if known. */
  forks?: number;
}

/** Card theme. */
export type Theme = "dark" | "light";

/** Card dimensions. `og` is the 1200×630 social size; `card` is compact. */
export type Size = "og" | "card";

/** Options accepted by {@link renderCard}. */
export interface RenderOptions {
  theme?: Theme;
  size?: Size;
}

interface Palette {
  bgFrom: string;
  bgTo: string;
  text: string;
  muted: string;
  accent: string;
  track: string;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    bgFrom: "#0d1117",
    bgTo: "#161b22",
    text: "#f0f6fc",
    muted: "#8b949e",
    accent: "#58a6ff",
    track: "#21262d",
  },
  light: {
    bgFrom: "#ffffff",
    bgTo: "#f6f8fa",
    text: "#1f2328",
    muted: "#636c76",
    accent: "#0969da",
    track: "#eaeef2",
  },
};

interface Dimensions {
  width: number;
  height: number;
}

const SIZES: Record<Size, Dimensions> = {
  og: { width: 1200, height: 630 },
  card: { width: 800, height: 320 },
};

/** Escape a string for safe inclusion in SVG text/attribute content. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Format a count compactly: 1234 → "1.2k", 1_500_000 → "1.5M". */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const v = n / 1000;
    return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}k`;
  }
  const v = n / 1_000_000;
  return `${v >= 100 ? Math.round(v) : v.toFixed(1).replace(/\.0$/, "")}M`;
}

/**
 * Truncate `text` to at most `max` characters, appending an ellipsis when cut.
 * Operates on code points so multi-byte characters aren't split.
 */
function truncate(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return `${chars.slice(0, Math.max(0, max - 1)).join("")}…`;
}

/**
 * Render the language bar as a list of `<rect>` segments laid out left to
 * right. Each segment is sized by its share of the total percentage so the bar
 * always fills the available width even if percentages don't sum to exactly
 * 100.
 */
function renderLanguageBar(
  languages: CardLanguage[],
  x: number,
  y: number,
  width: number,
  height: number,
  trackColor: string,
): string {
  const radius = height / 2;
  const track = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" fill="${trackColor}" />`;

  const total = languages.reduce((sum, l) => sum + Math.max(0, l.percent), 0);
  if (total <= 0 || languages.length === 0) return track;

  const segments: string[] = [];
  let offset = 0;
  languages.forEach((lang, index) => {
    const share = Math.max(0, lang.percent) / total;
    let segWidth = share * width;
    // Absorb rounding into the last segment so the bar fills exactly.
    if (index === languages.length - 1) segWidth = width - offset;
    if (segWidth <= 0) return;
    segments.push(
      `<rect x="${(x + offset).toFixed(2)}" y="${y}" width="${segWidth.toFixed(2)}" height="${height}" fill="${escapeXml(lang.color)}" />`,
    );
    offset += segWidth;
  });

  // Clip the colored segments to a rounded rectangle for clean end caps.
  return `${track}<clipPath id="sc-bar"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" /></clipPath><g clip-path="url(#sc-bar)">${segments.join("")}</g>`;
}

/** Render the language legend (color dot + name + percent) as a flowing row. */
function renderLegend(
  languages: CardLanguage[],
  x: number,
  y: number,
  textColor: string,
  mutedColor: string,
  fontSize: number,
): string {
  const parts: string[] = [];
  let cursor = x;
  const dot = fontSize * 0.55;
  for (const lang of languages) {
    const label = `${lang.name} ${lang.percent.toFixed(lang.percent < 10 ? 1 : 0)}%`;
    parts.push(
      `<circle cx="${(cursor + dot / 2).toFixed(2)}" cy="${(y - fontSize * 0.3).toFixed(2)}" r="${(dot / 2).toFixed(2)}" fill="${escapeXml(lang.color)}" />`,
    );
    parts.push(
      `<text x="${(cursor + dot + 8).toFixed(2)}" y="${y}" font-size="${fontSize}" fill="${textColor}" font-weight="500">${escapeXml(lang.name)}</text>`,
    );
    parts.push(
      `<text x="${(cursor + dot + 8 + estimateWidth(lang.name, fontSize) + 8).toFixed(2)}" y="${y}" font-size="${fontSize}" fill="${mutedColor}">${escapeXml(`${lang.percent.toFixed(lang.percent < 10 ? 1 : 0)}%`)}</text>`,
    );
    // Advance the cursor past dot + name + percent + gap.
    cursor +=
      dot + 8 + estimateWidth(label, fontSize) + 16 + estimateWidth("%", fontSize);
  }
  return parts.join("");
}

/** Rough monospace-ish width estimate for layout (no font metrics available). */
function estimateWidth(text: string, fontSize: number): number {
  return Array.from(text).length * fontSize * 0.58;
}

/**
 * Render a polished, standalone SVG card from normalized repo `data`.
 *
 * The result is a complete `<svg>…</svg>` document suitable for writing to a
 * file, embedding in a README, or serving as a social preview image.
 */
export function renderCard(
  data: CardData,
  options: RenderOptions = {},
): string {
  const theme = options.theme ?? "dark";
  const size = options.size ?? "og";
  const palette = PALETTES[theme];
  const { width, height } = SIZES[size];

  const scale = size === "og" ? 1 : 0.72;
  const pad = Math.round(64 * scale);

  const ownerSize = Math.round(28 * scale);
  const nameSize = Math.round(72 * scale);
  const descSize = Math.round(30 * scale);
  const statSize = Math.round(28 * scale);
  const legendSize = Math.round(24 * scale);

  const barHeight = Math.round(18 * scale);
  const barWidth = width - pad * 2;

  const descMax = size === "og" ? 78 : 64;

  const owner = escapeXml(truncate(data.owner, 40));
  const name = escapeXml(truncate(data.name, 28));
  const description = escapeXml(truncate(data.description || "", descMax));

  // Vertical rhythm, top to bottom.
  const ownerY = pad + ownerSize;
  const nameY = ownerY + nameSize + Math.round(8 * scale);
  const descY = nameY + descSize + Math.round(24 * scale);

  // Anchor the language section + stats near the bottom.
  const legendY = height - pad - Math.round(8 * scale);
  const barY = legendY - barHeight - Math.round(28 * scale);
  const statsY = barY - Math.round(36 * scale);

  const stats: string[] = [];
  let statX = pad;
  const pushStat = (glyph: string, value: number) => {
    const text = formatCount(value);
    stats.push(
      `<text x="${statX}" y="${statsY}" font-size="${statSize}" fill="${palette.muted}">${glyph}</text>`,
    );
    stats.push(
      `<text x="${statX + Math.round(statSize * 1.2)}" y="${statsY}" font-size="${statSize}" fill="${palette.text}" font-weight="600">${escapeXml(text)}</text>`,
    );
    statX +=
      Math.round(statSize * 1.2) + estimateWidth(text, statSize) + Math.round(40 * scale);
  };
  if (typeof data.stars === "number") pushStat("★", data.stars);
  if (typeof data.forks === "number") pushStat("⎇", data.forks);

  const bar = renderLanguageBar(
    data.languages,
    pad,
    barY,
    barWidth,
    barHeight,
    palette.track,
  );
  const legend = renderLegend(
    data.languages.slice(0, size === "og" ? 6 : 4),
    pad,
    legendY,
    palette.text,
    palette.muted,
    legendSize,
  );

  const fontStack =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(`${data.owner}/${data.name}`)}">
  <defs>
    <linearGradient id="sc-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${palette.bgFrom}" />
      <stop offset="100%" stop-color="${palette.bgTo}" />
    </linearGradient>
  </defs>
  <style>text { font-family: ${fontStack}; }</style>
  <rect width="${width}" height="${height}" fill="url(#sc-bg)" />
  <rect x="0" y="0" width="${width}" height="${Math.round(6 * scale)}" fill="${palette.accent}" />
  <text x="${pad}" y="${ownerY}" font-size="${ownerSize}" fill="${palette.accent}" font-weight="600">${owner}/</text>
  <text x="${pad}" y="${nameY}" font-size="${nameSize}" fill="${palette.text}" font-weight="800">${name}</text>
  <text x="${pad}" y="${descY}" font-size="${descSize}" fill="${palette.muted}">${description}</text>
  ${stats.join("\n  ")}
  ${bar}
  ${legend}
</svg>
`;
}

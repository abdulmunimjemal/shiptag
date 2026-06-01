import { describe, expect, it } from "vitest";

import {
  renderCard,
  escapeXml,
  formatCount,
  computeLanguages,
  colorForLanguage,
  NEUTRAL_COLOR,
  type CardData,
} from "../src/index.js";

const sample: CardData = {
  name: "shipcard",
  owner: "abdulmunimjemal",
  description: "Generate a beautiful, shareable SVG card for any repository.",
  languages: [
    { name: "TypeScript", percent: 82.5, color: "#3178c6" },
    { name: "JavaScript", percent: 12.5, color: "#f1e05a" },
    { name: "CSS", percent: 5, color: "#563d7c" },
  ],
  stars: 1234,
  forks: 56,
};

describe("escapeXml", () => {
  it("escapes the five XML special characters", () => {
    expect(escapeXml(`<a href="x" & 'y'>`)).toBe(
      "&lt;a href=&quot;x&quot; &amp; &apos;y&apos;&gt;",
    );
  });
});

describe("formatCount", () => {
  it("formats counts compactly", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(999)).toBe("999");
    expect(formatCount(1234)).toBe("1.2k");
    expect(formatCount(1_500_000)).toBe("1.5M");
  });
});

describe("renderCard", () => {
  it("produces a well-formed standalone SVG", () => {
    const svg = renderCard(sample);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.trimEnd().endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("uses the og size by default and card when requested", () => {
    expect(renderCard(sample)).toContain('width="1200" height="630"');
    expect(renderCard(sample, { size: "card" })).toContain(
      'width="800" height="320"',
    );
  });

  it("contains the repo name, owner, and description", () => {
    const svg = renderCard(sample);
    expect(svg).toContain("shipcard");
    expect(svg).toContain("abdulmunimjemal");
    expect(svg).toContain("shareable SVG card");
  });

  it("renders the language bar with each language color", () => {
    const svg = renderCard(sample);
    for (const lang of sample.languages) {
      expect(svg).toContain(lang.color);
    }
    // A clipped group of colored rects forms the bar.
    expect(svg).toContain('clip-path="url(#sc-bar)"');
  });

  it("renders the legend with percentages", () => {
    const svg = renderCard(sample);
    expect(svg).toContain("TypeScript");
    expect(svg).toContain("83%");
    expect(svg).toContain("13%");
  });

  it("escapes XML in user-controlled fields", () => {
    const svg = renderCard({
      ...sample,
      name: "a<b>",
      description: "tom & jerry",
    });
    expect(svg).toContain("a&lt;b&gt;");
    expect(svg).toContain("tom &amp; jerry");
    expect(svg).not.toContain("a<b>");
  });

  it("renders stats when stars/forks are present and omits when absent", () => {
    expect(renderCard(sample)).toContain("★");
    const noStats = renderCard({ ...sample, stars: undefined, forks: undefined });
    expect(noStats).not.toContain("★");
  });

  it("supports a light theme", () => {
    const light = renderCard(sample, { theme: "light" });
    expect(light).toContain("#ffffff");
  });

  it("renders a sensible bar even with no languages", () => {
    const svg = renderCard({ ...sample, languages: [] });
    expect(svg.startsWith("<svg")).toBe(true);
  });
});

describe("computeLanguages", () => {
  it("computes percentages that sum to ~100 and ranks largest first", () => {
    const langs = computeLanguages({ TypeScript: 800, JavaScript: 150, CSS: 50 });
    expect(langs[0].name).toBe("TypeScript");
    const sum = langs.reduce((s, l) => s + l.percent, 0);
    expect(sum).toBeGreaterThan(99);
    expect(sum).toBeLessThan(101);
  });

  it("tags known languages with their color and unknowns with neutral", () => {
    const langs = computeLanguages({ TypeScript: 100, Brainfuck: 100 });
    const ts = langs.find((l) => l.name === "TypeScript");
    const bf = langs.find((l) => l.name === "Brainfuck");
    expect(ts?.color).toBe("#3178c6");
    expect(bf?.color).toBe(NEUTRAL_COLOR);
  });

  it("ignores zero/empty inputs and respects the limit", () => {
    expect(computeLanguages({})).toEqual([]);
    expect(computeLanguages({ A: 0 })).toEqual([]);
    const many = computeLanguages(
      { a: 7, b: 6, c: 5, d: 4, e: 3, f: 2, g: 1 },
      3,
    );
    expect(many).toHaveLength(3);
  });
});

describe("colorForLanguage", () => {
  it("returns the mapped color or a neutral fallback", () => {
    expect(colorForLanguage("Go")).toBe("#00add8");
    expect(colorForLanguage("Nonexistent")).toBe(NEUTRAL_COLOR);
  });
});

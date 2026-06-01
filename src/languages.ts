/**
 * shipcard — language metadata.
 *
 * A small embedded map of common languages to their canonical colors (the same
 * palette GitHub uses for its language bars) plus file-extension → language
 * resolution for local-mode scanning. Anything not in the map falls back to a
 * neutral grey so the card always renders sensibly.
 */

/** Neutral fallback color for unknown languages. */
export const NEUTRAL_COLOR = "#8b949e";

/** Canonical display color for common languages. */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  Java: "#b07219",
  C: "#555555",
  "C++": "#f34b7d",
  "C#": "#178600",
  Ruby: "#701516",
  PHP: "#4f5d95",
  Swift: "#f05138",
  Kotlin: "#a97bff",
  Dart: "#00b4ab",
  Scala: "#c22d40",
  Shell: "#89e051",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
  Lua: "#000080",
  Perl: "#0298c3",
  "Objective-C": "#438eff",
  R: "#198ce7",
  Julia: "#a270ba",
  Clojure: "#db5855",
  Zig: "#ec915c",
  Markdown: "#083fa1",
  JSON: "#292929",
  YAML: "#cb171e",
  Dockerfile: "#384d54",
  Makefile: "#427819",
};

/**
 * Map a known language name to its color, falling back to a neutral grey for
 * anything not in the table.
 */
export function colorForLanguage(name: string): string {
  return LANGUAGE_COLORS[name] ?? NEUTRAL_COLOR;
}

/**
 * Map a lowercased file extension (no leading dot) to a canonical language
 * name. Used by local-mode scanning; extensions that aren't code are omitted
 * so they don't pollute the language breakdown.
 */
export const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript",
  mts: "TypeScript",
  cts: "TypeScript",
  js: "JavaScript",
  jsx: "JavaScript",
  mjs: "JavaScript",
  cjs: "JavaScript",
  py: "Python",
  rs: "Rust",
  go: "Go",
  java: "Java",
  c: "C",
  h: "C",
  cc: "C++",
  cpp: "C++",
  cxx: "C++",
  hpp: "C++",
  cs: "C#",
  rb: "Ruby",
  php: "PHP",
  swift: "Swift",
  kt: "Kotlin",
  kts: "Kotlin",
  dart: "Dart",
  scala: "Scala",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  html: "HTML",
  htm: "HTML",
  css: "CSS",
  scss: "SCSS",
  vue: "Vue",
  svelte: "Svelte",
  ex: "Elixir",
  exs: "Elixir",
  hs: "Haskell",
  lua: "Lua",
  pl: "Perl",
  pm: "Perl",
  m: "Objective-C",
  r: "R",
  jl: "Julia",
  clj: "Clojure",
  zig: "Zig",
  md: "Markdown",
  markdown: "Markdown",
  json: "JSON",
  yml: "YAML",
  yaml: "YAML",
};

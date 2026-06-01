/**
 * shiptag — generate a beautiful, shareable SVG card for any repository.
 *
 * Public library API. The renderer ({@link renderCard}) and the language
 * computation are pure; the GitHub, local, and summary data sources are kept
 * separate so network access stays isolated and testable.
 */

export {
  renderCard,
  escapeXml,
  formatCount,
  type CardData,
  type CardLanguage,
  type RenderOptions,
  type Theme,
  type Size,
} from "./render.js";

export { computeLanguages } from "./compute.js";

export {
  LANGUAGE_COLORS,
  EXTENSION_LANGUAGES,
  NEUTRAL_COLOR,
  colorForLanguage,
} from "./languages.js";

export { fetchGitHubCard, parseSlug, GitHubError } from "./github.js";

export { buildLocalCard, parseRemote } from "./local.js";

export {
  generateSummary,
  SummaryError,
  type SummaryOptions,
} from "./summary.js";

#!/usr/bin/env node
/**
 * shiptag CLI — generate a beautiful, shareable SVG card for any repository.
 *
 * Usage:
 *   shiptag owner/repo                 GitHub mode (network)
 *   shiptag --local [path]             local mode (offline)
 *   shiptag owner/repo -o card.svg     write to a file
 *
 * Exit codes: 0 ok, 1 fetch/network error, 2 usage error.
 */

import { writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import {
  renderCard,
  fetchGitHubCard,
  buildLocalCard,
  generateSummary,
  GitHubError,
  SummaryError,
  type CardData,
  type Theme,
  type Size,
} from "./index.js";

const VERSION = "0.1.0";

const HELP = `shiptag — a beautiful, shareable SVG card for any repository

Usage:
  shiptag <owner/repo> [options]      Fetch repo metadata from GitHub
  shiptag --local [path] [options]    Build from a local repo (offline)

Options:
  -o, --out <file>     Write the SVG to <file> (default: stdout).
      --theme <name>   Card theme: dark | light (default: dark).
      --size <name>    Card size: og (1200x630) | card (compact) (default: og).
      --local [path]   Offline mode: read package.json, git origin, and scan
                       file extensions in [path] (default: current directory).
      --summary        Replace the description with a one-line AI summary via an
                       OpenAI-compatible API (needs OPENAI_API_KEY). Off by
                       default.
      --base-url <url> Base URL for the --summary API (default: OpenAI).
  -h, --help           Show this help.
  -v, --version        Show version.

Environment:
  GITHUB_TOKEN         Optional; lifts the GitHub API rate limit.
  OPENAI_API_KEY       Required only when --summary is used.

Exit codes: 0 ok, 1 fetch error, 2 usage error.
`;

function usage(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(2);
}

function fail(message: string): never {
  process.stderr.write(`error: ${message}\n`);
  process.exit(1);
}

function parseTheme(value: string | undefined): Theme {
  if (value === undefined) return "dark";
  if (value !== "dark" && value !== "light") {
    usage(`invalid --theme '${value}' (expected dark|light)`);
  }
  return value;
}

function parseSize(value: string | undefined): Size {
  if (value === undefined) return "og";
  if (value !== "og" && value !== "card") {
    usage(`invalid --size '${value}' (expected og|card)`);
  }
  return value;
}

async function main(): Promise<void> {
  let parsed;
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      allowPositionals: true,
      options: {
        out: { type: "string", short: "o" },
        theme: { type: "string" },
        size: { type: "string" },
        local: { type: "boolean", default: false },
        summary: { type: "boolean", default: false },
        "base-url": { type: "string" },
        help: { type: "boolean", short: "h", default: false },
        version: { type: "boolean", short: "v", default: false },
      },
    });
  } catch (err) {
    usage(err instanceof Error ? err.message : String(err));
  }

  const { values, positionals } = parsed;

  if (values.help) {
    process.stdout.write(HELP);
    return;
  }
  if (values.version) {
    process.stdout.write(`${VERSION}\n`);
    return;
  }

  const theme = parseTheme(values.theme);
  const size = parseSize(values.size);

  let data: CardData;

  if (values.local) {
    // In local mode the first positional, if any, is the path.
    const path = positionals[0] ?? ".";
    data = buildLocalCard(path);
  } else {
    if (positionals.length === 0) {
      usage("missing <owner/repo> — or pass --local for offline mode (see --help)");
    }
    if (positionals.length > 1) {
      usage(`unexpected extra argument '${positionals[1]}'`);
    }
    try {
      data = await fetchGitHubCard(positionals[0]);
    } catch (err) {
      if (err instanceof GitHubError) fail(err.message);
      fail(err instanceof Error ? err.message : String(err));
    }
  }

  if (values.summary) {
    try {
      data = { ...data, description: await generateSummary(data, {
        baseUrl: values["base-url"],
      }) };
    } catch (err) {
      if (err instanceof SummaryError) fail(err.message);
      fail(err instanceof Error ? err.message : String(err));
    }
  }

  const svg = renderCard(data, { theme, size });

  if (values.out) {
    try {
      writeFileSync(values.out, svg, "utf8");
    } catch (err) {
      fail(
        `cannot write '${values.out}': ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  } else {
    process.stdout.write(svg);
  }
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});

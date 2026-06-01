/**
 * shiptag — local (offline) data source.
 *
 * Builds {@link CardData} for a directory with no network access: name and
 * description come from `package.json`, owner/name fall back to the git
 * `origin` remote, and the language breakdown is computed by scanning file
 * extensions (skipping node_modules/.git/dist and other noise).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname, basename } from "node:path";

import { computeLanguages } from "./compute.js";
import { EXTENSION_LANGUAGES } from "./languages.js";
import type { CardData } from "./render.js";

/** Directories never descended into during a local scan. */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".next",
  ".cache",
  ".turbo",
  "vendor",
  "target",
]);

interface PackageJson {
  name?: string;
  description?: string;
  repository?: string | { url?: string };
}

/** Parse `owner/repo` out of a git remote URL (ssh or https forms). */
export function parseRemote(url: string): { owner: string; name: string } | null {
  const cleaned = url.trim().replace(/\.git$/, "");
  // git@github.com:owner/repo  or  https://github.com/owner/repo
  const match = cleaned.match(/[/:]([^/:]+)\/([^/]+)$/);
  if (!match) return null;
  return { owner: match[1], name: match[2] };
}

/** Read the `origin` (or first) remote URL from a `.git/config`, if present. */
function readGitOrigin(dir: string): string | null {
  let config: string;
  try {
    config = readFileSync(join(dir, ".git", "config"), "utf8");
  } catch {
    return null;
  }
  // Prefer [remote "origin"]; fall back to the first remote url found.
  const originBlock = config.match(
    /\[remote "origin"\][^[]*?url\s*=\s*(\S+)/,
  );
  if (originBlock) return originBlock[1];
  const anyUrl = config.match(/url\s*=\s*(\S+)/);
  return anyUrl ? anyUrl[1] : null;
}

/** Recursively scan `dir`, accumulating bytes per language by extension. */
function scanLanguages(dir: string): Record<string, number> {
  const bytes: Record<string, number> = {};

  const walk = (current: string): void => {
    let entries: string[];
    try {
      entries = readdirSync(current);
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".") && entry !== ".") {
        // Skip dotfiles/dotdirs except when explicitly the scan root.
        if (SKIP_DIRS.has(entry) || entry === ".git") continue;
      }
      const full = join(current, entry);
      let stat;
      try {
        stat = statSync(full);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        if (SKIP_DIRS.has(entry)) continue;
        walk(full);
      } else if (stat.isFile()) {
        const ext = extname(entry).slice(1).toLowerCase();
        const lang = ext
          ? EXTENSION_LANGUAGES[ext]
          : EXTENSION_LANGUAGES[basename(entry).toLowerCase()];
        if (lang) {
          bytes[lang] = (bytes[lang] ?? 0) + stat.size;
        }
      }
    }
  };

  walk(dir);
  return bytes;
}

/**
 * Build {@link CardData} for a local directory `dir` (default cwd) with no
 * network access.
 */
export function buildLocalCard(dir: string = process.cwd()): CardData {
  let pkg: PackageJson = {};
  try {
    pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as PackageJson;
  } catch {
    // No package.json — fall back to the directory name below.
  }

  const remoteUrl = readGitOrigin(dir);
  const remote = remoteUrl ? parseRemote(remoteUrl) : null;

  const repoUrl =
    typeof pkg.repository === "string"
      ? pkg.repository
      : pkg.repository?.url ?? "";
  const pkgRemote = repoUrl ? parseRemote(repoUrl) : null;

  const name =
    pkg.name?.replace(/^@[^/]+\//, "") ??
    remote?.name ??
    pkgRemote?.name ??
    basename(dir.replace(/\/+$/, "")) ??
    "repository";
  const owner = remote?.owner ?? pkgRemote?.owner ?? "local";

  return {
    name,
    owner,
    description: pkg.description ?? "",
    languages: computeLanguages(scanLanguages(dir)),
  };
}

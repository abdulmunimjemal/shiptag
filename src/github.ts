/**
 * shiptag — GitHub data source.
 *
 * Fetches repo metadata and the language breakdown from the GitHub REST API
 * using the global `fetch`. Network access is confined to this module so the
 * renderer and computation stay pure and testable. Tests stub `fetch` via
 * `vi.stubGlobal`.
 */

import { computeLanguages } from "./compute.js";
import type { CardData } from "./render.js";

const API = "https://api.github.com";

/** Raised when the GitHub API can't be reached or returns a non-OK status. */
export class GitHubError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GitHubError";
  }
}

interface RepoResponse {
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  owner: { login: string };
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "shiptag",
  };
  const t = token ?? process.env.GITHUB_TOKEN;
  if (t) headers.Authorization = `Bearer ${t}`;
  return headers;
}

/** Split an `owner/repo` slug, throwing a usage-style error if malformed. */
export function parseSlug(slug: string): { owner: string; repo: string } {
  const parts = slug.split("/").filter(Boolean);
  if (parts.length !== 2) {
    throw new GitHubError(
      `invalid repository '${slug}' — expected the form 'owner/repo'`,
    );
  }
  return { owner: parts[0], repo: parts[1] };
}

/**
 * Fetch and normalize a repository into {@link CardData} from GitHub.
 *
 * `slug` is `owner/repo`. An optional `token` (otherwise `GITHUB_TOKEN`) lifts
 * the unauthenticated rate limit.
 */
export async function fetchGitHubCard(
  slug: string,
  token?: string,
): Promise<CardData> {
  const { owner, repo } = parseSlug(slug);
  const headers = authHeaders(token);

  const [repoRes, langRes] = await Promise.all([
    fetch(`${API}/repos/${owner}/${repo}`, { headers }),
    fetch(`${API}/repos/${owner}/${repo}/languages`, { headers }),
  ]);

  if (!repoRes.ok) {
    throw new GitHubError(
      `GitHub API returned ${repoRes.status} for ${owner}/${repo}` +
        (repoRes.status === 404
          ? " (not found)"
          : repoRes.status === 403
            ? " (rate limited — set GITHUB_TOKEN)"
            : ""),
    );
  }

  const repoData = (await repoRes.json()) as RepoResponse;
  const langBytes = langRes.ok
    ? ((await langRes.json()) as Record<string, number>)
    : {};

  return {
    name: repoData.name,
    owner: repoData.owner?.login ?? owner,
    description: repoData.description ?? "",
    languages: computeLanguages(langBytes),
    stars: repoData.stargazers_count,
    forks: repoData.forks_count,
  };
}

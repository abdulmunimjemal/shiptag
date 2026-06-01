import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchGitHubCard, parseSlug, GitHubError } from "../src/index.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("parseSlug", () => {
  it("splits owner/repo", () => {
    expect(parseSlug("abdulmunimjemal/shipcard")).toEqual({
      owner: "abdulmunimjemal",
      repo: "shipcard",
    });
  });

  it("throws on malformed slugs", () => {
    expect(() => parseSlug("nope")).toThrow(GitHubError);
    expect(() => parseSlug("a/b/c")).toThrow(GitHubError);
  });
});

describe("fetchGitHubCard", () => {
  it("normalizes repo + languages from mocked fetch responses", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/languages")) {
        return jsonResponse({ TypeScript: 9000, JavaScript: 1000 });
      }
      return jsonResponse({
        name: "shipcard",
        description: "A lovely card",
        stargazers_count: 4321,
        forks_count: 21,
        owner: { login: "abdulmunimjemal" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const card = await fetchGitHubCard("abdulmunimjemal/shipcard");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(card.name).toBe("shipcard");
    expect(card.owner).toBe("abdulmunimjemal");
    expect(card.description).toBe("A lovely card");
    expect(card.stars).toBe(4321);
    expect(card.forks).toBe(21);
    expect(card.languages[0].name).toBe("TypeScript");
    expect(card.languages[0].percent).toBe(90);
    expect(card.languages[0].color).toBe("#3178c6");
  });

  it("sends an Authorization header when a token is provided", async () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) =>
      jsonResponse({
        name: "r",
        description: null,
        stargazers_count: 0,
        forks_count: 0,
        owner: { login: "o" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchGitHubCard("o/r", "secret-token");

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-token");
  });

  it("tolerates a missing description and a failed languages call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith("/languages")) return jsonResponse({}, false, 404);
      return jsonResponse({
        name: "r",
        description: null,
        stargazers_count: 0,
        forks_count: 0,
        owner: { login: "o" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const card = await fetchGitHubCard("o/r");
    expect(card.description).toBe("");
    expect(card.languages).toEqual([]);
  });

  it("throws GitHubError on a non-OK repo response", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 404));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGitHubCard("o/missing")).rejects.toThrow(GitHubError);
  });

  it("hints at rate limiting on a 403", async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 403));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGitHubCard("o/r")).rejects.toThrow(/rate limited/);
  });
});

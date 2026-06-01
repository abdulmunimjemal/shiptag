/**
 * shipcard — optional AI one-line summary.
 *
 * OFF by default. When `--summary` is passed, this asks an OpenAI-compatible
 * chat completions endpoint for a single punchy line describing the repo,
 * using a BYO `OPENAI_API_KEY`. All network access is isolated here; failures
 * are surfaced so the caller can fall back to the repo description.
 */

import type { CardData } from "./render.js";

const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-4o-mini";

/** Raised when the summary endpoint is misconfigured or unreachable. */
export class SummaryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SummaryError";
  }
}

export interface SummaryOptions {
  /** OpenAI-compatible base URL (default OpenAI). */
  baseUrl?: string;
  /** API key; defaults to `OPENAI_API_KEY`. */
  apiKey?: string;
  /** Model name (default gpt-4o-mini). */
  model?: string;
}

interface ChatResponse {
  choices?: { message?: { content?: string } }[];
}

/**
 * Produce a one-line AI summary for `data`. Returns the trimmed line; throws
 * {@link SummaryError} if no key is configured or the request fails.
 */
export async function generateSummary(
  data: CardData,
  options: SummaryOptions = {},
): Promise<string> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new SummaryError(
      "no API key — set OPENAI_API_KEY to use --summary",
    );
  }
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = options.model ?? DEFAULT_MODEL;

  const langs = data.languages.map((l) => l.name).join(", ") || "unknown";
  const prompt =
    `Repository: ${data.owner}/${data.name}\n` +
    `Languages: ${langs}\n` +
    `Description: ${data.description || "(none)"}\n\n` +
    "Write a single punchy line (max 80 characters) describing what this " +
    "repository is, for a social preview card. No quotes, no trailing period.";

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 60,
      }),
    });
  } catch (err) {
    throw new SummaryError(
      `request failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!res.ok) {
    throw new SummaryError(`summary API returned ${res.status}`);
  }

  const json = (await res.json()) as ChatResponse;
  const line = json.choices?.[0]?.message?.content?.trim();
  if (!line) {
    throw new SummaryError("summary API returned an empty response");
  }
  return line.replace(/^["']|["']$/g, "").replace(/\.$/, "");
}

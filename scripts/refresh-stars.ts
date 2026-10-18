/**
 * Refresh GitHub star counts in `data/tools/*.json`.
 *
 * Only `github.stars` and `github.checkedAt` are touched. Files whose star
 * count did not change are left byte-for-byte alone, and edits are made in
 * place so the existing key order and 2-space formatting survive. Run weekly
 * from .github/workflows/refresh-stars.yml, or locally:
 *
 *   GITHUB_TOKEN=$(gh auth token) npm run refresh:stars
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadTools } from "../src/data/load";
import type { Tool } from "../src/data/schema";

const API = "https://api.github.com";
const CONCURRENCY = 4;

const token = process.env.GITHUB_TOKEN?.trim() ?? "";
const today = new Date().toISOString().slice(0, 10);

interface RepoRef {
  owner: string;
  name: string;
}

interface Stats {
  stars: number;
  archived: boolean;
}

interface Result {
  slug: string;
  status: "changed" | "unchanged" | "failed";
  detail: string;
}

function parseRepo(repo: string): RepoRef | null {
  let url: URL;
  try {
    url = new URL(repo);
  } catch {
    return null;
  }
  if (url.hostname.replace(/^www\./, "").toLowerCase() !== "github.com") {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  if (!owner || !name) return null;
  return { owner, name };
}

async function fetchStats(repo: RepoRef): Promise<Stats> {
  const headers: Record<string, string> = {
    accept: "application/vnd.github+json",
    "user-agent": "ohmyharness-star-refresh/1.0 (+https://ohmyharness.com)",
    "x-github-api-version": "2022-11-28",
  };
  if (token) headers.authorization = `Bearer ${token}`;

  const response = await fetch(`${API}/repos/${repo.owner}/${repo.name}`, {
    headers,
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    const detail = remaining === "0" ? " (rate limit exhausted)" : "";
    throw new Error(`HTTP ${response.status}${detail}`);
  }

  const data = (await response.json()) as {
    stargazers_count?: unknown;
    archived?: unknown;
  };

  if (typeof data.stargazers_count !== "number") {
    throw new Error("response has no stargazers_count");
  }

  return {
    stars: data.stargazers_count,
    archived: data.archived === true,
  };
}

/**
 * Replace the two values inside the existing `github` object without
 * re-serialising the file. Returns null when no textual change was needed.
 */
function patchGithub(raw: string, stars: number, checkedAt: string): string | null {
  const block = raw.match(/"github"\s*:\s*\{[^}]*\}/);
  if (block) {
    const patched = block[0]
      .replace(/("stars"\s*:\s*)\d+/, `$1${stars}`)
      .replace(/("checkedAt"\s*:\s*)"[^"]*"/, `$1"${checkedAt}"`);
    return patched === block[0] ? null : raw.replace(block[0], patched);
  }

  const nullEntry = raw.match(/(^[ \t]*)"github"\s*:\s*null/m);
  if (!nullEntry) return null;

  const indent = nullEntry[1] ?? "";
  const object = [
    `${indent}"github": {`,
    `${indent}  "stars": ${stars},`,
    `${indent}  "checkedAt": "${checkedAt}"`,
    `${indent}}`,
  ].join("\n");

  return raw.replace(nullEntry[0], object);
}

async function refresh(tool: Tool, file: string, raw: string): Promise<Result> {
  if (!tool.repo) {
    return { slug: tool.slug, status: "unchanged", detail: "no repository" };
  }

  const repo = parseRepo(tool.repo);
  if (!repo) {
    return { slug: tool.slug, status: "failed", detail: "repo is not a GitHub repository" };
  }

  let stats: Stats;
  try {
    stats = await fetchStats(repo);
  } catch (error) {
    return {
      slug: tool.slug,
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  if (stats.archived && tool.status === "active") {
    console.warn(
      `⚠ ${tool.slug}: repository is archived but status is "active" — review the entry.`,
    );
  }

  const previous = tool.github?.stars;
  if (previous === stats.stars) {
    return { slug: tool.slug, status: "unchanged", detail: `${stats.stars} stars` };
  }

  const patched = patchGithub(raw, stats.stars, today);
  if (patched === null) {
    return {
      slug: tool.slug,
      status: "failed",
      detail: "could not find github.stars in the file",
    };
  }

  writeFileSync(file, patched);
  return {
    slug: tool.slug,
    status: "changed",
    detail:
      previous === undefined
        ? `${stats.stars} stars (added)`
        : `${previous} → ${stats.stars} stars`,
  };
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main(): Promise<void> {
  const { tools, issues, dir } = loadTools({ throwOnError: false });
  if (issues.length > 0) {
    throw new Error(
      `[ohmyharness] Cannot refresh stars: ${issues.length} invalid tool file(s).`,
    );
  }

  if (!token) {
    console.warn(
      "⚠ GITHUB_TOKEN is not set. Unauthenticated requests are limited to 60 per hour.",
    );
  }

  const results = await mapLimit(tools, CONCURRENCY, async (tool) => {
    const file = `${dir}/${tool.slug}.json`;
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      return { slug: tool.slug, status: "failed" as const, detail: "could not read file" };
    }
    return refresh(tool, file, raw);
  });

  const changed = results.filter((result) => result.status === "changed");
  const failed = results.filter((result) => result.status === "failed");
  const unchanged = results.length - changed.length - failed.length;

  for (const result of [...changed, ...failed].sort((a, b) =>
    a.slug.localeCompare(b.slug, "en"),
  )) {
    const marker = result.status === "changed" ? "✓" : "✗";
    console.log(`${marker} ${result.slug}: ${result.detail}`);
  }

  console.log(
    `\n${changed.length} changed, ${unchanged} unchanged, ${failed.length} failed (${today}).`,
  );

  if (failed.length > 0) process.exitCode = 1;
}

await main();

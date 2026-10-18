import { existsSync } from "node:fs";
import path from "node:path";
import { loadTools } from "../data/load";
import type { Tool, ToolKind } from "../data/schema";
import { FEATURES } from "./features";

export function getAllTools(): Tool[] {
  return loadTools().tools;
}

export function getTool(slug: string): Tool | undefined {
  return getAllTools().find((tool) => tool.slug === slug);
}

export function getToolsByKind(kind: ToolKind): Tool[] {
  return getAllTools().filter((tool) => tool.kind === kind);
}

export function countByKind(): Record<ToolKind, number> {
  const counts: Record<ToolKind, number> = {
    harness: 0,
    orchestrator: 0,
    "cloud-agent": 0,
    "add-on": 0,
  };
  for (const tool of getAllTools()) counts[tool.kind] += 1;
  return counts;
}

/** Add-ons that extend `slug`, alphabetical. */
export function getAddOnsFor(slug: string): Tool[] {
  return getAllTools().filter(
    (tool) => tool.kind === "add-on" && tool.extends === slug,
  );
}

/** Orchestrators and add-ons that list `slug` in their `drives` field. */
export function getDrivenBy(slug: string): Tool[] {
  return getAllTools().filter(
    (tool) =>
      (tool.kind === "orchestrator" || tool.kind === "add-on") &&
      tool.drives.includes(slug),
  );
}

/** Most recently verified tools first, then alphabetical. */
export function getRecentlyVerified(limit?: number): Tool[] {
  const sorted = [...getAllTools()].sort(
    (a, b) =>
      b.lastVerified.localeCompare(a.lastVerified, "en") ||
      a.name.localeCompare(b.name, "en"),
  );
  return limit === undefined ? sorted : sorted.slice(0, limit);
}

export interface ToolPair {
  a: Tool;
  b: Tool;
}

/**
 * Every same-kind pair, ordered by slug so each head-to-head has one canonical
 * URL. Pair strings are de-duplicated in case hyphenated slugs collide.
 */
export function getSameKindPairs(): ToolPair[] {
  const tools = [...getAllTools()].sort((a, b) =>
    a.slug.localeCompare(b.slug, "en"),
  );
  const pairs = new Map<string, ToolPair>();

  for (const a of tools) {
    for (const b of tools) {
      if (a.slug >= b.slug || a.kind !== b.kind) continue;
      const key = `${a.slug}-vs-${b.slug}`;
      if (!pairs.has(key)) pairs.set(key, { a, b });
    }
  }
  return [...pairs.values()];
}

/** Optional icon convention: drop `public/icons/<slug>.svg` in and it is used. */
export function iconFor(slug: string): string | null {
  const relative = `/icons/${slug}.svg`;
  const absolute = path.resolve(process.cwd(), "public", "icons", `${slug}.svg`);
  return existsSync(absolute) ? relative : null;
}

export function featureCount(tool: Tool): { confirmed: number; known: number } {
  let confirmed = 0;
  let known = 0;
  for (const feature of FEATURES) {
    const value = tool.features[feature.key];
    if (value !== null) known += 1;
    if (value === true) confirmed += 1;
  }
  return { confirmed, known };
}

export function latestVerified(): string | null {
  const dates = getAllTools()
    .map((tool) => tool.lastVerified)
    .sort()
    .reverse();
  return dates[0] ?? null;
}

export function formatStars(stars: number): string {
  if (stars >= 1_000_000) return `${(stars / 1_000_000).toFixed(1)}m`;
  if (stars >= 1_000) {
    const value = stars / 1_000;
    return `${value >= 100 ? Math.round(value) : value.toFixed(1)}k`;
  }
  return String(stars);
}

export function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export const REPO_URL = "https://github.com/gulivan/ohmyharness";
export const SITE_URL = "https://ohmyharness.com";

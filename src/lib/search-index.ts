import type { Tool } from "../data/schema";
import { FEATURES, KIND_LABELS } from "./features";
import { monogram, monogramStyle } from "./monogram";
import { priceLabel } from "./pricing";
import { iconFor } from "./tools";

/**
 * One compact document per tool for the header search. Long prose
 * (`description`) is deliberately left out: the index is fetched on the first
 * search, so it only carries the fields the scorer and the result row need.
 */
export interface SearchEntry {
  slug: string;
  name: string;
  kind: Tool["kind"];
  kindLabel: string;
  maker: string | null;
  tagline: string;
  interfaces: readonly string[];
  platforms: readonly string[];
  /** Display names of the tools this one runs, falling back to the slug. */
  drives: readonly string[];
  /** Display name of the tool an add-on extends, falling back to the slug. */
  extends: string | null;
  /** Confirmed feature keys (`true` only), in data order. */
  features: readonly string[];
  /** Human labels for `features`, so "PR integration" can match too. */
  featureLabels: readonly string[];
  /** Short starting-price label, e.g. "Free" or "From $20/mo". */
  price: string;
  icon: string | null;
  /** Precomputed monogram and tile colours, matching the card design. */
  mono: string;
  bg: string;
  fg: string;
}

export interface SearchIndex {
  tools: SearchEntry[];
}

export function buildSearchIndex(tools: readonly Tool[]): SearchIndex {
  const names = new Map(tools.map((tool) => [tool.slug, tool.name]));
  const featureLabels = new Map<string, string>(
    FEATURES.map((feature) => [String(feature.key), feature.label]),
  );

  return {
    tools: tools.map((tool) => {
      const features: string[] = [];
      const labels: string[] = [];
      // Read the tool's own feature object instead of a fixed key list, so
      // keys added later show up in search without touching this file.
      for (const [key, value] of Object.entries(tool.features)) {
        if (value !== true) continue;
        features.push(key);
        labels.push(featureLabels.get(key) ?? key);
      }

      const style = monogramStyle(tool.slug);

      return {
        slug: tool.slug,
        name: tool.name,
        kind: tool.kind,
        kindLabel: KIND_LABELS[tool.kind],
        maker: tool.maker,
        tagline: tool.tagline,
        interfaces: tool.interfaces,
        platforms: tool.platforms,
        drives: tool.drives.map((slug) => names.get(slug) ?? slug),
        extends: tool.extends
          ? (names.get(tool.extends) ?? tool.extends)
          : null,
        features,
        featureLabels: labels,
        price: priceLabel(tool),
        icon: iconFor(tool.slug),
        mono: monogram(tool.name),
        bg: style.background,
        fg: style.color,
      };
    }),
  };
}

import type { FeatureKey, Tool, ToolKind } from "../data/schema";

export interface FeatureDefinition {
  key: FeatureKey;
  label: string;
  /** Plain-language question shown in the legend / tool pages. */
  question: string;
}

export const FEATURES: readonly FeatureDefinition[] = [
  {
    key: "worktrees",
    label: "Worktrees",
    question: "Keeps parallel work in separate git worktrees?",
  },
  {
    key: "parallelAgents",
    label: "Parallel agents",
    question: "Runs several agent sessions at the same time?",
  },
  {
    key: "subagents",
    label: "Subagents",
    question: "Can an agent delegate work to child agents?",
  },
  {
    key: "mcp",
    label: "MCP",
    question: "Connects to MCP servers and their tools?",
  },
  {
    key: "remoteAccess",
    label: "Remote access",
    question: "Can you follow or control sessions from another device?",
  },
  {
    key: "cloudSandbox",
    label: "Cloud sandbox",
    question: "Runs work in a hosted sandbox rather than on your machine?",
  },
  {
    key: "diffReview",
    label: "Diff review",
    question: "Includes a built-in diff or review screen?",
  },
  {
    key: "planMode",
    label: "Plan mode",
    question: "Has an explicit plan / approve-before-edit step?",
  },
] as const;

export const KIND_LABELS: Record<ToolKind, string> = {
  harness: "Harness",
  orchestrator: "Orchestrator",
  "cloud-agent": "Cloud agent",
  "add-on": "Add-on",
};

export const KIND_PLURALS: Record<ToolKind, string> = {
  harness: "Harnesses",
  orchestrator: "Orchestrators",
  "cloud-agent": "Cloud agents",
  "add-on": "Add-ons",
};

export type SourceState = "open" | "available" | "closed" | "unknown";

/**
 * Three real states plus "not verified".
 *
 * - open source: the project says so
 * - source available: closed-source project with a public repository and a
 *   non-proprietary licence (e.g. FSL, Elastic) — you can read the code, but
 *   it is not OSI open source
 * - closed source: no public repository, or a proprietary licence
 */
export function sourceState(
  tool: Pick<Tool, "openSource" | "repo" | "license">,
): SourceState {
  if (tool.openSource === true) return "open";
  if (tool.openSource === null) return "unknown";
  if (
    tool.repo !== null &&
    tool.license !== null &&
    tool.license.trim().toLowerCase() !== "proprietary"
  ) {
    return "available";
  }
  return "closed";
}

export const SOURCE_LABELS: Record<SourceState, string> = {
  open: "Open source",
  available: "Source available",
  closed: "Closed source",
  unknown: "?",
};

export function sourceLabel(
  tool: Pick<Tool, "openSource" | "repo" | "license">,
): string {
  return SOURCE_LABELS[sourceState(tool)];
}

export const INTERFACE_LABELS: Record<string, string> = {
  cli: "CLI",
  tui: "TUI",
  desktop: "Desktop",
  web: "Web",
  "ide-extension": "IDE extension",
  mobile: "Mobile",
  api: "API",
};

export const PLATFORM_LABELS: Record<string, string> = {
  macos: "macOS",
  linux: "Linux",
  windows: "Windows",
  web: "Web",
  ios: "iOS",
  android: "Android",
};

export const MODEL_ACCESS_LABELS: Record<string, string> = {
  subscription: "Your subscription",
  byok: "Your API key",
  bundled: "Vendor credits",
  local: "Local models",
};

export const PRICING_LABELS: Record<string, string> = {
  free: "Free",
  freemium: "Freemium",
  paid: "Paid",
};

export const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  beta: "Beta",
  deprecated: "Deprecated",
};

export type GlyphState = "yes" | "no" | "unknown";

export function featureState(value: boolean | null | undefined): GlyphState {
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

export function glyph(value: boolean | null | undefined): string {
  const state = featureState(value);
  if (state === "yes") return "✓";
  if (state === "no") return "✗";
  return "?";
}

export function glyphWord(value: boolean | null | undefined): string {
  const state = featureState(value);
  if (state === "yes") return "yes";
  if (state === "no") return "no";
  return "not verified";
}

/** The feature keys a tool is confirmed to have (used by client-side filters). */
export function confirmedFeatures(tool: Tool): FeatureKey[] {
  return FEATURES.filter((feature) => tool.features[feature.key] === true).map(
    (feature) => feature.key,
  );
}

/**
 * How much of the feature table has been checked for this tool. A feature
 * counts once it is confirmed either way; `null` means nobody checked yet.
 */
export function verifiedFeatureCount(
  tool: Pick<Tool, "features">,
): { verified: number; total: number } {
  return {
    verified: FEATURES.filter(
      (feature) => tool.features[feature.key] !== null,
    ).length,
    total: FEATURES.length,
  };
}

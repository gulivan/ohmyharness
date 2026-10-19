import type { FeatureKey, Tool, ToolKind } from "../data/schema";

export type { FeatureKey, ToolKind } from "../data/schema";

export type FeatureGroup = "agents" | "workflow" | "integrations" | "access";

export interface FeatureDefinition {
  key: FeatureKey;
  /** Short label used in tables and cards (≤ 18 characters). */
  label: string;
  /** Plain-language question shown in the legend / tool pages. */
  question: string;
  group: FeatureGroup;
  /** Kinds for which the question makes sense. Others render as “–”. */
  appliesTo: readonly ToolKind[];
}

const ALL_KINDS: readonly ToolKind[] = [
  "harness",
  "orchestrator",
  "cloud-agent",
  "add-on",
];

const AGENT_TOOLS: readonly ToolKind[] = [
  "harness",
  "orchestrator",
  "cloud-agent",
];

const BUILT_TOOLS: readonly ToolKind[] = ["harness", "orchestrator"];

const EXTENDABLE_TOOLS: readonly ToolKind[] = [
  "harness",
  "orchestrator",
  "add-on",
];

/**
 * Definitions live in display order, grouped Agents → Workflow → Integrations
 * → Access & safety. The long-form rules are in `docs/features.md`; the
 * original eight keep their definitions in SPEC.md.
 */
export const FEATURES: readonly FeatureDefinition[] = [
  // Agents
  {
    key: "multiProvider",
    label: "Multi-provider",
    question: "Runs agents from several providers side by side?",
    group: "agents",
    appliesTo: AGENT_TOOLS,
  },
  {
    key: "acp",
    label: "ACP",
    question: "Speaks the Agent Client Protocol?",
    group: "agents",
    appliesTo: EXTENDABLE_TOOLS,
  },
  {
    key: "parallelAgents",
    label: "Parallel agents",
    question: "Runs several agent sessions at the same time?",
    group: "agents",
    appliesTo: ALL_KINDS,
  },
  {
    key: "subagents",
    label: "Subagents",
    question: "Can an agent delegate work to child agents?",
    group: "agents",
    appliesTo: ALL_KINDS,
  },
  {
    key: "customAgents",
    label: "Custom agents",
    question: "Can you define your own agent roles?",
    group: "agents",
    appliesTo: EXTENDABLE_TOOLS,
  },

  // Workflow
  {
    key: "planMode",
    label: "Plan mode",
    question: "Has an explicit plan / approve-before-edit step?",
    group: "workflow",
    appliesTo: ALL_KINDS,
  },
  {
    key: "worktrees",
    label: "Worktrees",
    question: "Keeps parallel work in separate git worktrees?",
    group: "workflow",
    appliesTo: ["harness", "orchestrator", "add-on"],
  },
  {
    key: "checkpoints",
    label: "Checkpoints",
    question: "Can you rewind code and chat to an earlier turn?",
    group: "workflow",
    appliesTo: BUILT_TOOLS,
  },
  {
    key: "diffReview",
    label: "Diff review",
    question: "Includes a built-in diff or review screen?",
    group: "workflow",
    appliesTo: ALL_KINDS,
  },
  {
    key: "prIntegration",
    label: "PR integration",
    question: "Opens and tracks pull requests from the session?",
    group: "workflow",
    appliesTo: AGENT_TOOLS,
  },
  {
    key: "automations",
    label: "Automations",
    question: "Can it start agent runs on a schedule or event?",
    group: "workflow",
    appliesTo: AGENT_TOOLS,
  },

  // Integrations
  {
    key: "mcp",
    label: "MCP",
    question: "Connects to MCP servers and their tools?",
    group: "integrations",
    appliesTo: ALL_KINDS,
  },
  {
    key: "skills",
    label: "Skills",
    question: "Can you add reusable skills or commands?",
    group: "integrations",
    appliesTo: EXTENDABLE_TOOLS,
  },
  {
    key: "hooks",
    label: "Hooks",
    question: "Can your own scripts run on agent events?",
    group: "integrations",
    appliesTo: EXTENDABLE_TOOLS,
  },
  {
    key: "issueTracker",
    label: "Issue tracker",
    question: "Can it pull work from GitHub or Linear issues?",
    group: "integrations",
    appliesTo: AGENT_TOOLS,
  },
  {
    key: "browserPreview",
    label: "Browser preview",
    question: "Can the agent open and drive a web browser?",
    group: "integrations",
    appliesTo: AGENT_TOOLS,
  },

  // Access & safety
  {
    key: "remoteAccess",
    label: "Remote access",
    question: "Can you follow or control sessions from another device?",
    group: "access",
    appliesTo: AGENT_TOOLS,
  },
  {
    key: "cloudSandbox",
    label: "Cloud sandbox",
    question: "Runs work in a hosted sandbox rather than on your machine?",
    group: "access",
    appliesTo: AGENT_TOOLS,
  },
  {
    key: "sandboxing",
    label: "Local sandbox",
    question: "Does it sandbox what agents can do locally?",
    group: "access",
    appliesTo: BUILT_TOOLS,
  },
  {
    key: "headlessApi",
    label: "Headless / API",
    question: "Can you run it from scripts, CI, or your own code?",
    group: "access",
    appliesTo: AGENT_TOOLS,
  },
] as const;

/** All feature keys in display order. Mirrors `FEATURE_KEYS` in schema.ts. */
export const FEATURE_KEYS: readonly FeatureKey[] = FEATURES.map(
  (feature) => feature.key,
);

export const GROUP_ORDER: readonly FeatureGroup[] = [
  "agents",
  "workflow",
  "integrations",
  "access",
];

export const GROUP_LABELS: Record<FeatureGroup, string> = {
  agents: "Agents",
  workflow: "Workflow",
  integrations: "Integrations",
  access: "Access & safety",
};

export interface FeatureGroupDefinition {
  key: FeatureGroup;
  label: string;
  features: readonly FeatureDefinition[];
}

export const FEATURE_GROUPS: readonly FeatureGroupDefinition[] = GROUP_ORDER.map(
  (key) => ({
    key,
    label: GROUP_LABELS[key],
    features: FEATURES.filter((feature) => feature.group === key),
  }),
);

/**
 * The six features that stay in the home filter bar. Everything else lives
 * behind the “More filters” disclosure.
 */
export const HEADLINE_FEATURE_KEYS = [
  "multiProvider",
  "parallelAgents",
  "worktrees",
  "prIntegration",
  "cloudSandbox",
  "remoteAccess",
] as const satisfies readonly FeatureKey[];

export function appliesTo(feature: FeatureDefinition, kind: ToolKind): boolean {
  return feature.appliesTo.includes(kind);
}

/** Features that make sense for a kind, in display order. */
export function applicableFeatures(kind: ToolKind): FeatureDefinition[] {
  return FEATURES.filter((feature) => appliesTo(feature, kind));
}

export function featuresInGroup(
  group: FeatureGroup,
  kind?: ToolKind,
): FeatureDefinition[] {
  return FEATURES.filter(
    (feature) =>
      feature.group === group &&
      (kind === undefined || appliesTo(feature, kind)),
  );
}

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

/** Compact platform abbreviations for card meta lines. */
export const PLATFORM_SHORT_LABELS: Record<string, string> = {
  macos: "mac",
  linux: "linux",
  windows: "win",
  web: "web",
  ios: "ios",
  android: "android",
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

export type GlyphState = "yes" | "no" | "unknown" | "na";

/**
 * Three data states plus “not applicable”.
 *
 * `na` comes from the display layer (the tool's kind is outside `appliesTo`);
 * it is never stored in the data, so “doesn't apply” can't be read as “no”.
 */
export function featureState(
  value: boolean | null | undefined,
  applicable = true,
): GlyphState {
  if (!applicable) return "na";
  if (value === true) return "yes";
  if (value === false) return "no";
  return "unknown";
}

export function glyph(value: boolean | null | undefined, applicable = true): string {
  const state = featureState(value, applicable);
  if (state === "na") return "–";
  if (state === "yes") return "✓";
  if (state === "no") return "✗";
  return "?";
}

export function glyphWord(
  value: boolean | null | undefined,
  applicable = true,
): string {
  const state = featureState(value, applicable);
  if (state === "na") return "not applicable";
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

/** Confirmed features with the headline ones first, then display order. */
export function prioritisedFeatures(tool: Tool): FeatureKey[] {
  const rank = new Map<FeatureKey, number>(
    (HEADLINE_FEATURE_KEYS as readonly FeatureKey[]).map((key, index) => [
      key,
      index,
    ]),
  );
  return confirmedFeatures(tool).sort((a, b) => {
    const rankA = rank.get(a);
    const rankB = rank.get(b);
    if (rankA !== undefined && rankB !== undefined) return rankA - rankB;
    if (rankA !== undefined) return -1;
    if (rankB !== undefined) return 1;
    return FEATURE_KEYS.indexOf(a) - FEATURE_KEYS.indexOf(b);
  });
}

/**
 * How much of the applicable feature table has been checked for this tool.
 * Features that do not apply to the tool's kind are excluded from the total,
 * and `null` means nobody has checked that cell yet.
 */
export function verifiedFeatureCount(
  tool: Pick<Tool, "features" | "kind">,
): { verified: number; total: number } {
  const applicable = applicableFeatures(tool.kind);
  return {
    verified: applicable.filter(
      (feature) => tool.features[feature.key] !== null,
    ).length,
    total: applicable.length,
  };
}

/** Verified / applicable counts for one group, optionally over several tools. */
export function groupStats(
  group: FeatureGroupDefinition,
  tools: readonly Pick<Tool, "features" | "kind">[],
): { yes: number; applicable: number; verified: number } {
  let yes = 0;
  let applicable = 0;
  let verified = 0;
  for (const tool of tools) {
    for (const feature of group.features) {
      if (!appliesTo(feature, tool.kind)) continue;
      applicable += 1;
      const value = tool.features[feature.key];
      if (value === true) yes += 1;
      if (value !== null) verified += 1;
    }
  }
  return { yes, applicable, verified };
}

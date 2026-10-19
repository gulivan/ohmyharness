import featureDocSource from "../../docs/features.md?raw";
import type { FeatureKey } from "./features";

export interface FeatureDoc {
  question: string;
  yes: string;
  no: string;
  boundary: string[];
}

/**
 * The original eight features are defined in SPEC.md with a one-line comment
 * each. Their rules are spelled out here so the definitions page covers all
 * 20 features in the same shape as the newer ones.
 */
const ORIGINAL_DOCS: Partial<Record<FeatureKey, FeatureDoc>> = {
  parallelAgents: {
    question: "Runs several agent sessions at the same time?",
    yes: "Two or more agent sessions can run concurrently, and the product shows and manages them as separate sessions or workspaces.",
    no: "A queue that runs one session at a time; multiple tabs attached to the same session; subagents inside one session (that is `subagents`).",
    boundary: [
      "Parallel sessions may share one checkout or each get their own worktree; both count.",
      "A cap on concurrent sessions still counts.",
    ],
  },
  subagents: {
    question: "Can an agent delegate work to child agents?",
    yes: "An agent can spawn or delegate to child agents and collect their results within a session, using built-in delegation rather than the user starting separate sessions.",
    no: "The user starting additional top-level sessions; a fixed helper function that is not an agent; a workflow that only prompts the same agent again.",
    boundary: [
      "User-authored subagent definitions count here and also support `customAgents`.",
      "Delegation that only works through a third-party MCP server does not count as a built-in feature.",
    ],
  },
  planMode: {
    question: "Has an explicit plan / approve-before-edit step?",
    yes: "A product mode that produces a plan or proposed changes and waits for approval before editing files, or a read-only planning mode the agent can enter.",
    no: "Per-command permission prompts; a summary written after the edits; a system-prompt instruction to plan first with no enforced step.",
    boundary: [
      "The approval step may be optional as long as the product provides it.",
      "Plan mode that still runs read-only commands counts.",
    ],
  },
  worktrees: {
    question: "Keeps parallel work in separate git worktrees?",
    yes: "The product creates and manages a separate git worktree per session or workspace, so parallel work is isolated without manual git commands.",
    no: "Switching branches in one working tree; asking the user to run `git worktree`; isolation through copied directories or containers instead of git worktrees.",
    boundary: [
      "The worktree may be created by an orchestrator for the harness it runs.",
      "Automatic cleanup of worktrees is a quality signal, not a separate feature.",
    ],
  },
  diffReview: {
    question: "Includes a built-in diff or review screen?",
    yes: "A first-party UI shows the changes an agent made as diffs and lets the user review, accept, reject, or comment on them.",
    no: "Raw `git diff` in a terminal; a diff the user opens in an editor; diffs printed as text with no review action.",
    boundary: [
      "A review screen that only shows the final file contents does not count; a diff view is required.",
      "Review may happen per file or per turn.",
    ],
  },
  mcp: {
    question: "Connects to MCP servers and their tools?",
    yes: "Documented, first-party support for connecting Model Context Protocol servers and giving their tools to the agent.",
    no: "A single hardcoded integration; support that requires patching the product; an MCP mention without documentation.",
    boundary: [
      "Support may be shipped as a built-in client or a documented plugin.",
      "Being callable from another MCP client is not the same as supporting MCP servers itself.",
    ],
  },
  remoteAccess: {
    question: "Can you follow or control sessions from another device?",
    yes: "Sessions can be followed or controlled from a different device or browser through a first-party path, such as a web app, mobile app, or remote connection.",
    no: "SSH or tmux the user sets up; a desktop-only local UI; a read-only screenshot or log feed.",
    boundary: [
      "Same-machine browser access counts only when the product provides it, not when it exposes a local port for the user to tunnel.",
      "Watch-only mobile access counts as following; control is not required.",
    ],
  },
  cloudSandbox: {
    question: "Runs work in a hosted sandbox rather than on your machine?",
    yes: "The vendor runs agent work in its own hosted, sandboxed compute, and the user does not need local resources for that run.",
    no: "Local sandboxing; a container or VM the user hosts; a cloud API that only serves model inference.",
    boundary: [
      "A cloud agent that always runs remotely counts.",
      "A product with both local and cloud execution counts if hosted sandbox runs are a first-party option.",
    ],
  },
};

const FIELD_NAMES = ["Question", "Yes if", "No if", "Boundary cases"] as const;
type FieldName = (typeof FIELD_NAMES)[number];

interface Draft {
  key: string;
  fields: Partial<Record<FieldName, string[]>>;
}

/** Extract the per-feature rules from `docs/features.md`. */
function parseFeatureDocs(source: string): Map<string, FeatureDoc> {
  const docs = new Map<string, FeatureDoc>();
  let draft: Draft | null = null;
  let field: FieldName | null = null;

  const flush = (): void => {
    if (!draft) return;
    const bullets: string[] = [];
    for (const line of draft.fields["Boundary cases"] ?? []) {
      if (line.startsWith("- ")) {
        bullets.push(line.slice(2).trim());
      } else if (bullets.length > 0) {
        bullets[bullets.length - 1] = `${bullets[bullets.length - 1]} ${line}`;
      }
    }
    const doc: FeatureDoc = {
      question: clean(draft.fields.Question?.join(" ") ?? ""),
      yes: clean(draft.fields["Yes if"]?.join(" ") ?? ""),
      no: clean(draft.fields["No if"]?.join(" ") ?? ""),
      boundary: bullets.map(clean),
    };
    docs.set(draft.key, doc);
    draft = null;
    field = null;
  };

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trim();
    const heading = line.match(/^###\s+\d+\.\d+\s+`([^`]+)`/);
    if (heading) {
      flush();
      draft = { key: heading[1], fields: {} };
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      continue;
    }
    if (!draft) continue;

    const marker = line.match(
      /^\*\*(Question|Yes if|No if|Boundary cases|Spread):\*\*\s*(.*)$/,
    );
    if (marker) {
      const name = marker[1];
      field = FIELD_NAMES.includes(name as FieldName)
        ? (name as FieldName)
        : null;
      if (field) draft.fields[field] = [marker[2]];
      continue;
    }

    if (!field || line === "") continue;
    draft.fields[field]?.push(line);
  }

  flush();
  return docs;
}

/** Strip the small amount of inline markdown used in the docs. */
function clean(value: string): string {
  return value
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

const PARSED_DOCS = parseFeatureDocs(featureDocSource);

export function featureDoc(key: FeatureKey): FeatureDoc | null {
  return ORIGINAL_DOCS[key] ?? PARSED_DOCS.get(key) ?? null;
}

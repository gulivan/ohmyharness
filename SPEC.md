# ohmyharness — spec

Open-source (MIT), community-maintained directory of AI coding **harnesses**, **orchestrators**, **cloud agents** and **add-ons**.
Domain: ohmyharness.com. Repo: github.com/gulivan/ohmyharness.

## Vocabulary (shown on the site)

- **Harness** — the agent runtime that talks to a model and runs tools: Claude Code, Codex CLI, OpenCode, Gemini CLI, Aider…
- **Orchestrator** — an app that runs and manages one or more harnesses (parallel sessions, worktrees, review UI): T3 Code, Conductor, Paseo, Emdash…
- **Cloud agent** — hosted agent that works in a remote sandbox and returns PRs (Devin, Jules…). Optional for v1.
- **Add-on** — a plugin or distribution that extends one harness or orchestrator: oh-my-opencode extends OpenCode, ohmypi extends Pi, cbds extends Herdr.

## Data

One JSON file per tool: `data/tools/<slug>.json`. Validated at build time with zod (`src/data/schema.ts`); invalid data fails the build.
`null` means **unknown / not verified** and renders as "?" — never guess.
`extends` must point at a slug that has a file when possible; a missing target is a build warning, not a failure, so an add-on can land before its base tool.

```jsonc
{
  "slug": "t3-code",                  // kebab-case, equals filename
  "name": "T3 Code",
  "kind": "orchestrator",             // "harness" | "orchestrator" | "cloud-agent" | "add-on"
  "extends": null,                    // add-ons only: slug of the one tool it extends; required for "add-on", forbidden otherwise
  "tagline": "…",                     // ≤ 110 chars, neutral, factual, no marketing superlatives
  "description": "…",                 // 1–3 sentences, factual
  "website": "https://…",
  "repo": "https://github.com/…",     // or null if closed source
  "openSource": true,                 // true | false | null
  "license": "MIT",                   // SPDX id, "proprietary", or null
  "maker": "…",                       // company or person, or null
  "interfaces": ["desktop", "web"],   // subset of: "cli","tui","desktop","web","ide-extension","mobile","api"
  "platforms": ["macos", "linux", "windows"], // subset of: "macos","linux","windows","web","ios","android"
  "drives": ["claude-code", "codex-cli"],      // orchestrators and add-ons: slugs of harnesses it runs (may reference slugs not yet in data); harnesses: []
  "modelAccess": ["subscription", "byok"],     // subset of: "subscription" (uses your Claude/ChatGPT plan), "byok" (your API key), "bundled" (vendor-provided credits/plan), "local" (local models e.g. Ollama)
  "pricing": { "model": "free", "notes": "…" }, // model: "free" | "freemium" | "paid" | null; notes optional string
  "features": {                        // each: true | false | null
    "worktrees": null,                 // isolates parallel work in git worktrees
    "parallelAgents": null,            // run several agent sessions at once
    "subagents": null,                 // agent can spawn/delegate to child agents
    "mcp": null,                       // supports MCP servers
    "remoteAccess": null,              // control sessions from another device / browser
    "cloudSandbox": null,              // runs agents in hosted sandboxes
    "diffReview": null,                // built-in diff / code review UI
    "planMode": null                   // explicit plan/approve-before-edit mode
  },
  "github": { "stars": 12345, "checkedAt": "2026-10-18" }, // or null if no public repo
  "status": "active",                 // "active" | "beta" | "deprecated"
  "install": [                        // optional; omitted or [] = not verified yet. Order = display order, first is the default.
    { "label": "npm", "type": "command", "value": "npm install -g @openai/codex", "platforms": ["macos", "linux", "windows"] },
    { "label": "Homebrew", "type": "command", "value": "brew install --cask codex", "platforms": ["macos"] },
    { "label": "Download", "type": "url", "value": "https://…/download", "platforms": ["macos", "windows"] }
  ],                                   // type: "command" (copyable shell line) | "url" (download page / store / extension marketplace / sign-up for web apps)
                                       // platforms: subset of the top-level platforms enum; label ≤ 24 chars; every entry must be backed by an official install doc in "sources"
  "sources": ["https://…"],           // ≥ 1 URL backing the facts above
  "lastVerified": "2026-10-18"
}
```

## Pages (Astro, fully static)

- `/` — hero ("Pick your harness."), short explainer of the four kinds (harness, orchestrator, cloud agent, add-on), search + filters (kind, source availability, platform, interface, feature toggles), card grid.
- `/tools/<slug>` — detail page: facts table, features with ✓ / ✗ / ?, "drives" links, "extends" link for add-ons, an "Add-ons" section on the base tool, sources, "Edit this page on GitHub" + "Report it broke" links, per-tool social card.
- `/compare` — feature matrix of all tools, filter by kind, pick tools to compare side by side (state in URL query).
- `/vs/<a>-vs-<b>` — static head-to-head pages for every pair within the same kind (SEO).
- `/tier-list` — tier-list maker: drag tools between S/A/B/C/D/unranked rows (tiers renameable), pointer + touch + keyboard accessible, state in URL hash so it's shareable, "Download PNG" export, "Share on X" intent link. Pre-fill option: orchestrators only / harnesses only / cloud agents only / add-ons only / all.
- `/about` — what this is, how to contribute, neutrality policy (no paid rankings; sponsors clearly labeled).
- `/og/<slug>.png` — generated social card for each tool (also used by its head-to-head pages).
- `/api/tools.json` — all data as JSON, plus a derived `source` display value (`Open source`, `Source available`, `Closed source`, `?`); `/llms.txt` — index for LLMs.

## Non-goals for v1

Accounts, votes stored on a server, comments. (v2: aggregate tier lists, breakage reports.)

## Engineering rules

- TypeScript strict, `astro check` + `tsc --noEmit` clean.
- npm, exact versions (no ^ or ~), `npm install --ignore-scripts`, commit `package-lock.json`.
- Minimal client JS: islands only where needed (filters, compare picker, tier list). No heavy UI frameworks unless justified.
- Accessible, responsive, dark-first distinctive design; fast (Lighthouse ≥ 95).
- UI copy describes what users do; no implementation talk on screens.
- Dockerfile: multi-stage build → static server as non-root user with pinned UID. No host ports in compose.
- GitHub Actions: `npm ci`, validate data, `astro check`, build on PRs.

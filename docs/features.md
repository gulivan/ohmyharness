# Feature definitions

Every feature is `true` / `false` / `null` (not verified). Values must be backed by an official source listed in the tool's `sources`.

## Attribution rule and definitions

A feature is credited to **the layer that provides or surfaces it**. An orchestrator does not
inherit a harness's capability merely because it can run that harness: it earns the flag only when
the orchestrator provides the capability itself, manages it, or makes it work uniformly across the
harnesses it drives. This rule is what keeps `hooks`, `skills`, and `checkpoints` from becoming
"yes for every orchestrator that runs Claude Code". It should be written into SPEC before the new
keys are populated.

### 2.1 `multiProvider` — Multi-provider

**Question:** Runs agents from several providers side by side?
**Yes if:** the product has first-class, documented support for at least two distinct agent runtimes
or model vendors, selectable per session/thread. For an orchestrator: it can drive two or more
different harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Pi, Muse, ACP agents…) and
the user can pick per thread without leaving the app. For a harness: it can run models from two or
more vendors natively (provider/aggregator config shipped with the tool).
**No if:** single-vendor harness (Claude Code, Codex CLI, Gemini CLI, Qwen Code); orchestrator that
only runs one harness; add-on that extends one harness.
**Boundary cases:**
- Two accounts from the same vendor, or several models from one vendor → no.
- "Any OpenAI-compatible endpoint" alone → no; two genuinely different vendors through built-in
  provider config → yes.
- Running several harnesses, but only one per install/workspace type → still yes if all are
  supported by the product.
- ACP/registry support is evidence for an orchestrator, not a separate feature.
**Spread:** ~11/25 harnesses (OpenCode, Cline, Roo, Kilo, Crush, Goose, Amp, Aider, Cursor CLI,
Copilot CLI, Antigravity; several others null), ~7/25 orchestrators (T3 Code, Conductor, Paseo,
Emdash, Vibe Kanban, cmux, Sculptor), 0/2 cloud agents, 0/5 add-ons → **~18**.

### 2.2 `automations` — Automations

**Question:** Can it start agent runs on a schedule or event?
**Yes if:** the product itself can start an agent run with no human present, either on a recurring
time/cron schedule or from an inbound event (webhook URL, GitHub/GitLab/Slack event), configured
inside the product.
**No if:** a GitHub Actions/CI recipe in the docs; an external cron job calling the CLI; a "loop" or
"goal" that keeps working inside an already-started session; a webhook that only posts a message
into a chat; a PR review bot that only comments without starting an agent run.
**Boundary cases:**
- Schedule only on mobile or desktop still counts (it is the product's feature).
- Event-only with no cron counts; cron-only counts.
- Cloud-only automations count for a tool that also has a local product.
- GitHub/GitLab triggers that run the vendor's cloud agent count; third-party wiring does not.
**Spread:** ~3/25 harnesses (Claude Code, Codex, Cursor), ~5/25 orchestrators (T3 Code, Conductor,
Paseo + two likely), 1/2 cloud agents (Devin) → **~9**.

### 2.3 `prIntegration` — PR integration

**Question:** Opens and tracks pull requests from the session?
**Yes if:** a first-class PR workflow in the product: create/open a PR from a session **and** see or
act on its state (checks, reviews, comments), including link/watch behavior where the agent responds
to review feedback or CI.
**No if:** only shell access to `gh`/`glab`; generic git commit/branch/push without PR awareness;
issue tracker only.
**Boundary cases:**
- Opening a PR with no way to see its checks/reviews → no (that is the "tracks" half).
- Cloud agents that always deliver a PR count.
- A GitHub App that reviews PRs and shows results counts if it starts/feeds agent work and surfaces
  PR state.
- Multiple hosts (GitHub, GitLab, Bitbucket, Azure DevOps, Forgejo) are a quality signal, not a
  separate feature.
**Spread:** ~3/25 harnesses (Codex, Cursor, possibly Factory Droid), ~8/25 orchestrators (T3 Code,
Conductor, Vibe Kanban, Sculptor and other queue-style UIs), 2/2 cloud agents → **~13**.

### 2.4 `browserPreview` — Browser preview

**Question:** Can the agent open and drive a web browser?
**Yes if:** built-in browser automation: the agent can navigate real pages, click/type/scroll, take
screenshots, and read console or network output — or a built-in live app preview the agent can
inspect and interact with. It must work without the user installing a browser MCP server.
**No if:** an MCP Playwright/Puppeteer server the user configures; a screenshot-only tool; opening
a URL in the user's own browser; rendering markdown/HTML artifacts with no interaction.
**Boundary cases:**
- Desktop-only control counts; mobile-only does not (agents do not drive a browser there).
- A built-in "browser subagent" counts.
- Mobile simulator/emulator control is not a browser — do not count it here.
- "Computer use" that can control any app, including a browser, counts.
**Spread:** ~3/25 harnesses (Cursor, Claude Code, Codex — the latter two only on some surfaces),
~3/25 orchestrators (T3 Code, Paseo, possibly cmux), 1–2/2 cloud agents → **~7**.

### 2.5 `checkpoints` — Checkpoints

**Question:** Can you rewind code and chat to an earlier turn?
**Yes if:** a first-party snapshot/restore action returns **both** the workspace files and the
conversation to a chosen earlier turn, in one operation, without manual git.
**No if:** manual git commit/reset; per-file undo; "revert last edit" only; automatic per-turn
commits that leave the conversation intact; conversation branching without file restore.
**Boundary cases:**
- Restoring files but not the chat → no (the question promises both).
- A cap (e.g. 100 checkpoints or a retention window) still counts.
- Cloud snapshots count.
- A manual "restore to here" that only works in one surface still counts for the tool.
**Spread:** ~6/25 harnesses (Claude Code, OpenCode, Cline, Roo, Kilo, Cursor if chat restore is
confirmed), ~3/25 orchestrators (T3 Code, Conductor, possibly Sculptor/Vibe Kanban) → **~10**.

### 2.6 `hooks` — Hooks

**Question:** Can your own scripts run on agent events?
**Yes if:** documented, user-authored scripts/commands (or plugin code) bound to agent lifecycle
events — session start/stop, before/after tool use, file edit, prompt submit, subagent start/stop —
that can observe, block, or modify behavior.
**No if:** MCP tools the agent chooses to call; skills/slash commands invoked by the user or agent
(not event-driven); git hooks; setup scripts; chat notification webhooks.
**Boundary cases:**
- A plugin API with event handlers counts (e.g. OpenCode plugins).
- Observation-only hooks count; they need not block.
- An orchestrator that merely displays or forwards the harness's hooks does **not** count under the
  layer rule; it counts only if it runs its own hook system.
- Cloud-execution hooks count if documented.
**Spread:** ~9/25 harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Copilot CLI, Factory
Droid + likely), 0–1/25 orchestrators → **~9**.

### 2.7 `skills` — Skills

**Question:** Can you add reusable skills or commands?
**Yes if:** first-party support for reusable, user-authored capability packages (Agent Skills
`SKILL.md` or an equivalent command/skill bundle) that the agent discovers and invokes explicitly or
automatically, and the product lets the user add, list, or manage them.
**No if:** a single `AGENTS.md`/`CLAUDE.md`/rules file; one-off saved prompts; vendor-hardcoded slash
commands; MCP servers (tools, not procedures).
**Boundary cases:**
- An orchestrator that only passes through whatever skills the underlying harness has → no.
- An orchestrator that installs, lists, copies, or deletes skills across environments → yes.
- An add-on that ships new skills/commands for its base → yes.
- Reusable command bundles with no model-invoked discovery (e.g. recipes) → yes if the product
  documents them as the equivalent reusable-workflow mechanism.
**Spread:** ~11/25 harnesses (Claude Code, Codex, Cursor, OpenCode, Gemini CLI, Copilot CLI,
Factory Droid, Amp, OpenClaw + likely), ~2/25 orchestrators (T3 Code, possibly Paseo), add-ons that
ship skills → **~13**.

### 2.8 `customAgents` — Custom agents

**Question:** Can you define your own agent roles?
**Yes if:** the user can define named agent roles/personas — instructions/system prompt, tool
access, model — as reusable configuration, and select them for a session or delegation.
**No if:** built-in subagents; a single project instruction file; saved prompts/slash commands;
provider instances or accounts; vendor-shipped modes/personalities the user cannot author.
**Boundary cases:**
- User-authored subagent definitions with frontmatter count.
- "Agent profiles" count.
- Per-session model/effort presets do not count.
- A custom agent that can only be used as a subagent still counts.
**Spread:** ~7/25 harnesses (Claude Code, Codex, Cursor, OpenCode, possibly Gemini CLI, Factory
Droid, Copilot CLI), ~1/25 orchestrators (Paseo), add-ons that add agents → **~9**.

### 2.9 `sandboxing` — Local sandbox

**Question:** Does it sandbox what agents can do locally?
**Yes if:** a built-in, enforced local execution boundary: OS-level sandbox (seatbelt, landlock,
bubblewrap), container/VM isolation, or a permission engine that can pre-deny classes of tool
actions with persistent allow/ask/deny rules rather than prompting on every call.
**No if:** cloud sandbox only (that is `cloudSandbox`); plain per-command approval prompts with no
enforceable policy; running the tool inside Docker yourself; a read-only/plan toggle used as the
only restriction.
**Boundary cases:**
- Filesystem and/or network limits count.
- Approval modes with persistent allowlists/denylists count; one-off prompts do not.
- A local sandbox that is optional but documented counts.
- Platform-limited support (e.g. macOS only) still counts.
**Spread:** ~8/25 harnesses (Codex, Claude Code, Cursor, OpenCode, Gemini CLI, Factory Droid,
Copilot CLI, Antigravity), 0–1/25 orchestrators → **~8**.

### 2.10 `headlessApi` — Headless / API

**Question:** Can you run it from scripts, CI, or your own code?
**Yes if:** a documented, first-party non-interactive path: a CLI flag/mode (`-p`, `exec`, `run`)
that returns output/exit code, a local or remote server with an HTTP/OpenAPI API, an SDK, or an MCP
control surface that can start runs and read results.
**No if:** only an interactive TUI/desktop app; CI recipes that wrap an interactive CLI with
`expect`; a CLI that only installs/authenticates.
**Boundary cases:**
- `--print`/`exec` modes count even if file edits need an extra flag.
- Control through a first-party MCP server counts (an outside program drives the tool).
- A cloud-only API counts for tools that also ship a local product.
- An add-on that only configures its base does not inherit this flag.
**Spread:** ~15–17/25 harnesses (Claude Code, Codex, OpenCode, Cursor, Gemini CLI, Copilot CLI,
Aider, Goose, Amp, Crush, Qwen Code, Kimi CLI, Factory Droid, OpenClaw + likely), ~4/25
orchestrators (T3 Code MCP, Conductor API/MCP, Paseo SDK/CLI, cmux CLI), 2/2 cloud agents → **~21**.

### 2.11 `issueTracker` — Issue tracker

**Question:** Can it pull work from GitHub or Linear issues?
**Yes if:** first-party integration with an issue tracker (GitHub Issues, GitLab, Linear, Jira,
Azure DevOps) that lets the user browse issues, start a session/workspace from one, and link the
session or resulting PR back to it.
**No if:** an MCP server for Linear/Jira the user installs; `gh issue` through the shell; PR
integration only.
**Boundary cases:**
- Read-only issue browsing with no start/link path → no.
- Multiple trackers are a quality signal, not a separate feature.
- A cloud agent that accepts a GitHub issue URL and opens a PR counts.
- Issue sync that only displays a link in the PR body does not count.
**Spread:** ~2–3/25 harnesses (Codex, Cursor, possibly Copilot CLI), ~5/25 orchestrators (T3 Code,
Conductor, Traycer, Paseo, Vibe Kanban), 2/2 cloud agents → **~10**.

### 2.12 `acp` — ACP

**Question:** Speaks the Agent Client Protocol?
**Yes if:** the product officially implements the Agent Client Protocol (agentclientprotocol.com) in either direction: as an **ACP agent** that editors/clients such as Zed, JetBrains or T3 Code can drive, or as an **ACP client** that can run any ACP agent (e.g. via the ACP Registry). Built-in, documented support — including an official adapter maintained by the vendor — counts.
**No if:** only a community adapter exists; "compatible with" claims without docs; MCP support alone (MCP ≠ ACP).
**Boundary cases:**
- An official `*-acp` adapter package published by the vendor → yes.
- An orchestrator that lists ACP agents in its provider picker → yes (it is an ACP client).
- Third-party adapters (e.g. a community `claude-code-acp`) do not make the wrapped tool `true`; record them in notes only.

## Groups (display order)

| Group | Features |
|---|---|
| Agents | multiProvider, acp, parallelAgents, subagents, customAgents |
| Workflow | planMode, worktrees, checkpoints, diffReview, prIntegration, automations |
| Integrations | mcp, skills, hooks, issueTracker, browserPreview |
| Access & safety | remoteAccess, cloudSandbox, sandboxing, headlessApi |

The original eight (worktrees, parallelAgents, subagents, mcp, remoteAccess, cloudSandbox, diffReview, planMode) keep the definitions in SPEC.md.

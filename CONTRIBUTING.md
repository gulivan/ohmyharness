# Contributing

Thanks for helping. The most useful contribution is a well-sourced fact.

## Ways to help

- **Add a tool** — open an [Add a tool](https://github.com/gulivan/ohmyharness/issues/new?template=add-tool.yml)
  issue or send a pull request with one new JSON file.
- **Fix a fact** — pricing, platforms and features change. Open a
  [Fix data](https://github.com/gulivan/ohmyharness/issues/new?template=fix-data.yml)
  issue or edit the file directly.
- **Improve the site** — code, accessibility, copy and performance changes are
  welcome. Open an issue first for anything large.

By taking part you agree to the [code of conduct](CODE_OF_CONDUCT.md).

## The data rules

1. **`null` means unknown or not verified.** It is not a stand-in for "no" and
   it is never a guess. It renders as **?** and the comparison table treats it
   as unknown.
2. **`false` means a source confirms the feature is absent.** Use it only when
   you can point at the source.
3. **Every entry needs at least one source.** Sources must be stable pages you
   actually checked: official docs, pricing pages, repositories, changelogs.
   A search result or a review site is not a source.
4. **Taglines are neutral.** Describe what the tool does in at most 110
   characters. No "best", "fastest", "revolutionary", no rankings, no calls to
   action.
5. **Order follows the data.** Directory order is alphabetical and comparisons
   show the same rows for every tool, so the format cannot favour one entry.
6. **Write for the reader, not the marketing team.** Facts, units and dates.
   Say when something changed if that matters.

## Adding a tool

1. Pick a slug: lowercase letters, digits and single hyphens, matching the
   filename exactly (`claude-code.json` → `"slug": "claude-code"`).
2. Copy an existing file in `data/tools/` and fill in every field you can
   confirm. Omit nothing required; use `null` when a fact is unknown.
3. Set `lastVerified` to the date you checked the entry (`YYYY-MM-DD`) and add
   a `checkedAt` date to any GitHub star count.
4. Run `npm run validate` and fix anything it reports.
5. Open a pull request. One tool per pull request is easiest to review.

### Add-ons

An `add-on` is a plugin or distribution that extends exactly one harness or
orchestrator. Set `"kind": "add-on"` and `"extends": "<slug of the base tool>"`.
The base tool's page then lists the add-on under **Add-ons**, and the add-on's
page links back to it. If the base tool is not listed yet, the validator warns
instead of failing; add the base entry when you can source it.

Do not edit or delete someone else's entry to "improve" it without evidence.
Send a fix with the source instead.

### Install steps

`install` is optional. Add it when you have checked how to get the tool; leave
it out (or use `[]`) when you have not. An empty list shows "Install steps not
verified yet" with a link to add them, so a partial entry is still useful.

Every method must come from the tool's **official install documentation**, and
that page must be listed in `sources`. Prefer the official package manager or
installer for each platform (`npm`, Homebrew, `winget`, the vendor's signed
installer). Never invent a command or translate one from memory.

```jsonc
"install": [
  { "label": "npm", "type": "command", "value": "npm install -g @openai/codex", "platforms": ["macos", "linux", "windows"] },
  { "label": "Download", "type": "url", "value": "https://…/download", "platforms": ["macos", "windows"] }
]
```

- Order matters: the first entry is the default on the tool page, on cards and
  in `llms.txt`.
- `label` — the method's name, at most 24 characters (`npm`, `Homebrew`,
  `winget`, `Download`).
- `type` — `command` for a copyable shell line, `url` for a download page,
  store listing, extension marketplace or sign-up page.
- `value` — a command is one line with no newlines and no leading prompt (`$`
  is drawn by the site). A `url` is an absolute `https://` URL.
- `platforms` — one or more of `macos`, `linux`, `windows`, `web`, `ios`,
  `android`. List every platform the method targets.

Do not rewrite official instructions. If the official docs make a
`curl … | sh` installer the primary method, show it exactly as published. Keep
each entry to one step; link the official page for the rest.

### Field reference

The machine-readable truth is [`src/data/schema.ts`](src/data/schema.ts); the
narrative reference, including allowed values, is in [`SPEC.md`](SPEC.md).
Quick notes:

- `kind` — `harness`, `orchestrator`, `cloud-agent` or `add-on`.
- `extends` — for add-ons only: the slug of the one harness or orchestrator
  the tool extends (for example `"extends": "herdr"`). Required when `kind` is
  `add-on`, not allowed otherwise. The target may not have a file yet; the
  validator warns and the page shows it as "not listed yet".
- `tagline` — a plain sentence, 1–110 characters.
- `description` — a short paragraph. Factual, no marketing.
- `website` — the canonical `https://` URL.
- `repo` — source repository URL, or `null` if it is not open source.
- `openSource` — `true`/`false`, or `null` when the licence situation is
  genuinely unclear.
- `license` — SPDX-style name such as `MIT`, or `null`.
- `maker` — the organisation or person behind the tool, or `null`.
- `interfaces` — subset of `cli`, `desktop`, `ide`, `web`.
- `platforms` — subset of `macos`, `linux`, `windows`, `web`.
- `drives` — slugs of harnesses an orchestrator or add-on runs. Empty for
  harnesses and for add-ons that do not dispatch to harnesses.
- `modelAccess` — subset of `byok`, `provider-subscription`, `included`.
- `pricing` — `{ "model": ..., "notes": "..." }`, where the model is
  `free`, `subscription`, `usage`, `hybrid` or `null`.
- `features` — eight keys, each `true`, `false` or `null`.
- `github` — `{ "stars": number, "checkedAt": "YYYY-MM-DD" }` or `null`.
  Never use a star count you did not read on that date.
- `install` — optional list of ways to get the tool, in display order. See
  [Install steps](#install-steps). Omit it when the steps are not verified.
- `status` — `active`, `beta`, `archived` or `unknown`.
- `sources` — at least one URL.
- `lastVerified` — `YYYY-MM-DD`, the day the entry was checked.

### The eight features

| Key | Question the site asks |
| --- | --- |
| `worktrees` | Can it run agents in separate git worktrees? |
| `parallelAgents` | Can several agents work at the same time? |
| `subagents` | Can an agent delegate to subagents? |
| `mcp` | Can it connect to MCP servers? |
| `remoteAccess` | Can you reach a running session from another device? |
| `cloudSandbox` | Does it run work in a hosted sandbox? |
| `diffReview` | Does it show a diff for review before accepting? |
| `planMode` | Does it have a read-only planning step? |

## Site changes

- Stack: Astro (static output) and TypeScript. Client islands are vanilla
  TypeScript; do not add a UI framework.
- Run `npm run verify` before opening a pull request.
- Keep visible copy about the reader's task, not about the implementation.
  Architecture notes belong in comments, docs or pull request descriptions.
- New interactive controls need a keyboard path and a visible focus state.
- Test at 360 px wide as well as desktop.
- Dependencies are pinned exactly (`npm install --ignore-scripts <pkg>@<version>`,
  no `^` or `~`). Explain why a dependency is needed in the pull request.

## Test fixtures

`tests/fixtures/tools/` holds three small fixtures used to test the loader and
build without touching `data/tools/`. They are not real directory entries and
must not be used as a source of facts.

```sh
OMH_DATA_DIR=tests/fixtures/tools npm run validate
OMH_DATA_DIR=tests/fixtures/tools npm run build
```

## Review

A maintainer checks that the sources are real, that `null` is used honestly,
and that the tagline stays neutral. Corrections with a source are normally
merged quickly. If a fact is disputed, the source wins.

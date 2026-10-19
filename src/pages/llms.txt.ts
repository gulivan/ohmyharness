import type { APIRoute } from "astro";
import { FEATURE_GROUPS, KIND_LABELS } from "../lib/features";
import { installLine } from "../lib/install";
import { startingPrice } from "../lib/pricing";
import { countByKind, getAllTools, latestVerified } from "../lib/tools";

export const GET: APIRoute = () => {
  const tools = getAllTools();
  const counts = countByKind();
  const verified = latestVerified();

  const lines: string[] = [
    "# ohmyharness",
    "",
    "> An open, sourced directory of AI coding harnesses, orchestrators, cloud agents and add-ons. Unknown facts are marked null, never guessed.",
    "",
    `Tools: ${tools.length} (${counts.harness} harnesses, ${counts.orchestrator} orchestrators, ${counts["cloud-agent"]} cloud agents, ${counts["add-on"]} add-ons).`,
  ];

  if (verified) lines.push(`Last verified: ${verified}.`);

  lines.push(
    "",
    "## Pages",
    "",
    "- [Directory](https://ohmyharness.com/): every harness, orchestrator, cloud agent and add-on",
    "- [Compare](https://ohmyharness.com/compare): feature matrix and side-by-side comparison",
    "- [Features](https://ohmyharness.com/features): what each feature means and when it counts",
    "- [Tier list](https://ohmyharness.com/tier-list): make and share a tier list",
    "- [About](https://ohmyharness.com/about): how facts are checked and how to contribute",
    "- [Full data (JSON)](https://ohmyharness.com/api/tools.json)",
    "",
    "## Features",
    "",
    "Every tool records 20 features as `true`, `false` or `null` (not verified).",
    "Applicability depends on the kind of tool; a dash on the site means the",
    "feature does not apply. Per-tool values are in the JSON data.",
    "",
  );

  for (const group of FEATURE_GROUPS) {
    lines.push(`### ${group.label}`, "");
    for (const feature of group.features) {
      lines.push(`- \`${feature.key}\` — ${feature.label}: ${feature.question}`);
    }
    lines.push("");
  }

  lines.push(
    "## Tools",
    "",
  );

  if (tools.length === 0) {
    lines.push(
      "- The directory is empty. Add the first tool: https://github.com/gulivan/ohmyharness",
    );
  } else {
    for (const tool of tools) {
      const entry = tool.install[0] ?? null;
      const install = entry
        ? ` Install: ${installLine(entry)}`
        : " Install: not verified yet";
      const price = startingPrice(tool)?.label ?? "not verified yet";
      lines.push(
        `- [${tool.name}](https://ohmyharness.com/tools/${tool.slug}): ${KIND_LABELS[tool.kind]} — ${tool.tagline}${install}. Price: ${price}.`,
      );
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- `null` means unknown or not verified; it is rendered as \"?\" on the site.",
    "- A dash (–) means the feature does not apply to that kind of tool.",
    "- Every entry lists at least one source URL.",
    "- Data licence: MIT. Repository: https://github.com/gulivan/ohmyharness",
    "",
  );

  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

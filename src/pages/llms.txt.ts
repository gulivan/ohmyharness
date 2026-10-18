import type { APIRoute } from "astro";
import { KIND_LABELS } from "../lib/features";
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
    "- [Tier list](https://ohmyharness.com/tier-list): make and share a tier list",
    "- [About](https://ohmyharness.com/about): method, neutrality policy and how to contribute",
    "- [Full data (JSON)](https://ohmyharness.com/api/tools.json)",
    "",
    "## Tools",
    "",
  );

  if (tools.length === 0) {
    lines.push(
      "- The directory is empty. Add the first tool: https://github.com/gulivan/ohmyharness",
    );
  } else {
    for (const tool of tools) {
      lines.push(
        `- [${tool.name}](https://ohmyharness.com/tools/${tool.slug}): ${KIND_LABELS[tool.kind]} — ${tool.tagline}`,
      );
    }
  }

  lines.push(
    "",
    "## Notes",
    "",
    "- `null` means unknown or not verified; it is rendered as \"?\" on the site.",
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

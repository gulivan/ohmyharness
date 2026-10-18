import type { APIRoute } from "astro";
import { sourceLabel } from "../../lib/features";
import { startingPrice } from "../../lib/pricing";
import { getAllTools } from "../../lib/tools";

export const GET: APIRoute = () => {
  const tools = getAllTools().map((tool) => ({
    ...tool,
    /** Derived display value: Open source, Source available, Closed source or ? */
    source: sourceLabel(tool),
    /** Derived: cheapest plan, or a free plan when one exists. */
    startingPrice: startingPrice(tool),
  }));
  const body = {
    name: "ohmyharness",
    description:
      "An open directory of AI coding harnesses, orchestrators, cloud agents and add-ons.",
    site: "https://ohmyharness.com",
    schema: "https://ohmyharness.com/api/tools.json",
    generatedAt: new Date().toISOString(),
    count: tools.length,
    tools,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

import type { APIRoute } from "astro";
import { buildSearchIndex } from "../lib/search-index";
import { getAllTools } from "../lib/tools";

/**
 * Lazy search index. The header fetches this on the first focus/open, never on
 * page load, so it can stay out of the critical path.
 */
export const GET: APIRoute = () => {
  const body = JSON.stringify(buildSearchIndex(getAllTools()));

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};

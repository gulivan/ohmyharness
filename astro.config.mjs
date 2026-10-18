import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

export default defineConfig({
  site: "https://ohmyharness.com",
  output: "static",
  // Keep HTML whitespace handling predictable between inline elements.
  compressHTML: true,
  integrations: [
    sitemap({
      filter: (page) =>
        !page.includes("/api/") && !page.endsWith("/llms.txt"),
    }),
  ],
});

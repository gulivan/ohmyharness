/**
 * Build the per-tool social cards at `public/og/<slug>.png`.
 *
 * Runs before `astro build` (npm's `prebuild` lifecycle) so the static server
 * can hand out a real PNG for every tool page and head-to-head page. The card
 * follows the site's own palette and type: JetBrains Mono for facts, Newsreader
 * for the tagline.
 *
 * Fonts are static (not variable) builds from @fontsource: satori's font
 * parser cannot read the `fvar` table in the variable files the site loads for
 * the browser.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";
import { loadTools } from "../src/data/load";
import { KIND_LABELS, sourceLabel } from "../src/lib/features";
import { monogram, monogramStyle } from "../src/lib/monogram";
import { iconFile } from "../src/lib/tools";
import type { Tool } from "../src/data/schema";

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: "#0a0a0b",
  ink: "#f2efe7",
  muted: "#a5a29a",
  faint: "#6f6d66",
  accent: "#d7ff3f",
};

const fontDir = (...parts: string[]) =>
  path.resolve(process.cwd(), "node_modules", "@fontsource", ...parts);

const monoBold = readFileSync(
  fontDir("jetbrains-mono", "files", "jetbrains-mono-latin-700-normal.woff2"),
);
const monoRegular = readFileSync(
  fontDir("jetbrains-mono", "files", "jetbrains-mono-latin-400-normal.woff2"),
);
const serif = readFileSync(
  fontDir("newsreader", "files", "newsreader-latin-400-normal.woff2"),
);

const fonts = [
  { name: "JetBrains Mono", data: monoRegular, weight: 400 as const, style: "normal" as const },
  { name: "JetBrains Mono", data: monoBold, weight: 700 as const, style: "normal" as const },
  { name: "Newsreader", data: serif, weight: 400 as const, style: "normal" as const },
];

type Style = Record<string, string | number>;

/** Plain-object element; satori reads `type` and `props`. */
interface Element {
  type: string;
  props: {
    style: Style;
    children: Element | Element[] | string;
    src?: string;
    width?: number;
    height?: number;
  };
}

/** Small object helper so this script does not need JSX or React. */
const node = (
  type: string,
  style: Style,
  children: Element | Element[] | string,
): Element => ({ type, props: { style, children } });

/**
 * Embed `public/icons/<slug>.*` as a data URI. Rasters go in as-is; SVGs are
 * rasterised first because satori's SVG image support is unreliable. Anything
 * satori cannot read returns null and the card keeps the monogram.
 */
function iconDataUri(tool: Tool): string | null {
  const icon = iconFile(tool.slug);
  if (!icon) return null;

  try {
    if (icon.extension === "png") {
      return `data:image/png;base64,${readFileSync(icon.file).toString("base64")}`;
    }
    if (icon.extension === "svg") {
      const svg = readFileSync(icon.file, "utf8");
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 256 } })
        .render()
        .asPng();
      return `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    }
  } catch {
    // Fall through to the monogram.
  }
  return null;
}

function identity(tool: Tool, icon: string | null): Element {
  const size = 96;
  if (icon) {
    return node(
      "div",
      {
        width: size,
        height: size,
        flex: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f4f1e8",
      },
      {
        type: "img",
        props: {
          src: icon,
          width: size - 12,
          height: size - 12,
          style: { objectFit: "contain" },
          children: "",
        },
      },
    );
  }

  const style = monogramStyle(tool.slug);
  return node(
    "div",
    {
      width: size,
      height: size,
      flex: "none",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: style.background,
      color: style.color,
      fontSize: 28,
      fontWeight: 700,
      letterSpacing: -1,
    },
    monogram(tool.name),
  );
}

function card(tool: Tool, icon: string | null): Element {
  const source = sourceLabel(tool);
  const license = tool.license ? ` · ${tool.license}` : "";

  return node(
    "div",
    {
      width: WIDTH,
      height: HEIGHT,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
      background: COLORS.bg,
      color: COLORS.ink,
      fontFamily: "JetBrains Mono",
      padding: "56px 64px",
      boxSizing: "border-box",
    },
    [
      node(
        "div",
        {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: 22,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: COLORS.muted,
        },
        [
          node(
            "div",
            { display: "flex", alignItems: "center", gap: 14 },
            [
              node("div", { width: 16, height: 16, background: COLORS.accent }, ""),
              node("span", {}, "ohmyharness.com"),
            ],
          ),
          node(
            "div",
            { display: "flex", color: COLORS.accent, fontSize: 20 },
            KIND_LABELS[tool.kind],
          ),
        ],
      ),
      node(
        "div",
        { display: "flex", flexDirection: "row", alignItems: "center", gap: 28 },
        [
          identity(tool, icon),
          node(
            "div",
            { display: "flex", flexDirection: "column", gap: 18 },
            [
              node(
                "div",
                {
                  display: "flex",
                  fontSize: 76,
                  fontWeight: 700,
                  letterSpacing: -3,
                  lineHeight: 1,
                },
                tool.name,
              ),
              node(
                "div",
                {
                  display: "flex",
                  fontFamily: "Newsreader",
                  fontSize: 32,
                  color: COLORS.muted,
                  lineHeight: 1.3,
                  maxWidth: 900,
                },
                tool.tagline,
              ),
            ],
          ),
        ],
      ),
      node(
        "div",
        {
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          fontSize: 20,
          color: COLORS.faint,
        },
        [
          node("span", {}, `ohmyharness.com/tools/${tool.slug}`),
          node("span", {}, `${source}${license}`),
        ],
      ),
    ],
  );
}

async function renderCard(tool: Tool, icon: string | null): Promise<Buffer> {
  const svg = await satori(card(tool, icon), {
    width: WIDTH,
    height: HEIGHT,
    fonts,
  });
  return new Resvg(svg, { fitTo: { mode: "width", value: WIDTH } })
    .render()
    .asPng();
}

async function render(tool: Tool): Promise<Buffer> {
  const icon = iconDataUri(tool);
  if (!icon) return renderCard(tool, null);

  try {
    return await renderCard(tool, icon);
  } catch (error) {
    console.warn(
      `⚠ ${tool.slug}: could not render its logo, using the monogram (${error instanceof Error ? error.message : String(error)}).`,
    );
    return renderCard(tool, null);
  }
}

async function main(): Promise<void> {
  const { tools, issues } = loadTools({ throwOnError: false });
  if (issues.length > 0) {
    throw new Error(
      `[ohmyharness] Cannot render social cards: ${issues.length} invalid tool file(s).`,
    );
  }

  const outDir = path.resolve(process.cwd(), "public", "og");
  mkdirSync(outDir, { recursive: true });

  const started = Date.now();
  for (const tool of tools) {
    writeFileSync(path.join(outDir, `${tool.slug}.png`), await render(tool));
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  console.log(
    `✓ ${tools.length} social card${tools.length === 1 ? "" : "s"} written to public/og (${seconds}s).`,
  );
}

await main();

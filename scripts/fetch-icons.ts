/**
 * Fetch a logo for every tool that does not have one yet.
 *
 * Convention: `public/icons/<slug>.svg|png|webp` is picked up by the build
 * automatically (see `iconFile` in src/lib/tools.ts). This script only writes
 * files; it never touches `data/tools/*.json`.
 *
 * Sources, tried in order:
 *   1. the largest PNG or SVG declared by the tool's website
 *      (`<link rel="icon">`, `<link rel="apple-touch-icon">`),
 *   2. `<origin>/apple-touch-icon.png`,
 *   3. the GitHub owner avatar of the tool's repository.
 *
 * Rasters are normalised to 128x128 PNG. HTML responses, images smaller than
 * 32px and files over 200KB are rejected, so a generic 404 page is never saved
 * as a logo.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { loadTools } from "../src/data/load";
import { iconFile } from "../src/lib/tools";
import type { Tool } from "../src/data/schema";

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 200 * 1024;
const MIN_RASTER = 32;
const TARGET_SIZE = 128;
const CONCURRENCY = 6;

const USER_AGENT =
  "ohmyharness-icon-fetcher/1.0 (+https://ohmyharness.com; contact: hello@ohmyharness.com)";

const force = process.argv.includes("--force");

const onlyFlag = process.argv.indexOf("--only");
const only =
  onlyFlag !== -1
    ? (process.argv[onlyFlag + 1] ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
    : null;

interface Image {
  buffer: Buffer;
  extension: "svg" | "png" | "webp";
  width: number;
  height: number;
}

interface Candidate {
  url: string;
  source: string;
  score: number;
}

interface Outcome {
  slug: string;
  icon: string | null;
  source: string;
  reason: string;
}

const iconsDir = path.resolve(process.cwd(), "public", "icons");

/* ---------- HTTP ---------- */

async function fetchBuffer(
  url: string,
): Promise<{ buffer: Buffer; contentType: string; finalUrl: string }> {
  const response = await fetch(url, {
    headers: {
      "user-agent": USER_AGENT,
      accept: "image/avif,image/webp,image/png,image/svg+xml,text/html;q=0.8,*/*;q=0.5",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new Error(`${Math.round(declared / 1024)}KB larger than 200KB`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    buffer,
    contentType: (response.headers.get("content-type") ?? "").toLowerCase(),
    finalUrl: response.url,
  };
}

/* ---------- website icon discovery ---------- */

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of tag.matchAll(pattern)) {
    attributes[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? "";
  }
  return attributes;
}

function decodeDataUri(uri: string): { buffer: Buffer; contentType: string } | null {
  const match = /^data:(image\/(?:png|svg\+xml|webp));base64,(.+)$/is.exec(uri);
  if (!match) return null;
  try {
    return { buffer: Buffer.from(match[2], "base64"), contentType: match[1] };
  } catch {
    return null;
  }
}

async function websiteCandidates(website: string): Promise<{ candidates: Candidate[]; error?: string }> {
  let page;
  try {
    page = await fetchBuffer(website);
  } catch (error) {
    return { candidates: [], error: error instanceof Error ? error.message : String(error) };
  }

  if (!page.contentType.includes("text/html")) {
    return { candidates: [], error: "website did not return HTML" };
  }

  const html = page.buffer.toString("utf8");
  const candidates: Candidate[] = [];

  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attributes = parseAttributes(match[0]);
    const rel = (attributes.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    if (
      !rel.includes("icon") &&
      !rel.includes("apple-touch-icon") &&
      !rel.includes("apple-touch-icon-precomposed")
    ) {
      continue;
    }

    const href = attributes.href;
    if (!href) continue;

    const type = (attributes.type ?? "").toLowerCase();
    const looksRaster = /\.(png|webp)(?:[?#]|$)/i.test(href) || type.includes("png") || type.includes("webp");
    const looksVector = /\.svg(?:[?#]|$)/i.test(href) || type.includes("svg");
    if (!looksRaster && !looksVector && !href.startsWith("data:image/")) continue;

    let url: string;
    try {
      url = href.startsWith("data:") ? href : new URL(href, page.finalUrl).toString();
    } catch {
      continue;
    }

    let sizes: number[] = [];
    for (const size of (attributes.sizes ?? "").matchAll(/(\d+)x(\d+)/gi)) {
      sizes.push(Math.max(Number(size[1]), Number(size[2])));
    }
    const isSvg = looksVector;
    const score = isSvg ? 5_000 : sizes.length > 0
      ? Math.max(...sizes)
      : rel.includes("apple-touch-icon")
        ? 180
        : 32;

    candidates.push({
      url,
      score,
      source: `website ${rel.includes("apple-touch-icon") ? "apple-touch-icon" : "icon"}${isSvg ? " (svg)" : score > 0 ? ` (${score}px)` : ""}`,
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return { candidates };
}

/* ---------- GitHub owner avatar ---------- */

function githubOwner(repo: string): string | null {
  let url: URL;
  try {
    url = new URL(repo);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "github.com") return null;

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length !== 2) return null;
  const [owner, name] = parts;
  if (!owner || !name) return null;
  if (["features", "orgs", "topics", "sponsors", "settings"].includes(owner.toLowerCase())) {
    return null;
  }
  return owner;
}

/* ---------- validation and normalisation ---------- */

function svgSize(svg: string): { width: number; height: number } {
  const tag = svg.match(/<svg\b[^>]*>/i)?.[0] ?? "";
  const attribute = (name: string): number => {
    const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"));
    if (!match) return 0;
    const value = Number.parseFloat(match[1]);
    return Number.isFinite(value) ? value : 0;
  };

  let width = attribute("width");
  let height = attribute("height");
  if (width > 0 && height > 0) return { width, height };

  const viewBox = tag.match(/viewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  if (viewBox) {
    const values = viewBox.split(/[\s,]+/).map(Number);
    if (values.length === 4 && values[2] > 0 && values[3] > 0) {
      return { width: values[2], height: values[3] };
    }
  }

  width = 0;
  height = 0;
  return { width, height };
}

async function readImage(raw: Buffer, contentType: string): Promise<Image> {
  if (raw.length > MAX_BYTES) {
    throw new Error(`${Math.round(raw.length / 1024)}KB larger than 200KB`);
  }

  const head = raw.subarray(0, 1024).toString("utf8").trim().toLowerCase();
  if (
    contentType.includes("text/html") ||
    head.startsWith("<!doctype") ||
    head.startsWith("<html")
  ) {
    throw new Error("HTML response, not an image");
  }

  const looksSvg =
    contentType.includes("svg") || head.startsWith("<svg") || head.includes("<svg");
  if (looksSvg) {
    const { width, height } = svgSize(raw.toString("utf8"));
    if (width > 0 && height > 0 && Math.min(width, height) < MIN_RASTER) {
      throw new Error(`SVG declares ${width}x${height}, smaller than 32px`);
    }
    return { buffer: raw, extension: "svg", width, height };
  }

  let metadata;
  try {
    metadata = await sharp(raw).metadata();
  } catch {
    throw new Error("not a readable PNG/SVG/WebP/JPEG image");
  }

  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (width === 0 || height === 0) {
    throw new Error("image has no dimensions");
  }
  if (Math.min(width, height) < MIN_RASTER) {
    throw new Error(`${width}x${height}, smaller than 32px`);
  }

  let png = await sharp(raw)
    .resize(TARGET_SIZE, TARGET_SIZE, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // The icon tile is light. A white-on-transparent mark would disappear on it,
  // so invert those to the dark variant before saving.
  const sample = await sharp(png)
    .resize(32, 32, { fit: "fill" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const pixels = sample.info.width * sample.info.height;
  let opaque = 0;
  let luminance = 0;
  for (let index = 0; index < pixels; index += 1) {
    const alpha = sample.data[index * 4 + 3];
    if (alpha <= 32) continue;
    opaque += 1;
    luminance +=
      0.2126 * sample.data[index * 4] +
      0.7152 * sample.data[index * 4 + 1] +
      0.0722 * sample.data[index * 4 + 2];
  }
  if (opaque === 0) {
    throw new Error("image is fully transparent");
  }
  const opaqueRatio = opaque / pixels;
  const meanLuminance = luminance / opaque;
  if (opaqueRatio < 0.6 && meanLuminance > 200) {
    png = await sharp(png).negate({ alpha: false }).png().toBuffer();
  }

  if (png.length > MAX_BYTES) {
    throw new Error(`normalised PNG is ${Math.round(png.length / 1024)}KB, over 200KB`);
  }

  return { buffer: png, extension: "png", width, height };
}

async function download(url: string): Promise<Image> {
  if (url.startsWith("data:")) {
    const decoded = decodeDataUri(url);
    if (!decoded) throw new Error("unsupported data URI");
    return readImage(decoded.buffer, decoded.contentType);
  }
  const { buffer, contentType } = await fetchBuffer(url);
  return readImage(buffer, contentType);
}

/* ---------- per-tool resolution ---------- */

async function resolveIcon(tool: Tool): Promise<{ image: Image; source: string }> {
  const attempts: Candidate[] = [];
  const notes: string[] = [];

  if (tool.website) {
    const { candidates, error } = await websiteCandidates(tool.website);
    if (error) notes.push(`website: ${error}`);
    attempts.push(...candidates);

    try {
      const origin = new URL(tool.website).origin;
      attempts.push({
        url: `${origin}/apple-touch-icon.png`,
        score: 180,
        source: "apple-touch-icon.png",
      });
    } catch {
      // website already validated by the schema; ignore URL edge cases.
    }
  }

  const owner = tool.repo ? githubOwner(tool.repo) : null;
  if (owner) {
    attempts.push({
      url: `https://github.com/${owner}.png?size=${TARGET_SIZE}`,
      score: 128,
      source: "GitHub owner avatar",
    });
  }

  const failures: string[] = [...notes];

  for (const attempt of attempts) {
    try {
      const image = await download(attempt.url);
      return { image, source: attempt.source };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${attempt.source}: ${message}`);
    }
  }

  throw new Error(failures.length > 0 ? failures.join("; ") : "no icon source");
}

/* ---------- main ---------- */

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;

  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main(): Promise<void> {
  const { tools, issues } = loadTools({ throwOnError: false });
  if (issues.length > 0) {
    throw new Error(
      `[ohmyharness] Cannot fetch icons: ${issues.length} invalid tool file(s).`,
    );
  }

  await mkdir(iconsDir, { recursive: true });

  const pending = tools.filter(
    (tool) =>
      (!only || only.includes(tool.slug)) &&
      (force || !iconFile(tool.slug)),
  );
  const skipped = tools.filter((tool) => !pending.includes(tool));

  const outcomes = await mapLimit(pending, CONCURRENCY, async (tool): Promise<Outcome> => {
    try {
      const { image, source } = await resolveIcon(tool);
      const name = `${tool.slug}.${image.extension}`;
      await writeFile(path.join(iconsDir, name), image.buffer);
      return { slug: tool.slug, icon: name, source, reason: "" };
    } catch (error) {
      return {
        slug: tool.slug,
        icon: null,
        source: "",
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const rows: Outcome[] = [
    ...skipped.map((tool) => ({
      slug: tool.slug,
      icon: iconFile(tool.slug) ? path.basename(iconFile(tool.slug)!.file) : null,
      source: "already present",
      reason: "",
    })),
    ...outcomes,
  ].sort((a, b) => a.slug.localeCompare(b.slug, "en"));

  console.log(`\n${"slug".padEnd(24)} ${"icon".padEnd(28)} source`);
  console.log("-".repeat(100));
  for (const row of rows) {
    if (row.icon) {
      console.log(`${row.slug.padEnd(24)} ${row.icon.padEnd(28)} ${row.source}`);
    } else {
      console.log(`${row.slug.padEnd(24)} ${"—".padEnd(28)} failed: ${row.reason}`);
    }
  }

  const found = outcomes.filter((row) => row.icon).length;
  const failed = outcomes.length - found;
  console.log(
    `\n${found} icon${found === 1 ? "" : "s"} written, ${skipped.length} already present, ${failed} failed.`,
  );

  if (failed > 0) process.exitCode = 1;
}

await main();

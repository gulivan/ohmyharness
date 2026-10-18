import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import path from "node:path";
import { formatIssues, toolSchema, type Tool } from "./schema";

export interface DataIssue {
  file: string;
  messages: string[];
}

export interface LoadOptions {
  /** Directory of tool JSON files. Defaults to $OMH_DATA_DIR or data/tools. */
  dir?: string;
  /** Throw a single readable build error when any file is invalid. */
  throwOnError?: boolean;
}

export interface LoadResult {
  dir: string;
  tools: Tool[];
  issues: DataIssue[];
  /** Non-fatal problems, e.g. an `extends` slug with no file yet. */
  warnings: DataIssue[];
}

const cache = new Map<string, LoadResult>();

/** Resolve the tools directory; relative overrides are resolved from the repo root. */
export function resolveDataDir(override?: string): string {
  const explicit = override ?? process.env.OMH_DATA_DIR;
  if (explicit && explicit.trim().length > 0) {
    return path.resolve(process.cwd(), explicit.trim());
  }
  return path.resolve(process.cwd(), "data", "tools");
}

/** Show repo paths relative to the working directory, but keep outside paths absolute. */
export function displayPath(target: string): string {
  const relative = path.relative(process.cwd(), target);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return target;
  }
  return relative;
}

function readToolFiles(dir: string): { file: string; raw: string }[] {
  if (!existsSync(dir)) {
    console.warn(
      `[ohmyharness] Tool data directory not found: ${displayPath(dir)} — rendering an empty directory.`,
    );
    return [];
  }
  if (!statSync(dir).isDirectory()) {
    throw new Error(`[ohmyharness] Expected a directory of tool files at ${dir}`);
  }

  return readdirSync(dir)
    .filter(
      (name) =>
        name.endsWith(".json") && !name.startsWith(".") && !name.startsWith("_"),
    )
    .sort()
    .map((name) => ({
      file: name,
      raw: readFileSync(path.join(dir, name), "utf8"),
    }));
}

/**
 * Read and validate every `data/tools/*.json` file.
 *
 * - Invalid files collect readable issues and, by default, abort the build.
 * - An empty or missing directory is valid: the site renders whatever exists.
 * - `slug` must equal the filename, so tool URLs stay predictable.
 */
export function loadTools(options: LoadOptions = {}): LoadResult {
  const dir = resolveDataDir(options.dir);
  const cached = cache.get(dir);
  if (cached) {
    if (options.throwOnError !== false && cached.issues.length > 0) {
      throw new Error(errorMessage(cached));
    }
    return cached;
  }

  const issues: DataIssue[] = [];
  const tools: Tool[] = [];
  const seenSlugs = new Set<string>();

  for (const { file, raw } of readToolFiles(dir)) {
    const expectedSlug = file.slice(0, -".json".length);
    let data: unknown;

    try {
      data = JSON.parse(raw);
    } catch (error) {
      issues.push({
        file,
        messages: [
          `not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
        ],
      });
      continue;
    }

    const parsed = toolSchema.safeParse(data);
    if (!parsed.success) {
      issues.push({ file, messages: formatIssues(parsed.error) });
      continue;
    }

    const tool = parsed.data;
    if (tool.slug !== expectedSlug) {
      issues.push({
        file,
        messages: [`slug: "${tool.slug}" must equal the filename "${expectedSlug}"`],
      });
      continue;
    }
    if (seenSlugs.has(tool.slug)) {
      issues.push({ file, messages: [`slug: duplicate tool "${tool.slug}"`] });
      continue;
    }

    seenSlugs.add(tool.slug);
    tools.push(tool);
  }

  tools.sort((a, b) => a.name.localeCompare(b.name, "en"));

  const warnings: DataIssue[] = [];
  for (const tool of tools) {
    if (tool.extends !== null && !seenSlugs.has(tool.extends)) {
      warnings.push({
        file: `${tool.slug}.json`,
        messages: [
          `extends: no file for "${tool.extends}" yet — the page will show it as not listed`,
        ],
      });
    }
  }

  const result: LoadResult = { dir, tools, issues, warnings };
  cache.set(dir, result);

  if (warnings.length > 0) {
    console.warn(
      [
        `[ohmyharness] ${warnings.length} data warning(s) in ${displayPath(dir)}:`,
        ...warnings.flatMap((warning) =>
          warning.messages.map((message) => `  ${warning.file}\n    → ${message}`),
        ),
      ].join("\n"),
    );
  }

  if (options.throwOnError !== false && issues.length > 0) {
    throw new Error(errorMessage(result));
  }
  return result;
}

function errorMessage(result: LoadResult): string {
  const lines = result.issues.flatMap((issue) =>
    issue.messages.map((message) => `  ${issue.file}\n    → ${message}`),
  );
  return [
    `[ohmyharness] Invalid tool data in ${displayPath(result.dir)}:`,
    ...lines,
    "",
    "Every file must match src/data/schema.ts. See CONTRIBUTING.md.",
  ].join("\n");
}

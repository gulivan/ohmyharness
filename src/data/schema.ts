import { z } from "zod";

/**
 * The data contract for `data/tools/<slug>.json`.
 *
 * `null` always means "unknown / not verified". It is never a stand-in for
 * "no" — contributors should only write `false` when a source backs it up.
 */

export const KINDS = [
  "harness",
  "orchestrator",
  "cloud-agent",
  "add-on",
] as const;
export const INTERFACES = [
  "cli",
  "tui",
  "desktop",
  "web",
  "ide-extension",
  "mobile",
  "api",
] as const;
export const PLATFORMS = [
  "macos",
  "linux",
  "windows",
  "web",
  "ios",
  "android",
] as const;
export const MODEL_ACCESS = [
  "subscription",
  "byok",
  "bundled",
  "local",
] as const;
export const PRICING_MODELS = ["free", "freemium", "paid"] as const;
export const STATUSES = ["active", "beta", "deprecated"] as const;

export const FEATURE_KEYS = [
  "worktrees",
  "parallelAgents",
  "subagents",
  "mcp",
  "remoteAccess",
  "cloudSandbox",
  "diffReview",
  "planMode",
] as const;

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const slug = z
  .string()
  .min(1)
  .max(64)
  .regex(SLUG_RE, "must be kebab-case (lowercase letters, digits, hyphens)");

const httpUrl = z
  .string()
  .max(500)
  .refine(
    (value) => /^https?:\/\/\S+$/i.test(value),
    "must be an absolute http(s) URL",
  );

const dateString = z
  .string()
  .regex(DATE_RE, "must be a date in YYYY-MM-DD format")
  .refine(
    (value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
    "must be a real calendar date",
  );

function uniqueArray<T extends z.ZodType>(schema: T, values: string) {
  return z
    .array(schema)
    .refine((items) => new Set(items).size === items.length, {
      message: `must not repeat ${values}`,
    });
}

const flag = z.boolean().nullable().default(null);

/**
 * One way to get a tool. Kept deliberately small: a label for the method
 * ("npm", "Homebrew", "Download"), a copyable shell line or an https link,
 * and the platforms it applies to.
 */
export const installEntrySchema = z
  .strictObject({
    label: z
      .string()
      .min(1, "must not be empty")
      .max(24, "must be at most 24 characters"),
    type: z.enum(["command", "url"], {
      message: 'must be "command" or "url"',
    }),
    value: z.string().min(1, "must not be empty"),
    platforms: uniqueArray(z.enum(PLATFORMS), "platforms").min(
      1,
      "at least one platform is required",
    ),
  })
  .superRefine((entry, context) => {
    if (entry.type === "url") {
      let valid = /^https:\/\/\S+$/i.test(entry.value);
      if (valid) {
        try {
          new URL(entry.value);
        } catch {
          valid = false;
        }
      }
      if (!valid) {
        context.addIssue({
          code: "custom",
          path: ["value"],
          message: "must be an absolute https:// URL when type is \"url\"",
        });
      }
      return;
    }

    if (entry.value.trim().length === 0) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "must not be blank when type is \"command\"",
      });
    }
    if (/[\r\n]/.test(entry.value)) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "must be a single line without newlines",
      });
    }
  });

// A way to pay for the tool, including the vendor subscription it runs on
// (e.g. Codex CLI is free software but is used through ChatGPT plans).
export const PLAN_PERIODS = ["month", "year", "once", "usage"] as const;
export const planSchema = z.strictObject({
  name: z.string().min(1).max(40),
  price: z.number().nonnegative().nullable(), // null = "contact sales"
  currency: z.string().regex(/^[A-Z]{3}$/, "currency must be an ISO 4217 code like USD"),
  period: z.enum(PLAN_PERIODS),
  notes: z.string().max(160).optional(),
  url: z.url({ protocol: /^https$/ }).optional(),
});
export type Plan = z.infer<typeof planSchema>;

export const featuresSchema = z.strictObject({
  worktrees: flag,
  parallelAgents: flag,
  subagents: flag,
  mcp: flag,
  remoteAccess: flag,
  cloudSandbox: flag,
  diffReview: flag,
  planMode: flag,
});

const toolObject = z.strictObject({
  slug,
  name: z.string().min(1).max(80),
  kind: z.enum(KINDS),
  /**
   * Slug of the one harness or orchestrator an add-on extends. Required for
   * `kind: "add-on"` and forbidden for every other kind. The referenced file
   * may not exist yet; the loader warns instead of failing.
   */
  extends: slug.nullable().default(null),
  tagline: z.string().min(1).max(110),
  description: z.string().min(1).max(700),
  website: httpUrl,
  repo: httpUrl.nullable(),
  openSource: z.boolean().nullable(),
  license: z.string().min(1).max(80).nullable(),
  maker: z.string().min(1).max(120).nullable(),
  interfaces: uniqueArray(z.enum(INTERFACES), "interfaces"),
  platforms: uniqueArray(z.enum(PLATFORMS), "platforms"),
  drives: uniqueArray(slug, "drives entries"),
  modelAccess: uniqueArray(z.enum(MODEL_ACCESS), "model access entries"),
  pricing: z.strictObject({
    model: z.enum(PRICING_MODELS).nullable(),
    notes: z.string().max(300).optional(),
    plans: z.array(planSchema).max(8).default([]),
  }),
  features: featuresSchema,
  github: z
    .strictObject({
      stars: z.number().int().nonnegative(),
      checkedAt: dateString,
    })
    .nullable(),
  status: z.enum(STATUSES),
  /**
   * How to get the tool, in display order. The first entry is the default.
   * Omitted or empty means the install steps have not been verified yet.
   */
  install: z.array(installEntrySchema).default([]),
  sources: uniqueArray(httpUrl, "sources").min(1, "at least one source is required"),
  lastVerified: dateString,
});

export const toolSchema = toolObject.superRefine((tool, context) => {
  if (tool.kind === "add-on" && tool.extends === null) {
    context.addIssue({
      code: "custom",
      path: ["extends"],
      message: 'is required when kind is "add-on"',
    });
  }
  if (tool.kind !== "add-on" && tool.extends !== null) {
    context.addIssue({
      code: "custom",
      path: ["extends"],
      message: 'is only allowed when kind is "add-on"',
    });
  }
});

export type Tool = z.infer<typeof toolSchema>;
export type ToolKind = (typeof KINDS)[number];
export type InstallEntry = z.infer<typeof installEntrySchema>;
export type FeatureKey = keyof Tool["features"];
export type FeatureValue = boolean | null;

/** Turn zod issues into short, file-relative lines for build logs. */
export function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `${path}: ${issue.message}`;
  });
}

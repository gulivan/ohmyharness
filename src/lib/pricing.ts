import type { Plan, Tool } from "../data/schema";

const PERIOD_SUFFIX: Record<Plan["period"], string> = {
  month: "/mo",
  year: "/yr",
  once: " once",
  usage: " usage",
};

/**
 * Order plans for display: fixed prices first (cheapest first), then
 * pay-as-you-go prices, then "contact sales", with usage plans last.
 */
function planRank(plan: Plan): number {
  if (plan.price !== null) return plan.period === "usage" ? 1 : 0;
  return plan.period === "usage" ? 3 : 2;
}

export function sortPlans(plans: readonly Plan[]): Plan[] {
  return [...plans].sort((a, b) => {
    const rank = planRank(a) - planRank(b);
    if (rank !== 0) return rank;

    const priceA = a.price ?? Number.POSITIVE_INFINITY;
    const priceB = b.price ?? Number.POSITIVE_INFINITY;
    if (priceA !== priceB) return priceA - priceB;

    return a.name.localeCompare(b.name, "en");
  });
}

const formatters = new Map<string, Intl.NumberFormat>();

function money(amount: number, currency: string): string {
  let formatter = formatters.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        currencyDisplay: "narrowSymbol",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    } catch {
      formatter = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
      formatters.set(currency, formatter);
      return `${currency} ${formatter.format(amount)}`;
    }
    formatters.set(currency, formatter);
  }
  return formatter.format(amount);
}

/** "$20/mo", "$9.99/mo", "Free", "Contact sales", "Pay as you go". */
export function formatPrice(plan: Plan): string {
  if (plan.price === 0) return "Free";
  if (plan.price === null) {
    return plan.period === "usage" ? "Pay as you go" : "Contact sales";
  }
  return `${money(plan.price, plan.currency)}${PERIOD_SUFFIX[plan.period]}`;
}

export function hasFreePlan(tool: Pick<Tool, "pricing">): boolean {
  return tool.pricing.plans.some((plan) => plan.price === 0);
}

/** Cheapest fixed-price paid plan (monthly, yearly or one-off), if any. */
export function cheapestPaidPlan(
  tool: Pick<Tool, "pricing">,
): Plan | null {
  return (
    sortPlans(tool.pricing.plans).find(
      (plan) =>
        plan.price !== null && plan.price > 0 && plan.period !== "usage",
    ) ?? null
  );
}

export interface StartingPrice {
  amount: number | null;
  currency: string;
  period: Plan["period"];
  label: string;
}

/**
 * The first price a reader would pay: a free plan when one exists, otherwise
 * the cheapest fixed-price plan, otherwise whatever the plans say.
 */
export function startingPrice(
  tool: Pick<Tool, "pricing">,
): StartingPrice | null {
  const plans = sortPlans(tool.pricing.plans);
  if (plans.length === 0) return null;

  const free = plans.find((plan) => plan.price === 0);
  if (free) {
    return {
      amount: 0,
      currency: free.currency,
      period: free.period,
      label: "Free",
    };
  }

  const paid = cheapestPaidPlan(tool);
  if (paid && paid.price !== null) {
    return {
      amount: paid.price,
      currency: paid.currency,
      period: paid.period,
      label: `From ${formatPrice(paid)}`,
    };
  }

  const fallback = plans[0]!;
  return {
    amount: null,
    currency: fallback.currency,
    period: fallback.period,
    label: formatPrice(fallback),
  };
}

/**
 * Short price label for cards: "Free", "Free · from $10/mo",
 * "From $20/mo", "Contact sales", or "Pricing ?" when nothing is known.
 */
export function priceLabel(tool: Pick<Tool, "pricing">): string {
  if (tool.pricing.plans.length === 0) return "Pricing ?";

  const free = hasFreePlan(tool);
  const paid = cheapestPaidPlan(tool);

  if (free && paid) return `Free · from ${formatPrice(paid)}`;
  if (free) return "Free";
  if (paid) return `From ${formatPrice(paid)}`;

  const starting = startingPrice(tool);
  return starting?.label ?? "Pricing ?";
}

/** A plan's price as a monthly figure, for comparison and filtering. */
export function monthlyEquivalent(plan: Plan): number | null {
  if (plan.price === null) return null;
  if (plan.period === "month") return plan.price;
  if (plan.period === "year") return plan.price / 12;
  return null;
}

/**
 * Cheapest fixed plan per month, with yearly prices divided by twelve.
 * Free plans count as 0; pay-as-you-go and one-off plans do not.
 */
export function cheapestMonthly(
  tool: Pick<Tool, "pricing">,
): number | null {
  const values = tool.pricing.plans
    .map(monthlyEquivalent)
    .filter((value): value is number => value !== null);
  return values.length > 0 ? Math.min(...values) : null;
}

const VENDORS: { vendor: string; pattern: RegExp }[] = [
  { vendor: "X", pattern: /\bX Subscription\b/ },
  { vendor: "Claude", pattern: /\bClaude (?:Pro|Max|Team|Enterprise|Code)\b/ },
  {
    vendor: "ChatGPT",
    pattern: /\bChatGPT (?:Free|Go|Plus|Pro|Business|Team|Enterprise)\b/,
  },
  { vendor: "Google AI", pattern: /\bGoogle AI (?:Plus|Pro|Ultra)\b/ },
  {
    vendor: "GitHub Copilot",
    pattern: /\bCopilot (?:Free|Pro|Pro\+|Max|Business|Enterprise)\b/,
  },
  {
    vendor: "Kimi",
    pattern: /\bKimi (?:Code|membership|Plus|Pro|Max|Ultra)\b/,
  },
  { vendor: "Nous Portal", pattern: /\bNous Portal\b/ },
  { vendor: "Grok", pattern: /\bGrok (?:Build|Plus|Premium|Super|Ultra)\b/ },
];

/**
 * The subscription a tool's plans are really sold through, e.g. Claude Code's
 * plans are Claude plans. Only derived when a plan name or note names one of
 * the vendor's products; otherwise null.
 */
export function vendorPlan(tool: Pick<Tool, "pricing">): string | null {
  const text = [
    tool.pricing.notes ?? "",
    ...tool.pricing.plans.flatMap((plan) => [plan.name, plan.notes ?? ""]),
  ].join(" ");

  for (const { vendor, pattern } of VENDORS) {
    if (pattern.test(text)) return vendor;
  }
  return null;
}

/** One compact line for a plan, e.g. "Pro $20/mo" or just "Free". */
export function planSummary(plan: Plan): string {
  const price = formatPrice(plan);
  return plan.name.toLowerCase() === price.toLowerCase()
    ? plan.name
    : `${plan.name} ${price}`;
}

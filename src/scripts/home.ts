export {};

/**
 * Home-page chrome: sticky directory toolbar, the More filters popover, and
 * the comparison tray. Filtering itself lives in filters.ts.
 */

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------------- header offset ---------------- */

const header = document.querySelector<HTMLElement>(".site-header");

function setHeaderHeight(): void {
  if (!header) return;
  document.documentElement.style.setProperty(
    "--site-header-h",
    `${header.offsetHeight}px`,
  );
}

setHeaderHeight();
window.addEventListener("resize", setHeaderHeight);
if (header && "ResizeObserver" in window) {
  new ResizeObserver(setHeaderHeight).observe(header);
}

/* ---------------- sticky toolbar ---------------- */

const toolbar = document.querySelector<HTMLElement>("[data-toolbar]");
const sentinel = document.querySelector<HTMLElement>("[data-toolbar-sentinel]");

if (toolbar && sentinel && "IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0];
      if (window.matchMedia("(max-width: 767px)").matches) {
        toolbar.classList.remove("is-stuck");
        return;
      }
      toolbar.classList.toggle(
        "is-stuck",
        entry !== undefined && !entry.isIntersecting,
      );
    },
    { rootMargin: `-${header?.offsetHeight ?? 58}px 0px 0px 0px`, threshold: 0 },
  );
  observer.observe(sentinel);
}

/* ---------------- More filters ---------------- */

const panel = document.querySelector<HTMLElement>("[data-more-filters-panel]");
const backdrop = document.querySelector<HTMLElement>("[data-filters-backdrop]");
const toggles = Array.from(
  document.querySelectorAll<HTMLElement>(
    "[data-more-filters-toggle], [data-mobile-filters]",
  ),
);
const closeButtons = Array.from(
  document.querySelectorAll<HTMLElement>("[data-more-filters-close]"),
);

function setPanel(open: boolean, returnFocus = false): void {
  if (!panel) return;
  panel.hidden = !open;
  if (backdrop) backdrop.hidden = !open;
  document.body.classList.toggle("filters-open", open);
  for (const toggle of toggles) {
    toggle.setAttribute("aria-expanded", String(open));
  }
  if (open) {
    panel.querySelector<HTMLElement>("input, select, button")?.focus({
      preventScroll: true,
    });
  } else if (returnFocus) {
    toggles[0]?.focus({ preventScroll: true });
  }
}

for (const toggle of toggles) {
  toggle.addEventListener("click", () => {
    setPanel(panel?.hidden !== false);
  });
}
for (const button of closeButtons) {
  button.addEventListener("click", () => setPanel(false, true));
}
backdrop?.addEventListener("click", () => setPanel(false, true));

document.addEventListener("pointerdown", (event) => {
  if (!panel || panel.hidden) return;
  const target = event.target as Node | null;
  if (!target) return;
  if (panel.contains(target)) return;
  if (toggles.some((toggle) => toggle.contains(target))) return;
  setPanel(false);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !panel || panel.hidden) return;
  event.preventDefault();
  setPanel(false, true);
});

/* ---------------- comparison tray ---------------- */

const COMPARE_KEY = "omh.compare.v1";
const MAX_COMPARE = 4;

const compareButtons = Array.from(
  document.querySelectorAll<HTMLButtonElement>("[data-compare-toggle]"),
);
const tray = document.querySelector<HTMLElement>("[data-compare-tray]");
const trayItems = document.querySelector<HTMLElement>("[data-compare-items]");
const trayHint = document.querySelector<HTMLElement>("[data-compare-hint]");
const trayLinks = Array.from(
  document.querySelectorAll<HTMLAnchorElement>("[data-compare-link]"),
);
const clearCompare = document.querySelector<HTMLButtonElement>(
  "[data-compare-clear]",
);
const compareCounts = Array.from(
  document.querySelectorAll<HTMLElement>("[data-compare-count]"),
);
const compareStatus = document.querySelector<HTMLElement>(
  "[data-compare-status]",
);

const available = new Set(
  compareButtons
    .map((button) => button.dataset.slug)
    .filter((slug): slug is string => Boolean(slug)),
);
const names = new Map(
  compareButtons.map((button) => [
    button.dataset.slug ?? "",
    button.dataset.name ?? button.dataset.slug ?? "Tool",
  ]),
);

function readCompare(): string[] {
  try {
    const raw = window.localStorage.getItem(COMPARE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((value): value is string => typeof value === "string")
      .filter((value) => available.has(value))
      .filter((value, index, list) => list.indexOf(value) === index)
      .slice(0, MAX_COMPARE);
  } catch {
    return [];
  }
}

let selected = readCompare();

function writeCompare(): void {
  try {
    window.localStorage.setItem(COMPARE_KEY, JSON.stringify(selected));
  } catch {
    // Storage may be unavailable; the tray still works for this page view.
  }
}

function announce(message: string): void {
  if (compareStatus) compareStatus.textContent = message;
}

function renderCompare(): void {
  for (const button of compareButtons) {
    const active = selected.includes(button.dataset.slug ?? "");
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      `${active ? "Remove" : "Add"} ${button.dataset.name ?? "tool"} ${
        active ? "from" : "to"
      } comparison`,
    );
  }

  for (const count of compareCounts) {
    count.textContent = String(selected.length);
  }

  if (trayItems) {
    trayItems.replaceChildren();
    for (const slug of selected) {
      const item = document.createElement("li");
      item.className = "compare-tray__item";

      const link = document.createElement("a");
      link.href = `/tools/${slug}`;
      link.textContent = names.get(slug) ?? slug;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "compare-tray__remove";
      remove.dataset.compareRemove = slug;
      remove.setAttribute("aria-label", `Remove ${names.get(slug) ?? slug}`);
      remove.textContent = "×";

      item.append(link, remove);
      trayItems.append(item);
    }
  }

  if (tray) tray.hidden = selected.length === 0;
  if (trayHint) {
    trayHint.textContent =
      selected.length === 0
        ? "Pick 2–4 tools"
        : selected.length === 1
          ? "Pick one more"
          : `${selected.length} of ${MAX_COMPARE} selected`;
  }

  const href =
    selected.length > 0
      ? `/compare?tools=${selected.map(encodeURIComponent).join(",")}`
      : "/compare";
  for (const link of trayLinks) {
    link.href = href;
    link.setAttribute(
      "aria-disabled",
      String(link.hasAttribute("data-compare-cta") && selected.length < 2),
    );
  }

  writeCompare();
}

for (const button of compareButtons) {
  button.addEventListener("click", () => {
    const slug = button.dataset.slug ?? "";
    if (!slug) return;
    const index = selected.indexOf(slug);
    if (index >= 0) {
      selected.splice(index, 1);
      announce(`${names.get(slug) ?? slug} removed from comparison`);
    } else if (selected.length >= MAX_COMPARE) {
      announce(`Comparison holds up to ${MAX_COMPARE} tools. Remove one first.`);
      return;
    } else {
      selected.push(slug);
      announce(
        `${names.get(slug) ?? slug} added. ${selected.length} of ${MAX_COMPARE} selected.`,
      );
    }
    renderCompare();
  });
}

trayItems?.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>("[data-compare-remove]");
  if (!button) return;
  const slug = button.dataset.compareRemove ?? "";
  selected = selected.filter((value) => value !== slug);
  announce(`${names.get(slug) ?? slug} removed from comparison`);
  renderCompare();
});

clearCompare?.addEventListener("click", () => {
  selected = [];
  announce("Comparison cleared");
  renderCompare();
});

for (const link of trayLinks) {
  link.addEventListener("click", (event) => {
    if (
      link.hasAttribute("data-compare-cta") &&
      selected.length < 2
    ) {
      event.preventDefault();
      announce("Pick at least two tools to compare.");
    }
  });
}

renderCompare();

/* ---------------- mobile search shortcut ---------------- */

for (const button of document.querySelectorAll<HTMLElement>(
  "[data-mobile-search]",
)) {
  button.addEventListener("click", (event) => {
    event.preventDefault();
    const input =
      document.querySelector<HTMLInputElement>("#mobile-search") ??
      document.querySelector<HTMLInputElement>("[data-filter-search]");
    if (!input) return;
    input.scrollIntoView({
      block: "center",
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
    input.focus({ preventScroll: true });
  });
}

/* ---------------- hero search submit ---------------- */

document
  .querySelector<HTMLFormElement>("[data-hero-search]")
  ?.addEventListener("submit", (event) => {
    event.preventDefault();
    document.querySelector<HTMLElement>("#directory")?.scrollIntoView({
      block: "start",
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
  });

/* ---------------- kind cards ---------------- */

for (const link of document.querySelectorAll<HTMLAnchorElement>(
  "[data-kind-link]",
)) {
  link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const kind = link.dataset.kindLink;
    if (!kind) return;
    event.preventDefault();
    document
      .querySelector<HTMLButtonElement>(`[data-filter-kind="${kind}"]`)
      ?.click();
    document.querySelector<HTMLElement>("#directory")?.scrollIntoView({
      block: "start",
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
  });
}

/* ---------------- "/" focuses the hero search ---------------- */

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

// The header search also listens for "/" on the document. On the home page the
// hero search is the primary field, so claim the key first and stop the event.
window.addEventListener(
  "keydown",
  (event) => {
    if (
      event.defaultPrevented ||
      event.key !== "/" ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      isTyping(event.target)
    ) {
      return;
    }
    const input = document.querySelector<HTMLInputElement>(
      ".hero-search__input",
    );
    if (!input) return;
    event.preventDefault();
    event.stopPropagation();
    input.focus({ preventScroll: true });
    input.scrollIntoView({
      block: "center",
      behavior: reduceMotion.matches ? "auto" : "smooth",
    });
  },
  true,
);

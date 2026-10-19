import { plural } from "./ui";

const KINDS = ["harness", "orchestrator", "cloud-agent", "add-on"] as const;
type Kind = (typeof KINDS)[number] | "all";
type SourceFilter = "any" | "open" | "available" | "closed";
type PriceFilter = "any" | "free" | "under20" | "under50";
type SortOrder = "name" | "stars" | "price";

interface FilterState {
  q: string;
  kind: Kind;
  os: SourceFilter;
  price: PriceFilter;
  platform: string;
  iface: string;
  features: string[];
  sort: SortOrder;
}

const KIND_NAMES: Record<Kind, string> = {
  all: "All kinds",
  harness: "Harnesses",
  orchestrator: "Orchestrators",
  "cloud-agent": "Cloud agents",
  "add-on": "Add-ons",
};

const root = document.querySelector<HTMLElement>("[data-filters]");

if (root) {
  initFilters(root);
}

function initFilters(container: HTMLElement): void {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tool]"),
  );
  // The hero and the sticky toolbar both drive the same query.
  const searchInputs = Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-filter-search]"),
  );
  const osSelect = document.querySelector<HTMLSelectElement>("#filter-os");
  const platformSelect =
    document.querySelector<HTMLSelectElement>("#filter-platform");
  const interfaceSelect =
    document.querySelector<HTMLSelectElement>("#filter-interface");
  const priceSelect = document.querySelector<HTMLSelectElement>("#filter-price");
  const kindButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("[data-filter-kind]"),
  );
  const featureInputs = Array.from(
    container.querySelectorAll<HTMLInputElement>('input[name="feature"]'),
  );
  const priceButtons = Array.from(
    container.querySelectorAll<HTMLButtonElement>("[data-filter-price]"),
  );
  const sortSelect = document.querySelector<HTMLSelectElement>("#filter-sort");
  const grids = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tool-grid]"),
  );
  const results = document.querySelector<HTMLElement>("#results-count");
  const reset = document.querySelector<HTMLButtonElement>("#filter-reset");
  const empty = document.querySelector<HTMLElement>("#filter-empty");
  const chips = document.querySelector<HTMLElement>("[data-active-filters]");
  const activeRow = document.querySelector<HTMLElement>("[data-active-row]");
  const clearAll = document.querySelector<HTMLButtonElement>(
    "[data-clear-filters]",
  );
  const badge = document.querySelector<HTMLElement>(
    "[data-hidden-filter-count]",
  );
  const moreButton = document.querySelector<HTMLElement>(
    "[data-more-filters-toggle]",
  );
  const total = cards.length;

  const featureLabels = new Map<string, string>();
  for (const input of featureInputs) {
    const label =
      input
        .closest("label")
        ?.querySelector<HTMLElement>(".chip__text")
        ?.textContent?.trim() ?? input.value;
    featureLabels.set(input.value, label);
  }

  let state = readState();

  function readState(): FilterState {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind");
    const os = params.get("os");
    const price = params.get("price");
    const sort = params.get("sort");
    return {
      q: params.get("q") ?? "",
      kind:
        kind && (KINDS as readonly string[]).includes(kind)
          ? (kind as Kind)
          : "all",
      os:
        os === "open" || os === "available" || os === "closed"
          ? (os as SourceFilter)
          : "any",
      price:
        price === "free" || price === "under20" || price === "under50"
          ? (price as PriceFilter)
          : "any",
      platform: params.get("platform") ?? "",
      iface: params.get("interface") ?? "",
      features: (params.get("f") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
      sort:
        sort === "stars" || sort === "price" ? (sort as SortOrder) : "name",
    };
  }

  function applyControls(): void {
    for (const input of searchInputs) {
      if (input.value !== state.q) input.value = state.q;
    }
    if (osSelect) osSelect.value = state.os;
    if (platformSelect) platformSelect.value = state.platform;
    if (interfaceSelect) interfaceSelect.value = state.iface;
    if (priceSelect) priceSelect.value = state.price;
    if (sortSelect) sortSelect.value = state.sort;
    for (const button of kindButtons) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.filterKind ?? "all") === state.kind),
      );
    }
    for (const button of priceButtons) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.filterPrice ?? "any") === state.price),
      );
    }
    for (const input of featureInputs) {
      input.checked = state.features.includes(input.value);
    }
    renderChips();
    updateBadge();
  }

  function selectedText(
    select: HTMLSelectElement | null,
    fallback: string,
  ): string {
    return select?.selectedOptions[0]?.textContent?.trim() || fallback;
  }

  function renderChips(): void {
    if (!chips) return;

    const items: Array<{ key: string; label: string }> = [];
    if (state.q.trim()) {
      items.push({ key: "q", label: `“${state.q.trim()}”` });
    }
    if (state.kind !== "all") {
      items.push({ key: "kind", label: KIND_NAMES[state.kind] });
    }
    if (state.price !== "any") {
      items.push({
        key: "price",
        label: selectedText(priceSelect, "Price"),
      });
    }
    if (state.os !== "any") {
      items.push({ key: "os", label: selectedText(osSelect, "Source") });
    }
    if (state.platform) {
      items.push({
        key: "platform",
        label: selectedText(platformSelect, "Platform"),
      });
    }
    if (state.iface) {
      items.push({
        key: "iface",
        label: selectedText(interfaceSelect, "Interface"),
      });
    }
    for (const feature of state.features) {
      items.push({
        key: `f:${feature}`,
        label: featureLabels.get(feature) ?? feature,
      });
    }

    chips.replaceChildren();
    chips.hidden = items.length === 0;
    if (activeRow) activeRow.hidden = items.length === 0;
    if (clearAll) clearAll.hidden = items.length === 0;

    for (const item of items) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "active-chip";
      button.dataset.removeFilter = item.key;
      button.setAttribute("aria-label", `Remove filter: ${item.label}`);

      const text = document.createElement("span");
      text.textContent = item.label;
      const close = document.createElement("span");
      close.className = "active-chip__x";
      close.setAttribute("aria-hidden", "true");
      close.textContent = "×";

      button.append(text, close);
      chips.append(button);
    }
  }

  function updateBadge(): void {
    const hidden =
      (state.os !== "any" ? 1 : 0) +
      (state.iface ? 1 : 0) +
      state.features.length;
    if (badge) {
      badge.textContent = String(hidden);
      badge.hidden = hidden === 0;
    }
    moreButton?.classList.toggle("has-active", hidden > 0);
  }

  function writeUrl(): void {
    const params = new URLSearchParams();
    if (state.q.trim()) params.set("q", state.q.trim());
    if (state.kind !== "all") params.set("kind", state.kind);
    if (state.os !== "any") params.set("os", state.os);
    if (state.price !== "any") params.set("price", state.price);
    if (state.platform) params.set("platform", state.platform);
    if (state.iface) params.set("interface", state.iface);
    if (state.features.length > 0) params.set("f", state.features.join(","));
    if (state.sort !== "name") params.set("sort", state.sort);

    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    try {
      window.history.replaceState(null, "", url);
    } catch {
      // A sandboxed preview may forbid history updates; filtering still works.
    }
  }

  function matches(card: HTMLElement): boolean {
    if (state.kind !== "all" && card.dataset.kind !== state.kind) return false;

    if (state.os !== "any" && card.dataset.source !== state.os) return false;

    if (state.price !== "any") {
      if (state.price === "free") {
        if (card.dataset.priceFree !== "true") return false;
      } else {
        const monthly = card.dataset.priceMonthly ?? "";
        if (monthly === "") return false;
        const amount = Number(monthly);
        if (!Number.isFinite(amount)) return false;
        if (state.price === "under20" && amount >= 20) return false;
        if (state.price === "under50" && amount >= 50) return false;
      }
    }

    if (
      state.platform &&
      !(card.dataset.platforms ?? "").split(" ").includes(state.platform)
    ) {
      return false;
    }

    if (
      state.iface &&
      !(card.dataset.interfaces ?? "").split(" ").includes(state.iface)
    ) {
      return false;
    }

    const confirmed = (card.dataset.features ?? "").split(" ");
    if (!state.features.every((feature) => confirmed.includes(feature))) {
      return false;
    }

    const haystack = card.dataset.search ?? "";
    const tokens = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    return tokens.every((token) => haystack.includes(token));
  }

  function sortedCards(): HTMLElement[] {
    const byName = (a: HTMLElement, b: HTMLElement): number =>
      (a.dataset.name ?? "").localeCompare(b.dataset.name ?? "", "en");

    return [...cards].sort((a, b) => {
      if (state.sort === "stars") {
        const starsA = Number(a.dataset.stars ?? "") || -1;
        const starsB = Number(b.dataset.stars ?? "") || -1;
        if (starsA !== starsB) return starsB - starsA;
        return byName(a, b);
      }
      if (state.sort === "price") {
        const priceA = a.dataset.priceMonthly ?? "";
        const priceB = b.dataset.priceMonthly ?? "";
        const valueA = priceA === "" ? Number.POSITIVE_INFINITY : Number(priceA);
        const valueB = priceB === "" ? Number.POSITIVE_INFINITY : Number(priceB);
        if (valueA !== valueB) return valueA - valueB;
        return byName(a, b);
      }
      return byName(a, b);
    });
  }

  function place(
    sorted: HTMLElement[],
    visible: Map<HTMLElement, boolean>,
  ): void {
    const [first, rest] = grids;
    if (!first) return;

    const shown: HTMLElement[] = [];
    const hidden: HTMLElement[] = [];
    for (const card of sorted) {
      (visible.get(card) ? shown : hidden).push(card);
    }

    // The tier-list band sits between the first six results and the rest.
    shown.slice(0, 6).forEach((card) => first.append(card));
    if (rest) {
      shown.slice(6).forEach((card) => rest.append(card));
      hidden.forEach((card) => rest.append(card));
    } else {
      shown.slice(6).forEach((card) => first.append(card));
      hidden.forEach((card) => first.append(card));
    }
  }

  function update(shouldWriteUrl = true): void {
    const sorted = sortedCards();
    const visible = new Map<HTMLElement, boolean>();
    for (const card of cards) visible.set(card, matches(card));

    place(sorted, visible);

    let count = 0;
    for (const card of cards) {
      const show = visible.get(card) === true;
      card.hidden = !show;
      if (show) count += 1;
    }

    if (results) {
      results.textContent =
        count === total ? plural(total, "tool") : `${count} of ${plural(total, "tool")}`;
    }
    if (empty) empty.hidden = count > 0 || total === 0;
    if (shouldWriteUrl) writeUrl();
  }

  function clearFilters(): void {
    state = {
      q: "",
      kind: "all",
      os: "any",
      price: "any",
      platform: "",
      iface: "",
      features: [],
      sort: "name",
    };
    applyControls();
    update();
  }

  for (const input of searchInputs) {
    input.addEventListener("input", () => {
      state.q = input.value;
      for (const other of searchInputs) {
        if (other !== input && other.value !== state.q) other.value = state.q;
      }
      update();
    });
  }

  osSelect?.addEventListener("change", () => {
    state.os = (osSelect.value as SourceFilter) || "any";
    applyControls();
    update();
  });

  platformSelect?.addEventListener("change", () => {
    state.platform = platformSelect.value;
    applyControls();
    update();
  });

  interfaceSelect?.addEventListener("change", () => {
    state.iface = interfaceSelect.value;
    applyControls();
    update();
  });

  priceSelect?.addEventListener("change", () => {
    const value = priceSelect.value;
    state.price =
      value === "free" || value === "under20" || value === "under50"
        ? (value as PriceFilter)
        : "any";
    applyControls();
    update();
  });

  for (const button of kindButtons) {
    button.addEventListener("click", () => {
      state.kind = (button.dataset.filterKind as Kind) ?? "all";
      applyControls();
      update();
    });
  }

  for (const button of priceButtons) {
    button.addEventListener("click", () => {
      state.price = (button.dataset.filterPrice as PriceFilter) ?? "any";
      applyControls();
      update();
    });
  }

  sortSelect?.addEventListener("change", () => {
    const value = sortSelect.value;
    state.sort =
      value === "stars" || value === "price" ? (value as SortOrder) : "name";
    update();
  });

  for (const input of featureInputs) {
    input.addEventListener("change", () => {
      state.features = featureInputs
        .filter((item) => item.checked)
        .map((item) => item.value);
      applyControls();
      update();
    });
  }

  chips?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement | null;
    const button = target?.closest<HTMLButtonElement>("[data-remove-filter]");
    if (!button) return;

    const key = button.dataset.removeFilter ?? "";
    if (key === "q") state.q = "";
    else if (key === "kind") state.kind = "all";
    else if (key === "price") state.price = "any";
    else if (key === "os") state.os = "any";
    else if (key === "platform") state.platform = "";
    else if (key === "iface") state.iface = "";
    else if (key.startsWith("f:")) {
      state.features = state.features.filter(
        (feature) => feature !== key.slice(2),
      );
    }

    applyControls();
    update();
  });

  clearAll?.addEventListener("click", clearFilters);
  reset?.addEventListener("click", clearFilters);

  window.addEventListener("popstate", () => {
    state = readState();
    applyControls();
    update(false);
  });

  applyControls();
  update(false);
}

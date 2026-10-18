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

const root = document.querySelector<HTMLElement>("[data-filters]");

if (root) {
  initFilters(root);
}

function initFilters(container: HTMLElement): void {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tool]"),
  );
  const search = document.querySelector<HTMLInputElement>("#filter-search");
  const osSelect = document.querySelector<HTMLSelectElement>("#filter-os");
  const platformSelect =
    document.querySelector<HTMLSelectElement>("#filter-platform");
  const interfaceSelect =
    document.querySelector<HTMLSelectElement>("#filter-interface");
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
  const grid = document.querySelector<HTMLElement>(".tool-grid");
  const results = document.querySelector<HTMLElement>("#results-count");
  const reset = document.querySelector<HTMLButtonElement>("#filter-reset");
  const empty = document.querySelector<HTMLElement>("#filter-empty");
  const total = cards.length;

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
    if (search) search.value = state.q;
    if (osSelect) osSelect.value = state.os;
    if (platformSelect) platformSelect.value = state.platform;
    if (interfaceSelect) interfaceSelect.value = state.iface;
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

  function sortCards(): void {
    if (!grid) return;

    const byName = (a: HTMLElement, b: HTMLElement): number =>
      (a.dataset.name ?? "").localeCompare(b.dataset.name ?? "", "en");

    const sorted = [...cards].sort((a, b) => {
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

    for (const card of sorted) grid.append(card);
  }

  function update(shouldWriteUrl = true): void {
    sortCards();

    let visible = 0;
    for (const card of cards) {
      const show = matches(card);
      card.hidden = !show;
      if (show) visible += 1;
    }

    if (results) {
      results.textContent =
        visible === total
          ? plural(total, "tool")
          : `${visible} of ${plural(total, "tool")}`;
    }
    if (empty) empty.hidden = visible > 0 || total === 0;
    if (shouldWriteUrl) writeUrl();
  }

  search?.addEventListener("input", () => {
    state.q = search.value;
    update();
  });

  osSelect?.addEventListener("change", () => {
    state.os = (osSelect.value as SourceFilter) || "any";
    update();
  });

  platformSelect?.addEventListener("change", () => {
    state.platform = platformSelect.value;
    update();
  });

  interfaceSelect?.addEventListener("change", () => {
    state.iface = interfaceSelect.value;
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
      update();
    });
  }

  reset?.addEventListener("click", () => {
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
  });

  window.addEventListener("popstate", () => {
    state = readState();
    applyControls();
    update(false);
  });

  applyControls();
  update(false);
}

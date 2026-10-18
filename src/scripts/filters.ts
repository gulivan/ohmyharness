import { plural } from "./ui";

const KINDS = ["harness", "orchestrator", "cloud-agent", "add-on"] as const;
type Kind = (typeof KINDS)[number] | "all";
type SourceFilter = "any" | "open" | "available" | "closed";

interface FilterState {
  q: string;
  kind: Kind;
  os: SourceFilter;
  platform: string;
  iface: string;
  features: string[];
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
  const results = document.querySelector<HTMLElement>("#results-count");
  const reset = document.querySelector<HTMLButtonElement>("#filter-reset");
  const empty = document.querySelector<HTMLElement>("#filter-empty");
  const total = cards.length;

  let state = readState();

  function readState(): FilterState {
    const params = new URLSearchParams(window.location.search);
    const kind = params.get("kind");
    const os = params.get("os");
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
      platform: params.get("platform") ?? "",
      iface: params.get("interface") ?? "",
      features: (params.get("f") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
  }

  function applyControls(): void {
    if (search) search.value = state.q;
    if (osSelect) osSelect.value = state.os;
    if (platformSelect) platformSelect.value = state.platform;
    if (interfaceSelect) interfaceSelect.value = state.iface;
    for (const button of kindButtons) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.filterKind ?? "all") === state.kind),
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
    if (state.platform) params.set("platform", state.platform);
    if (state.iface) params.set("interface", state.iface);
    if (state.features.length > 0) params.set("f", state.features.join(","));

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

  function update(shouldWriteUrl = true): void {
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
      platform: "",
      iface: "",
      features: [],
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

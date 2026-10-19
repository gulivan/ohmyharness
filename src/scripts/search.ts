/**
 * Header search.
 *
 * The index is fetched on the first focus/open, never on page load. Matching
 * is a small hand-written scorer: name prefix beats name substring, which
 * beats maker, feature, kind and tagline hits. Everything is normalised to
 * lowercase words, so "cloud-agent", "cloud agent" and "addon" all work.
 */

export {};

interface SearchEntry {
  slug: string;
  name: string;
  kind: string;
  kindLabel: string;
  maker: string | null;
  tagline: string;
  interfaces: string[];
  platforms: string[];
  drives: string[];
  extends: string | null;
  features: string[];
  featureLabels: string[];
  price: string;
  icon: string | null;
  mono: string;
  bg: string;
  fg: string;
}

interface Prepared {
  entry: SearchEntry;
  name: string;
  maker: string;
  tagline: string;
  features: string[];
  featureText: string;
  kinds: string[];
  kindText: string;
  extra: string[];
  extraText: string;
  haystack: string;
}

interface Match {
  entry: SearchEntry;
  score: number;
  /**
   * Where the query lands in the name: exact > prefix > word start > substring
   * > no name hit. This is the primary sort key, so a tagline or maker hit can
   * never leapfrog a tool whose name actually matches.
   */
  tier: number;
  /** How much of the name the query covers, so "claude" prefers Claude Code. */
  coverage: number;
}

const KIND_WORDS: Record<string, string[]> = {
  harness: ["harness", "harnesses"],
  orchestrator: ["orchestrator", "orchestrators", "orchestration"],
  "cloud-agent": ["cloud agent", "cloud agents", "cloud-agent", "hosted agent"],
  "add-on": [
    "add-on",
    "add-ons",
    "addon",
    "addons",
    "plugin",
    "plugins",
    "extension",
    "extensions",
  ],
};

const MAX_RESULTS = 8;

const root = document.querySelector<HTMLElement>("[data-search]");
if (root) initSearch(root);

function initSearch(searchRoot: HTMLElement): void {
  const toggle = required(
    searchRoot.querySelector<HTMLButtonElement>("[data-search-toggle]"),
  );
  const input = required(
    searchRoot.querySelector<HTMLInputElement>("[data-search-input]"),
  );
  const kbd = searchRoot.querySelector<HTMLElement>("[data-search-kbd]");
  const closeButton = required(
    searchRoot.querySelector<HTMLButtonElement>("[data-search-close]"),
  );
  const sheet = required(
    searchRoot.querySelector<HTMLElement>(".omh-search__sheet"),
  );
  const panel = required(
    searchRoot.querySelector<HTMLElement>("[data-search-panel]"),
  );
  const list = required(
    searchRoot.querySelector<HTMLElement>("[data-search-list]"),
  );
  const hint = required(
    searchRoot.querySelector<HTMLElement>("[data-search-hint]"),
  );
  const foot = required(
    searchRoot.querySelector<HTMLElement>("[data-search-foot]"),
  );
  const count = required(
    searchRoot.querySelector<HTMLElement>("[data-search-count]"),
  );
  const seeAll = required(
    searchRoot.querySelector<HTMLAnchorElement>("[data-search-all]"),
  );
  const empty = required(
    searchRoot.querySelector<HTMLElement>("[data-search-empty]"),
  );
  const term = searchRoot.querySelector<HTMLElement>("[data-search-term]");
  const live = required(
    searchRoot.querySelector<HTMLElement>("[data-search-status]"),
  );

  const mobile = window.matchMedia("(max-width: 767px)");
  let prepared: Prepared[] | null = null;
  let indexRequest: Promise<Prepared[]> | null = null;
  let failed = false;
  let matches: Match[] = [];
  let activeIndex = -1;

  if (kbd && /Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) {
    kbd.textContent = "⌘K";
  }

  /* ---------------- index ---------------- */

  function loadIndex(): Promise<Prepared[]> {
    if (prepared) return Promise.resolve(prepared);
    if (indexRequest) return indexRequest;

    indexRequest = fetch("/search-index.json", { credentials: "same-origin" })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json() as Promise<{ tools: SearchEntry[] }>;
      })
      .then((data) => {
        prepared = data.tools.map(prepareEntry);
        return prepared;
      })
      .catch((error: unknown) => {
        failed = true;
        indexRequest = null;
        console.warn("[ohmyharness] Search index unavailable", error);
        return [];
      });

    return indexRequest;
  }

  /* ---------------- matching ---------------- */

  function update(): void {
    const raw = input.value.trim();
    const query = normalize(raw);

    if (!query) {
      closePanel();
      live.textContent = "";
      return;
    }

    if (!prepared) {
      openPanel();
      list.replaceChildren();
      foot.hidden = true;
      empty.hidden = true;
      hint.hidden = false;
      hint.textContent = failed ? "Search is unavailable." : "Searching…";
      live.textContent = failed ? "Search is unavailable" : "Searching";
      if (!failed) {
        void loadIndex().then(() => {
          if (input.value.trim() === raw) update();
        });
      }
      return;
    }

    matches = search(prepared, query);
    hint.hidden = true;
    openPanel();

    if (matches.length === 0) {
      list.replaceChildren();
      foot.hidden = true;
      empty.hidden = false;
      if (term) term.textContent = raw;
      activeIndex = -1;
      input.removeAttribute("aria-activedescendant");
      live.textContent = `No tools match ${raw}`;
      return;
    }

    empty.hidden = true;
    foot.hidden = false;
    renderOptions();
    setActive(0);

    const phrase = matches.length === 1 ? "result" : "results";
    count.textContent = `${matches.length} ${phrase}`;
    seeAll.textContent = `See all results for “${raw}” →`;
    seeAll.href = `/?q=${encodeURIComponent(raw)}`;
    live.textContent = `${matches.length} ${phrase} for ${raw}`;
  }

  function search(index: Prepared[], query: string): Match[] {
    const tokens = query.split(" ").filter(Boolean);
    const kindQuery = kindForQuery(query);
    const found: Match[] = [];

    for (const item of index) {
      // "orchestrator", "add-on", "cloud agent" name a kind outright, so show
      // that kind rather than every entry that happens to mention the words.
      if (kindQuery && item.entry.kind !== kindQuery) continue;
      // Every token must appear somewhere; then rank by where they land.
      if (!tokens.every((token) => item.haystack.includes(token))) continue;
      const score = scoreEntry(item, query, tokens);
      if (score > 0) {
        found.push({
          entry: item.entry,
          score,
          tier: nameTier(item.name, query),
          coverage: item.name.includes(query)
            ? query.length / item.name.length
            : 0,
        });
      }
    }

    found.sort(
      (a, b) =>
        b.tier - a.tier ||
        b.coverage - a.coverage ||
        b.score - a.score ||
        a.entry.name.localeCompare(b.entry.name, "en"),
    );
    return found;
  }

  function scoreEntry(item: Prepared, query: string, tokens: string[]): number {
    let score = 0;

    // Whole-query field weights. Name prefix > name substring > the rest.
    if (item.name === query) score += 2000;
    else if (item.name.startsWith(query)) score += 1600;
    else if (item.name.includes(` ${query}`)) score += 1300;
    else if (item.name.includes(query)) score += 1000;

    // Exact feature words ("acp", "mcp", "worktrees") are strong signals.
    if (item.features.includes(query)) score += 600;

    score += wholeField(item.maker, query, [520, 460]);
    score += wholeField(item.featureText, query, [480, 440, 380]);
    score += wholeField(item.kindText, query, [360, 360, 360]);
    score += wholeField(item.tagline, query, [320, 320, 320]);
    score += wholeField(item.extraText, query, [220, 220, 220]);
    if (item.entry.slug.includes(query)) score += 150;

    // Per-token weights keep multi-word queries (and partial ones) useful.
    for (const token of tokens) {
      if (item.name === token) score += 420;
      else if (item.name.startsWith(token)) score += 350;
      else if (item.name.includes(` ${token}`)) score += 310;
      else if (item.name.includes(token)) score += 270;
      else if (item.maker.includes(token)) score += 160;
      else if (item.featureText.includes(token)) score += 140;
      else if (item.kindText.includes(token)) score += 120;
      else if (item.tagline.includes(token)) score += 90;
      else if (item.extraText.includes(token)) score += 70;
      else if (item.haystack.includes(token)) score += 50;
    }

    return score;
  }

  /* ---------------- rendering ---------------- */

  function renderOptions(): void {
    const fragment = document.createDocumentFragment();

    matches.slice(0, MAX_RESULTS).forEach((match, index) => {
      const entry = match.entry;
      const option = document.createElement("li");
      option.className = "omh-result";
      option.id = `omh-result-${entry.slug}`;
      option.setAttribute("role", "option");
      option.setAttribute(
        "aria-selected",
        index === activeIndex ? "true" : "false",
      );

      const link = document.createElement("a");
      link.className = "omh-result__link";
      link.href = `/tools/${entry.slug}`;
      link.tabIndex = -1;

      const logo = document.createElement("span");
      if (entry.icon) {
        logo.className = "monogram monogram--sm monogram--icon";
        const image = document.createElement("img");
        image.src = entry.icon;
        image.alt = "";
        image.width = 28;
        image.height = 28;
        image.loading = "lazy";
        logo.append(image);
      } else {
        logo.className = "monogram monogram--sm";
        logo.style.background = entry.bg;
        logo.style.color = entry.fg;
        logo.textContent = entry.mono;
        logo.setAttribute("aria-hidden", "true");
      }

      const body = document.createElement("span");
      body.className = "omh-result__body";

      const name = document.createElement("span");
      name.className = "omh-result__name";
      name.textContent = entry.name;

      const meta = document.createElement("span");
      meta.className = "omh-result__meta";

      const kind = document.createElement("span");
      kind.className = "omh-result__kind";
      kind.textContent = entry.kindLabel;

      const price = document.createElement("span");
      price.className = "omh-result__price";
      price.textContent = entry.price;

      meta.append(kind, price);
      body.append(name, meta);
      link.append(logo, body);
      option.append(link);

      option.addEventListener("pointerenter", () => setActive(index));
      option.addEventListener("click", (event) => {
        if ((event.target as Element | null)?.closest("a")) return;
        window.location.assign(link.href);
      });

      fragment.append(option);
    });

    list.replaceChildren(fragment);
  }

  function setActive(index: number): void {
    activeIndex = index;
    const options = Array.from(
      list.querySelectorAll<HTMLElement>('[role="option"]'),
    );

    options.forEach((option, optionIndex) => {
      const selected = optionIndex === index;
      option.setAttribute("aria-selected", String(selected));
      if (selected) {
        option.scrollIntoView({ block: "nearest" });
        input.setAttribute("aria-activedescendant", option.id);
      }
    });

    if (index < 0) input.removeAttribute("aria-activedescendant");
  }

  function openPanel(): void {
    panel.hidden = false;
    input.setAttribute("aria-expanded", "true");
  }

  function closePanel(): void {
    panel.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  /* ---------------- mobile sheet ---------------- */

  function sheetOpen(): boolean {
    return searchRoot.classList.contains("is-open");
  }

  function fitSheet(): void {
    if (!sheetOpen()) return;
    const header = searchRoot.closest<HTMLElement>(".site-header");
    const top = header?.getBoundingClientRect().height ?? 58;
    sheet.style.maxHeight = `${Math.max(240, window.innerHeight - top)}px`;
  }

  function setSheet(open: boolean, restoreFocus = false): void {
    searchRoot.classList.toggle("is-open", open);
    document.documentElement.classList.toggle("omh-search-open", open);
    toggle.setAttribute("aria-expanded", String(open));

    if (open) fitSheet();
    else {
      closePanel();
      input.blur();
      if (restoreFocus) toggle.focus();
    }
  }

  function openSearch(select: boolean): void {
    if (mobile.matches && !sheetOpen()) setSheet(true);
    input.focus();
    if (select) input.select();
    void loadIndex();
    if (input.value.trim()) update();
  }

  /* ---------------- events ---------------- */

  input.addEventListener("input", update);

  input.addEventListener("focus", () => {
    void loadIndex();
    if (input.value.trim()) update();
  });

  input.addEventListener("keydown", (event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (panel.hidden) {
          update();
          return;
        }
        if (matches.length > 0) {
          setActive((activeIndex + 1) % Math.min(matches.length, MAX_RESULTS));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (matches.length > 0) {
          const size = Math.min(matches.length, MAX_RESULTS);
          setActive(activeIndex <= 0 ? size - 1 : activeIndex - 1);
        }
        break;
      case "Enter": {
        const entry = matches[activeIndex]?.entry;
        if (entry) {
          event.preventDefault();
          window.location.assign(`/tools/${entry.slug}`);
        }
        break;
      }
      case "Escape":
        event.preventDefault();
        if (!panel.hidden) closePanel();
        else if (mobile.matches && sheetOpen()) setSheet(false, true);
        else input.blur();
        break;
      case "Tab":
        closePanel();
        break;
      default:
        break;
    }
  });

  toggle.addEventListener("click", () => {
    if (sheetOpen()) {
      setSheet(false, true);
      return;
    }
    if (mobile.matches) setSheet(true);
    input.focus();
    void loadIndex();
    if (input.value.trim()) update();
  });

  closeButton.addEventListener("click", () => setSheet(false, true));

  document.addEventListener("pointerdown", (event) => {
    const target = event.target as Node | null;
    if (target && searchRoot.contains(target)) return;
    closePanel();
    if (sheetOpen()) setSheet(false);
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || isTypingTarget(event.target)) return;

    if (
      (event.metaKey || event.ctrlKey) &&
      !event.altKey &&
      event.key.toLowerCase() === "k"
    ) {
      event.preventDefault();
      openSearch(true);
      return;
    }

    if (event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      openSearch(false);
    }
  });

  mobile.addEventListener("change", (event) => {
    if (!event.matches && sheetOpen()) setSheet(false);
  });

  window.addEventListener("resize", fitSheet);
}

/* ---------------- helpers ---------------- */

function prepareEntry(entry: SearchEntry): Prepared {
  const features = [...entry.features, ...entry.featureLabels].map(normalize);
  const kinds = (KIND_WORDS[entry.kind] ?? [entry.kind, entry.kindLabel]).map(
    normalize,
  );
  const extra = [
    ...entry.interfaces,
    ...entry.platforms,
    ...entry.drives,
    ...(entry.extends ? [entry.extends] : []),
  ].map(normalize);

  const haystack = [
    entry.name,
    entry.slug,
    entry.maker ?? "",
    entry.tagline,
    entry.kindLabel,
    ...features,
    ...kinds,
    ...extra,
  ]
    .map(normalize)
    .join(" ");

  return {
    entry,
    name: normalize(entry.name),
    maker: normalize(entry.maker ?? ""),
    tagline: normalize(entry.tagline),
    features,
    featureText: features.join(" "),
    kinds,
    kindText: kinds.join(" "),
    extra,
    extraText: extra.join(" "),
    haystack,
  };
}

/**
 * Lowercase words only: accents folded, punctuation and hyphens become
 * spaces. "cloud-agent" and "cloud agent" search the same way.
 */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * The kind a query names outright, if any. Synonyms such as "addon" and
 * "plugin" resolve to the same kind.
 */
function kindForQuery(query: string): string | null {
  for (const [kind, words] of Object.entries(KIND_WORDS)) {
    if (words.some((word) => normalize(word) === query)) return kind;
  }
  return null;
}

/**
 * Rank the query's position in a normalised name. Exact beats prefix, which
 * beats a later word, which beats a substring, which beats no name hit at all.
 */
function nameTier(name: string, query: string): number {
  if (name === query) return 5;
  if (name.startsWith(query)) return 4;
  if (name.includes(` ${query}`)) return 3;
  if (name.includes(query)) return 2;
  return 1;
}

/**
 * Score one field against the whole query.
 * `weights` is [exact, word prefix, substring].
 */
function wholeField(value: string, query: string, weights: number[]): number {
  if (!value) return 0;
  if (value === query) return weights[0] ?? 0;
  if (value.startsWith(query) || value.includes(` ${query}`)) {
    return weights[1] ?? weights[0] ?? 0;
  }
  if (value.includes(query)) return weights[2] ?? weights[1] ?? 0;
  return 0;
}

function required<T>(value: T | null): T {
  if (!value) throw new Error("Search markup is incomplete");
  return value;
}

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  return /^(input|textarea|select)$/i.test(node.tagName);
}

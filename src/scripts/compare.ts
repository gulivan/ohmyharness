import type { Tool } from "../data/schema";
import type {
  FeatureDefinition,
  FeatureGroupDefinition,
} from "../lib/features";
import {
  FEATURE_GROUPS,
  INTERFACE_LABELS,
  KIND_LABELS,
  MODEL_ACCESS_LABELS,
  PLATFORM_LABELS,
  PRICING_LABELS,
  STATUS_LABELS,
  appliesTo,
  featureState,
  glyph,
  glyphWord,
  groupStats,
  sourceLabel,
} from "../lib/features";
import { createElement, makeMonogram, plural, setStatus } from "./ui";
import { startingPrice } from "../lib/pricing";

interface ClientTool extends Tool {
  icon: string | null;
}

const MAX_COMPARE = 4;
const KINDS = ["harness", "orchestrator", "cloud-agent", "add-on"] as const;

const dataNode = document.getElementById("compare-data");
const panel = document.getElementById("compare-panel");
const empty = document.getElementById("compare-empty");
const status = document.getElementById("compare-status");
const matrix = document.getElementById("matrix");
const matrixCount = document.getElementById("matrix-count");
const copyButton = document.getElementById("compare-copy");
const pickerSearch = document.getElementById("picker-search") as
  | HTMLInputElement
  | null;
const pickerEmpty = document.getElementById("picker-empty");
const pickerTray = document.getElementById("picker-tray");
const pickerCount = document.getElementById("picker-count");
const pickerNames = document.getElementById("picker-names");
const pickerClear = document.getElementById("picker-clear");
const matrixWrap = document.querySelector<HTMLElement>(".matrix-wrap");
const matrixScroll = document.querySelector<HTMLElement>("[data-matrix-scroll]");
const matrixCue = document.getElementById("matrix-cue");

if (dataNode && panel) {
  initCompare();
}

function initCompare(): void {
  const tools: ClientTool[] = JSON.parse(dataNode?.textContent ?? "[]");
  const bySlug = new Map(tools.map((tool) => [tool.slug, tool]));
  const chips = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".pick[data-slug]"),
  );
  const kindButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-matrix-kind]"),
  );
  const rows = Array.from(
    matrix?.querySelectorAll<HTMLTableRowElement>("tbody tr[data-row-kind]") ??
      [],
  );
  const groups = Array.from(
    document.querySelectorAll<HTMLElement>("[data-picker-group]"),
  );

  let selected = new Set<string>();
  let matrixKind = "all";
  let showAllFeatures = false;
  const collapsedGroups = new Set<string>();

  function readState(): void {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("tools") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter((value) => bySlug.has(value));
    selected = new Set(requested.slice(0, MAX_COMPARE));

    const kind = params.get("kind") ?? "all";
    matrixKind = (KINDS as readonly string[]).includes(kind) ? kind : "all";
  }

  function writeUrl(): void {
    const params = new URLSearchParams();
    const chosen = tools
      .filter((tool) => selected.has(tool.slug))
      .map((tool) => tool.slug);
    if (chosen.length > 0) params.set("tools", chosen.join(","));
    if (matrixKind !== "all") params.set("kind", matrixKind);

    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    try {
      window.history.replaceState(null, "", url);
    } catch {
      // ignore history restrictions
    }
  }

  function syncPicker(): void {
    for (const chip of chips) {
      chip.setAttribute(
        "aria-pressed",
        String(selected.has(chip.dataset.slug ?? "")),
      );
    }
    syncTray();
  }

  function syncTray(): void {
    const chosen = chosenTools();
    if (pickerTray) pickerTray.hidden = chosen.length === 0;
    if (pickerCount) {
      pickerCount.textContent = `${chosen.length} selected`;
    }
    if (pickerNames) {
      pickerNames.textContent = chosen.map((tool) => tool.name).join(", ");
    }
  }

  function filterPicker(raw: string): void {
    const query = raw.trim().toLowerCase();
    let total = 0;
    for (const group of groups) {
      let visible = 0;
      for (const chip of group.querySelectorAll<HTMLButtonElement>(".pick")) {
        const haystack = `${chip.dataset.name ?? ""} ${chip.dataset.maker ?? ""}`;
        const show = query.length === 0 || haystack.includes(query);
        chip.hidden = !show;
        if (show) visible += 1;
      }
      group.hidden = visible === 0;
      const count = group.querySelector<HTMLElement>("[data-group-count]");
      if (count) count.textContent = String(visible);
      total += visible;
    }
    if (pickerEmpty) pickerEmpty.hidden = total > 0;
  }

  function scrollToMatrix(): void {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    matrixWrap?.scrollIntoView({
      behavior: reduced ? "auto" : "smooth",
      block: "start",
    });
  }

  function syncOverflow(): void {
    if (!matrixWrap || !matrixScroll) return;
    const overflowing = matrixWrap.scrollWidth > matrixWrap.clientWidth + 2;
    const atEnd =
      matrixWrap.scrollLeft + matrixWrap.clientWidth >=
      matrixWrap.scrollWidth - 2;
    matrixScroll.dataset.overflow = String(overflowing && !atEnd);
    if (matrixCue) matrixCue.hidden = !overflowing || atEnd;
  }

  function featureCell(
    value: boolean | null,
    label: string,
    applicable: boolean,
  ): HTMLTableCellElement {
    const cell = createElement("td");
    const state = featureState(value, applicable);
    const node = createElement(
      "span",
      `glyph glyph--${state}`,
      glyph(value, applicable),
    );
    node.setAttribute("role", "img");
    node.setAttribute(
      "aria-label",
      `${label}: ${glyphWord(value, applicable)}`,
    );
    node.title = `${label}: ${glyphWord(value, applicable)}`;
    cell.append(node);
    return cell;
  }

  /** Same row title and glyphs for every selected tool. */
  function featureGroupRow(
    body: HTMLTableSectionElement,
    group: FeatureGroupDefinition,
    selectedTools: ClientTool[],
  ): void {
    const heading = document.createElement("tr");
    heading.className = "compare-group";
    const cell = document.createElement("th");
    cell.scope = "colgroup";
    cell.colSpan = selectedTools.length + 1;
    const stats = groupStats(group, selectedTools);
    cell.append(
      createElement("span", "compare-group__label", group.label),
      createElement(
        "span",
        "compare-group__count",
        `${stats.yes}/${stats.applicable} yes`,
      ),
    );
    heading.append(cell);
    body.append(heading);
  }

  /**
   * A feature is identical when every selected tool has the same
   * applicability and the same value. “Doesn't apply” is its own state, so it
   * is never treated as a match for a plain no.
   */
  function featureSignature(
    tool: ClientTool,
    feature: FeatureDefinition,
  ): string {
    if (!appliesTo(feature, tool.kind)) return "na";
    const value = tool.features[feature.key];
    return value === null ? "unknown" : value ? "yes" : "no";
  }

  function sameForAll(
    feature: FeatureDefinition,
    selectedTools: ClientTool[],
  ): boolean {
    if (selectedTools.length < 2) return false;
    const first = featureSignature(selectedTools[0]!, feature);
    return selectedTools.every(
      (tool) => featureSignature(tool, feature) === first,
    );
  }

  function addRow(
    body: HTMLTableSectionElement,
    label: string,
    value: (tool: ClientTool) => Node | string,
  ): void {
    const row = document.createElement("tr");
    const heading = document.createElement("th");
    heading.scope = "row";
    heading.textContent = label;
    row.append(heading);

    for (const tool of chosenTools()) {
      const cell = document.createElement("td");
      const valueNode = value(tool);
      if (typeof valueNode === "string") cell.textContent = valueNode;
      else cell.append(valueNode);
      row.append(cell);
    }
    body.append(row);
  }

  function chosenTools(): ClientTool[] {
    return tools.filter((tool) => selected.has(tool.slug));
  }

  function tagList(values: string[], fallback: string): Node {
    if (values.length === 0) return document.createTextNode(fallback);
    const wrapper = createElement("span", "tag-list");
    for (const value of values) {
      wrapper.append(createElement("span", "tag", value));
    }
    return wrapper;
  }

  function installCell(tool: ClientTool): Node {
    const entry = tool.install[0];
    if (!entry) return document.createTextNode("Not verified yet");

    const wrapper = createElement("div", "compare-install");
    if (entry.type === "command") {
      const line = createElement("code", "compare-install__command");
      line.append(
        createElement("span", "compare-install__prompt", "$ "),
        document.createTextNode(entry.value),
      );
      wrapper.append(line);
    } else {
      const link = createElement("a", "compare-install__link", `${entry.label} ↗`);
      link.href = entry.value;
      link.target = "_blank";
      link.rel = "noopener";
      wrapper.append(link);
    }
    wrapper.append(createElement("span", "compare-install__meta", entry.label));
    return wrapper;
  }

  function renderCompare(): void {
    const chosen = chosenTools();
    if (empty) empty.hidden = chosen.length > 0;
    panel?.replaceChildren();
    if (!panel || chosen.length === 0) return;

    const table = createElement("table", "compare-table");
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    const corner = document.createElement("th");
    corner.scope = "col";
    corner.textContent = "Feature";
    headRow.append(corner);

    for (const tool of chosen) {
      const cell = document.createElement("th");
      cell.scope = "col";
      const wrapper = createElement("div", "compare-head");
      const identity = createElement("div", "row");
      identity.style.gap = "8px";
      identity.append(makeMonogram(tool.slug, tool.name, "sm", tool.icon));
      const name = createElement("a", "compare-head__name", tool.name);
      name.href = `/tools/${tool.slug}`;
      identity.append(name);
      wrapper.append(identity);
      wrapper.append(
        createElement("span", "compare-head__kind", KIND_LABELS[tool.kind]),
      );
      const remove = createElement("button", "compare-head__remove", "Remove");
      remove.type = "button";
      remove.dataset.remove = tool.slug;
      remove.setAttribute("aria-label", `Remove ${tool.name} from comparison`);
      wrapper.append(remove);
      cell.append(wrapper);
      headRow.append(cell);
    }

    head.append(headRow);
    table.append(head);

    const body = document.createElement("tbody");
    addRow(body, "Tagline", (tool) => tool.tagline);
    addRow(body, "Kind", (tool) => KIND_LABELS[tool.kind]);
    addRow(body, "Status", (tool) => STATUS_LABELS[tool.status] ?? tool.status);
    addRow(body, "Source", (tool) => sourceLabel(tool));
    addRow(body, "License", (tool) => tool.license ?? "Unknown");
    addRow(body, "Pricing", (tool) => {
      const label = tool.pricing.model
        ? (PRICING_LABELS[tool.pricing.model] ?? tool.pricing.model)
        : "Unknown";
      return tool.pricing.notes ? `${label} — ${tool.pricing.notes}` : label;
    });
    addRow(
      body,
      "Starting price",
      (tool) => startingPrice(tool)?.label ?? "Not verified yet",
    );
    addRow(body, "Model access", (tool) =>
      tagList(
        tool.modelAccess.map((value) => MODEL_ACCESS_LABELS[value] ?? value),
        "Unknown",
      ),
    );
    addRow(body, "Platforms", (tool) =>
      tagList(
        tool.platforms.map((value) => PLATFORM_LABELS[value] ?? value),
        "Unknown",
      ),
    );
    addRow(body, "Interfaces", (tool) =>
      tagList(
        tool.interfaces.map((value) => INTERFACE_LABELS[value] ?? value),
        "Unknown",
      ),
    );
    addRow(body, "Install", installCell);
    addRow(body, "GitHub stars", (tool) =>
      tool.github
        ? `${tool.github.stars.toLocaleString("en-GB")} · checked ${tool.github.checkedAt}`
        : tool.repo
          ? "Not checked"
          : "No public repository",
    );
    addRow(body, "Last verified", (tool) => tool.lastVerified);

    const differencesOnly = chosen.length >= 2 && !showAllFeatures;
    let differenceCount = 0;

    for (const group of FEATURE_GROUPS) {
      const visibleFeatures = group.features.filter(
        (feature) => !differencesOnly || !sameForAll(feature, chosen),
      );
      if (visibleFeatures.length === 0) continue;

      featureGroupRow(body, group, chosen);
      for (const feature of visibleFeatures) {
        const row = document.createElement("tr");
        const heading = document.createElement("th");
        heading.scope = "row";
        heading.textContent = feature.label;
        heading.title = feature.question;
        row.append(heading);
        for (const tool of chosen) {
          row.append(
            featureCell(
              tool.features[feature.key],
              feature.label,
              appliesTo(feature, tool.kind),
            ),
          );
        }
        body.append(row);
        if (differencesOnly) differenceCount += 1;
      }
    }

    if (differencesOnly && differenceCount === 0) {
      const row = document.createElement("tr");
      row.className = "compare-same";
      const cell = document.createElement("td");
      cell.colSpan = chosen.length + 1;
      cell.textContent = "These tools match on every feature.";
      row.append(cell);
      body.append(row);
    }

    table.append(body);

    if (chosen.length >= 2) {
      const bar = createElement("div", "differences-bar");
      bar.append(createElement("span", "differences-bar__label", "Feature rows"));
      const count = createElement(
        "span",
        "differences-bar__count",
        differencesOnly
          ? differenceCount === 0
            ? "No differences"
            : `${differenceCount} ${differenceCount === 1 ? "difference" : "differences"}`
          : `${FEATURE_GROUPS.reduce((total, group) => total + group.features.length, 0)} features`,
      );
      count.setAttribute("role", "status");
      count.setAttribute("aria-live", "polite");
      const toggle = createElement(
        "button",
        "chip differences-toggle",
        showAllFeatures ? "Differences only" : "Show all 20",
      );
      toggle.type = "button";
      toggle.setAttribute("aria-pressed", String(showAllFeatures));
      toggle.addEventListener("click", () => {
        showAllFeatures = !showAllFeatures;
        renderCompare();
      });
      bar.append(count, toggle);
      panel.append(bar, table);
    } else {
      panel.append(table);
    }
  }

  const groupToggles = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-matrix-group]"),
  );
  const groupHeads = Array.from(
    document.querySelectorAll<HTMLTableCellElement>("[data-matrix-group-head]"),
  );

  function setGroupCollapsed(key: string, collapsed: boolean): void {
    if (collapsed) collapsedGroups.add(key);
    else collapsedGroups.delete(key);

    const featureCells = Array.from(
      document.querySelectorAll<HTMLTableCellElement>(
        `.matrix [data-feature-group="${key}"]`,
      ),
    );
    const affectedRows = new Set<HTMLTableRowElement>();
    for (const cell of featureCells) {
      cell.hidden = collapsed;
      if (cell.parentElement instanceof HTMLTableRowElement) {
        affectedRows.add(cell.parentElement);
      }
    }

    // A hidden cell takes its column out of the table, which would shift every
    // later group. Keep one empty cell in each affected row so the group's
    // single collapsed column stays in place for the header and body rows.
    for (const node of Array.from(
      document.querySelectorAll(`.matrix [data-placeholder-for="${key}"]`),
    )) {
      node.remove();
    }
    if (collapsed) {
      for (const row of affectedRows) {
        const first = featureCells.find((cell) => cell.parentElement === row);
        if (!first) continue;
        const placeholder = document.createElement(
          first.tagName === "TH" ? "th" : "td",
        );
        placeholder.className = "matrix-placeholder";
        placeholder.dataset.placeholderFor = key;
        first.before(placeholder);
      }
    }

    const head = groupHeads.find(
      (node) => node.dataset.matrixGroupHead === key,
    );
    if (head) {
      const group = FEATURE_GROUPS.find((item) => item.key === key);
      head.colSpan = collapsed ? 1 : (group?.features.length ?? 1);
      head.classList.toggle("is-collapsed", collapsed);
    }

    const toggle = groupToggles.find(
      (node) => node.dataset.matrixGroup === key,
    );
    toggle?.setAttribute("aria-expanded", String(!collapsed));
    toggle?.classList.toggle("is-collapsed", collapsed);
  }

  function syncGroupCounts(): void {
    const visibleTools: ClientTool[] = [];
    for (const row of rows) {
      if (row.hidden) continue;
      const tool = bySlug.get(row.dataset.slug ?? "");
      if (tool) visibleTools.push(tool);
    }

    for (const group of FEATURE_GROUPS) {
      const head = groupHeads.find(
        (node) => node.dataset.matrixGroupHead === group.key,
      );
      const target = head?.querySelector<HTMLElement>("[data-group-yes]");
      if (!target) continue;
      const stats = groupStats(group, visibleTools);
      target.textContent = `${stats.yes}/${stats.applicable} yes`;
      target.title = `${group.label}: ${stats.yes} yes of ${stats.applicable} applicable cells`;
    }
  }

  function syncMatrix(): number {
    if (!matrix) return 0;
    let visible = 0;
    for (const row of rows) {
      const show =
        matrixKind === "all" || row.dataset.rowKind === matrixKind;
      row.hidden = !show;
      if (show) visible += 1;
    }
    for (const button of kindButtons) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.matrixKind ?? "all") === matrixKind),
      );
    }
    if (matrixCount) matrixCount.textContent = plural(visible, "tool");
    syncGroupCounts();
    return visible;
  }

  function update(write = true): void {
    syncPicker();
    renderCompare();
    syncMatrix();
    if (write) writeUrl();
    requestAnimationFrame(syncOverflow);
  }

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const slug = chip.dataset.slug ?? "";
      if (selected.has(slug)) {
        selected.delete(slug);
        update();
        setStatus(status, "");
        return;
      }
      if (selected.size >= MAX_COMPARE) {
        setStatus(status, `Compare up to ${MAX_COMPARE} tools at once.`);
        return;
      }

      selected.add(slug);
      update();
      const chosen = chosenTools();
      if (chosen.length === 2) {
        setStatus(
          status,
          `${chosen[0]?.name} and ${chosen[1]?.name} selected. Comparison and matrix below.`,
        );
        requestAnimationFrame(() => {
          syncOverflow();
          scrollToMatrix();
        });
      } else if (chosen.length > 2) {
        setStatus(status, `${chosen.length} tools selected.`);
      } else {
        setStatus(
          status,
          `${chosen[0]?.name ?? bySlug.get(slug)?.name} selected. Pick one more to compare.`,
        );
      }
    });
  }

  pickerClear?.addEventListener("click", () => {
    selected.clear();
    update();
    setStatus(status, "Selection cleared.");
    pickerSearch?.focus();
  });

  pickerSearch?.addEventListener("input", () => {
    filterPicker(pickerSearch.value);
  });

  panel?.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-remove]",
    );
    const slug = target?.dataset.remove;
    if (!slug) return;
    selected.delete(slug);
    update();
  });

  for (const button of kindButtons) {
    button.addEventListener("click", () => {
      matrixKind = button.dataset.matrixKind ?? "all";
      update();
      const visible = rows.filter((row) => !row.hidden).length;
      setStatus(status, `Showing ${plural(visible, "tool")}.`);
    });
  }

  for (const toggle of groupToggles) {
    toggle.addEventListener("click", () => {
      const key = toggle.dataset.matrixGroup ?? "";
      setGroupCollapsed(key, !collapsedGroups.has(key));
    });
  }

  matrixWrap?.addEventListener("scroll", syncOverflow, { passive: true });
  window.addEventListener("resize", syncOverflow);

  copyButton?.addEventListener("click", async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setStatus(status, "Link copied.");
    } catch {
      setStatus(status, "Copy the address bar link to share this comparison.");
    }
  });

  window.addEventListener("popstate", () => {
    readState();
    update(false);
  });

  readState();
  update(false);
  filterPicker(pickerSearch?.value ?? "");

  // Desktop shows every group; on phones the two long groups start collapsed.
  if (window.matchMedia("(max-width: 767px)").matches) {
    setGroupCollapsed("integrations", true);
    setGroupCollapsed("access", true);
  }

  if (typeof ResizeObserver === "function" && matrixWrap) {
    new ResizeObserver(syncOverflow).observe(matrixWrap);
  }
  requestAnimationFrame(syncOverflow);
}

import type { Tool } from "../data/schema";
import {
  FEATURES,
  INTERFACE_LABELS,
  KIND_LABELS,
  MODEL_ACCESS_LABELS,
  PLATFORM_LABELS,
  PRICING_LABELS,
  STATUS_LABELS,
  featureState,
  glyph,
  glyphWord,
  sourceLabel,
} from "../lib/features";
import { createElement, makeMonogram, plural, setStatus } from "./ui";

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

  let selected = new Set<string>();
  let matrixKind = "all";

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
  }

  function featureCell(value: boolean | null, label: string): HTMLTableCellElement {
    const cell = createElement("td");
    const state = featureState(value);
    const node = createElement(
      "span",
      `glyph glyph--${state}`,
      glyph(value),
    );
    node.setAttribute("role", "img");
    node.setAttribute("aria-label", `${label}: ${glyphWord(value)}`);
    node.title = `${label}: ${glyphWord(value)}`;
    cell.append(node);
    return cell;
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

    for (const feature of FEATURES) {
      const row = document.createElement("tr");
      const heading = document.createElement("th");
      heading.scope = "row";
      heading.textContent = feature.label;
      heading.title = feature.question;
      row.append(heading);
      for (const tool of chosen) {
        row.append(featureCell(tool.features[feature.key], feature.label));
      }
      body.append(row);
    }

    table.append(body);
    panel.append(table);
  }

  function syncMatrix(): void {
    if (!matrix) return;
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
  }

  function update(write = true): void {
    syncPicker();
    renderCompare();
    syncMatrix();
    if (write) writeUrl();
  }

  for (const chip of chips) {
    chip.addEventListener("click", () => {
      const slug = chip.dataset.slug ?? "";
      if (selected.has(slug)) {
        selected.delete(slug);
      } else if (selected.size >= MAX_COMPARE) {
        setStatus(status, `Compare up to ${MAX_COMPARE} tools at once.`);
        return;
      } else {
        selected.add(slug);
        setStatus(status, "");
      }
      update();
    });
  }

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
    });
  }

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
}

import type { Tool, ToolKind } from "../data/schema";
import { createElement, makeMonogram, setStatus } from "./ui";

interface ClientTool extends Tool {
  icon: string | null;
}

type Scope = "all" | ToolKind;

interface TierState {
  names: string[];
  ranked: string[][];
  scope: Scope;
}

interface DragState {
  slug: string;
  startX: number;
  startY: number;
  pointerId: number;
  active: boolean;
  ghost: HTMLElement | null;
  over: number | null;
}

const TIER_COLORS = [
  "#ff6b57",
  "#ffc247",
  "#d7ff3f",
  "#5bd6a0",
  "#6fc3ff",
  "#c7a3ff",
];

const SCOPES: Scope[] = ["all", "harness", "orchestrator", "cloud-agent", "add-on"];

const dataNode = document.getElementById("tier-data");
const board = document.getElementById("tier-board");

if (dataNode && board) {
  initTierList();
}

function initTierList(): void {
  const tools: ClientTool[] = JSON.parse(dataNode?.textContent ?? "[]");
  const bySlug = new Map(tools.map((tool) => [tool.slug, tool]));
  const statusNode = document.getElementById("tier-status");
  const moveBar = document.getElementById("move-bar");
  const moveLabel = document.getElementById("move-label");
  const moveTargets = document.getElementById("move-targets");
  const scopeButtons = Array.from(
    document.querySelectorAll<HTMLButtonElement>("[data-scope]"),
  );
  const addTierButton =
    document.querySelector<HTMLButtonElement>("#add-tier");
  const downloadButton =
    document.querySelector<HTMLButtonElement>("#download-png");
  const shareLink = document.querySelector<HTMLAnchorElement>("#share-x");
  const copyButton = document.querySelector<HTMLButtonElement>("#copy-link");
  const capture = document.getElementById("capture");
  const captureSub = document.getElementById("tier-capture-sub");

  let state = parseHash() ?? defaultState();
  let selected: string | null = null;
  let drag: DragState | null = null;
  let suppressClickUntil = 0;

  /* ---------- state ---------- */

  function defaultState(): TierState {
    const names = ["S", "A", "B", "C", "D"];
    return {
      names,
      ranked: names.map(() => []),
      scope: "all",
    };
  }

  function scopeTools(): ClientTool[] {
    return state.scope === "all"
      ? tools
      : tools.filter((tool) => tool.kind === state.scope);
  }

  function parseHash(): TierState | null {
    const raw = window.location.hash.replace(/^#/, "");
    if (!raw.startsWith("v1")) return null;
    const segments = raw.split("|");
    const namesSegment = segments[1] ?? "";

    let names: string[];
    try {
      names = namesSegment.length
        ? namesSegment.split("~").map((value) => decodeURIComponent(value))
        : [];
    } catch {
      return null;
    }
    if (names.length === 0) return null;

    const scopeRaw = segments[3] ?? "all";
    const scope: Scope = (SCOPES as readonly string[]).includes(scopeRaw)
      ? (scopeRaw as Scope)
      : "all";

    const ranked: string[][] = names.map(() => []);
    const seen = new Set<string>();
    const entries = (segments[2] ?? "").split("~").filter(Boolean);

    for (const entry of entries) {
      const separator = entry.lastIndexOf(":");
      if (separator < 1) continue;
      const slug = entry.slice(0, separator);
      const index = Number(entry.slice(separator + 1));
      const tool = bySlug.get(slug);
      if (!tool || seen.has(slug)) continue;
      if (!Number.isInteger(index) || index < 0 || index >= names.length) {
        continue;
      }
      if (scope !== "all" && tool.kind !== scope) continue;
      seen.add(slug);
      ranked[index].push(slug);
    }

    return { names, ranked, scope };
  }

  function serialize(): string {
    const names = state.names.map((name) => encodeURIComponent(name)).join("~");
    const entries = state.ranked.flatMap((slugs, index) =>
      slugs.map((slug) => `${slug}:${index}`),
    );
    const parts = ["v1", names, entries.join("~")];
    if (state.scope !== "all") parts.push(state.scope);
    return parts.join("|");
  }

  function writeUrl(): void {
    const hash = `#${serialize()}`;
    if (window.location.hash === hash) {
      updateShare();
      return;
    }
    try {
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${window.location.search}${hash}`,
      );
    } catch {
      // ignore history restrictions
    }
    updateShare();
  }

  function updateShare(): void {
    if (!shareLink) return;
    const text = "My AI coding harness tier list";
    shareLink.href = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(window.location.href)}`;
  }

  /* ---------- helpers ---------- */

  function tierColor(index: number): string {
    return TIER_COLORS[index % TIER_COLORS.length] ?? "#6f6d66";
  }

  function tierLabel(index: number): string {
    if (index >= state.names.length) return "Unranked";
    return state.names[index] || `Tier ${index + 1}`;
  }

  function tierOf(slug: string): number {
    for (let index = 0; index < state.ranked.length; index += 1) {
      if (state.ranked[index].includes(slug)) return index;
    }
    return state.names.length;
  }

  function announce(message: string): void {
    setStatus(statusNode, message);
  }

  function removeFromRanked(slug: string): void {
    for (const list of state.ranked) {
      const index = list.indexOf(slug);
      if (index !== -1) list.splice(index, 1);
    }
  }

  function moveTool(
    slug: string,
    target: number,
    insertAt?: number,
    message?: string,
  ): void {
    removeFromRanked(slug);
    if (target < state.names.length) {
      const list = state.ranked[target];
      if (insertAt === undefined || insertAt > list.length) list.push(slug);
      else list.splice(Math.max(0, insertAt), 0, slug);
    }
    writeUrl();
    render({ focusSlug: slug });
    syncSelection();
    announce(
      message ??
        `${bySlug.get(slug)?.name ?? slug} moved to ${tierLabel(target)}.`,
    );
  }

  /* ---------- rendering ---------- */

  function renderTile(tool: ClientTool): HTMLButtonElement {
    const tile = createElement("button", "tile");
    tile.type = "button";
    tile.dataset.slug = tool.slug;
    tile.draggable = false;
    tile.setAttribute("aria-pressed", String(selected === tool.slug));
    tile.setAttribute(
      "aria-label",
      `${tool.name}, ${tierLabel(tierOf(tool.slug))}`,
    );
    tile.append(makeMonogram(tool.slug, tool.name, "sm", tool.icon));
    tile.append(createElement("span", "tile__name", tool.name));
    const handle = createElement("span", "tile__handle", "⠿");
    handle.setAttribute("aria-hidden", "true");
    tile.append(handle);
    return tile;
  }

  function render(options: { focusSlug?: string; focusTierInput?: number } = {}): void {
    board?.replaceChildren();
    if (!board) return;

    const scoped = scopeTools();
    const scopedSet = new Set(scoped.map((tool) => tool.slug));
    const rankedSet = new Set<string>();

    if (captureSub) {
      captureSub.textContent = `ohmyharness.com · ${scoped.length} ${scoped.length === 1 ? "tool" : "tools"}`;
    }

    state.names.forEach((name, index) => {
      const row = createElement("div", "tier-row");
      row.dataset.tierRow = String(index);

      const label = createElement("div", "tier-row__label");
      const color = createElement("span", "tier-row__color");
      color.style.background = tierColor(index);
      const input = document.createElement("input");
      input.className = "tier-row__letter";
      input.value = name;
      input.maxLength = 16;
      input.spellcheck = false;
      input.dataset.tierName = String(index);
      input.setAttribute(
        "aria-label",
        `Rename tier ${index + 1} (currently ${name || `Tier ${index + 1}`})`,
      );
      const remove = createElement("button", "tier-row__remove", "×");
      remove.type = "button";
      remove.dataset.removeTier = String(index);
      remove.disabled = state.names.length <= 1;
      remove.setAttribute("aria-label", `Remove tier ${name || index + 1}`);
      label.append(color, input, remove);

      const drop = createElement("div", "tier-row__drop");
      drop.dataset.dropTier = String(index);
      for (const slug of state.ranked[index]) {
        if (!scopedSet.has(slug)) continue;
        const tool = bySlug.get(slug);
        if (!tool) continue;
        rankedSet.add(slug);
        drop.append(renderTile(tool));
      }

      row.append(label, drop);
      board.append(row);
    });

    const unrankedRow = createElement("div", "tier-row tier-row--unranked");
    unrankedRow.dataset.tierRow = String(state.names.length);
    const unrankedLabel = createElement("div", "tier-row__label");
    const gray = createElement("span", "tier-row__color");
    gray.style.background = "#5a5a60";
    const dash = createElement("span", "tier-row__letter", "—");
    dash.setAttribute("aria-hidden", "true");
    unrankedLabel.append(gray, dash);
    const unrankedDrop = createElement("div", "tier-row__drop");
    unrankedDrop.dataset.dropTier = String(state.names.length);

    const unranked = scoped.filter((tool) => !rankedSet.has(tool.slug));
    for (const tool of unranked) unrankedDrop.append(renderTile(tool));
    if (unranked.length === 0) {
      unrankedDrop.append(
        createElement("span", "unranked-note", "No unranked tools"),
      );
    }
    unrankedRow.append(unrankedLabel, unrankedDrop);
    board.append(unrankedRow);

    if (options.focusSlug) {
      board
        .querySelector<HTMLElement>(
          `.tile[data-slug="${CSS.escape(options.focusSlug)}"]`,
        )
        ?.focus({ preventScroll: true });
    }
    if (options.focusTierInput !== undefined) {
      const input = board.querySelector<HTMLInputElement>(
        `[data-tier-name="${options.focusTierInput}"]`,
      );
      input?.focus();
      input?.select();
    }
  }

  function syncSelection(): void {
    if (!board) return;
    for (const tile of board.querySelectorAll<HTMLElement>(".tile")) {
      tile.setAttribute(
        "aria-pressed",
        String(tile.dataset.slug === selected),
      );
    }

    if (moveBar) moveBar.hidden = selected === null;
    if (!selected) return;
    if (moveLabel) {
      moveLabel.textContent = bySlug.get(selected)?.name ?? selected;
    }
    if (!moveTargets) return;
    moveTargets.replaceChildren();

    const toolName = bySlug.get(selected)?.name ?? selected;
    state.names.forEach((name, index) => {
      const button = createElement(
        "button",
        "btn btn--small",
        name || `Tier ${index + 1}`,
      );
      button.type = "button";
      button.dataset.moveTier = String(index);
      button.setAttribute(
        "aria-label",
        `Move ${toolName} to ${name || `tier ${index + 1}`}`,
      );
      moveTargets.append(button);
    });

    const unranked = createElement("button", "btn btn--small", "Unranked");
    unranked.type = "button";
    unranked.dataset.moveTier = String(state.names.length);
    unranked.setAttribute("aria-label", `Move ${toolName} to unranked`);
    moveTargets.append(unranked);

    const done = createElement("button", "btn btn--small btn--ghost", "Done");
    done.type = "button";
    done.dataset.clearSelection = "true";
    done.setAttribute("aria-label", "Finish moving tools");
    moveTargets.append(done);
  }

  function applyScopeButtons(): void {
    for (const button of scopeButtons) {
      button.setAttribute(
        "aria-pressed",
        String((button.dataset.scope ?? "all") === state.scope),
      );
    }
  }

  /* ---------- interactions ---------- */

  board?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    const removeTier = target.closest<HTMLElement>("[data-remove-tier]");
    if (removeTier) {
      const index = Number(removeTier.dataset.removeTier);
      if (!Number.isInteger(index) || state.names.length <= 1) return;
      const name = tierLabel(index);
      state.names.splice(index, 1);
      state.ranked.splice(index, 1);
      writeUrl();
      render();
      syncSelection();
      addTierButton?.focus({ preventScroll: true });
      announce(`Tier ${name} removed; its tools are unranked.`);
      return;
    }

    const tile = target.closest<HTMLElement>(".tile");
    if (!tile) return;
    if (Date.now() < suppressClickUntil) return;
    const slug = tile.dataset.slug ?? "";
    selected = selected === slug ? null : slug;
    syncSelection();
    tile.focus({ preventScroll: true });
  });

  board?.addEventListener("input", (event) => {
    const target = event.target as HTMLInputElement;
    if (!target.matches("[data-tier-name]")) return;
    const index = Number(target.dataset.tierName);
    if (!Number.isInteger(index)) return;
    state.names[index] = target.value;
    writeUrl();
    syncSelection();
  });

  board?.addEventListener("blur", (event) => {
    const target = event.target as HTMLInputElement;
    if (!target.matches("[data-tier-name]")) return;
    const index = Number(target.dataset.tierName);
    if (!Number.isInteger(index)) return;
    if (target.value.trim().length === 0) {
      state.names[index] = `Tier ${index + 1}`;
      writeUrl();
      render();
      syncSelection();
    }
  }, true);

  board?.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (target.matches("[data-tier-name]")) return;

    const tile = target.closest<HTMLElement>(".tile");
    if (!tile) return;
    const slug = tile.dataset.slug ?? "";

    if (event.key === "Escape") {
      selected = null;
      syncSelection();
      return;
    }

    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      if (selected !== slug) {
        selected = slug;
        syncSelection();
      }
      const current = tierOf(slug);
      const next =
        event.key === "ArrowUp"
          ? Math.max(0, current - 1)
          : Math.min(state.names.length, current + 1);
      if (next !== current) moveTool(slug, next);
      return;
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const tier = tierOf(slug);
      if (tier >= state.names.length) return;
      const list = state.ranked[tier];
      const from = list.indexOf(slug);
      const to = event.key === "ArrowLeft" ? from - 1 : from + 1;
      if (from < 0 || to < 0 || to >= list.length) return;
      event.preventDefault();
      [list[from], list[to]] = [list[to], list[from]];
      writeUrl();
      render({ focusSlug: slug });
      syncSelection();
      announce(
        `Reordered within ${tierLabel(tier)}.`,
      );
    }
  });

  moveBar?.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (target.closest("[data-clear-selection]")) {
      selected = null;
      syncSelection();
      return;
    }
    const button = target.closest<HTMLElement>("[data-move-tier]");
    if (!button || !selected) return;
    const index = Number(button.dataset.moveTier);
    if (!Number.isInteger(index)) return;
    moveTool(selected, index);
  });

  for (const button of scopeButtons) {
    button.addEventListener("click", () => {
      const value = (button.dataset.scope ?? "all") as Scope;
      if (!SCOPES.includes(value)) return;
      state.scope = value;
      state.ranked = state.names.map(() => []);
      selected = null;
      applyScopeButtons();
      writeUrl();
      render();
      syncSelection();
      announce(
        value === "all"
          ? "Showing all tools, unranked."
          : `Showing ${button.textContent?.trim().toLowerCase() ?? value}, unranked.`,
      );
    });
  }

  addTierButton?.addEventListener("click", () => {
    state.names.push("New tier");
    state.ranked.push([]);
    writeUrl();
    render({ focusTierInput: state.names.length - 1 });
    syncSelection();
    announce("Tier added. Type a name.");
  });

  /* ---------- drag & drop (pointer events) ---------- */

  board?.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    const tile = target.closest<HTMLElement>(".tile");
    if (!tile) return;
    if (event.pointerType === "touch" && !target.closest(".tile__handle")) {
      return;
    }
    const slug = tile.dataset.slug;
    if (!slug) return;

    drag = {
      slug,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      active: false,
      ghost: null,
      over: null,
    };
    tile.focus({ preventScroll: true });
  });

  window.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.active) {
        const distance = Math.hypot(
          event.clientX - drag.startX,
          event.clientY - drag.startY,
        );
        if (distance < 7) return;

        const tile = board?.querySelector<HTMLElement>(
          `.tile[data-slug="${CSS.escape(drag.slug)}"]`,
        );
        if (!tile) return;

        drag.active = true;
        selected = drag.slug;
        syncSelection();

        const ghost = tile.cloneNode(true) as HTMLElement;
        ghost.classList.add("tile--ghost");
        ghost.removeAttribute("aria-pressed");
        const rect = tile.getBoundingClientRect();
        ghost.style.width = `${rect.width}px`;
        ghost.style.height = `${rect.height}px`;
        ghost.style.left = `${event.clientX}px`;
        ghost.style.top = `${event.clientY}px`;
        document.body.append(ghost);
        drag.ghost = ghost;
        tile.classList.add("is-dragging");
      }

      event.preventDefault();
      if (drag.ghost) {
        drag.ghost.style.left = `${event.clientX}px`;
        drag.ghost.style.top = `${event.clientY}px`;
      }

      const under = document
        .elementFromPoint(event.clientX, event.clientY)
        ?.closest<HTMLElement>("[data-drop-tier]");
      const next = under ? Number(under.dataset.dropTier) : null;
      if (next !== drag.over) {
        drag.over = next !== null && Number.isInteger(next) ? next : null;
        for (const row of board?.querySelectorAll(".tier-row") ?? []) {
          row.classList.remove("tier-row--over");
        }
        under?.closest(".tier-row")?.classList.add("tier-row--over");
      }
    },
    { passive: false },
  );

  function endDrag(commit: boolean): void {
    if (!drag) return;
    const { slug, active, over, ghost } = drag;

    board
      ?.querySelector<HTMLElement>(`.tile[data-slug="${CSS.escape(slug)}"]`)
      ?.classList.remove("is-dragging");
    ghost?.remove();
    for (const row of board?.querySelectorAll(".tier-row") ?? []) {
      row.classList.remove("tier-row--over");
    }

    if (active) {
      suppressClickUntil = Date.now() + 300;
      if (commit && over !== null) {
        moveTool(slug, over);
      } else {
        announce("Move cancelled.");
      }
    }

    drag = null;
  }

  window.addEventListener("pointerup", (event) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(true);
  });

  window.addEventListener("pointercancel", (event) => {
    if (drag && event.pointerId === drag.pointerId) endDrag(false);
  });

  /* ---------- export & sharing ---------- */

  downloadButton?.addEventListener("click", async () => {
    if (!capture) return;
    const label = downloadButton.textContent;
    downloadButton.disabled = true;
    downloadButton.textContent = "Rendering…";
    selected = null;
    syncSelection();
    announce("Preparing image…");

    try {
      await document.fonts.ready;

      // html-to-image inlines every image. Make sure the logos are decoded
      // first, otherwise the export can contain empty tiles.
      const images = Array.from(capture.querySelectorAll("img"));
      for (const image of images) image.loading = "eager";
      await Promise.all(
        images.map(async (image) => {
          if (!image.complete) {
            await new Promise<void>((resolve) => {
              image.addEventListener("load", () => resolve(), { once: true });
              image.addEventListener("error", () => resolve(), { once: true });
            });
          }
          try {
            await image.decode();
          } catch {
            // A broken logo should not block the rest of the board.
          }
        }),
      );

      capture.classList.add("is-exporting");
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(capture, {
        pixelRatio: 2,
        backgroundColor: "#0a0a0b",
      });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = "ohmyharness-tier-list.png";
      link.click();
      announce("Image downloaded.");
    } catch (error) {
      console.error(error);
      announce("Could not render the image. Try a screenshot instead.");
    } finally {
      capture.classList.remove("is-exporting");
      downloadButton.disabled = false;
      downloadButton.textContent = label;
    }
  });

  copyButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      announce("Link copied.");
    } catch {
      announce("Copy the address bar link to share this list.");
    }
  });

  window.addEventListener("hashchange", () => {
    const next = parseHash();
    if (!next) return;
    state = next;
    selected = null;
    applyScopeButtons();
    render();
    syncSelection();
    updateShare();
  });

  applyScopeButtons();
  render();
  syncSelection();
  updateShare();
}

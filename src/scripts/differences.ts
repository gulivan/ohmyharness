const root = document.querySelector<HTMLElement>("[data-differences-root]");

if (root) {
  initDifferences(root);
}

/**
 * Server-rendered comparison pages start in "differences only" mode. This
 * script only toggles the rendered rows, so the default works without JS.
 */
function initDifferences(container: HTMLElement): void {
  const toggle = container.querySelector<HTMLButtonElement>(
    "[data-differences-toggle]",
  );
  const count = container.querySelector<HTMLElement>(
    "[data-differences-count]",
  );
  const none = container.querySelector<HTMLElement>("[data-differences-none]");
  const rows = Array.from(
    container.querySelectorAll<HTMLTableRowElement>("[data-feature-row]"),
  );
  const groups = Array.from(
    container.querySelectorAll<HTMLTableRowElement>("[data-compare-group]"),
  );

  if (rows.length === 0) return;

  let showAll = false;

  function render(): void {
    const differing = rows.filter((row) => row.dataset.same !== "true").length;
    const total = rows.length;

    for (const row of rows) {
      row.hidden = !showAll && row.dataset.same === "true";
    }

    for (const group of groups) {
      const key = group.dataset.compareGroup;
      group.hidden = !rows.some(
        (row) => row.dataset.featureGroup === key && !row.hidden,
      );
    }

    if (count) {
      count.textContent = showAll
        ? `All ${total} features`
        : differing === 0
          ? "No differences"
          : `${differing} ${differing === 1 ? "difference" : "differences"}`;
    }

    if (none) none.hidden = showAll || differing > 0;

    if (toggle) {
      toggle.textContent = showAll ? "Differences only" : `Show all ${total}`;
      toggle.setAttribute("aria-pressed", String(showAll));
    }
  }

  toggle?.addEventListener("click", () => {
    showAll = !showAll;
    render();
  });

  render();
}

export {};

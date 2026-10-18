/**
 * Copy buttons and install-method tabs. Small enough to stay framework-free:
 * event delegation handles every copy button on the page, then each server-
 * rendered install panel gets tab switching and an OS-aware default.
 */

const COPY_RESET_MS = 1800;
const PLATFORMS = ["macos", "windows", "linux", "ios", "android"] as const;

type Platform = (typeof PLATFORMS)[number];

let liveRegion: HTMLElement | null = null;

/** Announce a result through a single shared, visually hidden live region. */
function announce(message: string): void {
  if (!liveRegion) {
    liveRegion = document.createElement("span");
    liveRegion.className = "visually-hidden";
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
    document.body.append(liveRegion);
  }

  liveRegion.textContent = "";
  window.setTimeout(() => {
    if (liveRegion) liveRegion.textContent = message;
  }, 20);
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fall through: older browsers or a denied clipboard permission.
  }

  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.readOnly = true;
    area.style.position = "fixed";
    area.style.inset = "0 auto auto 0";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  } catch {
    return false;
  }
}

document.addEventListener("click", (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest<HTMLButtonElement>("[data-copy-text]");
  if (!button) return;

  // Buttons can sit inside a card link; keep the copy action self-contained.
  event.preventDefault();
  event.stopPropagation();

  const text = button.dataset.copyText ?? "";
  const feedback = button.querySelector<HTMLElement>("[data-copy-feedback]");
  const message = button.dataset.copyMessage ?? "Copied to clipboard";
  const original = feedback?.textContent ?? "Copy";
  const copiedLabel = button.dataset.copiedLabel ?? "Copied";

  void writeClipboard(text).then((copied) => {
    if (!copied) {
      announce("Copy failed. Select the command and copy it.");
      return;
    }

    if (feedback) feedback.textContent = copiedLabel;
    button.classList.add("is-copied");
    announce(message);
    window.setTimeout(() => {
      if (feedback) feedback.textContent = original;
      button.classList.remove("is-copied");
    }, COPY_RESET_MS);
  });
});

/** Map the visitor's OS to one of the platform keys used by the data. */
function detectPlatform(): Platform | null {
  const uaData = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData;
  const reported = (uaData?.platform ?? "").toLowerCase();

  if (reported.includes("mac")) return "macos";
  if (reported.includes("win")) return "windows";
  if (reported.includes("android")) return "android";
  if (reported.includes("ios") || reported.includes("iphone")) return "ios";
  if (reported.includes("linux") || reported.includes("chrome os")) {
    return "linux";
  }

  const ua = navigator.userAgent.toLowerCase();
  if (/android/.test(ua)) return "android";
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/mac os x|macintosh/.test(ua)) return "macos";
  if (/windows/.test(ua)) return "windows";
  if (/linux|x11/.test(ua)) return "linux";
  return null;
}

function initInstallPanels(): void {
  for (const root of document.querySelectorAll<HTMLElement>("[data-install]")) {
    const tabs = Array.from(
      root.querySelectorAll<HTMLButtonElement>("[data-install-tab]"),
    );
    const entries = Array.from(
      root.querySelectorAll<HTMLElement>("[data-install-entry]"),
    );
    if (entries.length === 0) continue;

    const activate = (index: number, focus = false): void => {
      entries.forEach((entry, entryIndex) => {
        entry.hidden = entryIndex !== index;
      });
      tabs.forEach((tab, tabIndex) => {
        const active = tabIndex === index;
        tab.setAttribute("aria-selected", String(active));
        tab.tabIndex = active ? 0 : -1;
        if (active && focus) tab.focus();
      });
    };

    // Start on the method that matches the visitor's OS, when one does.
    const platform = detectPlatform();
    if (platform) {
      const match = entries.findIndex((entry) =>
        (entry.dataset.platforms ?? "").split(" ").includes(platform),
      );
      if (match > 0) activate(match);
    }

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activate(index));
      tab.addEventListener("keydown", (event) => {
        const last = tabs.length - 1;
        let next: number | null = null;

        if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
        else if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
        else if (event.key === "Home") next = 0;
        else if (event.key === "End") next = last;

        if (next === null) return;
        event.preventDefault();
        activate(next, true);
      });
    });
  }
}

initInstallPanels();

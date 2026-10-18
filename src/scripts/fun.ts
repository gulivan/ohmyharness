/**
 * Shared playful details.
 *
 * ClickSpark and ScrollReveal are adapted from React Bits (reactbits.dev,
 * David Haz, MIT + Commons Clause). Upstream ships them as React islands;
 * here they are one delegated script so pages without islands keep their
 * content in the server HTML and add only a few hundred bytes of JS.
 *
 * Every effect is skipped under prefers-reduced-motion.
 */

const prefersReducedMotion = (): boolean =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

/* ------------------------------------------------------------------ *
 * ClickSpark — a small burst on primary buttons, delegated site-wide
 * ------------------------------------------------------------------ */

function initClickSparks(): void {
  if (prefersReducedMotion()) return;

  document.addEventListener("click", (event) => {
    const target = (event.target as Element | null)?.closest?.(
      ".btn--primary, [data-spark]",
    ) as HTMLElement | null;
    if (!target || target.hasAttribute("disabled")) return;

    const click = event as MouseEvent;
    let x = click.clientX;
    let y = click.clientY;
    // Keyboard activation reports 0,0; burst from the control instead.
    if (!x && !y) {
      const rect = target.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    }

    const spark = document.createElement("span");
    spark.className = "click-spark";
    spark.setAttribute("aria-hidden", "true");
    spark.style.left = `${x}px`;
    spark.style.top = `${y}px`;

    const count = 9;
    for (let index = 0; index < count; index += 1) {
      const line = document.createElement("span");
      line.className = "click-spark__line";
      line.style.setProperty("--angle", `${(360 / count) * index}deg`);
      line.style.setProperty("--dist", `${15 + Math.random() * 15}px`);
      spark.append(line);
    }

    document.body.append(spark);
    window.setTimeout(() => spark.remove(), 480);
  });
}

/* ------------------------------------------------------------------ *
 * ScrollReveal — headings ease in as they enter the viewport
 * ------------------------------------------------------------------ */

function initReveals(): void {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (
    nodes.length === 0 ||
    prefersReducedMotion() ||
    typeof IntersectionObserver === "undefined"
  ) {
    return;
  }

  document.documentElement.classList.add("reveal-ready");

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        (entry.target as HTMLElement).classList.add("is-revealed");
        observer.unobserve(entry.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.15 },
  );

  for (const node of nodes) observer.observe(node);
}

/* ------------------------------------------------------------------ *
 * 404 crosshair — a thin accent reticle follows the pointer
 * ------------------------------------------------------------------ */

function initCrosshair(): void {
  const zone = document.querySelector<HTMLElement>("[data-crosshair]");
  if (
    !zone ||
    prefersReducedMotion() ||
    !window.matchMedia?.("(pointer: fine)").matches
  ) {
    return;
  }

  const reticle = document.createElement("div");
  reticle.className = "notfound__crosshair";
  reticle.setAttribute("aria-hidden", "true");
  zone.append(reticle);

  let queued = false;
  let x = 0;
  let y = 0;

  const paint = () => {
    queued = false;
    reticle.style.setProperty("--x", `${x}px`);
    reticle.style.setProperty("--y", `${y}px`);
  };

  zone.addEventListener(
    "pointermove",
    (event) => {
      const rect = zone.getBoundingClientRect();
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
      reticle.classList.add("is-on");
      if (queued) return;
      queued = true;
      requestAnimationFrame(paint);
    },
    { passive: true },
  );

  zone.addEventListener("pointerleave", () => reticle.classList.remove("is-on"));
}

/* ------------------------------------------------------------------ *
 * Easter egg — typing "harness" anywhere outside a field paints ribbons
 * for three seconds. Ribbons is adapted from React Bits.
 * ------------------------------------------------------------------ */

const EGG = "harness";
const RIBBON_MS = 3000;

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  if (node.isContentEditable) return true;
  return /^(input|textarea|select)$/i.test(node.tagName);
}

function paintRibbons(done: () => void): void {
  const canvas = document.createElement("canvas");
  canvas.className = "fun-ribbons";
  canvas.setAttribute("aria-hidden", "true");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const context = canvas.getContext("2d");
  if (!context) {
    done();
    return;
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);

  document.body.append(canvas);

  const COLORS = ["#d7ff3f", "#e6ff7c", "#a5a29a", "#43434a"];
  const points: Array<{ x: number; y: number }> = [
    { x: width / 2, y: height / 2 },
  ];
  let pointer = { x: width / 2, y: height / 2 };
  let frame = 0;
  let start = 0;

  const onMove = (event: PointerEvent) => {
    pointer = { x: event.clientX, y: event.clientY };
  };
  window.addEventListener("pointermove", onMove, { passive: true });

  const cleanup = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener("pointermove", onMove);
    canvas.remove();
    done();
  };

  const draw = (now: number) => {
    if (!start) start = now;
    const elapsed = now - start;
    if (elapsed >= RIBBON_MS) {
      cleanup();
      return;
    }

    points.push({ ...pointer });
    if (points.length > 64) points.shift();

    const fade = Math.min(1, (RIBBON_MS - elapsed) / 420);
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let ribbon = 0; ribbon < COLORS.length; ribbon += 1) {
      if (points.length < 2) break;
      context.beginPath();
      for (let index = 0; index < points.length; index += 1) {
        const point = points[index];
        const wobble =
          Math.sin(index * 0.32 + elapsed * 0.004 + ribbon * 1.7) *
          (3 + ribbon * 2.4);
        const sway =
          Math.cos(index * 0.26 + elapsed * 0.003 + ribbon) *
          (2 + ribbon * 1.8);
        const x = point.x + wobble;
        const y = point.y + sway;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.strokeStyle = COLORS[ribbon];
      context.globalAlpha = fade * (0.22 + ribbon * 0.08);
      context.lineWidth = 8 - ribbon;
      context.stroke();
    }

    context.globalAlpha = 1;
    frame = requestAnimationFrame(draw);
  };

  frame = requestAnimationFrame(draw);
}

function initEasterEgg(): void {
  if (prefersReducedMotion()) return;

  let buffer = "";
  let running = false;

  document.addEventListener("keydown", (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (isTypingTarget(event.target)) return;
    if (event.key.length !== 1) return;

    buffer = (buffer + event.key.toLowerCase()).slice(-EGG.length);
    if (buffer !== EGG || running) return;

    buffer = "";
    running = true;
    paintRibbons(() => {
      running = false;
    });
  });
}

initClickSparks();
initReveals();
initCrosshair();
initEasterEgg();

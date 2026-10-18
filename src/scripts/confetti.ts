/**
 * A tiny celebratory burst, adapted from React Bits' Confetti
 * (reactbits.dev, David Haz, MIT + Commons Clause).
 *
 * Local change: no React, no dependencies — one 2D canvas per burst that
 * removes itself. Skipped under prefers-reduced-motion.
 */

const COLORS = ["#d7ff3f", "#e6ff7c", "#f2efe7", "#a5a29a", "#ffc247"];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  spin: number;
  color: string;
  life: number;
}

export function burstConfetti(x: number, y: number, count = 64): void {
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.createElement("canvas");
  canvas.className = "tier-confetti";
  canvas.setAttribute("aria-hidden", "true");

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);

  const context = canvas.getContext("2d");
  if (!context) return;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  document.body.append(canvas);

  const particles: Particle[] = [];
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
    const speed = 190 + Math.random() * 330;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 5,
      angle: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 12,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      life: 0.8 + Math.random() * 0.5,
    });
  }

  let last = 0;
  let frame = 0;
  const started = performance.now();

  const step = (now: number) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    context.clearRect(0, 0, width, height);

    let alive = false;
    for (const particle of particles) {
      const age = (now - started) / 1000;
      if (age > particle.life) continue;
      alive = true;

      particle.vy += 760 * dt;
      particle.vx *= 1 - 1.4 * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.angle += particle.spin * dt;

      const alpha = Math.max(0, 1 - age / particle.life);
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.angle);
      context.globalAlpha = alpha;
      context.fillStyle = particle.color;
      context.fillRect(
        -particle.size / 2,
        -particle.size / 4,
        particle.size,
        Math.max(1.5, particle.size / 2),
      );
      context.restore();
    }

    if (!alive) {
      canvas.remove();
      return;
    }
    frame = requestAnimationFrame(step);
  };

  frame = requestAnimationFrame(step);

  window.setTimeout(() => {
    cancelAnimationFrame(frame);
    canvas.remove();
  }, 1800);
}

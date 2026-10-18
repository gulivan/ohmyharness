/**
 * Deterministic monograms and colors, shared by server-rendered pages and the
 * client-side tier list. Tools do not need icons: the monogram is the identity.
 */

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** First letters of the first two words, or the first two characters. */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "??";
  if (words.length === 1) {
    return Array.from(words[0]).slice(0, 2).join("").toUpperCase();
  }
  return (
    Array.from(words[0])[0] + Array.from(words[1])[0]
  ).toUpperCase();
}

export interface MonogramStyle {
  background: string;
  color: string;
  hue: number;
}

/** A stable, earthy-but-bright block color derived from the slug. */
export function monogramStyle(slug: string): MonogramStyle {
  const hue = hashString(slug) % 360;
  const saturation = 62 + (hashString(`${slug}:s`) % 16);
  const lightness = 56 + (hashString(`${slug}:l`) % 12);
  return {
    background: `hsl(${hue} ${saturation}% ${lightness}%)`,
    color: lightness > 62 ? "#0b0b0c" : "#f4f1e8",
    hue,
  };
}

export function monogramStyleAttr(slug: string): string {
  const style = monogramStyle(slug);
  return `background:${style.background};color:${style.color}`;
}

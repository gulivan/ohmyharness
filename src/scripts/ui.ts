import { monogram, monogramStyle } from "../lib/monogram";

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function makeMonogram(
  slug: string,
  name: string,
  size: "sm" | "md" | "lg" = "sm",
  icon: string | null = null,
): HTMLSpanElement {
  const node = createElement("span", `monogram monogram--${size}`);
  node.setAttribute("aria-hidden", "true");

  if (icon) {
    node.classList.add("monogram--icon");
    const image = document.createElement("img");
    image.src = icon;
    image.alt = "";
    image.width = 64;
    image.height = 64;
    image.loading = "lazy";
    image.decoding = "async";
    node.append(image);
  } else {
    const style = monogramStyle(slug);
    node.style.background = style.background;
    node.style.color = style.color;
    node.textContent = monogram(name);
  }
  return node;
}

export function setStatus(
  node: HTMLElement | null,
  message: string,
): void {
  if (node) node.textContent = message;
}

export function plural(
  count: number,
  singular: string,
  pluralForm = `${singular}s`,
): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

import type { InstallEntry, Tool } from "../data/schema";

/** The default method: the first entry, or null when nothing is verified. */
export function primaryInstall(
  tool: Pick<Tool, "install">,
): InstallEntry | null {
  return tool.install[0] ?? null;
}

/**
 * One plain-text line for indexes (llms.txt) and head-to-head tables.
 * Commands are shown as the reader would type them, without the prompt.
 */
export function installLine(entry: InstallEntry | null): string {
  if (!entry) return "Not verified yet";
  return entry.type === "command"
    ? entry.value
    : `${entry.value} (${entry.label})`;
}

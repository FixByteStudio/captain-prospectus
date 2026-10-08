/**
 * The agent last chosen in Tournée du jour, so the sidebar link (plain
 * `/admin/tournee`) reopens on them — GH #284. A per-viewer convenience: no
 * server state, and `?agent=` still wins. Try/catch like `theme.ts`: blocked
 * site data must cost the memory, never the screen.
 */

export const REMEMBERED_AGENT_KEY = "cap-round-agent";

export function readRememberedAgent(): string | null {
  try {
    return globalThis.localStorage.getItem(REMEMBERED_AGENT_KEY);
  } catch {
    return null;
  }
}

export function rememberAgent(email: string): void {
  try {
    globalThis.localStorage.setItem(REMEMBERED_AGENT_KEY, email);
  } catch {
    // The URL still carries the choice for this visit.
  }
}

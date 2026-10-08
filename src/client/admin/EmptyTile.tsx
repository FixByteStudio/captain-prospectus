import type { ReactNode } from "react";

/**
 * The empty-state shape every admin screen shares (docs/design.md): an icon
 * tile, a title, one sentence and one button. Shared here rather than owned
 * by Prospects, since Doublons (and any later screen) composes it too.
 * Centred in its card, icon, text and button alike (#185).
 */
export function EmptyTile({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="text-muted-foreground flex flex-col items-center gap-3 px-3.5 py-10 text-center">
      <span className="bg-secondary grid size-10 place-items-center rounded-lg">{icon}</span>
      {children}
    </div>
  );
}

/**
 * The field tab bar's contents — GH #66. Pure so the matrix in the spec can be
 * asserted without a DOM, in the `unit` project. What the component does with
 * these tabs is covered separately, in `FieldTabs.test.tsx` (the `dom`
 * project, GH #83).
 */
import type { ComponentType } from "react";
import { Map as MapIcon, MapPinPlus, NotebookPen, Route } from "lucide-react";
import { copy } from "../copy/field";

export type FieldTab = {
  path: string;
  label: string;
  /** The tab's accessible name. Same string as `label` today, kept distinct
   * because a future tab's icon may need a fuller name than its short label. */
  ariaLabel: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  /**
   * `FieldTabs` passes this straight to `NavLink`'s own `end` prop, so its
   * built-in `isActive`/`aria-current` matcher agrees with `isCurrentTab`
   * exactly — true only for the index tab `/tournee`, which must not also
   * match its own subtree.
   */
  end: boolean;
};

/**
 * Tournée, Carte, Carnet and Ajouter, for every role. An admin's way to the
 * dashboard is the account card (`AccountMenu.tsx`, GH #561), not a fifth tab.
 */
export function fieldTabs(): readonly FieldTab[] {
  return [
    {
      path: "/tournee",
      label: copy.nav.tabs.today,
      ariaLabel: copy.nav.tabs.today,
      icon: Route,
      end: true,
    },
    {
      path: "/tournee/carte",
      label: copy.nav.tabs.map,
      ariaLabel: copy.nav.tabs.map,
      icon: MapIcon,
      end: false,
    },
    {
      path: "/tournee/carnet",
      label: copy.nav.tabs.carnet,
      ariaLabel: copy.nav.tabs.carnet,
      icon: NotebookPen,
      end: false,
    },
    {
      path: "/tournee/nouveau",
      label: copy.nav.tabs.add,
      ariaLabel: copy.nav.tabs.add,
      icon: MapPinPlus,
      end: false,
    },
  ];
}

/**
 * `/tournee` is an index route, so it must match only itself — the admin
 * sidebar's "path, or anything under it" rule (`admin/nav.ts`'s `isCurrent`)
 * would also light it up on `/tournee/nouveau` and on a visit. Every other
 * tab's path is a real subtree, so it keeps that rule.
 */
export function isCurrentTab(pathname: string, path: string): boolean {
  if (path === "/tournee") return pathname === "/tournee";
  return pathname === path || pathname.startsWith(`${path}/`);
}

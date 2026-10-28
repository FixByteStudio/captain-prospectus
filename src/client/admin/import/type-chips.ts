import { useState } from "react";
import type { ProspectType } from "../../../shared/constants";

/**
 * The import's type filter: which kinds of place an import brings in. Both
 * sources already speak `ProspectType` by the time rows reach a preview, so
 * one filter serves the CSV and the map (docs/domains/ingestion.md).
 *
 * Five chips for six types: the owner sells to a kebab shop as to a
 * restaurant, so `fast_food` rides on the Restaurant chip. The row keeps its
 * own type; only the choice is grouped.
 */
export const TYPE_CHIPS = ["restaurant", "cafe", "bar", "food_truck", "other"] as const;
export type TypeChip = (typeof TYPE_CHIPS)[number];

export function chipOf(type: ProspectType): TypeChip {
  return type === "fast_food" ? "restaurant" : type;
}

export function keepTypes<T extends { type: ProspectType }>(
  rows: readonly T[],
  chips: readonly TypeChip[],
): T[] {
  return rows.filter((row) => chips.includes(chipOf(row.type)));
}

export function countByChip(rows: readonly { type: ProspectType }[]): Record<TypeChip, number> {
  const counts: Record<TypeChip, number> = {
    restaurant: 0,
    cafe: 0,
    bar: 0,
    food_truck: 0,
    other: 0,
  };
  for (const row of rows) counts[chipOf(row.type)] += 1;
  return counts;
}

/**
 * The last choice, per admin device: a convenience, not a setting, so no
 * server state. Try/catch like `theme.ts`: blocked site data must cost the
 * memory, never the import. Anything unreadable, or an empty choice, starts
 * every chip ticked, so a fresh device never hides a whole import.
 */
export const TYPE_CHIPS_KEY = "cap-import-types";

export function readTypeChips(): TypeChip[] {
  try {
    const stored: unknown = JSON.parse(globalThis.localStorage.getItem(TYPE_CHIPS_KEY) ?? "null");
    if (Array.isArray(stored)) {
      const chips = TYPE_CHIPS.filter((chip) => stored.includes(chip));
      if (chips.length > 0) return chips;
    }
  } catch {
    // Fall through to every chip.
  }
  return [...TYPE_CHIPS];
}

export function rememberTypeChips(chips: readonly TypeChip[]): void {
  try {
    globalThis.localStorage.setItem(TYPE_CHIPS_KEY, JSON.stringify(chips));
  } catch {
    // The choice still holds for this import.
  }
}

export function useTypeChips(): [TypeChip[], (next: TypeChip[]) => void] {
  const [chips, setChips] = useState(readTypeChips);
  return [
    chips,
    (next) => {
      // Kept in TYPE_CHIPS order, so the stored value does not depend on click order.
      const ordered = TYPE_CHIPS.filter((chip) => next.includes(chip));
      setChips(ordered);
      rememberTypeChips(ordered);
    },
  ];
}

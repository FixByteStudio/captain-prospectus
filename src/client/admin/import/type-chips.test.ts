import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TYPE_CHIPS,
  TYPE_CHIPS_KEY,
  chipOf,
  countByChip,
  keepTypes,
  readTypeChips,
  rememberTypeChips,
} from "./type-chips";

// The unit project runs in node, so `localStorage` is stubbed, as in theme.test.ts.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("type chips", () => {
  it("files fast food under Restaurant and every other type under its own chip", () => {
    expect(chipOf("fast_food")).toBe("restaurant");
    expect(chipOf("restaurant")).toBe("restaurant");
    expect(chipOf("cafe")).toBe("cafe");
    expect(chipOf("bar")).toBe("bar");
    expect(chipOf("food_truck")).toBe("food_truck");
    expect(chipOf("other")).toBe("other");
  });

  it("keeps the rows whose chip is ticked, in their order", () => {
    const rows = [
      { name: "A", type: "bar" },
      { name: "B", type: "fast_food" },
      { name: "C", type: "cafe" },
      { name: "D", type: "food_truck" },
    ] as const;
    expect(keepTypes(rows, ["restaurant", "food_truck"]).map((r) => r.name)).toEqual(["B", "D"]);
    expect(keepTypes(rows, [])).toEqual([]);
  });

  it("counts every chip, zero included", () => {
    expect(countByChip([{ type: "restaurant" }, { type: "fast_food" }, { type: "bar" }])).toEqual({
      restaurant: 2,
      cafe: 0,
      bar: 1,
      food_truck: 0,
      other: 0,
    });
  });

  it("remembers the last choice", () => {
    rememberTypeChips(["restaurant", "cafe"]);
    expect(readTypeChips()).toEqual(["restaurant", "cafe"]);
  });

  it("starts every chip ticked with nothing stored, an empty choice or junk", () => {
    expect(readTypeChips()).toEqual([...TYPE_CHIPS]);
    rememberTypeChips([]);
    expect(readTypeChips()).toEqual([...TYPE_CHIPS]);
    globalThis.localStorage.setItem(TYPE_CHIPS_KEY, "{not json");
    expect(readTypeChips()).toEqual([...TYPE_CHIPS]);
    globalThis.localStorage.setItem(TYPE_CHIPS_KEY, JSON.stringify(["bar", "fast_food", 3]));
    expect(readTypeChips()).toEqual(["bar"]);
  });
});

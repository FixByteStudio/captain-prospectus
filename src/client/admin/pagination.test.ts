import { describe, expect, it } from "vitest";
import { PAGE_SIZE, pageCount, pageItems, pageSlice } from "./pagination";

describe("pageCount", () => {
  it("rounds up", () => {
    expect(pageCount(60)).toBe(3);
    expect(pageCount(50)).toBe(2);
    expect(pageCount(1)).toBe(1);
  });

  it("is never below 1, even for an empty list", () => {
    expect(pageCount(0)).toBe(1);
  });
});

describe("pageSlice", () => {
  const items = Array.from({ length: 60 }, (_, i) => i + 1);

  it("returns 25 rows per page", () => {
    expect(pageSlice(items, 1)).toEqual(items.slice(0, 25));
    expect(pageSlice(items, 2)).toEqual(items.slice(25, 50));
    expect(pageSlice(items, 3)).toEqual(items.slice(50, 60));
  });

  it("is empty past the last page", () => {
    expect(pageSlice(items, 4)).toEqual([]);
  });

  it("honours a custom page size", () => {
    expect(pageSlice(items, 1, 10)).toHaveLength(10);
  });
});

describe("pageItems", () => {
  it("lists every page when there are few", () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(1, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("prints Précédent/Suivant edges: page 1 and the last page of 3", () => {
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
  });

  it("windows around the current page with ellipses past 7 pages", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, "ellipsis", 10]);
    expect(pageItems(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(pageItems(10, 10)).toEqual([1, "ellipsis", 9, 10]);
  });
});

it("PAGE_SIZE is 25", () => {
  expect(PAGE_SIZE).toBe(25);
});

import { describe, expect, it } from "vitest";
import { clampOffset, lockAxis, swipeAction, SWIPE_COMMIT, SWIPE_SLOP } from "./swipe";

describe("lockAxis", () => {
  it("stays undecided within the slop on both axes", () => {
    expect(lockAxis(SWIPE_SLOP, SWIPE_SLOP)).toBeNull();
    expect(lockAxis(3, 4)).toBeNull();
  });

  it("locks horizontal once dx clears dy past the slop", () => {
    expect(lockAxis(-120, 4)).toBe("horizontal");
    expect(lockAxis(120, 4)).toBe("horizontal");
  });

  it("locks vertical once dy clears dx past the slop", () => {
    expect(lockAxis(3, 60)).toBe("vertical");
  });
});

describe("clampOffset", () => {
  it("clamps travel to ±SWIPE_COMMIT", () => {
    expect(clampOffset(-500, true)).toBe(-SWIPE_COMMIT);
    expect(clampOffset(500, true)).toBe(SWIPE_COMMIT);
  });

  it("passes small offsets through unchanged", () => {
    expect(clampOffset(-40, true)).toBe(-40);
    expect(clampOffset(40, true)).toBe(40);
  });

  it("clamps a right swipe to 0 without coordinates", () => {
    expect(clampOffset(120, false)).toBe(0);
    expect(clampOffset(40, false)).toBe(0);
  });

  it("still allows a left swipe with no coordinates", () => {
    expect(clampOffset(-120, false)).toBe(-SWIPE_COMMIT);
  });
});

describe("swipeAction", () => {
  it("starts visit at or past the left commit distance", () => {
    expect(swipeAction(-SWIPE_COMMIT, true)).toBe("visit");
    expect(swipeAction(-120, true)).toBe("visit");
  });

  it("starts navigate at or past the right commit distance when coordinates exist", () => {
    expect(swipeAction(SWIPE_COMMIT, true)).toBe("navigate");
    expect(swipeAction(120, true)).toBe("navigate");
  });

  it("starts nothing short of the commit distance", () => {
    expect(swipeAction(-40, true)).toBeNull();
    expect(swipeAction(40, true)).toBeNull();
  });

  it("starts nothing on a right swipe with no coordinates, however far", () => {
    expect(swipeAction(120, false)).toBeNull();
    expect(swipeAction(500, false)).toBeNull();
  });
});

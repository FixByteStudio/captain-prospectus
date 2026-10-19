import { describe, expect, it } from "vitest";
import { fieldTabs, isCurrentTab } from "./tabs";

describe("fieldTabs", () => {
  it("gives every role four tabs, in order: Tournée, Carte, Carnet, Ajouter", () => {
    expect(fieldTabs().map((t) => t.path)).toEqual([
      "/round",
      "/round/map",
      "/round/logbook",
      "/round/new",
    ]);
  });

  it("gives every tab a non-empty label and aria-label", () => {
    for (const tab of fieldTabs()) {
      expect(tab.label.length).toBeGreaterThan(0);
      expect(tab.ariaLabel.length).toBeGreaterThan(0);
    }
  });

  it("marks `end` true only for the index tab /round, so NavLink's own matcher agrees with isCurrentTab", () => {
    expect(fieldTabs().map((t) => [t.path, t.end])).toEqual([
      ["/round", true],
      ["/round/map", false],
      ["/round/logbook", false],
      ["/round/new", false],
    ]);
  });
});

describe("isCurrentTab", () => {
  // I/O matrix, spec-gh-66.
  it("Agent, round: /round matches only itself, Tournée current", () => {
    expect(isCurrentTab("/round", "/round")).toBe(true);
  });

  it("Agent, add: /round/new is Ajouter current, Tournée not", () => {
    expect(isCurrentTab("/round/new", "/round/new")).toBe(true);
    expect(isCurrentTab("/round/new", "/round")).toBe(false);
  });

  it("Visit open: /round/abc123 matches neither tab", () => {
    expect(isCurrentTab("/round/abc123", "/round")).toBe(false);
    expect(isCurrentTab("/round/abc123", "/round/new")).toBe(false);
  });

  it("Nested add route: /round/new/ or deeper still matches Ajouter", () => {
    expect(isCurrentTab("/round/new/", "/round/new")).toBe(true);
    expect(isCurrentTab("/round/new/deep/er", "/round/new")).toBe(true);
  });

  it("On Carte: /round/map is Carte current, Tournée is not (spec-gh-121)", () => {
    expect(isCurrentTab("/round/map", "/round/map")).toBe(true);
    expect(isCurrentTab("/round/map", "/round")).toBe(false);
  });

  it("On Carnet: /round/logbook is Carnet current, Tournée is not", () => {
    expect(isCurrentTab("/round/logbook", "/round/logbook")).toBe(true);
    expect(isCurrentTab("/round/logbook", "/round")).toBe(false);
  });

  it("does not let a sibling prefix pass, same rule as admin/nav.ts", () => {
    expect(isCurrentTab("/rounds", "/round")).toBe(false);
  });
});

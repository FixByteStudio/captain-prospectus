import { describe, expect, it } from "vitest";
import type { RecapResponse } from "../../shared/schemas";
import { recapLines, receivedAgo } from "./recap";

const NOW = Date.parse("2026-10-14T10:00:00.000Z");

function recap(overrides: Partial<RecapResponse> = {}): RecapResponse {
  return {
    date: "2026-10-14",
    activeAgents: 1,
    rosterSize: 2,
    visitsToday: 12,
    lastReceivedAt: NOW - 4 * 60_000,
    serverTime: NOW,
    ...overrides,
  };
}

describe("recapLines (spec I/O matrix)", () => {
  it("tells a working day: the date, the fraction, the visits and the age", () => {
    expect(recapLines(recap())).toEqual({
      date: "mercredi 14 octobre",
      agents: "1 / 2 agents actifs",
      visits: "12 visites",
      received: "Dernière visite reçue il y a 4 min",
    });
  });

  it("says nothing arrived, with no age line, on an empty day", () => {
    const lines = recapLines(recap({ activeAgents: 0, visitsToday: 0, lastReceivedAt: null }));
    expect(lines.agents).toBe("0 / 2 agents actifs");
    expect(lines.visits).toBe("Aucune visite");
    expect(lines.received).toBeNull();
  });

  it("agrees in the singular", () => {
    const lines = recapLines(recap({ rosterSize: 1, visitsToday: 1 }));
    expect(lines.agents).toBe("1 / 1 agent actif");
    expect(lines.visits).toBe("1 visite");
  });

  it("reads the age from the server's clock, not the device's", () => {
    // The device's clock is never consulted: only serverTime − lastReceivedAt.
    const lines = recapLines(recap({ serverTime: NOW + 3 * 3_600_000 + 10 * 60_000 }));
    expect(lines.received).toBe("Dernière visite reçue il y a 3 h");
  });
});

describe("receivedAgo", () => {
  it.each([
    [0, "Dernière visite reçue à l'instant"],
    [59_999, "Dernière visite reçue à l'instant"],
    [60_000, "Dernière visite reçue il y a 1 min"],
    [59 * 60_000 + 59_999, "Dernière visite reçue il y a 59 min"],
    [3_600_000, "Dernière visite reçue il y a 1 h"],
    [3 * 3_600_000 + 10 * 60_000, "Dernière visite reçue il y a 3 h"],
  ])("%i ms reads %s", (ageMs, expected) => {
    expect(receivedAgo(ageMs)).toBe(expected);
  });

  it("treats a receipt stamped after the server's clock as just now", () => {
    // Two isolates' clocks can disagree by a little.
    expect(receivedAgo(-500)).toBe("Dernière visite reçue à l'instant");
  });
});

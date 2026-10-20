import { describe, expect, it } from "vitest";
import { arrivedKeys, mergeDoorDays, nextSince } from "./feed";
import type { AdminDoorDay } from "../../../shared/schemas";

function doorDay(key: string, receivedAt: number, outcome = "interested"): AdminDoorDay {
  const latest = {
    id: "00000000-0000-4000-8000-000000000001",
    visitedAt: receivedAt,
    receivedAt,
    outcome: outcome as AdminDoorDay["outcome"],
    refusalReason: null,
    flyerGiven: true,
    followUpAt: null,
    notes: null,
    answerCount: 0,
  };
  return {
    key,
    prospectId: "00000000-0000-4000-8000-000000000000",
    prospectName: `Place ${key}`,
    agentEmail: "agent@example.com",
    dayStart: 0,
    visitedAt: receivedAt,
    receivedAt,
    listedAt: receivedAt,
    outcome: latest.outcome,
    refusalReason: null,
    flyerGiven: true,
    followUpAt: null,
    notes: null,
    visits: [latest],
  };
}

describe("mergeDoorDays", () => {
  it("keeps the newest arrival first", () => {
    const merged = mergeDoorDays([doorDay("a", 1)], [doorDay("b", 3), doorDay("c", 2)]);
    expect(merged.map((d) => d.key)).toEqual(["b", "c", "a"]);
  });

  it("is idempotent, so a re-delivered door-day never doubles", () => {
    const first = mergeDoorDays([], [doorDay("a", 1), doorDay("b", 2)]);
    const again = mergeDoorDays(first, [doorDay("b", 2)]);
    expect(again).toHaveLength(2);
    expect(again.map((d) => d.key)).toEqual(["b", "a"]);
  });

  it("replaces a held door-day with its newer self and moves it to the top", () => {
    const held = mergeDoorDays([], [doorDay("a", 1, "no_contact"), doorDay("b", 2)]);
    const merged = mergeDoorDays(held, [doorDay("a", 3, "converted")]);
    expect(merged.map((d) => [d.key, d.outcome])).toEqual([
      ["a", "converted"],
      ["b", "interested"],
    ]);
  });

  it("breaks a same-millisecond tie the same way every time", () => {
    // Two phones syncing at once land on the same receivedAt. Without the
    // tie-break the two rows would swap places on every poll.
    const one = mergeDoorDays([], [doorDay("b", 5), doorDay("a", 5)]);
    const two = mergeDoorDays([doorDay("a", 5)], [doorDay("b", 5)]);
    expect(one.map((d) => d.key)).toEqual(two.map((d) => d.key));
  });

  it("returns what it was given when nothing arrived", () => {
    const held = [doorDay("a", 1)];
    expect(mergeDoorDays(held, [])).toBe(held);
  });
});

describe("a repaired orphan (GH #528)", () => {
  // Received long ago, listed at the repair: the feed clock is `listedAt`.
  const repaired = { ...doorDay("a", 1, "converted"), listedAt: 9 };

  it("sorts to the top and moves the cursor on listedAt, not receivedAt", () => {
    const held = [doorDay("b", 5)];
    const merged = mergeDoorDays(held, [repaired]);
    expect(merged.map((d) => d.key)).toEqual(["a", "b"]);
    expect(nextSince(merged)).toBe(9);
  });

  it("is marked as arrived though its receivedAt did not grow", () => {
    expect(arrivedKeys([doorDay("a", 1)], [repaired])).toEqual(["a"]);
  });
});

describe("nextSince", () => {
  it("is the highest listedAt held, not the newest-first row", () => {
    expect(nextSince([doorDay("a", 3), doorDay("b", 9), doorDay("c", 1)])).toBe(9);
  });

  it("is 0 when nothing is held, which asks for everything", () => {
    expect(nextSince([])).toBe(0);
  });
});

describe("arrivedKeys", () => {
  it("names only what this poll added", () => {
    expect(arrivedKeys([doorDay("a", 1)], [doorDay("a", 1), doorDay("b", 2)])).toEqual(["b"]);
  });

  it("names nothing when the poll re-delivered what we had", () => {
    expect(arrivedKeys([doorDay("a", 1)], [doorDay("a", 1)])).toEqual([]);
  });

  it("names a held door-day that another visit reached", () => {
    expect(arrivedKeys([doorDay("a", 1)], [doorDay("a", 4, "converted")])).toEqual(["a"]);
  });
});

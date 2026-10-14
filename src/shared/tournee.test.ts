import { describe, expect, it } from "vitest";
import { OPEN_STATUSES, STATUSES } from "./constants";
import { isStopLeft } from "./tournee";

const ME = "agent@example.com";

describe("isStopLeft", () => {
  it("keeps an open stop the agent still owns", () => {
    for (const status of OPEN_STATUSES) {
      expect(isStopLeft({ assignedTo: ME, status, mergedInto: null }, ME, false)).toBe(false);
    }
  });

  it("leaves when the prospect is closed, unvisited", () => {
    for (const status of STATUSES.filter((s) => !OPEN_STATUSES.includes(s))) {
      expect(isStopLeft({ assignedTo: ME, status, mergedInto: null }, ME, false)).toBe(true);
    }
  });

  it("leaves when reassigned or unassigned, unvisited", () => {
    expect(
      isStopLeft(
        { assignedTo: "other@example.com", status: "assigned", mergedInto: null },
        ME,
        false,
      ),
    ).toBe(true);
    expect(isStopLeft({ assignedTo: null, status: "new", mergedInto: null }, ME, false)).toBe(true);
  });

  it("leaves when merged away, unvisited", () => {
    expect(isStopLeft({ assignedTo: ME, status: "assigned", mergedInto: "x" }, ME, false)).toBe(
      true,
    );
  });

  it("never leaves once visited today, whatever happened to the prospect", () => {
    expect(isStopLeft({ assignedTo: ME, status: "converted", mergedInto: null }, ME, true)).toBe(
      false,
    );
    expect(
      isStopLeft(
        { assignedTo: "other@example.com", status: "assigned", mergedInto: "x" },
        ME,
        true,
      ),
    ).toBe(false);
    expect(isStopLeft({ assignedTo: null, status: "rejected", mergedInto: null }, ME, true)).toBe(
      false,
    );
  });
});

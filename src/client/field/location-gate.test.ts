import { describe, expect, it } from "vitest";
import { LOCATION_GATE_ACCURACY_M, locationStatus, type LocationReading } from "./location-gate";

const none: LocationReading = { accuracy: null, locating: false, denied: false, refused: false };
const at = (over: Partial<LocationReading>): LocationReading => ({ ...none, ...over });
const status = (over: Partial<LocationReading>) =>
  locationStatus(at(over), LOCATION_GATE_ACCURACY_M);

describe("locationStatus", () => {
  it("is idle before the first reading", () => {
    expect(status({})).toEqual({ kind: "idle" });
  });

  it("is locating while the first reading is outstanding", () => {
    expect(status({ locating: true })).toEqual({ kind: "locating" });
  });

  it("is coarse above the threshold, rounded up so it never reads as the threshold, and stays coarse while the next reading runs", () => {
    expect(status({ accuracy: 350.4 })).toEqual({ kind: "coarse", meters: 351 });
    expect(status({ accuracy: LOCATION_GATE_ACCURACY_M + 0.4 })).toEqual({
      kind: "coarse",
      meters: LOCATION_GATE_ACCURACY_M + 1,
    });
    expect(status({ accuracy: 350, locating: true })).toEqual({ kind: "coarse", meters: 350 });
    expect(status({ accuracy: LOCATION_GATE_ACCURACY_M + 1 }).kind).toBe("coarse");
  });

  it("passes at the threshold and under it", () => {
    expect(status({ accuracy: LOCATION_GATE_ACCURACY_M })).toEqual({ kind: "passed" });
    expect(status({ accuracy: 12 })).toEqual({ kind: "passed" });
  });

  it("tells a refusal from a lost fix, and a failure outranks an older reading", () => {
    expect(status({ denied: true, refused: true })).toEqual({ kind: "refused" });
    expect(status({ denied: true })).toEqual({ kind: "unavailable" });
    expect(status({ denied: true, accuracy: 12 })).toEqual({ kind: "unavailable" });
  });

  it("reads again as locating after a failure, not as the old failure", () => {
    expect(status({ denied: true, refused: true, locating: true })).toEqual({ kind: "locating" });
  });

  it("takes the threshold as an argument", () => {
    expect(locationStatus(at({ accuracy: 150 }), 100).kind).toBe("coarse");
    expect(locationStatus(at({ accuracy: 150 }), 200).kind).toBe("passed");
  });
});

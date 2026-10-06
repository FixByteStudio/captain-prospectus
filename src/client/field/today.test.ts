import { describe, expect, it } from "vitest";
import { navigationUrl } from "./today";

describe("navigationUrl", () => {
  it("points at the coordinates on OpenStreetMap", () => {
    const url = navigationUrl({ lat: 45.7578, lng: 4.832, name: "Le Bouchon" });

    expect(url).toContain("openstreetmap.org");
    expect(url).toContain("mlat=45.757800");
    expect(url).toContain("mlon=4.832000");
  });

  it("has nowhere to send an agent without coordinates", () => {
    expect(navigationUrl({ lat: null, lng: null, name: "Inconnu" })).toBeNull();
  });
});

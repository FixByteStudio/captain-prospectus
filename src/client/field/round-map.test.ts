import { describe, expect, it } from "vitest";
import { mapPins, walkingPath, type NumberedItem } from "./round-map";

let nextNumber = 1;
const item = (over: Partial<NumberedItem> = {}): NumberedItem => ({
  id: crypto.randomUUID(),
  number: nextNumber++,
  name: "Le Bouchon",
  lat: 50.8467,
  lng: 4.3525,
  ...over,
});

describe("mapPins", () => {
  it("carries every stop's own number in the order given, gold for the first", () => {
    const a = item({ number: 4, lat: 50.85, lng: 4.35 });
    const b = item({ number: 5, lat: 50.86, lng: 4.36 });
    const c = item({ number: 9, lat: 50.87, lng: 4.37 });

    expect(mapPins([a, b, c])).toEqual([
      { id: a.id, number: 4, lat: 50.85, lng: 4.35, next: true, name: a.name },
      { id: b.id, number: 5, lat: 50.86, lng: 4.36, next: false, name: b.name },
      { id: c.id, number: 9, lat: 50.87, lng: 4.37, next: false, name: c.name },
    ]);
  });

  it("skips a stop with no coordinates but keeps the numbering around it", () => {
    const a = item({ number: 1, lat: 50.85, lng: 4.35 });
    const noCoords = item({ number: 2, lat: null, lng: null });
    const c = item({ number: 3, lat: 50.87, lng: 4.37 });

    expect(mapPins([a, noCoords, c])).toEqual([
      { id: a.id, number: 1, lat: 50.85, lng: 4.35, next: true, name: a.name },
      { id: c.id, number: 3, lat: 50.87, lng: 4.37, next: false, name: c.name },
    ]);
  });

  it("carries the stop's own name, for the pin's accessible label", () => {
    const a = item({ number: 1, lat: 50.85, lng: 4.35, name: "Curry House" });
    expect(mapPins([a])).toEqual([
      { id: a.id, number: 1, lat: 50.85, lng: 4.35, next: true, name: "Curry House" },
    ]);
  });

  it("draws no pin at all for an empty round", () => {
    expect(mapPins([])).toEqual([]);
  });
});

describe("walkingPath", () => {
  it("joins the pins in order, never the agent's own position", () => {
    const pins = mapPins([item({ lat: 1, lng: 2 }), item({ lat: 3, lng: 4 })]);
    expect(walkingPath(pins)).toEqual([
      [1, 2],
      [3, 4],
    ]);
  });

  it("skips straight from 1 to 3 when 2 has no coordinates", () => {
    const pins = mapPins([
      item({ lat: 1, lng: 2 }),
      item({ lat: null, lng: null }),
      item({ lat: 5, lng: 6 }),
    ]);
    expect(walkingPath(pins)).toEqual([
      [1, 2],
      [5, 6],
    ]);
  });

  it("is empty when there are no pins to join", () => {
    expect(walkingPath([])).toEqual([]);
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { dropReading, readingToSend, rememberReading, setReadingIdentity } from "./last-reading";

/**
 * ADR-0028, "On the phone": which reading the phone may offer to a sync. The
 * wire-level cases (what `runSync` puts in the body) are in `sync.test.ts`.
 */

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0); // 14:00 in Brussels (CEST)
// Brussels midnight starting 5 October 2026 is 22:00 UTC on the 4th.
const MIDNIGHT = Date.UTC(2026, 9, 4, 22, 0, 0);
// ...and tomorrow's starts 24 h later.
const NEXT_MIDNIGHT = Date.UTC(2026, 9, 5, 22, 0, 0);

const reading = (over: Partial<Parameters<typeof rememberReading>[0]> = {}) => ({
  lat: 50.8467,
  lng: 4.3525,
  accuracy: 25,
  capturedAt: NOW - 60_000,
  ...over,
});

afterEach(() => {
  setReadingIdentity(null);
  dropReading();
});

describe("last-reading", () => {
  it("offers today's reading to the identity that took it", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading());
    expect(readingToSend("a@example.com", NOW)).toEqual(reading());
  });

  it("offers nothing when no reading was taken", () => {
    setReadingIdentity("a@example.com");
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("offers nothing for a reading from before today's Brussels midnight", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ capturedAt: MIDNIGHT - 1 }));
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("offers a reading taken exactly at Brussels midnight", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ capturedAt: MIDNIGHT }));
    expect(readingToSend("a@example.com", NOW)).toBeDefined();
  });

  it("offers nothing for a reading dated on a later Brussels day (the clock moved back)", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ capturedAt: NEXT_MIDNIGHT }));
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("offers a reading taken one millisecond before the next Brussels midnight", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ capturedAt: NEXT_MIDNIGHT - 1 }));
    expect(readingToSend("a@example.com", NOW)).toBeDefined();
  });

  it("offers nothing to another identity", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading());
    expect(readingToSend("b@example.com", NOW)).toBeUndefined();
  });

  it("keeps nothing taken while there is no confirmed identity", () => {
    setReadingIdentity(null);
    rememberReading(reading());
    setReadingIdentity("a@example.com");
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("drops the reading when the identity changes", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading());
    setReadingIdentity("b@example.com");
    setReadingIdentity("a@example.com");
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("offers nothing once dropped", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading());
    dropReading();
    expect(readingToSend("a@example.com", NOW)).toBeUndefined();
  });

  it("ignores a reading that fails the wire schema, and keeps the good one it would replace", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ lat: 50.1 }));
    rememberReading(reading({ accuracy: 10_001, capturedAt: NOW }));
    rememberReading(reading({ lat: 200, capturedAt: NOW }));
    rememberReading(reading({ accuracy: Number.NaN, capturedAt: NOW }));
    expect(readingToSend("a@example.com", NOW)?.lat).toBe(50.1);
  });

  it("keeps the newer fix when an older one arrives, and takes a newer one", () => {
    setReadingIdentity("a@example.com");
    rememberReading(reading({ lat: 50.1, capturedAt: NOW - 60_000 }));
    rememberReading(reading({ lat: 50.2, capturedAt: NOW - 300_000 }));
    expect(readingToSend("a@example.com", NOW)?.lat).toBe(50.1);
    rememberReading(reading({ lat: 50.3, capturedAt: NOW - 1_000 }));
    expect(readingToSend("a@example.com", NOW)?.lat).toBe(50.3);
  });
});

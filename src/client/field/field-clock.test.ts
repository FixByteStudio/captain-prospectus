/**
 * The field clock's store — docs/design.md › Midnight. `useFieldNow` is covered
 * through the screens in `App.test.tsx`; this is the timer, the visibility
 * re-check and the reset on the last unsubscribe, with a fake clock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brusselsMidnightDaysFromNow } from "../../shared/period";
import { fieldClockTick, subscribeFieldClock } from "./field-clock";

// The sync provider drags in the PWA virtual module; the clock reads one field of it.
vi.mock("./useSync", () => ({ useSyncState: () => ({ lastSyncAt: null }) }));

/** The slice of `document` the store touches. The unit project runs in node. */
class FakeDocument extends EventTarget {
  visibilityState = "visible";
}

let doc: FakeDocument;
const unsubscribers: (() => void)[] = [];

function subscribe(listener: () => void = () => {}) {
  const off = subscribeFieldClock(listener);
  unsubscribers.push(off);
  return off;
}

/** A Brussels wall-clock time on 2026-10-14 (CEST, UTC+2). */
const at = (hour: number, minute = 0, second = 0) =>
  Date.UTC(2026, 9, 14, hour - 2, minute, second);

beforeEach(() => {
  doc = new FakeDocument();
  vi.stubGlobal("document", doc);
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
});

afterEach(() => {
  for (const off of unsubscribers.splice(0)) off();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("the field clock", () => {
  it("reads 0 until a midnight is crossed", () => {
    vi.setSystemTime(at(23, 59, 59));
    subscribe();
    expect(fieldClockTick()).toBe(0);
  });

  it("fires at Brussels midnight and tells its listeners", async () => {
    vi.setSystemTime(at(23, 59, 59));
    const listener = vi.fn();
    subscribe(listener);

    await vi.advanceTimersByTimeAsync(999);
    expect(listener).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(fieldClockTick()).toBe(at(24));
  });

  it("re-arms for the next midnight after each fire", async () => {
    vi.setSystemTime(at(23, 59, 59));
    const listener = vi.fn();
    subscribe(listener);

    await vi.advanceTimersByTimeAsync(1_000);
    await vi.advanceTimersByTimeAsync(24 * 3_600_000);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(fieldClockTick()).toBe(at(48));
  });

  it("fires at 00:00 Brussels across a night the clocks change", async () => {
    // 2026-10-24 23:00 CEST (UTC+2). The clocks go back on the 25th at 03:00, so
    // that day lasts 25 hours: the midnight after it is 25 hours after the first.
    vi.setSystemTime(Date.UTC(2026, 9, 24, 21, 0, 0));
    subscribe();
    const first = brusselsMidnightDaysFromNow(Date.now(), 1);
    expect(first).toBe(Date.UTC(2026, 9, 24, 22, 0, 0));
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fieldClockTick()).toBe(first);

    // 24 hours on, the wall clock reads 23:00: not midnight yet.
    await vi.advanceTimersByTimeAsync(24 * 3_600_000);
    expect(fieldClockTick()).toBe(first);
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(fieldClockTick()).toBe(Date.UTC(2026, 9, 25, 23, 0, 0));
  });

  it("re-checks when the page becomes visible, because a sleeping phone holds the timer back", () => {
    vi.setSystemTime(at(23, 59, 59));
    const listener = vi.fn();
    subscribe(listener);

    // The timer never ran: the clock jumped to 07:00 while the phone slept.
    vi.setSystemTime(at(31));
    doc.dispatchEvent(new Event("visibilitychange"));

    expect(listener).toHaveBeenCalledTimes(1);
    expect(fieldClockTick()).toBe(at(31));
  });

  it("does nothing on a visibility change before midnight, or when hidden", () => {
    vi.setSystemTime(at(12));
    const listener = vi.fn();
    subscribe(listener);

    doc.dispatchEvent(new Event("visibilitychange"));
    vi.setSystemTime(at(25));
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));

    expect(listener).not.toHaveBeenCalled();
    expect(fieldClockTick()).toBe(0);
  });

  it("does not fire a midnight twice", async () => {
    vi.setSystemTime(at(23, 59, 59));
    const listener = vi.fn();
    subscribe(listener);

    await vi.advanceTimersByTimeAsync(1_000);
    doc.dispatchEvent(new Event("visibilitychange"));

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("shares one timer between subscribers and resets on the last unsubscribe", async () => {
    vi.setSystemTime(at(23, 59, 59));
    const first = subscribe();
    const second = subscribe();
    expect(vi.getTimerCount()).toBe(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(fieldClockTick()).toBe(at(24));

    first();
    expect(vi.getTimerCount()).toBe(1);
    expect(fieldClockTick()).toBe(at(24));

    second();
    expect(vi.getTimerCount()).toBe(0);
    expect(fieldClockTick()).toBe(0);
  });
});

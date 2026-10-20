/**
 * The gate's readings: when they start, when they repeat, when they stop
 * (docs/design.md › The location dialog). Real timers with the cadence at 2 s
 * would crawl, so the cadence is read through fake ones.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setGeolocation, setGeolocationPermission } from "../../../test/geolocation";
import { dropReading, readingToSend, setReadingIdentity } from "./last-reading";
import {
  LOCATION_GATE_ACCURACY_M,
  LOCATION_GATE_RETRY_MS,
  LOCATION_GATE_SWIPE_TIMEOUT_MS,
} from "./location-gate";
import { useLocationGate } from "./useLocationGate";

const HERE = { lat: 50.8467, lng: 4.3525 };
const COARSE = { ...HERE, accuracy: LOCATION_GATE_ACCURACY_M + 150 };

let visibility: DocumentVisibilityState = "visible";
function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event("visibilitychange"));
}

/** Let promises and the faked geolocation's microtasks settle. */
const flush = () => act(async () => void (await Promise.resolve()));

beforeEach(() => {
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  setReadingIdentity(null);
  dropReading();
});

describe("useLocationGate", () => {
  it.each([
    ["no Permissions API", null],
    ["a permission still to ask", "prompt"],
  ] as const)("waits for « Activer » with %s", async (_name, permission) => {
    setGeolocationPermission(permission);
    setGeolocation(HERE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result } = renderHook(() => useLocationGate());
    await flush();

    expect(reading).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: "idle" });

    act(() => result.current.activate());
    await flush();
    expect(result.current.status).toEqual({ kind: "passed" });
    expect(result.current.point).toEqual(HERE);
    reading.mockRestore();
  });

  it("starts at once when the permission is granted, and only releases the point once passed", async () => {
    setGeolocationPermission("granted");
    setGeolocation(COARSE);
    const { result } = renderHook(() => useLocationGate());
    await flush();
    await flush();

    expect(result.current.status).toEqual({ kind: "coarse", meters: COARSE.accuracy });
    expect(result.current.point).toBeNull();
  });

  it("repeats a coarse reading after the cadence, then stops at the first that passes", async () => {
    setGeolocationPermission("granted");
    setGeolocation(COARSE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result } = renderHook(() => useLocationGate());
    await flush();
    await flush();
    expect(reading).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(LOCATION_GATE_RETRY_MS - 1));
    expect(reading).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(reading).toHaveBeenCalledTimes(2);

    setGeolocation({ ...HERE, accuracy: 30 });
    await act(() => vi.advanceTimersByTimeAsync(LOCATION_GATE_RETRY_MS));
    expect(result.current.status).toEqual({ kind: "passed" });
    expect(result.current.point).toEqual(HERE);

    const taken = reading.mock.calls.length;
    await act(() => vi.advanceTimersByTimeAsync(5 * LOCATION_GATE_RETRY_MS));
    expect(reading).toHaveBeenCalledTimes(taken);
    reading.mockRestore();
  });

  it("takes no reading while the page is hidden, and resumes when it is visible again", async () => {
    setGeolocationPermission("granted");
    setGeolocation(COARSE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    renderHook(() => useLocationGate());
    await flush();
    await flush();
    expect(reading).toHaveBeenCalledTimes(1);

    act(() => setVisibility("hidden"));
    await act(() => vi.advanceTimersByTimeAsync(10 * LOCATION_GATE_RETRY_MS));
    expect(reading).toHaveBeenCalledTimes(1);

    act(() => setVisibility("visible"));
    await flush();
    await flush();
    expect(reading.mock.calls.length).toBeGreaterThan(1);
    reading.mockRestore();
  });

  it("does not repeat after a refusal or a lost fix", async () => {
    for (const fix of ["denied", "unavailable"] as const) {
      setGeolocationPermission(null);
      setGeolocation(fix);
      const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
      const { result, unmount } = renderHook(() => useLocationGate());
      act(() => result.current.activate());
      await flush();

      expect(result.current.status).toEqual({ kind: fix === "denied" ? "refused" : "unavailable" });
      await act(() => vi.advanceTimersByTimeAsync(10 * LOCATION_GATE_RETRY_MS));
      expect(reading).toHaveBeenCalledTimes(1);
      reading.mockRestore();
      unmount();
    }
  });

  it("reads at once on coming back from Réglages with the permission now granted", async () => {
    setGeolocation("denied");
    const { result } = renderHook(() => useLocationGate());
    act(() => result.current.activate());
    await flush();
    expect(result.current.status).toEqual({ kind: "refused" });

    setGeolocationPermission("granted");
    setGeolocation(HERE);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await flush();
    await flush();

    expect(result.current.status).toEqual({ kind: "passed" });
  });

  it("takes fresh readings", async () => {
    setGeolocationPermission("granted");
    setGeolocation(HERE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    renderHook(() => useLocationGate());
    await flush();
    await flush();

    expect(reading.mock.calls[0]?.[2]).toMatchObject({ maximumAge: 0 });
    reading.mockRestore();
  });

  it("clears its timer on unmount", async () => {
    setGeolocationPermission("granted");
    setGeolocation(COARSE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { unmount } = renderHook(() => useLocationGate());
    await flush();
    await flush();
    unmount();

    await act(() => vi.advanceTimersByTimeAsync(5 * LOCATION_GATE_RETRY_MS));
    expect(reading).toHaveBeenCalledTimes(1);
    reading.mockRestore();
  });

  it("takes one reading however often « Activer » is touched while one is outstanding", async () => {
    setGeolocation(HERE);
    // Never answers: the reading stays in flight.
    const reading = vi
      .spyOn(navigator.geolocation, "getCurrentPosition")
      .mockImplementation(() => {});
    const { result } = renderHook(() => useLocationGate());

    act(() => {
      result.current.activate();
      result.current.activate();
    });
    await flush();
    act(() => result.current.activate());
    await flush();

    expect(reading).toHaveBeenCalledTimes(1);
    reading.mockRestore();
  });

  it("takes no second reading when the page comes back mid-reading", async () => {
    setGeolocationPermission("granted");
    const reading = vi
      .spyOn(navigator.geolocation, "getCurrentPosition")
      .mockImplementation(() => {});
    renderHook(() => useLocationGate());
    await flush();
    await flush();
    expect(reading).toHaveBeenCalledTimes(1);

    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await flush();
    await flush();

    expect(reading).toHaveBeenCalledTimes(1);
    reading.mockRestore();
  });

  it("takes no reading after it passed, whatever the page does", async () => {
    setGeolocationPermission("granted");
    setGeolocation(HERE);
    const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
    const { result } = renderHook(() => useLocationGate());
    await flush();
    await flush();
    expect(result.current.status).toEqual({ kind: "passed" });
    const taken = reading.mock.calls.length;

    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await flush();
    await flush();

    expect(reading).toHaveBeenCalledTimes(taken);
    expect(result.current.status).toEqual({ kind: "passed" });
    expect(result.current.point).toEqual(HERE);
    reading.mockRestore();
  });

  describe("swipePoint", () => {
    const THERE = { lat: 50.86, lng: 4.36 };

    /** A gate that has passed at HERE; the fix is then switched by the test. */
    async function passedAtHere() {
      setGeolocationPermission("granted");
      setGeolocation({ ...HERE, accuracy: 30 });
      const gate = renderHook(() => useLocationGate());
      await flush();
      await flush();
      expect(gate.result.current.status).toEqual({ kind: "passed" });
      return gate;
    }

    it("numbers from the fresh reading when the agent moved and it passes the rule", async () => {
      const { result } = await passedAtHere();
      setGeolocation({ ...THERE, accuracy: LOCATION_GATE_ACCURACY_M });

      let point: unknown;
      await act(async () => {
        point = await result.current.swipePoint();
      });

      expect(point).toEqual(THERE);
      // The gate stays where it ended.
      expect(result.current.status).toEqual({ kind: "passed" });
      expect(result.current.point).toEqual(HERE);
    });

    it("asks for a fresh reading with the swipe's own timeout", async () => {
      const { result } = await passedAtHere();
      const reading = vi.spyOn(navigator.geolocation, "getCurrentPosition");
      await act(async () => void (await result.current.swipePoint()));

      expect(reading).toHaveBeenCalledTimes(1);
      expect(reading.mock.calls[0]?.[2]).toMatchObject({
        maximumAge: 0,
        timeout: LOCATION_GATE_SWIPE_TIMEOUT_MS,
      });
      reading.mockRestore();
    });

    it.each([
      ["too coarse", { ...THERE, accuracy: LOCATION_GATE_ACCURACY_M + 1 }],
      ["refused", "denied"],
      ["lost", "unavailable"],
      ["timed out", "timeout"],
    ] as const)("falls back to the gate's point when the reading is %s", async (_name, fix) => {
      const { result } = await passedAtHere();
      setGeolocation(fix);

      let point: unknown;
      await act(async () => {
        point = await result.current.swipePoint();
      });

      expect(point).toEqual(HERE);
      expect(result.current.status).toEqual({ kind: "passed" });
    });

    it("falls back when the browser has no geolocation at all", async () => {
      const { result } = await passedAtHere();
      const real = Object.getOwnPropertyDescriptor(navigator, "geolocation");
      // @ts-expect-error -- an older WebView has no such property
      delete navigator.geolocation;
      try {
        let point: unknown;
        await act(async () => {
          point = await result.current.swipePoint();
        });
        expect(point).toEqual(HERE);
      } finally {
        if (real) Object.defineProperty(navigator, "geolocation", real);
      }
    });

    it("remembers the swipe's reading for the ADR-0028 marker, even a coarse one", async () => {
      setReadingIdentity("agent@example.com");
      const { result } = await passedAtHere();
      setGeolocation({ ...THERE, accuracy: LOCATION_GATE_ACCURACY_M + 50 });
      await act(async () => void (await result.current.swipePoint()));

      expect(readingToSend("agent@example.com", Date.now())).toMatchObject({
        lat: THERE.lat,
        lng: THERE.lng,
        accuracy: LOCATION_GATE_ACCURACY_M + 50,
      });
    });
  });
});

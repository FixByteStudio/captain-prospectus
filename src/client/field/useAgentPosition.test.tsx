import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setGeolocation } from "../../../test/geolocation";
import { dropReading, readingToSend, setReadingIdentity } from "./last-reading";
import { useAgentPosition } from "./useAgentPosition";

const HERE = { lat: 50.8467, lng: 4.3525 };

afterEach(() => {
  setReadingIdentity(null);
  dropReading();
});

describe("useAgentPosition", () => {
  it("is locating until the reading lands, then holds the position", async () => {
    setGeolocation(HERE);
    const { result } = renderHook(() => useAgentPosition());

    expect(result.current.locating).toBe(true);
    await waitFor(() => expect(result.current.locating).toBe(false));
    expect(result.current.point).toEqual(HERE);
    expect(result.current.denied).toBe(false);
  });

  it("carries on without a position when permission is refused", async () => {
    const { result } = renderHook(() => useAgentPosition());

    await waitFor(() => expect(result.current.denied).toBe(true));
    expect(result.current.point).toBeNull();
    expect(result.current.locating).toBe(false);
  });

  it("refresh() reads again, so a permission granted since is picked up", async () => {
    const { result } = renderHook(() => useAgentPosition());
    await waitFor(() => expect(result.current.denied).toBe(true));

    setGeolocation(HERE);
    act(() => result.current.refresh());

    await waitFor(() => expect(result.current.point).toEqual(HERE));
    expect(result.current.denied).toBe(false);
    expect(result.current.locating).toBe(false);
  });

  // React 19 no longer warns about a state update after unmount, so this pins
  // only that the `cancelled` guard lets a late reading land without a crash.
  it("ignores a reading that lands after unmount", async () => {
    const errors = vi.spyOn(console, "error");
    setGeolocation(HERE);
    const { unmount } = renderHook(() => useAgentPosition());

    expect(() => unmount()).not.toThrow();
    await act(() => Promise.resolve());

    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  // ADR-0028: the reading kept for the next sync carries the fix's own clock
  // and accuracy, not the moment the hook happened to resolve.
  it("keeps the reading with the fix's timestamp as capturedAt, not the time it resolved", async () => {
    const now = Date.now();
    const taken = now - 90_000;
    setReadingIdentity("a@example.com");
    setGeolocation({ ...HERE, accuracy: 37, timestamp: taken });
    const { result } = renderHook(() => useAgentPosition());

    await waitFor(() => expect(result.current.locating).toBe(false));

    expect(readingToSend("a@example.com", now)).toEqual({
      ...HERE,
      accuracy: 37,
      capturedAt: taken,
    });
  });

  it("keeps nothing when the reading is refused", async () => {
    setReadingIdentity("a@example.com");
    const { result } = renderHook(() => useAgentPosition());

    await waitFor(() => expect(result.current.denied).toBe(true));

    expect(readingToSend("a@example.com", Date.now())).toBeUndefined();
  });

  it("keeps a reading that lands after unmount: the fix was taken either way", async () => {
    setReadingIdentity("a@example.com");
    setGeolocation(HERE);
    const { unmount } = renderHook(() => useAgentPosition());
    unmount();
    await act(() => Promise.resolve());

    expect(readingToSend("a@example.com", Date.now())).toMatchObject(HERE);
  });
});

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { setGeolocation } from "../../../test/geolocation";
import { useAgentPosition } from "./useAgentPosition";

const HERE = { lat: 50.8467, lng: 4.3525 };

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
});

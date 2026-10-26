import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Component, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../copy/field";
import { AdminChunkBoundary } from "./AdminChunkBoundary";

afterEach(cleanup);

const Admin = ({ label }: { label: string }) => <p>{`admin screens: ${label}`}</p>;

function renderBoundary(load: () => Promise<{ default: typeof Admin }>) {
  return render(
    <AdminChunkBoundary load={load} fallback={<p>loading</p>}>
      {(Chunk) => <Chunk label="ok" />}
    </AdminChunkBoundary>,
  );
}

describe("AdminChunkBoundary", () => {
  it("shows the Hors ligne screen when the chunk fails, then the admin screens when Réessayer loads it", async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Admin }>>()
      .mockRejectedValueOnce(new Error("Failed to fetch dynamically imported module"))
      .mockResolvedValue({ default: Admin });
    renderBoundary(load);

    expect(await screen.findByText(copy.adminOffline.title)).toBeTruthy();
    expect(screen.getByText(copy.adminOffline.body)).toBeTruthy();
    expect(screen.queryByText(copy.adminOffline.stillOffline)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: copy.adminOffline.retry }));

    expect(await screen.findByText("admin screens: ok")).toBeTruthy();
    expect(screen.queryByText(copy.adminOffline.title)).toBeNull();
    // The first call was the lazy's own; the retry asked again, not the cached rejection.
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("keeps the screen, says it is still offline and re-enables Réessayer when the retry fails too", async () => {
    const load = vi
      .fn<() => Promise<{ default: typeof Admin }>>()
      .mockRejectedValue(new Error("Failed to fetch"));
    renderBoundary(load);

    fireEvent.click(await screen.findByRole("button", { name: copy.adminOffline.retry }));

    expect(await screen.findByText(copy.adminOffline.stillOffline)).toBeTruthy();
    expect(screen.getByText(copy.adminOffline.title)).toBeTruthy();
    await waitFor(() => {
      const again = screen.getByRole("button", { name: copy.adminOffline.retry });
      expect((again as HTMLButtonElement).disabled).toBe(false);
    });

    load.mockResolvedValue({ default: Admin });
    fireEvent.click(screen.getByRole("button", { name: copy.adminOffline.retry }));
    expect(await screen.findByText("admin screens: ok")).toBeTruthy();
  });

  it("does not word a bug inside the admin side as being offline", async () => {
    const Broken = (): never => {
      throw new Error("render bug");
    };
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    class Outer extends Component<{ children: ReactNode }, { caught: boolean }> {
      override state = { caught: false };
      static getDerivedStateFromError() {
        return { caught: true };
      }
      override render() {
        return this.state.caught ? <p>outer caught</p> : this.props.children;
      }
    }
    try {
      render(
        <Outer>
          <AdminChunkBoundary
            load={() => Promise.resolve({ default: Broken })}
            fallback={<p>loading</p>}
          >
            {(Chunk) => <Chunk />}
          </AdminChunkBoundary>
        </Outer>,
      );
      expect(await screen.findByText("outer caught")).toBeTruthy();
      expect(screen.queryByText(copy.adminOffline.title)).toBeNull();
    } finally {
      errors.mockRestore();
    }
  });
});

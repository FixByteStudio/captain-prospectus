import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { copy } from "../copy/field";
import { FieldChunkBoundary } from "./FieldChunkBoundary";

afterEach(cleanup);

const Screen = () => <p>field screen</p>;
type Load = () => Promise<{ default: typeof Screen }>;

function renderBoundary(load: Load) {
  return render(<FieldChunkBoundary load={load}>{(Chunk) => <Chunk />}</FieldChunkBoundary>);
}

describe("FieldChunkBoundary", () => {
  it("shows the field recovery when the chunk fails, then the screen when Réessayer loads it", async () => {
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(new Error("Failed to fetch dynamically imported module"))
      .mockResolvedValue({ default: Screen });
    renderBoundary(load);

    expect(await screen.findByText(copy.fieldChunk.title)).toBeTruthy();
    expect(screen.queryByText(copy.fieldChunk.stillFailing)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: copy.fieldChunk.retry }));

    expect(await screen.findByText("field screen")).toBeTruthy();
    expect(screen.queryByText(copy.fieldChunk.title)).toBeNull();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("says it is still failing and re-enables Réessayer when the retry fails too", async () => {
    const load = vi.fn<Load>().mockRejectedValue(new Error("Failed to fetch"));
    renderBoundary(load);

    fireEvent.click(await screen.findByRole("button", { name: copy.fieldChunk.retry }));

    expect(await screen.findByText(copy.fieldChunk.stillFailing)).toBeTruthy();
    await waitFor(() => {
      const again = screen.getByRole("button", { name: copy.fieldChunk.retry });
      expect((again as HTMLButtonElement).disabled).toBe(false);
    });
  });
});

/**
 * The location dialog's states and its refusal to close (docs/design.md › The
 * location dialog). The gate that feeds it is covered in `StartScreen.test.tsx`.
 */
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { copy } from "../copy";
import type { LocationStatus } from "./location-gate";
import { LocationDialog } from "./LocationDialog";

function renderDialog(
  status: LocationStatus,
  {
    open = true,
    adminOnline = false,
    onActivate = vi.fn(),
    notice = undefined as string | undefined,
  } = {},
) {
  const swipeRef = createRef<HTMLButtonElement>();
  const view = render(
    <MemoryRouter>
      <button ref={swipeRef} type="button">
        swipe
      </button>
      <LocationDialog
        open={open}
        status={status}
        onActivate={onActivate}
        adminOnline={adminOnline}
        swipeRef={swipeRef}
        notice={notice}
      />
    </MemoryRouter>,
  );
  return { ...view, swipeRef, onActivate };
}

describe("LocationDialog", () => {
  it("names itself, explains, and offers one action and the settings line", () => {
    renderDialog({ kind: "idle" });

    const dialog = screen.getByRole("alertdialog", { name: copy.location.title });
    expect(dialog.textContent).toContain(copy.location.description);
    expect(dialog.textContent).toContain(copy.location.settings);
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it.each<[string, LocationStatus, string, boolean]>([
    ["locating", { kind: "locating" }, copy.today.locating, true],
    ["coarse", { kind: "coarse", meters: 350 }, "Précision : 350 m. On affine…", true],
    ["refused", { kind: "refused" }, copy.location.refused, false],
    ["unavailable", { kind: "unavailable" }, copy.location.unavailable, false],
  ])("says %s in a polite status line", (_name, status, text, spinning) => {
    renderDialog(status);

    const line = screen.getByRole("status");
    expect(line.textContent).toBe(text);
    expect(line.getAttribute("aria-live")).toBe("polite");
    expect(line.querySelector(".animate-spin") !== null).toBe(spinning);
  });

  it("shows a save's confirmation above the title, and nothing without one", () => {
    const { unmount } = renderDialog({ kind: "idle" }, { notice: copy.visit.saved });

    const line = screen.getByText(copy.visit.saved);
    // A screen reader opening the alert hears the save first, then the description.
    const dialog = screen.getByRole("alertdialog", { name: copy.location.title });
    const description = screen.getByText(copy.location.description);
    expect(dialog.getAttribute("aria-describedby")).toBe(`${line.id} ${description.id}`);
    const title = screen.getByText(copy.location.title);
    expect(line.compareDocumentPosition(title) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    unmount();

    renderDialog({ kind: "idle" });
    expect(screen.queryByText(copy.visit.saved)).toBeNull();
  });

  it("calls onActivate from « Activer »", async () => {
    const { onActivate } = renderDialog({ kind: "idle" });
    await userEvent.click(screen.getByRole("button", { name: copy.location.activate }));
    expect(onActivate).toHaveBeenCalledTimes(1);
  });

  it("stays open on Escape and on a tap on the overlay", async () => {
    renderDialog({ kind: "idle" });

    await userEvent.keyboard("{Escape}");
    const overlay = document.querySelector("[data-slot=alert-dialog-overlay]");
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay as Element);

    expect(screen.getByRole("alertdialog")).toBeTruthy();
  });

  it("blurs the overlay", () => {
    renderDialog({ kind: "idle" });
    expect(
      document
        .querySelector("[data-slot=alert-dialog-overlay]")
        ?.classList.contains("backdrop-blur-sm"),
    ).toBe(true);
  });

  it("shows the dashboard link to an admin only", () => {
    const { unmount } = renderDialog({ kind: "idle" }, { adminOnline: true });
    expect(screen.getByRole("link", { name: copy.nav.tabs.dashboard }).getAttribute("href")).toBe(
      "/admin",
    );
    unmount();
    renderDialog({ kind: "idle" });
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hands focus to the swipe when it closes", async () => {
    const { rerender, swipeRef } = renderDialog({ kind: "idle" });
    rerender(
      <MemoryRouter>
        <button ref={swipeRef} type="button">
          swipe
        </button>
        <LocationDialog
          open={false}
          status={{ kind: "passed" }}
          onActivate={() => {}}
          adminOnline={false}
          swipeRef={swipeRef}
        />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("alertdialog")).toBeNull();
    // Radix hands focus back on a timer after the content unmounts.
    await waitFor(() => expect(document.activeElement).toBe(swipeRef.current));
  });
});

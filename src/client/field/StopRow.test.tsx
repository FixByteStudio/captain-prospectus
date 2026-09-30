/**
 * The shared stop row (spec-gh-118, spec-gh-120): tap toggles `aria-expanded`,
 * expanding reveals the same "Y aller"/"Visiter" pair the next-stop card
 * carries, a stop with no coordinates drops "Y aller", the outbox badge is
 * read-only (invariants 2, 3 — never a reason to hide or reorder a stop), and
 * a swipe on the header is a second way to the same two destinations.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { copy } from "../copy";
import { STATUS_EDGE } from "../admin/status";
import { SWIPE_COMMIT } from "./swipe";
import { edgeFor, StopRow } from "./StopRow";
import type { TodayItem } from "./today";

const item = (over: Partial<TodayItem> = {}): TodayItem => ({
  id: "11111111-1111-1111-1111-111111111111",
  name: "Le Bouchon",
  type: "restaurant",
  lat: 50.8467,
  lng: 4.3525,
  address: "Rue du Midi 42",
  status: "assigned",
  nextVisitAt: null,
  lastVisitAt: null,
  pending: false,
  distanceM: 120,
  visitQueued: false,
  ...over,
});

/** A row owns no state of its own (shared with Carte and the admin view). */
function ControlledRow({ initial = false, item: theItem }: { initial?: boolean; item: TodayItem }) {
  const [expanded, setExpanded] = useState(initial);
  return (
    <StopRow item={theItem} index={2} expanded={expanded} onToggle={() => setExpanded((v) => !v)} />
  );
}

function renderRow(theItem: TodayItem, initial = false) {
  return render(
    <MemoryRouter>
      <ul>
        <ControlledRow initial={initial} item={theItem} />
      </ul>
    </MemoryRouter>,
  );
}

/** For the swipe-left tests: a real route to observe `useNavigate` landing. */
function renderRowWithRoute(theItem: TodayItem) {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <ul>
              <ControlledRow item={theItem} />
            </ul>
          }
        />
        <Route path="/tournee/:id" element={<p>Visit form</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function header() {
  return screen.getByRole("button", { name: /Le Bouchon/ });
}

/** happy-dom's fireEvent carries clientX/clientY; setPointerCapture may not
 * exist there, which `useSwipe` already treats as optional. `isPrimary` and
 * `button` default to "not the primary pointer" / not-left in happy-dom, so
 * every real gesture in these tests states them explicitly. */
const PRIMARY_POINTER = { pointerId: 1, isPrimary: true, button: 0 };

function swipe(element: Element, dx: number, dy = 4) {
  fireEvent.pointerDown(element, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
  fireEvent.pointerMove(element, { clientX: dx, clientY: dy, ...PRIMARY_POINTER });
  fireEvent.pointerUp(element, { clientX: dx, clientY: dy, ...PRIMARY_POINTER });
}

describe("StopRow", () => {
  it("starts collapsed with no actions on screen", () => {
    renderRow(item());

    const button = screen.getByRole("button", { name: /Le Bouchon/ });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: copy.today.visit })).toBeNull();
    // Collapsed, the row still carries its walking-order number and distance.
    expect(within(button).getByText("2")).toBeTruthy();
    expect(within(button).getByText("120 m")).toBeTruthy();
  });

  it("expands on tap to show Y aller and Visiter, with the right hrefs", async () => {
    const user = userEvent.setup();
    renderRow(item());

    await user.click(screen.getByRole("button", { name: /Le Bouchon/ }));

    const button = screen.getByRole("button", { name: /Le Bouchon/ });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    const visit = screen.getByRole("link", { name: copy.today.visit });
    expect(visit.getAttribute("href")).toBe("/tournee/11111111-1111-1111-1111-111111111111");

    const navigate = screen.getByRole("link", { name: copy.today.navigate });
    expect(navigate.getAttribute("href")).toContain("openstreetmap.org");
  });

  it("collapses again on a second tap", async () => {
    const user = userEvent.setup();
    renderRow(item(), true);

    const button = screen.getByRole("button", { name: /Le Bouchon/ });
    expect(button.getAttribute("aria-expanded")).toBe("true");

    await user.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("link", { name: copy.today.visit })).toBeNull();
  });

  it("drops Y aller and gives Visiter the full width when there are no coordinates", () => {
    renderRow(item({ lat: null, lng: null, distanceM: null }), true);

    expect(screen.getByText(copy.today.distanceUnknown)).toBeTruthy();

    expect(screen.queryByRole("link", { name: copy.today.navigate })).toBeNull();
    const visit = screen.getByRole("link", { name: copy.today.visit });
    // The wrapping grid drops to one column so Visiter takes the full width.
    expect(visit.parentElement?.className).toContain("grid-cols-1");
  });

  it("shows « Pas encore envoyé » for a stop with a queued visit", () => {
    renderRow(item({ visitQueued: true }));

    expect(screen.getByText(copy.today.notSynced)).toBeTruthy();
  });

  it("shows « Pas encore envoyé » for a field prospect not yet accepted", () => {
    renderRow(item({ pending: true, status: null }));

    expect(screen.getByText(copy.today.notSynced)).toBeTruthy();
  });

  it("gives a field prospect with no server status the `new` edge", () => {
    expect(edgeFor({ status: null })).toBe(STATUS_EDGE.new);
    expect(edgeFor({ status: "follow_up" })).toBe(STATUS_EDGE.follow_up);
  });

  it("says nothing about the outbox for a stop that is fully synced", () => {
    renderRow(item());

    expect(screen.queryByText(copy.today.notSynced)).toBeNull();
  });

  describe("swipe (GH #120)", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("swiping left past the commit distance starts Visiter, not expand", () => {
      renderRowWithRoute(item());

      swipe(header(), -(SWIPE_COMMIT + 24));

      expect(screen.getByText("Visit form")).toBeTruthy();
      expect(screen.queryByRole("link", { name: copy.today.visit })).toBeNull();
    });

    it("swiping right past the commit distance opens Y aller and returns to rest", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item());

      swipe(header(), SWIPE_COMMIT + 24);

      expect(open).toHaveBeenCalledWith(
        expect.stringContaining("openstreetmap.org"),
        "_blank",
        "noopener,noreferrer",
      );
      expect(header().getAttribute("aria-expanded")).toBe("false");
    });

    it("a short swipe snaps back, starts nothing and does not expand", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item());

      swipe(header(), -40);

      expect(open).not.toHaveBeenCalled();
      expect(header().getAttribute("aria-expanded")).toBe("false");
      expect(header().style.transform).toBe("");
    });

    it("a gesture that starts vertical never swipes and never expands", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item());
      const button = header();

      fireEvent.pointerDown(button, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: 3, clientY: 60, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: 150, clientY: 60, ...PRIMARY_POINTER });
      fireEvent.pointerUp(button, { clientX: 150, clientY: 60, ...PRIMARY_POINTER });

      expect(open).not.toHaveBeenCalled();
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.style.transform).toBe("");
    });

    it("a tap within the slop still expands, as before", async () => {
      const user = userEvent.setup();
      renderRow(item());

      await user.click(header());

      expect(header().getAttribute("aria-expanded")).toBe("true");
    });

    it("a right swipe with no coordinates opens nothing and does not move", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item({ lat: null, lng: null, distanceM: null }));

      swipe(header(), SWIPE_COMMIT + 24);

      expect(open).not.toHaveBeenCalled();
      expect(header().style.transform).toBe("");
    });

    it("pointercancel resets the row and starts nothing", () => {
      const open = vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item());
      const button = header();

      fireEvent.pointerDown(button, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: -60, clientY: 4, ...PRIMARY_POINTER });
      fireEvent.pointerCancel(button, PRIMARY_POINTER);

      expect(open).not.toHaveBeenCalled();
      expect(button.getAttribute("aria-expanded")).toBe("false");
      expect(button.style.transform).toBe("");
    });

    it("drops the transition class while dragging, restores it on release", () => {
      renderRow(item());
      const button = header();

      expect(button.className).toContain("motion-safe:transition-transform");

      fireEvent.pointerDown(button, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: -40, clientY: 4, ...PRIMARY_POINTER });

      expect(button.className).not.toContain("motion-safe:transition-transform");

      fireEvent.pointerUp(button, { clientX: -40, clientY: 4, ...PRIMARY_POINTER });

      expect(button.className).toContain("motion-safe:transition-transform");
    });

    it("does not expand on the click that follows a short swipe", () => {
      renderRow(item());

      swipe(header(), -40);
      fireEvent.click(header(), { detail: 1 });

      expect(header().getAttribute("aria-expanded")).toBe("false");
    });

    it("does not expand on the click that follows a committed right swipe", () => {
      vi.spyOn(window, "open").mockImplementation(() => null);
      renderRow(item());

      swipe(header(), SWIPE_COMMIT + 24);
      fireEvent.click(header(), { detail: 1 });

      expect(header().getAttribute("aria-expanded")).toBe("false");
    });

    it("still expands on a keyboard/AT activation (detail 0) right after a swipe", () => {
      renderRow(item());

      swipe(header(), -40);
      fireEvent.click(header(), { detail: 0 });

      expect(header().getAttribute("aria-expanded")).toBe("true");
    });

    it("a mouse-style vertical drag still swallows the click that follows it", () => {
      renderRow(item());
      const button = header();

      fireEvent.pointerDown(button, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: 3, clientY: 60, ...PRIMARY_POINTER });
      fireEvent.pointerCancel(button, PRIMARY_POINTER);
      fireEvent.click(button, { detail: 1 });

      expect(button.getAttribute("aria-expanded")).toBe("false");
    });

    it("a second, non-primary pointer mid-drag does not change the outcome", () => {
      renderRowWithRoute(item());
      const button = header();

      fireEvent.pointerDown(button, { clientX: 0, clientY: 0, ...PRIMARY_POINTER });
      fireEvent.pointerMove(button, { clientX: -60, clientY: 4, ...PRIMARY_POINTER });
      // A second finger touches down mid-drag; it must not re-base or
      // otherwise disturb the first pointer's gesture, which still commits
      // Visiter exactly as it would have alone.
      fireEvent.pointerDown(button, { clientX: 10, clientY: 10, pointerId: 2, isPrimary: false });
      fireEvent.pointerMove(button, { clientX: 999, clientY: 999, pointerId: 2, isPrimary: false });
      fireEvent.pointerUp(button, {
        clientX: -(SWIPE_COMMIT + 24),
        clientY: 4,
        ...PRIMARY_POINTER,
      });

      expect(screen.getByText("Visit form")).toBeTruthy();
    });

    it("both panels are aria-hidden, and Y aller's is absent without coordinates", () => {
      const { rerender } = renderRow(item());

      // The collapsed StopActions panel (`hidden`, not `aria-hidden`) carries
      // the same two labels, so disambiguate by the swipe panel's own marker.
      const inSwipePanel = (text: string) =>
        screen.getAllByText(text).find((el) => el.closest('[aria-hidden="true"]'));
      expect(inSwipePanel(copy.today.navigate)).toBeTruthy();
      expect(inSwipePanel(copy.today.visit)).toBeTruthy();

      rerender(
        <MemoryRouter>
          <ul>
            <ControlledRow item={item({ lat: null, lng: null, distanceM: null })} />
          </ul>
        </MemoryRouter>,
      );

      expect(screen.queryByText(copy.today.navigate)).toBeNull();
    });
  });
});

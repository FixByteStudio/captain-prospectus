/**
 * The admin routes' two ends — GH #107, #90.
 *
 * `/admin` used to render an empty frame, and so did any path no route
 * matched. `fetch` is stubbed per URL: the sidebar asks for its two queue
 * counts on every admin path, and the dashboard for its figures.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { onlineManager } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router";
import { copy } from "../copy";
import { ORPHANS_PAGE_SIZE } from "../../shared/constants";
import type { DashboardResponse } from "../../shared/schemas";
import { AdminApp } from "./AdminApp";

const DASHBOARD: DashboardResponse = {
  period: 30,
  from: 0,
  to: 1,
  visits: { value: 386, previous: 343, delta: 0.1254, byDay: [] },
  openProspects: 278,
  openProspectsByStatus: { new: 128, assigned: 86, follow_up: 64 },
  converted: { value: 41, previous: 36, delta: 0.1389, byDay: [] },
  conversionRate: {
    value: 0.106,
    previous: 0.094,
    delta: 0.012,
    visitedProspects: { value: 386, previous: 383 },
  },
  visitsByDay: [],
  pipeline: { new: 128, assigned: 86, follow_up: 64, converted: 41, rejected: 93 },
  agents: [
    { email: "agent@example.com", visits: 386, converted: 41, followUp: 64, openProspects: 150 },
  ],
  followUpsDue: 6,
  flyersGiven: 120,
  agentsActiveToday: 2,
  followUpsDueSoon: { value: 6, dueBefore: 1 },
};

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** The repair queue the stub serves; a test swaps in a longer one. */
let orphans: { visits: unknown[]; remaining: number } = { visits: [], remaining: 0 };

beforeEach(() => {
  orphans = { visits: [], remaining: 0 };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/dashboard")) return json(DASHBOARD);
      if (url.startsWith("/api/admin/prospects/duplicates"))
        return json({ pairs: [], truncated: false });
      if (url.startsWith("/api/admin/visits/orphaned")) return json(orphans);
      if (url.startsWith("/api/admin/visits?")) return json({ visits: [], serverTime: 0 });
      return new Response("{}", { status: 404 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderAdmin(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route
          path="/admin/*"
          element={<AdminApp email="admin@example.com" updatePrompt={null} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

/** The sidebar's item, not the breadcrumb's page (also a "link") of the same name. */
function sidebarLink(name: string): HTMLElement {
  const item = screen
    .getAllByRole("link", { name })
    .find((link) => link.closest("[data-slot=sidebar-menu-button]"));
  if (!item) throw new Error(`no sidebar item named ${name}`);
  return item;
}

describe("AdminApp", () => {
  it("opens Tableau de bord on /admin, current in the sidebar", async () => {
    renderAdmin("/admin");

    expect(screen.getByRole("heading", { level: 2, name: copy.dashboard.title })).toBeTruthy();
    // The figures arrive from the stubbed endpoint.
    expect(await screen.findByText("278")).toBeTruthy();
    expect(sidebarLink(copy.nav.dashboard).getAttribute("aria-current")).toBe("page");
    expect(sidebarLink(copy.nav.prospects).getAttribute("aria-current")).toBeNull();
  });

  it("answers an unknown admin path with « Page introuvable. » inside the frame (#90)", () => {
    renderAdmin("/admin/inconnu");

    expect(screen.getByText(copy.errors.notFound)).toBeTruthy();
    expect(screen.queryByRole("heading", { name: copy.dashboard.title })).toBeNull();
    // Still the admin frame: the sidebar is there, and nothing in it is current.
    expect(sidebarLink(copy.nav.dashboard).getAttribute("aria-current")).toBeNull();
  });

  it("counts the whole repair queue in the sidebar badge, not its first page (#159)", async () => {
    // A full page (ORPHANS_PAGE_SIZE) plus 50 the server only counted. The
    // rows' contents do not matter: nothing on this path renders them.
    orphans = { visits: Array.from({ length: ORPHANS_PAGE_SIZE }, () => ({})), remaining: 50 };
    renderAdmin("/admin/inconnu");

    const total = ORPHANS_PAGE_SIZE + 50;
    const badged = await screen.findByRole("link", {
      name: copy.nav.withCount(copy.nav.orphans, total),
    });
    expect(badged.textContent).toContain(String(total));
  });

  // GH #209 (part of GH #85's untested offline-admin wiring): one full-width
  // banner takes the update prompt's slot while offline, and goes as soon as
  // the browser reports back online.
  describe("offline banner", () => {
    afterEach(() => {
      // DOM tests drive `useOnline` and TanStack's `onlineManager` alike by
      // dispatching window events; reset both for the next test.
      act(() => {
        window.dispatchEvent(new Event("online"));
        onlineManager.setOnline(true);
      });
    });

    it("shows the offline banner and displaces the update prompt, gone once back online", async () => {
      render(
        <MemoryRouter initialEntries={["/admin"]}>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <AdminApp
                  email="admin@example.com"
                  updatePrompt={<p data-testid="update-prompt">maj</p>}
                />
              }
            />
          </Routes>
        </MemoryRouter>,
      );
      await screen.findByText("278");
      expect(screen.getByTestId("update-prompt")).toBeTruthy();
      // The live region exists before the banner ever lands in it, so a
      // screen reader announces the sentence arriving rather than missing
      // an element that showed up already filled (EXPERIENCE.md:216).
      const live = document.querySelector('[data-slot="offline-region"]');
      expect(live).toBeTruthy();

      act(() => {
        window.dispatchEvent(new Event("offline"));
      });

      expect(screen.getByText(copy.offline.banner)).toBeTruthy();
      expect(live?.getAttribute("aria-live")).toBe("polite");
      expect(live?.textContent).not.toContain(copy.offline.reconnected);
      expect(live?.contains(screen.getByText(copy.offline.banner))).toBe(true);
      expect(screen.queryByTestId("update-prompt")).toBeNull();

      act(() => {
        window.dispatchEvent(new Event("online"));
      });

      expect(screen.queryByText(copy.offline.banner)).toBeNull();
      expect(screen.getByTestId("update-prompt")).toBeTruthy();
      // Announced once when it goes, too (EXPERIENCE.md:216).
      expect(live?.textContent).toBe(copy.offline.reconnected);
    });

    it("announces nothing on first load while online", async () => {
      renderAdmin("/admin");
      await screen.findByText("278");
      expect(document.querySelector('[data-slot="offline-region"]')?.textContent).toBe("");
    });
  });
});

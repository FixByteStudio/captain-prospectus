/**
 * Visites rebuilt (GH #178): the period selector drives both the feed and the
 * strip, the pager, the four strip figures and each card's link, and the
 * empty-feed copy — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-178-visites-rebuilt.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { ADMIN_VISITS_PAGE_SIZE, EXPORT_ROWS } from "../../shared/constants";
import { brusselsPeriod } from "../../shared/period";
import type { AdminVisit, DashboardResponse } from "../../shared/schemas";
import { copy } from "../copy";
import { Toaster } from "../ui/sonner";
import { adminKeys } from "./queries";
import { createAdminQueryClient } from "./query-client";
import { VisitsScreen } from "./VisitsScreen";

/** Pinned so `brusselsPeriod(Date.now(), …)` is a known value throughout. */
const NOW = new Date("2026-09-27T12:00:00Z").getTime();

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * `useVisitsFeed` trims held rows to the scoped window's own `from` (a period
 * boundary near `NOW`), so a fixture's `receivedAt` has to land inside it —
 * a handful of milliseconds apart is enough to keep every test's relative
 * ordering while staying well within even a 7-day window.
 */
function visit(id: string, receivedAt: number): AdminVisit {
  const at = NOW - 10_000_000 + receivedAt;
  return {
    id,
    prospectId: "00000000-0000-4000-8000-000000000000",
    prospectName: `Place ${id}`,
    agentEmail: "agent@example.com",
    visitedAt: at,
    receivedAt: at,
    flyerGiven: false,
    outcome: "interested",
    followUpAt: null,
    notes: null,
  };
}

function dashboardAnswer(period: number): DashboardResponse {
  return {
    period: period as DashboardResponse["period"],
    from: 0,
    to: 1,
    visits: { value: 10, previous: 8, delta: 0.25, byDay: [10] },
    openProspects: 100,
    openProspectsByStatus: { new: 50, assigned: 20, follow_up: 30 },
    converted: { value: 5, previous: 4, delta: 0.25, byDay: [5] },
    conversionRate: {
      value: 0.106,
      previous: 0.094,
      delta: 0.012,
      visitedProspects: { value: 47, previous: 40 },
    },
    visitsByDay: [
      {
        date: "2026-09-01",
        counts: { no_contact: 0, interested: 0, not_interested: 0, follow_up: 0, converted: 0 },
      },
    ],
    pipeline: { new: 50, assigned: 20, follow_up: 30, interested: 0, converted: 5, rejected: 2 },
    agents: [],
    followUpsDue: 6,
    flyersGiven: 84,
    agentsActiveToday: 2,
    followUpsDueSoon: { value: 12, dueBefore: 1_700_000_000_000 },
  };
}

type Stub = {
  visits?: (url: URL) => Response | Promise<Response>;
  dashboard?: (url: URL) => Response;
  exportCsv?: (url: URL) => Response;
};

function stubFetch({ visits, dashboard, exportCsv }: Stub) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://localhost");
      asked.push(url.pathname + url.search);
      if (url.pathname === "/api/admin/dashboard") {
        return (dashboard ?? ((p) => json(dashboardAnswer(Number(p.searchParams.get("period"))))))(
          url,
        );
      }
      if (url.pathname === "/api/admin/visits/export.csv") {
        return (exportCsv ?? (() => json({}, 500)))(url);
      }
      if (url.pathname === "/api/admin/visits") {
        return (visits ?? (() => json({ visits: [], serverTime: 0 })))(url);
      }
      throw new Error(`unexpected fetch: ${url}`);
    }),
  );
  return asked;
}

function Location() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderScreen(initialPath = "/admin/visites") {
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <QueryClientProvider client={client}>
        <VisitsScreen />
        <Location />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return client;
}

/** `q.get("from")`/`q.get("to")` of one recorded request URL. */
function bounds(url: string | undefined): [string | null, string | null] {
  const q = new URLSearchParams(url?.split("?")[1]);
  return [q.get("from"), q.get("to")];
}

beforeEach(() => {
  // `toFake: ["Date"]` only: waitFor and userEvent still run on real timers,
  // and every `brusselsPeriod(Date.now(), …)` in the app and in assertions
  // agrees on "now".
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VisitsScreen", () => {
  it("defaults to 30 jours: the feed asks for exactly brusselsPeriod(now, 30)", async () => {
    const asked = stubFetch({ visits: () => json({ visits: [visit("a", 1)], serverTime: 2 }) });
    renderScreen();

    await screen.findByText(copy.visits.strip.flyersGiven);
    const period = brusselsPeriod(NOW, 30);
    const visitsCall = asked.find((u) => u.startsWith("/api/admin/visits?"));
    expect(bounds(visitsCall)).toEqual([String(period.from), String(period.to - 1)]);
    expect(asked).toContain("/api/admin/dashboard?period=30");
    expect(
      screen.getByRole("radio", { name: copy.dashboard.periods[30] }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("treats a bad ?period= as 30 (I/O matrix)", async () => {
    stubFetch({});
    renderScreen("/admin/visites?period=12");
    await waitFor(() =>
      expect(
        screen
          .getByRole("radio", { name: copy.dashboard.periods[30] })
          .getAttribute("aria-checked"),
      ).toBe("true"),
    );
  });

  it("re-seeds the feed from since=0 under the new period's own bounds, with no arrival announcement (I/O matrix)", async () => {
    const asked = stubFetch({
      visits: (url) =>
        json({ visits: [visit(url.searchParams.get("from") ?? "x", 1)], serverTime: 2 }),
    });
    renderScreen();
    const period30 = brusselsPeriod(NOW, 30);
    await screen.findByText(`Place ${period30.from}`);
    const before = asked.length;

    await userEvent.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/visites?period=7"),
    );

    const period7 = brusselsPeriod(NOW, 7);
    await screen.findByText(`Place ${period7.from}`);

    // Only what was asked after the click: the reseed's own request.
    const after = asked.slice(before);
    const feedCall = after.find((u) => u.startsWith("/api/admin/visits?"));
    expect(new URLSearchParams(feedCall?.split("?")[1]).get("since")).toBe("0");
    expect(bounds(feedCall)).toEqual([String(period7.from), String(period7.to - 1)]);
    expect(screen.getByText(copy.visits.count(1))).toBeTruthy();
    expect(screen.queryByText(copy.visits.arrived(1))).toBeNull();
  });

  it("shows the empty-feed copy and no pager for an empty window", async () => {
    stubFetch({ visits: () => json({ visits: [], serverTime: 0 }) });
    renderScreen();
    expect(await screen.findByText(copy.visits.empty)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: copy.visits.pager.nav })).toBeNull();
  });

  it("pages 60 held visits 25 at a time, Précédent/Suivant disabled at the edges", async () => {
    const visits = Array.from({ length: 60 }, (_, i) => visit(String(i), i + 1));
    stubFetch({ visits: () => json({ visits, serverTime: 61 }) });
    renderScreen();

    await screen.findByText(copy.visits.count(60));
    const list = () => screen.getAllByText(/^Place \d+$/);
    expect(list()).toHaveLength(25);

    const previous = screen.getByRole("button", { name: copy.visits.pager.previous });
    const next = screen.getByRole("button", { name: copy.visits.pager.next });
    expect((previous as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(3) }));
    expect(list()).toHaveLength(10);
    expect((next as HTMLButtonElement).disabled).toBe(true);

    await userEvent.click(previous);
    expect(list()).toHaveLength(25);
  });

  it("returns to page 1 when the period changes", async () => {
    const period7 = brusselsPeriod(NOW, 7);
    stubFetch({
      visits: (url) => {
        const isSeven = url.searchParams.get("from") === String(period7.from);
        const rows = Array.from({ length: isSeven ? 30 : 60 }, (_, i) =>
          visit(`${isSeven ? "s" : "t"}${i}`, i + 1),
        );
        return json({ visits: rows, serverTime: 61 });
      },
    });
    renderScreen();
    await screen.findByText(copy.visits.count(60));

    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(2) }));

    await userEvent.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/visites?period=7"),
    );
    await screen.findByText(copy.visits.count(30));

    expect(
      screen
        .getByRole("button", { name: copy.visits.pager.pageLabel(1) })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("reads the count as capped at the feed's own cap (I/O matrix)", async () => {
    const visits = Array.from({ length: ADMIN_VISITS_PAGE_SIZE }, (_, i) =>
      visit(String(i), i + 1),
    );
    stubFetch({ visits: () => json({ visits, serverTime: ADMIN_VISITS_PAGE_SIZE + 1 }) });
    renderScreen();
    expect(await screen.findByText(copy.visits.countCapped(ADMIN_VISITS_PAGE_SIZE))).toBeTruthy();
  });

  it("shows each strip card's figure and link target", async () => {
    stubFetch({});
    renderScreen();

    const cardFor = (label: string) => screen.getByText(label).closest<HTMLElement>("a, div");
    await screen.findByText(copy.visits.strip.flyersGiven);

    expect(screen.getByText("12")).toBeTruthy(); // followUpsDueSoon
    expect(screen.getByText("84")).toBeTruthy(); // flyersGiven
    expect(screen.getByText("2")).toBeTruthy(); // agentsActiveToday

    const followUpsLink = cardFor(copy.visits.strip.followUpsDueSoon)?.closest("a");
    expect(followUpsLink?.getAttribute("href")).toBe(
      "/admin/prospects?status=follow_up&dueBefore=1700000000000",
    );
    const rateLink = cardFor(copy.dashboard.conversionRate)?.closest("a");
    expect(rateLink?.getAttribute("href")).toBe("/admin/prospects?status=converted");

    // Plain cards, not links.
    expect(cardFor(copy.visits.strip.flyersGiven)?.closest("a")).toBeNull();
    expect(cardFor(copy.visits.strip.agentsActiveToday)?.closest("a")).toBeNull();
  });

  it("shows the strip's load-failed Alert with a retry, leaving the ledger unaffected", async () => {
    let dashboardCalls = 0;
    stubFetch({
      dashboard: () => {
        dashboardCalls += 1;
        return dashboardCalls === 1 ? json({}, 500) : json(dashboardAnswer(30));
      },
      visits: () => json({ visits: [visit("a", 1)], serverTime: 2 }),
    });
    renderScreen();

    expect(await screen.findByText(copy.visits.strip.loadFailed)).toBeTruthy();
    expect(screen.getByText("Place a")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: copy.errors.retry }));
    await waitFor(() => expect(screen.getByText("84")).toBeTruthy());
  });

  it("shows 6–8 ledger-row skeletons, not a text line, before the first answer (#207)", async () => {
    stubFetch({ visits: () => new Promise<Response>(() => {}) });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    const rows = document.querySelectorAll('[aria-busy="true"] li [data-slot="skeleton"]');
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.length).toBeLessThanOrEqual(8);
    expect(screen.getByText(copy.visits.loading).className).toContain("sr-only");
  });

  it("shows the ledger's load-failed Alert and refetches on « Réessayer », with no empty copy (#208)", async () => {
    let fail = true;
    stubFetch({
      visits: () => (fail ? json({}, 500) : json({ visits: [visit("a", 1)], serverTime: 2 })),
    });
    renderScreen();

    const title = await screen.findByText(copy.visits.loadFailed);
    const alert = title.closest('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(screen.queryByText(copy.visits.empty)).toBeNull();

    fail = false;
    await userEvent.click(
      within(alert as HTMLElement).getByRole("button", { name: copy.errors.retry }),
    );
    expect(await screen.findByText("Place a")).toBeTruthy();
    expect(screen.queryByText(copy.visits.loadFailed)).toBeNull();
  });

  it("keeps held rows under loadFailed when a later poll fails", async () => {
    let fail = false;
    stubFetch({
      visits: () => (fail ? json({}, 500) : json({ visits: [visit("a", 1)], serverTime: 2 })),
    });
    const client = renderScreen();
    await screen.findByText("Place a");

    fail = true;
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    expect(await screen.findByText(copy.visits.loadFailed)).toBeTruthy();
    expect(screen.getByText("Place a")).toBeTruthy();
  });

  it("stays on page 2 when a visit arrives, and announces it once (I/O matrix)", async () => {
    let visits = Array.from({ length: 60 }, (_, i) => visit(String(i), i + 1));
    stubFetch({ visits: () => json({ visits, serverTime: 61 }) });
    const client = renderScreen();
    await screen.findByText(copy.visits.count(60));

    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(2) }));
    visits = [visit("new", 100)];
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    await screen.findByText(copy.visits.count(61));
    expect(
      screen
        .getByRole("button", { name: copy.visits.pager.pageLabel(2) })
        .getAttribute("aria-current"),
    ).toBe("page");
    expect(screen.getByText(copy.visits.arrived(1))).toBeTruthy();
  });

  it("re-announces the live region on each poll, even with unchanged text (#160)", async () => {
    let visits = [visit("a", 1)];
    stubFetch({ visits: () => json({ visits, serverTime: 2 }) });
    const client = renderScreen();
    await screen.findByText("Place a");
    const before = document.querySelector('[aria-live="polite"]');
    expect(before).not.toBeNull();

    visits = [visit("a", 1), visit("b", 3)];
    // The pinned clock must move between polls, or `dataUpdatedAt` — the
    // live-region's own key — lands on the same millisecond twice.
    vi.setSystemTime(NOW + 1);
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });
    await screen.findByText("Place b");

    const after = document.querySelector('[aria-live="polite"]');
    expect(after).not.toBeNull();
    expect(after).not.toBe(before);
  });

  it("keeps transition-colors on a row that is not newly arrived (#162)", async () => {
    stubFetch({ visits: () => json({ visits: [visit("a", 1)], serverTime: 2 }) });
    renderScreen();
    const row = (await screen.findByText("Place a")).closest("li");
    expect(row?.className).toContain("transition-colors");
    expect(row?.className).not.toContain("bg-accent");
  });

  it("exports the window's CSV under its own filename, and warns when the server truncated it", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:visites");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const asked = stubFetch({
      exportCsv: () =>
        new Response("received_at\n", {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="visites-2026-09-27.csv"',
            "x-truncated": "true",
          },
        }),
    });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));

    expect(await screen.findByText(copy.visits.export.truncated(EXPORT_ROWS))).toBeTruthy();
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("visites-2026-09-27.csv");

    const exportCall = asked.find((u) => u.startsWith("/api/admin/visits/export.csv?"));
    const feedCall = asked.find((u) => u.startsWith("/api/admin/visits?"));
    // The export asks for the same window the feed shows.
    expect(bounds(exportCall)).toEqual(bounds(feedCall));
  });

  it("warns that the session expired when the export's request is redirected (401)", async () => {
    stubFetch({ exportCsv: () => json({}, 401) });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));

    expect(await screen.findByText(copy.errors.sessionExpired)).toBeTruthy();
  });

  it("warns that the export failed on a server error", async () => {
    stubFetch({ exportCsv: () => json({}, 500) });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));

    expect(await screen.findByText(copy.visits.export.failed)).toBeTruthy();
  });
});

describe("VisitsScreen › live feed rows (#185)", () => {
  it("quotes a visit's notes on a second line, and a visit without notes has none", async () => {
    stubFetch({
      visits: () =>
        json({
          visits: [{ ...visit("a", 2), notes: "Rappeler lundi" }, visit("b", 1)],
          serverTime: 3,
        }),
    });
    renderScreen();

    const quoted = await screen.findByText("« Rappeler lundi »");
    const row = quoted.closest("li");
    expect(row?.textContent).toContain("Place a");
    // Its own line: a direct child of the row, outside the first line that
    // holds the name.
    expect(quoted.parentElement).toBe(row);
    expect(screen.getByText("Place a").parentElement?.contains(quoted)).toBe(false);
    expect(screen.getByText("Place b").closest("li")?.textContent).not.toContain("«");
  });

  it("shows a visit to a merged prospect under the name it was made against", async () => {
    const survivor = "11111111-1111-4111-8111-111111111111";
    stubFetch({
      visits: () =>
        json({
          visits: [
            { ...visit("new", 2), prospectId: survivor, prospectName: "Le Bouchon des Filles" },
            { ...visit("old", 1), prospectId: survivor, prospectName: "Le Bouchon" },
          ],
          serverTime: 3,
        }),
    });
    renderScreen();

    expect(await screen.findByText("Le Bouchon")).toBeTruthy();
    expect(screen.getByText("Le Bouchon des Filles")).toBeTruthy();
  });

  it("announces an arrival in the live region, never as a toast", async () => {
    let visits = [visit("a", 1)];
    stubFetch({ visits: () => json({ visits, serverTime: 2 }) });
    const client = renderScreen();
    await screen.findByText("Place a");

    visits = [visit("a", 1), visit("b", 3)];
    vi.setSystemTime(NOW + 1);
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    const announced = await screen.findByText(copy.visits.arrived(1));
    expect(announced.closest('[aria-live="polite"]')).toBe(announced);
    await screen.findByText("Place b");
    const toasts = Array.from(document.querySelectorAll("[data-sonner-toast]"));
    expect(toasts.filter((t) => t.textContent?.includes(copy.visits.arrived(1)))).toHaveLength(0);
    expect(toasts.filter((t) => t.textContent?.includes("Place b"))).toHaveLength(0);
  });
});

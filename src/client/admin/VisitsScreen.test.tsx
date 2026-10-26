/**
 * Visites rebuilt (GH #178): the period selector drives both the feed and the
 * strip, the pager, the four strip figures and each card's link, and the
 * empty-feed copy — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-178-visites-rebuilt.md.
 */
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router";
import { ADMIN_VISITS_PAGE_SIZE, EXPORT_ROWS } from "../../shared/constants";
import { brusselsPeriod } from "../../shared/period";
import type { AdminDoorDay, AdminDoorDayVisit, DashboardResponse } from "../../shared/schemas";
import { OUTCOME_LABELS, REFUSAL_REASON_LABELS, copy } from "../copy";
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

/** What `redirect: "manual"` makes of any redirect. */
function opaqueRedirect(): Response {
  const response = new Response(null, { status: 200 });
  Object.defineProperty(response, "type", { value: "opaqueredirect" });
  return response;
}

/**
 * `useVisitsFeed` trims held rows to the scoped window's own `from` (a period
 * boundary near `NOW`), so a fixture's `receivedAt` has to land inside it —
 * a handful of milliseconds apart is enough to keep every test's relative
 * ordering while staying well within even a 7-day window.
 */
const at = (offset: number) => NOW - 10_000_000 + offset;

/** One visit of a door-day, `offset` placing it as `doorDay`'s rows are placed. */
function dayVisit(
  id: string,
  offset: number,
  over: Partial<AdminDoorDayVisit> = {},
): AdminDoorDayVisit {
  return {
    id,
    visitedAt: at(offset),
    receivedAt: at(offset),
    outcome: "interested",
    refusalReason: null,
    flyerGiven: false,
    followUpAt: null,
    notes: null,
    answerCount: 0,
    ...over,
  };
}

/**
 * A door-day row keyed `id`. Its one visit mirrors the row unless `visits` is
 * given, in which case the row reads its latest (the last).
 */
function doorDay(id: string, receivedAt: number, over: Partial<AdminDoorDay> = {}): AdminDoorDay {
  const row: AdminDoorDay = {
    key: id,
    prospectId: "00000000-0000-4000-8000-000000000000",
    prospectName: `Place ${id}`,
    agentEmail: "agent@example.com",
    dayStart: 0,
    visitedAt: at(receivedAt),
    receivedAt: at(receivedAt),
    flyerGiven: false,
    outcome: "interested",
    followUpAt: null,
    notes: null,
    refusalReason: null,
    listedAt: 0,
    visits: [],
    ...over,
  };
  // The feed clock is the arrival unless a test says a repair moved it.
  row.listedAt = over.listedAt ?? row.receivedAt;
  if (row.visits.length === 0) {
    row.visits = [
      dayVisit(`${id}-1`, receivedAt, {
        outcome: row.outcome,
        refusalReason: row.refusalReason,
        flyerGiven: row.flyerGiven,
        notes: row.notes,
      }),
    ];
  }
  return row;
}

/**
 * The feed's answer: door-days, newest first as the server sends them. `nextSince`
 * is the server's position (a rowid there); unless a test sets it, a stand-in that
 * moves with the rows.
 */
function feedAnswer(
  doorDays: AdminDoorDay[],
  serverTime: number,
  truncated = false,
  nextSince = Math.max(0, ...doorDays.map((d) => d.listedAt)),
): Response {
  return json({ doorDays, truncated, nextSince, serverTime });
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
    inactiveAgentProspects: 0,
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
        return (visits ?? (() => feedAnswer([], 0)))(url);
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

function renderScreen(initialPath = "/admin/visits") {
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
  // Sonner keeps its toasts across tests; a leftover one doubles the next match.
  toast.dismiss();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("VisitsScreen", () => {
  it("defaults to 30 jours: the feed asks for exactly brusselsPeriod(now, 30)", async () => {
    const asked = stubFetch({ visits: () => feedAnswer([doorDay("a", 1)], 2) });
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
    renderScreen("/admin/visits?period=12");
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
      visits: (url) => feedAnswer([doorDay(url.searchParams.get("from") ?? "x", 1)], 2),
    });
    renderScreen();
    const period30 = brusselsPeriod(NOW, 30);
    await screen.findByText(`Place ${period30.from}`);
    const before = asked.length;

    await userEvent.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/visits?period=7"),
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
    stubFetch({ visits: () => feedAnswer([], 0) });
    renderScreen();
    expect(await screen.findByText(copy.visits.empty)).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: copy.visits.pager.nav })).toBeNull();
  });

  it("pages 60 held door-days 25 at a time, Précédent/Suivant disabled at the edges", async () => {
    const visits = Array.from({ length: 60 }, (_, i) => doorDay(String(i), i + 1));
    stubFetch({ visits: () => feedAnswer(visits, 61) });
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
          doorDay(`${isSeven ? "s" : "t"}${i}`, i + 1),
        );
        return feedAnswer(rows, 61);
      },
    });
    renderScreen();
    await screen.findByText(copy.visits.count(60));

    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(2) }));

    await userEvent.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/visits?period=7"),
    );
    await screen.findByText(copy.visits.count(30));

    expect(
      screen
        .getByRole("button", { name: copy.visits.pager.pageLabel(1) })
        .getAttribute("aria-current"),
    ).toBe("page");
  });

  it("reads the count as capped when the server cut the window, however few rows (I/O matrix)", async () => {
    // 500 visits can be fewer door-days: `truncated` decides, never the length.
    const rows = Array.from({ length: 320 }, (_, i) => doorDay(String(i), i + 1));
    stubFetch({ visits: () => feedAnswer(rows, 321, true) });
    renderScreen();
    expect(await screen.findByText(copy.visits.countCapped(320))).toBeTruthy();
  });

  it("reads 500 door-days as exact when the server did not cut the window", async () => {
    const rows = Array.from({ length: ADMIN_VISITS_PAGE_SIZE }, (_, i) =>
      doorDay(String(i), i + 1),
    );
    stubFetch({ visits: () => feedAnswer(rows, ADMIN_VISITS_PAGE_SIZE + 1, false) });
    renderScreen();
    expect(await screen.findByText(copy.visits.count(ADMIN_VISITS_PAGE_SIZE))).toBeTruthy();
    expect(screen.queryByText(copy.visits.countCapped(ADMIN_VISITS_PAGE_SIZE))).toBeNull();
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
      visits: () => feedAnswer([doorDay("a", 1)], 2),
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
      visits: () => (fail ? json({}, 500) : feedAnswer([doorDay("a", 1)], 2)),
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
      visits: () => (fail ? json({}, 500) : feedAnswer([doorDay("a", 1)], 2)),
    });
    const client = renderScreen();
    await screen.findByText("Place a");

    fail = true;
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    expect(await screen.findByText(copy.visits.loadFailed)).toBeTruthy();
    expect(screen.getByText("Place a")).toBeTruthy();
  });

  it("stays on page 2 when a door-day arrives, and announces it once (I/O matrix)", async () => {
    let visits = Array.from({ length: 60 }, (_, i) => doorDay(String(i), i + 1));
    stubFetch({ visits: () => feedAnswer(visits, 61) });
    const client = renderScreen();
    await screen.findByText(copy.visits.count(60));

    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(2) }));
    visits = [doorDay("new", 100)];
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
    let visits = [doorDay("a", 1)];
    stubFetch({ visits: () => feedAnswer(visits, 2) });
    const client = renderScreen();
    await screen.findByText("Place a");
    const before = document.querySelector('[aria-live="polite"]');
    expect(before).not.toBeNull();

    visits = [doorDay("a", 1), doorDay("b", 3)];
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
    stubFetch({ visits: () => feedAnswer([doorDay("a", 1)], 2) });
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
    expect(new URLSearchParams(exportCall?.split("?")[1]).get("reason")).toBeNull();
  });

  it("opens /login when the Worker answers the export 401 (GH #309)", async () => {
    stubFetch({ exportCsv: () => json({}, 401) });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));

    await waitFor(() => expect(screen.getByTestId("location").textContent).toBe("/login"));
    expect(screen.queryByText(copy.errors.sessionExpired)).toBeNull();
  });

  it("warns that the export failed when a redirect answers it", async () => {
    stubFetch({ exportCsv: opaqueRedirect });
    renderScreen();
    await screen.findByText(copy.visits.strip.flyersGiven);

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));

    expect(await screen.findByText(copy.visits.export.failed)).toBeTruthy();
    expect(screen.queryByText(copy.errors.sessionExpired)).toBeNull();
    expect(screen.getByTestId("location").textContent).not.toBe("/login");
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
  it("quotes a row's notes on a second line, and a row without notes has none", async () => {
    stubFetch({
      visits: () =>
        feedAnswer([{ ...doorDay("a", 2), notes: "Rappeler lundi" }, doorDay("b", 1)], 3),
    });
    renderScreen();

    const quoted = await screen.findByText("« Rappeler lundi »");
    const row = quoted.closest("li");
    expect(row?.textContent).toContain("Place a");
    // Its own line: a direct child of the row's button, outside the first line
    // that holds the name.
    expect(quoted.parentElement?.tagName).toBe("BUTTON");
    expect(quoted.parentElement?.closest("li")).toBe(row);
    expect(screen.getByText("Place a").parentElement?.contains(quoted)).toBe(false);
    expect(screen.getByText("Place b").closest("li")?.textContent).not.toContain("«");
  });

  it("shows a door-day of a merged prospect under the name it was made against", async () => {
    const survivor = "11111111-1111-4111-8111-111111111111";
    stubFetch({
      visits: () =>
        feedAnswer(
          [
            { ...doorDay("new", 2), prospectId: survivor, prospectName: "Le Bouchon des Filles" },
            { ...doorDay("old", 1), prospectId: survivor, prospectName: "Le Bouchon" },
          ],
          3,
        ),
    });
    renderScreen();

    expect(await screen.findByText("Le Bouchon")).toBeTruthy();
    expect(screen.getByText("Le Bouchon des Filles")).toBeTruthy();
  });

  it("announces an arrival in the live region, never as a toast", async () => {
    let visits = [doorDay("a", 1)];
    stubFetch({ visits: () => feedAnswer(visits, 2) });
    const client = renderScreen();
    await screen.findByText("Place a");

    visits = [doorDay("a", 1), doorDay("b", 3)];
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

describe("VisitsScreen › refusal reasons (GH #249)", () => {
  const reasonSelect = () => screen.getByRole("combobox", { name: copy.visits.reasonFilter.label });
  const param = (url: string | undefined, name: string) =>
    new URLSearchParams(url?.split("?")[1]).get(name);

  /** Answers by `reason=`, so a narrowed ledger proves the request carried it. */
  function byReason(url: URL): Response {
    const reason = url.searchParams.get("reason");
    const all = [
      doorDay("a", 3, { outcome: "not_interested", refusalReason: "no_need" }),
      doorDay("b", 2, { outcome: "not_interested", refusalReason: "fee_distrust" }),
      doorDay("c", 1, { outcome: "converted" }),
    ];
    const visits = reason === null ? all : all.filter((v) => v.refusalReason === reason);
    return feedAnswer(visits, 4);
  }

  it("shows the reason's label beside Pas intéressé, and nothing on a row without one", async () => {
    stubFetch({
      visits: () =>
        feedAnswer(
          [
            doorDay("a", 2, { outcome: "not_interested", refusalReason: "too_many_devices" }),
            doorDay("b", 1, { outcome: "not_interested" }),
          ],
          3,
        ),
    });
    renderScreen();

    const withReason = (await screen.findByText("Place a")).closest("li");
    expect(within(withReason as HTMLElement).getByText(OUTCOME_LABELS.not_interested)).toBeTruthy();
    expect(
      within(withReason as HTMLElement).getByText(REFUSAL_REASON_LABELS.too_many_devices),
    ).toBeTruthy();

    const without = screen.getByText("Place b").closest("li");
    for (const label of Object.values(REFUSAL_REASON_LABELS)) {
      expect(without?.textContent).not.toContain(label);
    }
  });

  it("puts the chosen reason in the URL and reseeds a narrowed feed from since=0", async () => {
    const asked = stubFetch({ visits: byReason });
    const client = renderScreen("/admin/visits?period=7");
    await screen.findByText("Place c");
    const before = asked.length;

    const user = userEvent.setup();
    await user.click(reasonSelect());
    await user.click(await screen.findByRole("option", { name: REFUSAL_REASON_LABELS.no_need }));

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe(
        "/admin/visits?period=7&reason=no_need",
      ),
    );
    await waitFor(() => expect(screen.queryByText("Place c")).toBeNull());
    expect(screen.getByText("Place a")).toBeTruthy();
    expect(screen.queryByText("Place b")).toBeNull();
    expect(screen.queryByText(copy.visits.arrived(1))).toBeNull();

    const reseed = asked.slice(before).find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(reseed, "since")).toBe("0");
    expect(param(reseed, "reason")).toBe("no_need");
    const period7 = brusselsPeriod(NOW, 7);
    expect(bounds(reseed)).toEqual([String(period7.from), String(period7.to - 1)]);

    // A later poll keeps asking for the same reason.
    const beforePoll = asked.length;
    vi.setSystemTime(NOW + 1);
    // `active`: the unfiltered entry left behind by the remount is inactive.
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed(), type: "active" });
    const poll = asked.slice(beforePoll).find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(poll, "since")).not.toBe("0");
    expect(param(poll, "reason")).toBe("no_need");
  });

  it("polls from the server's nextSince, though its page held no door-day (GH #636)", async () => {
    // A reason= read whose every visit was a door-day the filter dropped: no row,
    // yet the cursor must move or the next poll asks for the same page for ever.
    const asked = stubFetch({ visits: () => feedAnswer([], 4, false, 42) });
    const client = renderScreen("/admin/visits?period=7&reason=no_need");
    await screen.findByText(copy.visits.reasonFilter.empty);

    const beforePoll = asked.length;
    vi.setSystemTime(NOW + 1);
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed(), type: "active" });
    const poll = asked.slice(beforePoll).find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(poll, "since")).toBe("42");
  });

  it("drops ?reason= from the URL when Toutes les raisons is chosen", async () => {
    stubFetch({ visits: byReason });
    renderScreen("/admin/visits?period=7&reason=no_need");
    await screen.findByText("Place a");

    const user = userEvent.setup();
    await user.click(reasonSelect());
    await user.click(await screen.findByRole("option", { name: copy.visits.reasonFilter.any }));

    await waitFor(() =>
      expect(screen.getByTestId("location").textContent).toBe("/admin/visits?period=7"),
    );
    expect(await screen.findByText("Place c")).toBeTruthy();
  });

  it("reads ?period=7&reason=no_need back: the select shows the reason, the period stays 7", async () => {
    stubFetch({ visits: byReason });
    renderScreen("/admin/visits?period=7&reason=no_need");
    await screen.findByText("Place a");

    expect(reasonSelect().textContent).toBe(REFUSAL_REASON_LABELS.no_need);
    expect(
      screen.getByRole("radio", { name: copy.dashboard.periods[7] }).getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("says no visit matches the reason, not that none arrived, when the filter is empty", async () => {
    const asked = stubFetch({});
    renderScreen("/admin/visits?reason=wait_and_see");
    await screen.findByText(copy.visits.reasonFilter.empty);
    expect(screen.queryByText(copy.visits.empty)).toBeNull();

    expect(reasonSelect().textContent).toBe(REFUSAL_REASON_LABELS.wait_and_see);
    const feedCall = asked.find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(feedCall, "reason")).toBe("wait_and_see");
  });

  it("treats a bad ?reason= as Toutes les raisons, and the feed asks without one", async () => {
    const asked = stubFetch({ visits: byReason });
    renderScreen("/admin/visits?reason=bogus");
    await screen.findByText("Place c");

    expect(reasonSelect().textContent).toBe(copy.visits.reasonFilter.any);
    const feedCall = asked.find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(feedCall, "reason")).toBeNull();
  });

  it("exports with the same reason and bounds the feed asks with", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:visites");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const asked = stubFetch({
      visits: byReason,
      exportCsv: () =>
        new Response("received_at\n", {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="visites-2026-09-27.csv"',
          },
        }),
    });
    renderScreen("/admin/visits?period=7&reason=fee_distrust");
    await screen.findByText("Place b");

    await userEvent.click(screen.getByRole("button", { name: copy.visits.export.button }));
    await waitFor(() => expect(click).toHaveBeenCalledTimes(1));

    const exportCall = asked.find((u) => u.startsWith("/api/admin/visits/export.csv?"));
    const feedCall = asked.find((u) => u.startsWith("/api/admin/visits?"));
    expect(param(exportCall, "reason")).toBe("fee_distrust");
    expect(bounds(exportCall)).toEqual(bounds(feedCall));
  });
});

describe("VisitsScreen › door-day rows (ADR-0036 R13)", () => {
  /** A correction: Personne sur place, then Converti, one row. */
  function corrected(over: Partial<AdminDoorDay> = {}): AdminDoorDay {
    return doorDay("roma", 5, {
      prospectName: "Pizza Roma",
      outcome: "converted",
      flyerGiven: true,
      visits: [
        dayVisit("v1", 1, { outcome: "no_contact", notes: "Fermé, repasser" }),
        dayVisit("v2", 5, { outcome: "converted", flyerGiven: true, answerCount: 4 }),
      ],
      ...over,
    });
  }

  const opener = (name: string) => screen.getByRole("button", { name: new RegExp(`^${name},`) });

  it("shows a two-visit door-day as one row with « 2 visites », closed", async () => {
    stubFetch({ visits: () => feedAnswer([corrected(), doorDay("b", 1)], 6) });
    renderScreen();
    await screen.findByText("Pizza Roma");

    const button = opener("Pizza Roma");
    expect(button.getAttribute("aria-label")).toBe(
      copy.visits.openRow("Pizza Roma", OUTCOME_LABELS.converted, 2),
    );
    expect(within(button).getByText(copy.visits.visitCount(2))).toBeTruthy();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(copy.visits.history)).toBeNull();
    // One visit: no count on the row, and its name says none.
    expect(within(opener("Place b")).queryByText(/visites$/)).toBeNull();
    expect(opener("Place b").getAttribute("aria-label")).toBe(
      copy.visits.openRow("Place b", OUTCOME_LABELS.interested, 1),
    );
  });

  it("opens in place onto every visit, oldest first, with what each carried", async () => {
    stubFetch({ visits: () => feedAnswer([corrected()], 6) });
    renderScreen();
    await screen.findByText("Pizza Roma");

    const button = opener("Pizza Roma");
    await userEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText(copy.visits.history)).toBeTruthy();

    const lines = within(panel as HTMLElement).getAllByRole("listitem");
    expect(lines.map((line) => line.textContent)).toEqual([
      expect.stringContaining(OUTCOME_LABELS.no_contact),
      expect.stringContaining(OUTCOME_LABELS.converted),
    ]);
    expect(lines[0]?.textContent).toContain("« Fermé, repasser »");
    expect(lines[0]?.textContent).not.toContain(copy.visits.flyer);
    expect(lines[1]?.textContent).toContain(copy.visits.flyer);
    expect(lines[1]?.textContent).toContain(copy.visits.answers(4));
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(copy.visits.history)).toBeNull();
  });

  it("shows each history line's own refusal reason", async () => {
    const row = doorDay("roma", 5, {
      prospectName: "Pizza Roma",
      outcome: "converted",
      visits: [
        dayVisit("v1", 1, { outcome: "not_interested", refusalReason: "no_need" }),
        dayVisit("v2", 5, { outcome: "converted" }),
      ],
    });
    stubFetch({ visits: () => feedAnswer([row], 6) });
    renderScreen();
    await screen.findByText("Pizza Roma");

    const button = opener("Pizza Roma");
    await userEvent.click(button);
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    const lines = within(panel as HTMLElement).getAllByRole("listitem");
    expect(lines[0]?.textContent).toContain(REFUSAL_REASON_LABELS.no_need);
    expect(lines[1]?.textContent).not.toContain(REFUSAL_REASON_LABELS.no_need);
  });

  it("keeps at most one row open", async () => {
    stubFetch({ visits: () => feedAnswer([corrected(), doorDay("b", 1)], 6) });
    renderScreen();
    await screen.findByText("Pizza Roma");

    await userEvent.click(opener("Pizza Roma"));
    await userEvent.click(opener("Place b"));
    expect(opener("Pizza Roma").getAttribute("aria-expanded")).toBe("false");
    expect(opener("Place b").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getAllByText(copy.visits.history)).toHaveLength(1);
  });

  it("keeps the open row open across a poll and adds the arriving visit to its history", async () => {
    let rows = [
      corrected({
        receivedAt: at(2),
        outcome: "no_contact",
        visits: [dayVisit("v1", 1, { outcome: "no_contact" })],
      }),
      doorDay("b", 3),
    ];
    stubFetch({ visits: () => feedAnswer(rows, 4) });
    const client = renderScreen();
    await screen.findByText("Pizza Roma");
    expect(screen.getAllByRole("button", { name: /Voir les visites$/ })[1]).toBe(
      opener("Pizza Roma"),
    );
    await userEvent.click(opener("Pizza Roma"));

    rows = [corrected({ receivedAt: at(9) })];
    vi.setSystemTime(NOW + 1);
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    const button = opener("Pizza Roma");
    await waitFor(() => expect(within(button).getByText(copy.visits.visitCount(2))).toBeTruthy());
    expect(button.getAttribute("aria-expanded")).toBe("true");
    const panel = document.getElementById(button.getAttribute("aria-controls") ?? "");
    expect(within(panel as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
    // Replaced, moved to the top, washed and announced once: still one row.
    expect(screen.getAllByText("Pizza Roma")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Voir les visites$/ })[0]).toBe(button);
    expect(button.closest("li")?.className).toContain("bg-accent");
    expect(screen.getByText(copy.visits.arrived(1))).toBeTruthy();
  });

  it("closes the open row on a page change", async () => {
    const rows = Array.from({ length: 30 }, (_, i) => doorDay(String(i), 30 - i));
    stubFetch({ visits: () => feedAnswer(rows, 31) });
    renderScreen();
    await screen.findByText(copy.visits.count(30));

    await userEvent.click(opener("Place 0"));
    expect(screen.getByText(copy.visits.history)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(2) }));
    await userEvent.click(screen.getByRole("button", { name: copy.visits.pager.pageLabel(1) }));
    expect(opener("Place 0").getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText(copy.visits.history)).toBeNull();
  });
});

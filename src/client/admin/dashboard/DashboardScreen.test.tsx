/**
 * Tableau de bord's states — GH #107, #109, #110, #111: skeletons, the four
 * cards and their bottom rows, the chart's text equivalent, the period
 * selector and the load-failed alert. Rendered on its own with a fresh client
 * per test, so no answer leaks between them.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { OUTCOME_LABELS, copy } from "../../copy";
import type { AdminVisit, DashboardResponse } from "../../../shared/schemas";
import { adminKeys } from "../queries";
import { createAdminQueryClient } from "../query-client";
import { DashboardScreen } from "./DashboardScreen";

/** `period` days from 1 September 2026, a Tuesday: 1 no_contact and 2 converted on the first, zeros after. */
function days(period: number): DashboardResponse["visitsByDay"] {
  return Array.from({ length: period }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10),
    counts: {
      no_contact: i === 0 ? 1 : 0,
      interested: 0,
      not_interested: 0,
      follow_up: 0,
      converted: i === 0 ? 2 : 0,
    },
  }));
}

function answer(
  period: number,
  over: Partial<DashboardResponse["visits"]> = {},
  rate: Partial<DashboardResponse["conversionRate"]> = {},
): DashboardResponse {
  const visits = {
    value: period * 10,
    previous: period * 8,
    delta: 0.25,
    byDay: Array.from({ length: period }, () => 10),
    ...over,
  };
  return {
    period: period as DashboardResponse["period"],
    from: 0,
    to: 1,
    visits,
    openProspects: 1284,
    openProspectsByStatus: { new: 1000, assigned: 1, follow_up: 283 },
    converted: {
      value: period + 2,
      previous: period,
      delta: 2 / period,
      byDay: Array.from({ length: period }, (_, i) => (i === 0 ? 2 : 1)),
    },
    conversionRate: {
      value: 0.106,
      previous: 0.094,
      delta: 0.012,
      visitedProspects: { value: period * 9, previous: period * 7 },
      ...rate,
    },
    visitsByDay: days(period),
    pipeline: { new: 1000, assigned: 1, follow_up: 283, converted: 50, rejected: 166 },
    agents: [
      {
        email: "lea@example.com",
        visits: period * 6,
        converted: 3,
        followUp: 28,
        openProspects: 70,
      },
      {
        email: "karim@example.com",
        visits: period * 4,
        converted: 2,
        followUp: 26,
        openProspects: 62,
      },
      // Idle: on the roster, nothing in the period.
      { email: "admin@example.com", visits: 0, converted: 0, followUp: 0, openProspects: 0 },
    ],
    followUpsDue: 6,
    flyersGiven: period * 3,
    agentsActiveToday: 2,
    followUpsDueSoon: { value: 8, dueBefore: 1 },
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** The other requests on the screen (GH #113), each answered by its own function. */
type Others = {
  feed?: () => Response;
  orphans?: () => Response;
  duplicates?: () => Response;
};

/**
 * Answers each period with `respond`, and records what was asked of the
 * dashboard. The feed and the two queues are empty unless `others` says.
 */
function stubFetch(respond: (period: number) => Response | Promise<Response>, others: Others = {}) {
  // Both arguments, so toHaveBeenCalledWith sees what apiFetch passed.
  const fetchMock = vi.fn(async (...[input]: [RequestInfo | URL, RequestInit?]) => {
    const url = new URL(String(input), "http://localhost");
    return respond(Number(url.searchParams.get("period")));
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), "http://localhost").pathname;
      if (path === "/api/admin/visits")
        return (others.feed ?? (() => json({ visits: [], serverTime: 0 })))();
      if (path === "/api/admin/visits/orphaned")
        return (others.orphans ?? (() => json({ visits: [], remaining: 0 })))();
      if (path === "/api/admin/prospects/duplicates")
        return (others.duplicates ?? (() => json({ pairs: [], truncated: false })))();
      return fetchMock(input, init);
    }),
  );
  return fetchMock;
}

function renderScreen(prime?: (client: ReturnType<typeof createAdminQueryClient>) => void) {
  const client = createAdminQueryClient();
  // The factory's one retry waits a second; these tests do not need it.
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  prime?.(client);
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DashboardScreen />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return client;
}

/** The delta chip inside a card, Visites unless told otherwise. */
function chip(label: string = copy.dashboard.visits): HTMLElement {
  const element = card(label).querySelector<HTMLElement>("[data-slot=badge]");
  if (!element) throw new Error("no delta chip");
  return element;
}

/** The progress indicator's transform inside a card: where its percentage lands. */
function indicator(label: string): string | undefined {
  return card(label).querySelector<HTMLElement>("[data-slot=progress-indicator]")?.style.transform;
}

/** The card whose overline label is `label`. */
function card(label: string): HTMLElement {
  const heading = screen.getByRole("heading", { level: 3, name: label });
  const element = heading.closest<HTMLElement>("[data-slot=card]");
  if (!element) throw new Error(`no card around ${label}`);
  return element;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DashboardScreen", () => {
  it("shows skeletons, then the four cards for 30 jours by default", async () => {
    const fetchMock = stubFetch((period) => json(answer(period)));
    renderScreen();

    expect(screen.getByText(copy.dashboard.loading)).toBeTruthy();
    expect(await screen.findByText("300")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/dashboard?period=30", expect.anything());

    // formatCount groups with a narrow no-break space, which the default
    // normalizer folds to a space; textContent keeps the real one.
    const open = within(card(copy.dashboard.openProspects)).getByText("1 284");
    expect(open.textContent).toBe("1\u202f284");
    const visits = within(card(copy.dashboard.visits));
    // The default normalizer folds formatDelta's no-break space to a space.
    expect(visits.getByText("+25,0 %")).toBeTruthy();
    expect(visits.getByText(copy.dashboard.vsPrevious)).toBeTruthy();
    // A snapshot has no delta row.
    expect(
      within(card(copy.dashboard.openProspects)).queryByText(copy.dashboard.vsPrevious),
    ).toBeNull();
    expect(
      screen.getByRole("radio", { name: copy.dashboard.periods[30] }).getAttribute("aria-checked"),
    ).toBe("true");

    const converted = within(card(copy.dashboard.converted));
    expect(converted.getByText("32")).toBeTruthy();
    expect(converted.getByText("+6,7 %")).toBeTruthy();
    const rate = within(card(copy.dashboard.conversionRate));
    expect(rate.getByText("10,6 %")).toBeTruthy();
    // Points, not a relative change (docs/api.md › The dashboard).
    expect(rate.getByText("+1,2 pt")).toBeTruthy();
    expect(chip(copy.dashboard.conversionRate).dataset.variant).toBe("tint-success");
  });

  it("links three cards to their lists, named by label and figure (GH #114)", async () => {
    const user = userEvent.setup();
    stubFetch((period) => json(answer(period)));
    renderScreen();
    await screen.findByText("300");

    const link = (label: string, value: string) =>
      screen
        .getByRole("link", { name: copy.dashboard.openList(label, value) })
        .getAttribute("href");
    expect(link(copy.dashboard.openProspects, "1\u202f284")).toBe(
      "/admin/prospects?status=new%2Cassigned%2Cfollow_up",
    );
    expect(link(copy.dashboard.visits, "300")).toBe("/admin/visites?period=30");
    expect(link(copy.dashboard.converted, "32")).toBe("/admin/prospects?status=converted");
    // Taux de conversion has no list behind it.
    expect(card(copy.dashboard.conversionRate).closest("a")).toBeNull();

    // The Visites card's link follows the selector (GH #178).
    await user.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() => expect(link(copy.dashboard.visits, "70")).toBe("/admin/visites?period=7"));
  });

  it("lists the pipeline with each status's count and share (GH #112)", async () => {
    stubFetch((period) => json(answer(period)));
    renderScreen();

    const panel = within(await findCard(copy.dashboard.pipeline.title));
    // formatCount groups with a narrow no-break space; the normalizer folds it.
    expect(panel.getByText("1 500 prospects")).toBeTruthy();
    const rows = panel.getAllByRole("listitem").map((li) => li.textContent);
    expect(rows).toEqual([
      "Nouveau1\u202f00066,7\u00a0%",
      "Assigné10,1\u00a0%",
      "À relancer28318,9\u00a0%",
      "Converti503,3\u00a0%",
      "Refusé16611,1\u00a0%",
    ]);
  });

  it("shows 0 % and empty bars for an empty pipeline (I/O matrix, empty)", async () => {
    stubFetch((period) =>
      json({
        ...answer(period),
        pipeline: { new: 0, assigned: 0, follow_up: 0, converted: 0, rejected: 0 },
      }),
    );
    renderScreen();

    const element = await findCard(copy.dashboard.pipeline.title);
    const panel = within(element);
    expect(panel.getByText("0 prospect")).toBeTruthy();
    expect(panel.getAllByText("0,0 %")).toHaveLength(5);
    for (const fill of element.querySelectorAll<HTMLElement>("li [aria-hidden] > div")) {
      expect(fill.style.width).toBe("0%");
    }
  });

  it("lists Activité par agent, an idle agent with zeros (GH #112)", async () => {
    stubFetch((period) => json(answer(period)));
    renderScreen();

    const table = within(await findCard(copy.dashboard.agents.title)).getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(
      within(rows[0] as HTMLElement)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      copy.dashboard.agents.agent,
      copy.dashboard.agents.visits,
      copy.dashboard.agents.converted,
      copy.dashboard.agents.followUp,
      copy.dashboard.agents.openProspects,
    ]);
    const cells = (row: Element) => [
      within(row as HTMLElement).getByRole("rowheader").textContent,
      ...within(row as HTMLElement)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ];
    expect(cells(rows[1] as Element)).toEqual(["Llea@example.com", "180", "3", "28", "70"]);
    expect(cells(rows[3] as Element)).toEqual(["Aadmin@example.com", "0", "0", "0", "0"]);
  });

  it("says so when there is no agent", async () => {
    stubFetch((period) => json({ ...answer(period), agents: [] }));
    renderScreen();

    const panel = within(await findCard(copy.dashboard.agents.title));
    expect(panel.getByText(copy.dashboard.agents.empty)).toBeTruthy();
    expect(panel.queryByRole("table")).toBeNull();
  });

  it("gives Visites dans le temps a text equivalent, one row per day (GH #110)", async () => {
    const user = userEvent.setup();
    stubFetch((period) => json(answer(period)));
    renderScreen();

    // Recharts draws nothing at happy-dom's 0 width; the table is what a
    // screen reader gets, so it is what this reads.
    const table = await screen.findByRole("table", {
      name: copy.dashboard.visitsChart.tableCaption,
    });
    expect(table.closest(".sr-only")).not.toBeNull();
    const rows = within(table).getAllByRole("row");
    // The header row, then one per day of the period.
    expect(rows).toHaveLength(1 + 30);
    const header = within(rows[0] as HTMLElement)
      .getAllByRole("columnheader")
      .map((cell) => cell.textContent);
    expect(header).toEqual([
      copy.dashboard.visitsChart.day,
      "Personne sur place",
      "Intéressé",
      "Pas intéressé",
      "À relancer",
      "Converti",
      copy.dashboard.visitsChart.total,
    ]);
    const first = rows[1] as HTMLElement;
    expect(within(first).getByRole("rowheader").textContent).toBe("mardi 1 septembre");
    expect(
      within(first)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["1", "0", "0", "0", "2", "3"]);

    await user.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));
    await waitFor(() =>
      expect(
        within(
          screen.getByRole("table", { name: copy.dashboard.visitsChart.tableCaption }),
        ).getAllByRole("row"),
      ).toHaveLength(1 + 7),
    );
  });

  it("draws each card's bottom row: split, sparklines in the chip's tone, gold bar (GH #111)", async () => {
    stubFetch((period) =>
      json(
        answer(
          period,
          { delta: -0.08 },
          { value: 1.4, visitedProspects: { value: 5, previous: 1 } },
        ),
      ),
    );
    renderScreen();

    const open = within(await findCard(copy.dashboard.openProspects));
    expect(open.getByText("Nouveau · Assigné · À relancer")).toBeTruthy();
    expect(
      open.getByText("1 000 nouveaux, 1 assigné, 283 à relancer").closest(".sr-only"),
    ).not.toBeNull();
    const segments = card(copy.dashboard.openProspects).querySelectorAll(
      "[aria-hidden=true] > span[style]",
    );
    expect([...segments].map((s) => (s as HTMLElement).style.flexGrow)).toEqual([
      "1000",
      "1",
      "283",
    ]);

    // Recharts draws no SVG at happy-dom's 0 width, but the chart's scoped
    // style carries the line's colour: the chip's tone, not a fixed green.
    const style = (label: string) => card(label).querySelector("style")?.textContent ?? "";
    expect(style(copy.dashboard.visits)).toContain("--color-value: var(--destructive)");
    expect(style(copy.dashboard.converted)).toContain("--color-value: var(--success)");
    expect(
      card(copy.dashboard.visits).querySelector("[data-slot=chart]")?.getAttribute("aria-hidden"),
    ).toBe("true");

    // Not capped by the endpoint (manual conversions), so the bar is.
    const rate = within(card(copy.dashboard.conversionRate));
    expect(rate.getByText("32 convertis sur 5 prospects visités")).toBeTruthy();
    // The indicator's transform, not aria-valuenow: the vendored Progress
    // never forwards `value` to the Radix root (#147).
    expect(indicator(copy.dashboard.conversionRate)).toBe("translateX(-0%)");
  });

  it("keeps the rows' shape when nothing is open or visited (I/O matrix, open split zero and rate null)", async () => {
    stubFetch((period) =>
      json({
        ...answer(
          period,
          {},
          { value: null, delta: null, visitedProspects: { value: 0, previous: 0 } },
        ),
        openProspects: 0,
        openProspectsByStatus: { new: 0, assigned: 0, follow_up: 0 },
      }),
    );
    renderScreen();

    const rate = within(await findCard(copy.dashboard.conversionRate));
    expect(rate.getByText(copy.dashboard.kpiFooter.noneVisited)).toBeTruthy();
    expect(indicator(copy.dashboard.conversionRate)).toBe("translateX(-100%)");
    expect(
      within(card(copy.dashboard.openProspects)).getByText("0 nouveau, 0 assigné, 0 à relancer"),
    ).toBeTruthy();
    const track = card(copy.dashboard.openProspects).querySelector<HTMLElement>(
      ".bg-secondary.h-1\\.5",
    );
    expect(track?.children).toHaveLength(0);
  });

  it("shows « — » for a rate with nothing visited, and for its delta (I/O matrix, no visits)", async () => {
    stubFetch((period) =>
      json(
        answer(
          period,
          {},
          { value: null, delta: null, visitedProspects: { value: 0, previous: period } },
        ),
      ),
    );
    renderScreen();

    const rate = within(await findCard(copy.dashboard.conversionRate));
    await waitFor(() => expect(rate.getAllByText("—")).toHaveLength(2));
    expect(chip(copy.dashboard.conversionRate).dataset.variant).toBe("secondary");
  });

  it("shows a falling rate as a red chip in points (I/O matrix, rate delta)", async () => {
    stubFetch((period) => json(answer(period, {}, { value: 0.2, previous: 0.25, delta: -0.05 })));
    renderScreen();

    const rate = within(await findCard(copy.dashboard.conversionRate));
    expect(await rate.findByText("20,0 %")).toBeTruthy();
    expect(rate.getByText("\u22125,0 pt")).toBeTruthy();
    expect(chip(copy.dashboard.conversionRate).dataset.variant).toBe("tint-destructive");
  });

  it("changes Visites with the period while Prospects ouverts stays put", async () => {
    const user = userEvent.setup();
    stubFetch((period) => json(answer(period)));
    renderScreen();
    await screen.findByText("300");

    await user.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));

    expect(await within(card(copy.dashboard.visits)).findByText("70")).toBeTruthy();
    expect(within(card(copy.dashboard.openProspects)).getByText("1 284")).toBeTruthy();
  });

  it("keeps the period when the chosen one is pressed again", async () => {
    const user = userEvent.setup();
    stubFetch((period) => json(answer(period)));
    renderScreen();
    await screen.findByText("300");

    const thirty = screen.getByRole("radio", { name: copy.dashboard.periods[30] });
    await user.click(thirty);

    expect(thirty.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("300")).toBeTruthy();
  });

  it("shows a neutral « — » when there is no previous period (I/O matrix, previous empty)", async () => {
    stubFetch((period) => json(answer(period, { previous: 0, delta: null })));
    renderScreen();

    expect(await within(await findCard(copy.dashboard.visits)).findByText("—")).toBeTruthy();
  });

  it.each([
    [0.25, "tint-success", "lucide-arrow-up", "--success", "text-success"],
    [-0.03, "tint-destructive", "lucide-arrow-down", "--destructive", "text-destructive"],
    [null, "secondary", null, "--muted-foreground", "text-secondary-foreground"],
    // Rounds to 0,0 %: flat, like the chip.
    [0.0004, "secondary", null, "--muted-foreground", "text-secondary-foreground"],
  ] as const)(
    "colours a delta of %s as %s, sparkline included",
    async (delta, variant, arrow, line, ink) => {
      stubFetch((period) => json(answer(period, { delta })));
      renderScreen();
      await findCard(copy.dashboard.visits);

      await waitFor(() => expect(chip().dataset.variant).toBe(variant));
      const svg = chip().querySelector("svg");
      if (arrow === null) expect(svg).toBeNull();
      else expect(svg?.classList.contains(arrow)).toBe(true);
      // GH #136: the variant's own colour and the badge's size token must
      // both land in the merged className, proving cn() kept the pair
      // rather than the variant prop alone (which class merging can't break).
      expect(chip().className).toContain(ink);
      expect(chip().className).toContain("text-meta");
      // The sparkline takes the chip's tone (GH #111).
      expect(card(copy.dashboard.visits).querySelector("style")?.textContent).toContain(
        `--color-value: var(${line})`,
      );
    },
  );

  it("agrees the captions with small counts and formats large ones (GH #111)", async () => {
    stubFetch((period) =>
      json({
        ...answer(period, {}, { value: 0, visitedProspects: { value: 1, previous: 1 } }),
        converted: {
          value: 1,
          previous: 1,
          delta: 0,
          byDay: Array.from({ length: period }, () => 0),
        },
        openProspectsByStatus: { new: 1, assigned: 2, follow_up: 1284 },
      }),
    );
    renderScreen();

    // A rate of 0 with a visit is a caption, not "Aucun prospect visité".
    const rate = within(await findCard(copy.dashboard.conversionRate));
    expect(rate.getByText("1 converti sur 1 prospect visité")).toBeTruthy();
    // formatCount's narrow no-break space, as on the card's figure.
    const split = within(card(copy.dashboard.openProspects)).getByText(/à relancer$/, {
      selector: ".sr-only",
    });
    expect(split.textContent).toBe("1 nouveau, 2 assignés, 1\u202f284 à relancer");
  });

  it("keeps the last period's figures while the next one loads", async () => {
    const user = userEvent.setup();
    let release: (response: Response) => void = () => {};
    const held = new Promise<Response>((resolve) => {
      release = resolve;
    });
    stubFetch((period) => (period === 7 ? held : json(answer(period))));
    renderScreen();
    await screen.findByText("300");

    await user.click(screen.getByRole("radio", { name: copy.dashboard.periods[7] }));

    expect(screen.getByText("300")).toBeTruthy();
    // The card sits in its link (GH #114); the grid is the nearest busy region.
    const grid = card(copy.dashboard.visits).closest("[aria-busy]");
    expect(grid?.getAttribute("aria-busy")).toBe("true");
    // The screen's own region; Dernières visites has its own, polite one.
    const status = screen.getAllByRole("status").find((el) => !el.hasAttribute("aria-live"));
    expect(status?.textContent).toBe("");
    expect(document.querySelector("[data-slot=skeleton]")).toBeNull();

    release(json(answer(7)));
    expect(await within(card(copy.dashboard.visits)).findByText("70")).toBeTruthy();
  });

  it("keeps the figures under the Alert when a refetch fails", async () => {
    let fail = false;
    stubFetch((period) => (fail ? json({ error: "error" }, 500) : json(answer(period))));
    const client = renderScreen();
    await screen.findByText("300");

    fail = true;
    await client.refetchQueries();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(copy.dashboard.loadFailed);
    expect(screen.getByText("300")).toBeTruthy();
    expect(within(card(copy.dashboard.openProspects)).getByText("1 284")).toBeTruthy();
  });

  it("offers « Réessayer » when loading fails, and it refetches (I/O matrix, load fails)", async () => {
    const user = userEvent.setup();
    let fail = true;
    const fetchMock = stubFetch((period) =>
      fail ? json({ error: "error" }, 500) : json(answer(period)),
    );
    renderScreen();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(copy.dashboard.loadFailed);

    fail = false;
    await user.click(within(alert).getByRole("button", { name: copy.dashboard.retry }));

    expect(await screen.findByText("300")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

async function findCard(label: string): Promise<HTMLElement> {
  await screen.findByRole("heading", { level: 3, name: label });
  return card(label);
}

/** The À traiter row whose label is `label`. */
function todoRow(label: string): HTMLElement {
  const row = within(card(copy.dashboard.todo.title)).getByText(label).closest<HTMLElement>("li");
  if (!row) throw new Error(`no À traiter row ${label}`);
  return row;
}

function visit(n: number, over: Partial<AdminVisit> = {}): AdminVisit {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    prospectId: "11111111-1111-4111-8111-111111111111",
    prospectName: `Prospect ${n}`,
    agentEmail: "lea@example.com",
    visitedAt: n * 1000,
    receivedAt: n * 1000,
    flyerGiven: false,
    outcome: "interested",
    followUpAt: null,
    notes: null,
    ...over,
  };
}

describe("DashboardScreen › À traiter (GH #113)", () => {
  it("shows the three counts, each with its way in", async () => {
    stubFetch((period) => json(answer(period)), {
      orphans: () => json({ visits: [{}, {}], remaining: 3 }),
      duplicates: () => json({ pairs: [{}, {}, {}], truncated: false }),
    });
    renderScreen();
    await screen.findByRole("heading", { level: 3, name: copy.dashboard.todo.title });

    const t = copy.dashboard.todo;
    expect(within(todoRow(t.followUps)).getByText("6")).toBeTruthy();
    expect(
      within(todoRow(t.followUps))
        .getByRole("link", { name: t.followUpsAction })
        .getAttribute("href"),
    ).toBe(
      // The answer's own `to` (1 here), so the list's total is this count (GH #114).
      "/admin/prospects?status=follow_up&dueBefore=1",
    );
    // The page plus the rows past it: 2 + 3.
    await waitFor(() => expect(within(todoRow(t.orphans)).getByText("5")).toBeTruthy());
    expect(
      within(todoRow(t.orphans)).getByRole("link", { name: t.orphansAction }).getAttribute("href"),
    ).toBe("/admin/a-rattacher");
    await waitFor(() => expect(within(todoRow(t.duplicates)).getByText("3 paires")).toBeTruthy());
    expect(
      within(todoRow(t.duplicates))
        .getByRole("link", { name: t.duplicatesAction })
        .getAttribute("href"),
    ).toBe("/admin/doublons");
  });

  it("mutes every 0 and disables its button (I/O matrix, empty queues)", async () => {
    stubFetch((period) => json({ ...answer(period), followUpsDue: 0 }));
    renderScreen();
    await screen.findByRole("heading", { level: 3, name: copy.dashboard.todo.title });

    const t = copy.dashboard.todo;
    await waitFor(() => expect(within(todoRow(t.duplicates)).getByText("0 paire")).toBeTruthy());
    for (const [label, action] of [
      [t.followUps, t.followUpsAction],
      [t.orphans, t.orphansAction],
      [t.duplicates, t.duplicatesAction],
    ] as const) {
      const row = todoRow(label);
      expect(within(row).queryByRole("link")).toBeNull();
      expect(within(row).getByRole("button", { name: action }).hasAttribute("disabled")).toBe(true);
    }
    expect(within(todoRow(t.followUps)).getByText("0").className).toContain(
      "text-muted-foreground",
    );
  });

  it("mutes and disables a queue whose request failed, and renders the rest (I/O matrix, queue fails)", async () => {
    stubFetch((period) => json(answer(period)), {
      orphans: () => json({ error: "boom" }, 500),
    });
    renderScreen();
    await screen.findByRole("heading", { level: 3, name: copy.dashboard.todo.title });

    const t = copy.dashboard.todo;
    await waitFor(() =>
      expect(
        within(todoRow(t.orphans))
          .getByRole("button", { name: t.orphansAction })
          .hasAttribute("disabled"),
      ).toBe(true),
    );
    expect(within(todoRow(t.orphans)).getByText("—")).toBeTruthy();
    expect(
      within(todoRow(t.followUps)).getByRole("link", { name: t.followUpsAction }),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("DashboardScreen › Dernières visites (GH #113)", () => {
  function rows(): HTMLElement[] {
    return within(card(copy.dashboard.recent.title)).getAllByRole("row").slice(1);
  }
  function announcement(): string {
    const region = within(card(copy.dashboard.recent.title))
      .getAllByRole("status")
      .find((el) => el.getAttribute("aria-live") === "polite");
    return region?.textContent ?? "";
  }

  it("shows the newest 5 of the opening page, with no wash and no announcement (I/O matrix, opening page)", async () => {
    const page = Array.from({ length: 500 }, (_, i) => visit(i + 1));
    stubFetch((period) => json(answer(period)), {
      feed: () => json({ visits: page, serverTime: 0 }),
    });
    renderScreen();

    await waitFor(() => expect(rows()).toHaveLength(5));
    expect(rows()[0]?.textContent).toContain("Prospect 500");
    expect(rows()[4]?.textContent).toContain("Prospect 496");
    expect(rows().some((r) => r.hasAttribute("data-new"))).toBe(false);
    expect(announcement()).toBe("");
  });

  it("puts a polled visit on top with a wash and one announcement (I/O matrix, new visit)", async () => {
    let page = [visit(1), visit(2)];
    stubFetch((period) => json(answer(period)), {
      feed: () => json({ visits: page, serverTime: 0 }),
    });
    const client = renderScreen();
    await waitFor(() => expect(rows()).toHaveLength(2));

    page = [visit(3, { outcome: "converted", flyerGiven: true })];
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    await waitFor(() => expect(rows()).toHaveLength(3));
    const top = rows()[0];
    expect(top?.textContent).toContain("Prospect 3");
    expect(top?.hasAttribute("data-new")).toBe(true);
    expect(top?.textContent).toContain(OUTCOME_LABELS.converted);
    expect(top?.textContent).toContain(copy.visits.flyer);
    expect(rows()[1]?.hasAttribute("data-new")).toBe(false);
    expect(announcement()).toBe("1 nouvelle visite");
  });

  it("says so when the feed is empty (I/O matrix, no visits)", async () => {
    stubFetch((period) => json(answer(period)));
    renderScreen();
    expect(
      await within(await findCard(copy.dashboard.recent.title)).findByText(copy.visits.empty),
    ).toBeTruthy();
  });

  it("announces only the arrivals among the rows shown", async () => {
    let page = Array.from({ length: 5 }, (_, i) => visit(i + 10));
    stubFetch((period) => json(answer(period)), {
      feed: () => json({ visits: page, serverTime: 0 }),
    });
    const client = renderScreen();
    await waitFor(() => expect(rows()).toHaveLength(5));

    // One newer than all five, two older than all five: only one is shown.
    page = [visit(20), visit(1), visit(2)];
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    await waitFor(() => expect(rows()[0]?.textContent).toContain("Prospect 20"));
    expect(rows()).toHaveLength(5);
    expect(announcement()).toBe("1 nouvelle visite");
  });

  it("treats a page cached by an earlier mount as nothing new (I/O matrix, opening page)", async () => {
    // What Visites leaves in the shared entry: its last delta page.
    const page = [visit(1), visit(2), visit(3)];
    stubFetch((period) => json(answer(period)), {
      feed: () => json({ visits: page, serverTime: 0 }),
    });
    renderScreen((client) =>
      client.setQueryData(adminKeys.visitsFeed(), { visits: [visit(3)], serverTime: 0 }),
    );

    await waitFor(() => expect(rows()).toHaveLength(3));
    expect(rows().some((r) => r.hasAttribute("data-new"))).toBe(false);
    expect(announcement()).toBe("");
  });

  it("keeps its rows under the failure when a later poll fails", async () => {
    let fail = false;
    stubFetch((period) => json(answer(period)), {
      feed: () =>
        fail ? json({ error: "boom" }, 500) : json({ visits: [visit(1)], serverTime: 0 }),
    });
    const client = renderScreen();
    await waitFor(() => expect(rows()).toHaveLength(1));

    fail = true;
    await client.refetchQueries({ queryKey: adminKeys.visitsFeed() });

    const recent = card(copy.dashboard.recent.title);
    expect(await within(recent).findByText(copy.visits.loadFailed)).toBeTruthy();
    expect(rows()).toHaveLength(1);
  });

  it("says the feed failed without touching the rest", async () => {
    stubFetch((period) => json(answer(period)), { feed: () => json({ error: "boom" }, 500) });
    renderScreen();
    expect(
      await within(await findCard(copy.dashboard.recent.title)).findByText(copy.visits.loadFailed),
    ).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("links « Tout voir » to Visites", async () => {
    stubFetch((period) => json(answer(period)));
    renderScreen();
    const link = within(await findCard(copy.dashboard.recent.title)).getByRole("link", {
      name: copy.dashboard.recent.seeAll,
    });
    expect(link.getAttribute("href")).toBe("/admin/visites");
  });
});

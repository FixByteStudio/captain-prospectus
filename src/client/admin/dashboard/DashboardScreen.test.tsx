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
import { copy } from "../../copy";
import type { DashboardResponse } from "../../../shared/schemas";
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
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Answers each period with `respond`, and records what was asked. */
function stubFetch(respond: (period: number) => Response | Promise<Response>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const period = Number(new URL(String(input), "http://localhost").searchParams.get("period"));
    return respond(period);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderScreen() {
  const client = createAdminQueryClient();
  // The factory's one retry waits a second; these tests do not need it.
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  render(
    <QueryClientProvider client={client}>
      <DashboardScreen />
    </QueryClientProvider>,
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
    [0.25, "tint-success", "lucide-arrow-up", "--success"],
    [-0.03, "tint-destructive", "lucide-arrow-down", "--destructive"],
    [null, "secondary", null, "--muted-foreground"],
    // Rounds to 0,0 %: flat, like the chip.
    [0.0004, "secondary", null, "--muted-foreground"],
  ] as const)(
    "colours a delta of %s as %s, sparkline included",
    async (delta, variant, arrow, line) => {
      stubFetch((period) => json(answer(period, { delta })));
      renderScreen();
      await findCard(copy.dashboard.visits);

      await waitFor(() => expect(chip().dataset.variant).toBe(variant));
      const svg = chip().querySelector("svg");
      if (arrow === null) expect(svg).toBeNull();
      else expect(svg?.classList.contains(arrow)).toBe(true);
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
    const grid = card(copy.dashboard.visits).parentElement;
    expect(grid?.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("status").textContent).toBe("");
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

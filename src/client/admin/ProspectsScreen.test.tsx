/**
 * Prospects keeps its filters in the URL (GH #114): a deep link sets them and
 * the request, a chip shows what the selects cannot, and a change rewrites the
 * URL in place.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, useLocation, useNavigate } from "react-router";
import { EXPORT_ROWS } from "../../shared/constants";
import { STATUS_LABELS, copy } from "../copy";
import { formatBrusselsDate } from "../format";
import type { Prospect } from "../../shared/schemas";
import { createAdminQueryClient } from "./query-client";
import { ProspectsScreen } from "./ProspectsScreen";
import { Toaster } from "../ui/sonner";

/** happy-dom's own `matchMedia` matches a 1024px-wide desktop by default. */
function setMobile(mobile: boolean) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: mobile && query === "(width < 768px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Records every prospects request; the roster answers with one agent. */
function stubFetch(
  rows: Prospect[] = [],
  total = 13,
  options: { exportCsv?: (url: URL) => Response } = {},
) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/agents") {
        return json({ agents: [{ email: "lea@example.com", role: "agent" }] });
      }
      if (url.pathname === "/api/admin/prospects/export.csv") {
        asked.push(url.pathname + url.search);
        return (options.exportCsv ?? (() => json({}, 500)))(url);
      }
      // Paging (#179) appends limit/offset to every list request; existing
      // assertions here are about the filters, not the page, so they are
      // stripped before recording what was asked. Tests that care about the
      // page read `askedRaw` instead.
      const stripped = new URL(url);
      stripped.searchParams.delete("limit");
      stripped.searchParams.delete("offset");
      asked.push(stripped.pathname + stripped.search);
      askedRaw.push(url.pathname + url.search);
      return json({ prospects: rows, total });
    }),
  );
  return asked;
}

/** Every prospects list request, limit/offset included — reset per test. */
let askedRaw: string[] = [];

/** Where the router is now, and two ways to leave from outside the screen. */
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <Link to="/admin/prospects">sidebar</Link>
      <Link to="/admin/prospects?status=assigned">status-filter</Link>
      <button onClick={() => void navigate(-1)}>back</button>
    </>
  );
}

function prospect(id: string, name: string): Prospect {
  return {
    id,
    name,
    type: "restaurant",
    lat: null,
    lng: null,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    status: "assigned",
    assignedTo: null,
    nextVisitAt: null,
    lastVisitAt: null,
  };
}

function renderAt(...entries: string[]) {
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  render(
    <MemoryRouter initialEntries={entries} initialIndex={entries.length - 1}>
      <QueryClientProvider client={client}>
        <ProspectsScreen />
        <Location />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return client;
}

const location = () => screen.getByTestId("location").textContent;
const statusSelect = () => screen.getByRole("combobox", { name: copy.prospects.filters.status });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  askedRaw = [];
});

describe("ProspectsScreen › URL filters", () => {
  it("opens a deep link with its filter set and asks for it", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects?status=converted");

    await screen.findByText(copy.prospects.count(13));
    expect(asked).toEqual(["/api/admin/prospects?status=converted"]);
    expect(statusSelect().textContent).toBe(STATUS_LABELS.converted);
  });

  it("shows several statuses and a due date as chips, and each × drops its filter", async () => {
    const T = 1_800_000_000_000;
    const asked = stubFetch();
    renderAt(`/admin/prospects?status=new,assigned,follow_up&dueBefore=${T}`);

    await screen.findByText(copy.prospects.count(13));
    expect(asked).toEqual([
      `/api/admin/prospects?status=new%2Cassigned%2Cfollow_up&dueBefore=${T}`,
    ]);
    // Several statuses: the select says so, the chip says which.
    expect(statusSelect().textContent).toBe(copy.prospects.filters.someStatuses);
    const several = copy.prospects.filters.severalStatuses([
      STATUS_LABELS.new,
      STATUS_LABELS.assigned,
      STATUS_LABELS.follow_up,
    ]);
    // getByText folds the no-break space before the colon; the name keeps it.
    expect(screen.getByText(several.replace("\u00a0", " "))).toBeTruthy();
    const due = copy.prospects.filters.dueBefore(formatBrusselsDate(T));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.prospects.filters.remove(due) }));
    expect(location()).toBe("/admin/prospects?status=new%2Cassigned%2Cfollow_up");
    expect(screen.queryByText(due)).toBeNull();

    await user.click(screen.getByRole("button", { name: copy.prospects.filters.remove(several) }));
    expect(location()).toBe("/admin/prospects");
    expect(statusSelect().textContent).toBe(copy.prospects.filters.anyStatus);
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects"));
  });

  it("writes a select change to the URL", async () => {
    stubFetch();
    renderAt("/admin/prospects?source=osm");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.click(statusSelect());
    await user.click(await screen.findByRole("option", { name: STATUS_LABELS.assigned }));

    expect(location()).toBe("/admin/prospects?status=assigned&source=osm");
  });

  it("offers Intéressé as a filter, and shows the row with its label and faded-green edge (ADR-0027)", async () => {
    const lead = { ...prospect(crypto.randomUUID(), "Curry House"), status: "interested" as const };
    const asked = stubFetch([lead], 1);
    renderAt("/admin/prospects");
    await screen.findByText("Curry House");

    const user = userEvent.setup();
    await user.click(statusSelect());
    await user.click(await screen.findByRole("option", { name: STATUS_LABELS.interested }));
    expect(location()).toBe("/admin/prospects?status=interested");
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects?status=interested"));

    const row = (await screen.findByText("Curry House")).closest("tr");
    if (!row) throw new Error("no table row for the lead");
    expect(row.textContent).toContain(STATUS_LABELS.interested);
    expect(row.innerHTML).toContain("--color-status-interested");
  });

  it("clears every filter from the URL", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?status=converted&dueBefore=5&source=osm");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: copy.prospects.clearFilters }));

    expect(location()).toBe("/admin/prospects");
  });

  it("clears several statuses when « Tous les statuts » is chosen", async () => {
    stubFetch();
    renderAt("/admin/prospects?status=new,assigned");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.click(statusSelect());
    await user.click(await screen.findByRole("option", { name: copy.prospects.filters.anyStatus }));

    expect(location()).toBe("/admin/prospects");
  });

  it("offers to clear a due-date-only filter that matches nothing, not an import", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?dueBefore=1800000000000");

    expect(await screen.findByText(copy.prospects.noMatch)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.clearFilters })).toBeTruthy();
    expect(screen.queryByText(copy.prospects.empty)).toBeNull();
  });

  it("replaces the history entry rather than pushing one", async () => {
    stubFetch([], 0);
    renderAt("/admin", "/admin/prospects?status=converted");

    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: copy.prospects.clearFilters }));
    expect(location()).toBe("/admin/prospects");

    await user.click(screen.getByRole("button", { name: "back" }));
    expect(location()).toBe("/admin");
  });

  it("drops the selection when the URL changes from outside the screen", async () => {
    stubFetch([prospect("a", "Chez Léa")]);
    renderAt("/admin/prospects?status=assigned");
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", { name: copy.prospects.selection.selectOne("Chez Léa") }),
    );
    expect(screen.getByText(copy.prospects.selection.count(1))).toBeTruthy();

    await user.click(screen.getByRole("link", { name: "sidebar" }));

    expect(location()).toBe("/admin/prospects");
    expect(screen.queryByText(copy.prospects.selection.count(1))).toBeNull();
    expect(statusSelect()).toBeTruthy();
  });

  it("renders its title through the shared ScreenHeader, as a level-2 heading (GH #175)", () => {
    stubFetch();
    renderAt("/admin/prospects");

    expect(screen.getByRole("heading", { level: 2, name: copy.prospects.title })).toBeTruthy();
  });
});

describe("ProspectsScreen › search (#179)", () => {
  it("writes ?q= after the debounce and asks for it", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: copy.prospects.search.label }), "bistro");

    await waitFor(() => expect(location()).toBe("/admin/prospects?q=bistro"), { timeout: 2000 });
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects?q=bistro"));
  });

  it("drops `q` from the URL and the request when the box is cleared", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects?q=bistro");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.clear(screen.getByRole("searchbox", { name: copy.prospects.search.label }));

    await waitFor(() => expect(location()).toBe("/admin/prospects"), { timeout: 2000 });
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects"));
  });

  it("never sends a blank search", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects?q=bistro");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    const box = screen.getByRole("searchbox", { name: copy.prospects.search.label });
    await user.clear(box);
    await user.type(box, "   ");

    await waitFor(() => expect(location()).toBe("/admin/prospects"), { timeout: 2000 });
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects"));
    expect(asked.filter((url) => url.includes("q="))).toEqual(["/api/admin/prospects?q=bistro"]);
  });

  it("opens a deep link with `q` and its status filter both in the box and the request", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects?status=converted&q=L%C3%A9a");

    await screen.findByText(copy.prospects.count(13));
    const box = screen.getByRole("searchbox", {
      name: copy.prospects.search.label,
    }) as HTMLInputElement;
    expect(box.value).toBe("Léa");
    expect(asked).toEqual(["/api/admin/prospects?status=converted&q=L%C3%A9a"]);
  });

  it("coalesces a typed word into exactly one request carrying `q=`", async () => {
    const asked = stubFetch();
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: copy.prospects.search.label }), "bistro");

    await waitFor(() => expect(location()).toBe("/admin/prospects?q=bistro"), { timeout: 2000 });
    expect(asked.filter((url) => url.includes("q="))).toEqual(["/api/admin/prospects?q=bistro"]);
  });

  it("keeps a select changed inside the debounce window, and still carries `q`", async () => {
    stubFetch();
    renderAt("/admin/prospects?source=osm");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: copy.prospects.search.label }), "b");
    // Before the 300ms debounce fires: a select change must not be lost under
    // it (the timer reads `latestFilters`, not the filters as they were at
    // the keystroke).
    await user.click(statusSelect());
    await user.click(await screen.findByRole("option", { name: STATUS_LABELS.assigned }));

    await waitFor(
      () => expect(location()).toBe("/admin/prospects?status=assigned&source=osm&q=b"),
      { timeout: 2000 },
    );
  });

  it("does not undo an outside navigation that lands inside the debounce window", async () => {
    stubFetch();
    // Starts on a filtered URL, so the sidebar's plain "/admin/prospects" is
    // an actual change the pending debounce write must not be able to undo.
    renderAt("/admin/prospects?status=converted");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox", { name: copy.prospects.search.label }), "bistro");
    // Leaves before the 300ms debounce has a chance to fire.
    await user.click(screen.getByRole("link", { name: "sidebar" }));

    expect(location()).toBe("/admin/prospects");
    // The debounce firing late must not write "bistro" back over the nav.
    await new Promise((resolve) => setTimeout(resolve, 350));
    expect(location()).toBe("/admin/prospects");
    expect(
      (screen.getByRole("searchbox", { name: copy.prospects.search.label }) as HTMLInputElement)
        .value,
    ).toBe("");
  });
});

describe("ProspectsScreen › Hors cible signalé (#250)", () => {
  const toggle = (name: string) => screen.getByRole("button", { name });

  it("turns the filter on, writes outOfTarget=true and shows the filtered count", async () => {
    const asked = stubFetch([prospect("p1", "Chez Fermé")], 4);
    renderAt("/admin/prospects?source=osm");
    await screen.findByText(copy.prospects.count(4));

    // Off: no count rides on the label.
    const off = toggle(copy.prospects.filters.outOfTarget);
    expect(off.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(off);

    expect(location()).toBe("/admin/prospects?source=osm&outOfTarget=true");
    await waitFor(() =>
      expect(asked.at(-1)).toBe("/api/admin/prospects?source=osm&outOfTarget=true"),
    );
    const on = await screen.findByRole("button", {
      name: copy.prospects.filters.outOfTargetCount(4),
    });
    expect(on.getAttribute("aria-pressed")).toBe("true");
  });

  it("opens a deep link with the toggle on, and turning it off drops the param", async () => {
    const asked = stubFetch([], 2);
    renderAt("/admin/prospects?outOfTarget=true");

    const on = await screen.findByRole("button", {
      name: copy.prospects.filters.outOfTargetCount(2),
    });
    expect(asked).toEqual(["/api/admin/prospects?outOfTarget=true"]);

    await userEvent.click(on);
    expect(location()).toBe("/admin/prospects");
    await waitFor(() => expect(asked.at(-1)).toBe("/api/admin/prospects"));
  });

  it("never labels the toggle with the unfiltered total while the filtered list loads", async () => {
    let release: (() => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://admin");
        if (url.pathname === "/api/admin/agents") return json({ agents: [] });
        if (url.searchParams.get("outOfTarget") === "true") {
          await new Promise<void>((resolve) => (release = resolve));
          return json({ prospects: [], total: 2 });
        }
        return json({ prospects: [], total: 40 });
      }),
    );
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(40));

    await userEvent.click(toggle(copy.prospects.filters.outOfTarget));
    // The filtered request is still pending and the previous page is on
    // screen: the toggle must not borrow its 40.
    await waitFor(() => expect(release).toBeDefined());
    expect(
      screen.queryByRole("button", { name: copy.prospects.filters.outOfTargetCount(40) }),
    ).toBe(null);

    release?.();
    await screen.findByRole("button", { name: copy.prospects.filters.outOfTargetCount(2) });
    expect(
      screen.queryByRole("button", { name: copy.prospects.filters.outOfTargetCount(40) }),
    ).toBe(null);
  });

  it("says nothing matched, and offers to clear, when the filter finds no prospect", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?outOfTarget=true");

    expect(await screen.findByText(copy.prospects.noMatch)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.clearFilters })).toBeTruthy();
    expect(screen.queryByText(copy.prospects.empty)).toBe(null);
  });

  it("ignores a value the API would refuse, and exports with the filter", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:prospects");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const asked = stubFetch([], 1, {
      exportCsv: () =>
        new Response("name\n", {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="prospects.csv"',
          },
        }),
    });
    renderAt("/admin/prospects?outOfTarget=maybe");
    await screen.findByText(copy.prospects.count(1));
    expect(asked).toEqual(["/api/admin/prospects"]);

    await userEvent.click(toggle(copy.prospects.filters.outOfTarget));
    await screen.findByRole("button", { name: copy.prospects.filters.outOfTargetCount(1) });
    await userEvent.click(screen.getByRole("button", { name: copy.prospects.export.button }));
    await waitFor(() =>
      expect(asked).toContain("/api/admin/prospects/export.csv?outOfTarget=true"),
    );
  });
});

describe("ProspectsScreen › pagination (#179)", () => {
  it("pages over the server's own total, disables the ends, and shows the range", async () => {
    stubFetch(
      Array.from({ length: 13 }, (_, i) => prospect(`p${i}`, `Prospect ${i}`)),
      60,
    );
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(60));
    expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=0");
    expect(screen.getByText(copy.prospects.range(1, 25, 60))).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: copy.prospects.pager.previous }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.prospects.pager.next }));

    await waitFor(() => expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=25"));
    expect(await screen.findByText(copy.prospects.range(26, 50, 60))).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: copy.prospects.pager.next }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: copy.prospects.pager.next }));
    await waitFor(() => expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=50"));
    expect(await screen.findByText(copy.prospects.range(51, 60, 60))).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: copy.prospects.pager.next }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("clears the selection when the page turns", async () => {
    stubFetch(
      Array.from({ length: 25 }, (_, i) => prospect(`p${i}`, `Prospect ${i}`)),
      60,
    );
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(60));

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("checkbox", {
        name: copy.prospects.selection.selectOne("Prospect 0"),
      }),
    );
    expect(screen.getByText(copy.prospects.selection.count(1))).toBeTruthy();

    await user.click(screen.getByRole("button", { name: copy.prospects.pager.next }));

    await waitFor(() => expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=25"));
    expect(screen.queryByText(copy.prospects.selection.count(1))).toBeNull();
  });

  it("returns to page 1 and clears the selection when a filter changes on page 2", async () => {
    stubFetch(
      Array.from({ length: 25 }, (_, i) => prospect(`p${i}`, `Prospect ${i}`)),
      60,
    );
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(60));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.prospects.pager.next }));
    await waitFor(() => expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=25"));

    await user.click(
      await screen.findByRole("checkbox", {
        name: copy.prospects.selection.selectOne("Prospect 0"),
      }),
    );
    expect(screen.getByText(copy.prospects.selection.count(1))).toBeTruthy();

    // A status filter picked elsewhere (a chip's cross, a dashboard link) —
    // simulated here as a plain navigation, since the Statut select itself is
    // hidden by the selection toolbar while something is ticked.
    await user.click(screen.getByRole("link", { name: "status-filter" }));

    await waitFor(() =>
      expect(askedRaw.at(-1)).toBe("/api/admin/prospects?status=assigned&limit=25&offset=0"),
    );
    expect(screen.queryByText(copy.prospects.selection.count(1))).toBeNull();
  });

  it("clamps to the last page that still exists when a refetch shrinks the total", async () => {
    let total = 60;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = new URL(String(input), "http://admin");
        if (url.pathname === "/api/admin/agents") return json({ agents: [] });
        askedRaw.push(url.pathname + url.search);
        const offset = Number(url.searchParams.get("offset") ?? 0);
        // An out-of-range page answers empty, as the real endpoint does past
        // its own total — a stub that always answers a row would pass this
        // test even without a clamp.
        const prospects = offset >= total ? [] : [prospect("p0", "Prospect 0")];
        return json({ prospects, total });
      }),
    );
    const client = renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(60));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.prospects.pager.pageLabel(3) }));
    expect(await screen.findByText(copy.prospects.range(51, 60, 60))).toBeTruthy();

    // The last row of page 3 re-statused out: every mutation invalidates the
    // prospects prefix (useInvalidateProspects), and the refetch answers 50.
    total = 50;
    await client.invalidateQueries({ queryKey: ["admin", "prospects"] });

    expect(await screen.findByText(copy.prospects.range(26, 50, 50))).toBeTruthy();
    expect(screen.queryByText(copy.prospects.empty)).toBeNull();
    expect(screen.queryByText(copy.prospects.noMatchFilters)).toBeNull();
    // The invalidated page-3 query refetches once more at its own offset
    // (now empty, since offset ≥ the shrunk total) before the clamp moves to
    // page 2 — but no further, straggling offset=50 request after that.
    expect(askedRaw.filter((u) => u === "/api/admin/prospects?limit=25&offset=50")).toHaveLength(2);
    expect(askedRaw.at(-1)).toBe("/api/admin/prospects?limit=25&offset=25");
  });

  it("shows no pager when the total fits on one page", async () => {
    stubFetch([prospect("a", "Chez Léa")], 13);
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(13));

    expect(screen.queryByRole("navigation", { name: copy.prospects.pager.nav })).toBeNull();
  });
});

describe("ProspectsScreen › empty states (#179)", () => {
  it("invites a CSV import when there are no prospects at all", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects");

    expect(await screen.findByText(copy.prospects.empty)).toBeTruthy();
    // Two: the header's own action and the empty state's — both go to Import.
    expect(screen.getAllByRole("link", { name: copy.prospects.importCta })).toHaveLength(2);
  });

  it("names the search when it matches nothing, and offers to clear it", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?q=zzz");

    expect(await screen.findByText(copy.prospects.noMatch)).toBeTruthy();
    expect(screen.getByText(copy.prospects.noMatchSearch("zzz"))).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.clearFilters })).toBeTruthy();
    expect(screen.queryByText(copy.prospects.empty)).toBeNull();
  });

  it("clears the search box along with the URL on « Effacer les filtres »", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?q=zzz");
    await screen.findByText(copy.prospects.noMatchSearch("zzz"));

    await userEvent.click(screen.getByRole("button", { name: copy.prospects.clearFilters }));

    expect(location()).toBe("/admin/prospects");
    expect(
      (screen.getByRole("searchbox", { name: copy.prospects.search.label }) as HTMLInputElement)
        .value,
    ).toBe("");
  });

  it("says a filter matched nothing without naming a search", async () => {
    stubFetch([], 0);
    renderAt("/admin/prospects?status=rejected");

    expect(await screen.findByText(copy.prospects.noMatchFilters)).toBeTruthy();
  });
});

describe("ProspectsScreen › loading (#206)", () => {
  it("shows 6–8 row skeletons while the first page is pending", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) =>
        String(input).startsWith("/api/admin/agents")
          ? json({ agents: [] })
          : new Promise<Response>(() => {}),
      ),
    );
    renderAt("/admin/prospects");

    const rows = document.querySelectorAll('[aria-busy="true"] [data-slot="skeleton"]');
    expect(rows.length).toBeGreaterThanOrEqual(6);
    expect(rows.length).toBeLessThanOrEqual(8);
  });
});

describe("ProspectsScreen › load failed (#179)", () => {
  it("shows the shared Alert and refetches on « Réessayer »", async () => {
    let fail = true;
    const asked: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/admin/agents")) return json({ agents: [] });
        asked.push(url);
        return fail ? json({ error: "boom" }, 500) : json({ prospects: [], total: 4 });
      }),
    );
    renderAt("/admin/prospects");

    expect(await screen.findByText(copy.prospects.loadFailed)).toBeTruthy();
    fail = false;
    await userEvent.click(screen.getByRole("button", { name: copy.errors.retry }));

    expect(await screen.findByText(copy.prospects.count(4))).toBeTruthy();
    expect(asked.length).toBe(2);
  });
});

describe("ProspectsScreen › export (#179)", () => {
  it("exports the same filters as a CSV, and warns when the server truncated it", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:prospects");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const asked = stubFetch([], 13, {
      exportCsv: () =>
        new Response("name\n", {
          headers: {
            "content-type": "text/csv; charset=utf-8",
            "content-disposition": 'attachment; filename="prospects-2026-09-27.csv"',
            "x-truncated": "true",
          },
        }),
    });
    renderAt("/admin/prospects?status=converted");
    await screen.findByText(copy.prospects.count(13));

    await userEvent.click(screen.getByRole("button", { name: copy.prospects.export.button }));

    expect(await screen.findByText(copy.prospects.export.truncated(EXPORT_ROWS))).toBeTruthy();
    expect(click).toHaveBeenCalledTimes(1);
    const anchor = click.mock.instances[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("prospects-2026-09-27.csv");
    expect(asked).toContain("/api/admin/prospects/export.csv?status=converted");
  });

  it("exports the search along with the other filters", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:prospects");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const asked = stubFetch([], 13, {
      exportCsv: () => new Response("name\n", { headers: { "content-type": "text/csv" } }),
    });
    renderAt("/admin/prospects?q=bistro");
    await screen.findByText(copy.prospects.count(13));

    await userEvent.click(screen.getByRole("button", { name: copy.prospects.export.button }));

    await waitFor(() => expect(asked).toContain("/api/admin/prospects/export.csv?q=bistro"));
  });

  it("warns that the session expired on a 401", async () => {
    stubFetch([], 13, { exportCsv: () => json({}, 401) });
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(13));

    await userEvent.click(screen.getByRole("button", { name: copy.prospects.export.button }));

    expect(await screen.findByText(copy.errors.sessionExpired)).toBeTruthy();
  });

  it("warns that the export failed on a server error", async () => {
    stubFetch([], 13, { exportCsv: () => json({}, 500) });
    renderAt("/admin/prospects");
    await screen.findByText(copy.prospects.count(13));

    await userEvent.click(screen.getByRole("button", { name: copy.prospects.export.button }));

    expect(await screen.findByText(copy.prospects.export.failed)).toBeTruthy();
  });
});

describe("ProspectsScreen › below 768px (#179)", () => {
  it("renders a list of rows instead of a table", async () => {
    const restore = setMobile(true);
    stubFetch([prospect("a", "Chez Léa")], 1);
    renderAt("/admin/prospects");

    await screen.findByText("Chez Léa");
    expect(screen.queryByRole("table")).toBeNull();
    expect(
      screen.getByRole("checkbox", { name: copy.prospects.selection.selectOne("Chez Léa") }),
    ).toBeTruthy();
    expect(screen.getByText(STATUS_LABELS.assigned)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.row.menu("Chez Léa") })).toBeTruthy();
    restore.mockRestore();
  });
});

describe("ProspectsScreen › selection and row actions (#185)", () => {
  /** The list plus the assign route, which `stubFetch` would answer with a list. */
  function stubAssign(onAssign: (body: unknown) => Response) {
    const posted: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(String(input), "http://admin");
        if (url.pathname === "/api/admin/agents") {
          return json({ agents: [{ email: "lea@example.com", role: "agent" }] });
        }
        if (url.pathname === "/api/admin/prospects/assign") {
          const body: unknown = JSON.parse(String(init?.body));
          posted.push(body);
          return onAssign(body);
        }
        return json({ prospects: [prospect("a", "Chez Léa")], total: 1 });
      }),
    );
    return posted;
  }

  async function tick(user: ReturnType<typeof userEvent.setup>) {
    await user.click(
      await screen.findByRole("checkbox", { name: copy.prospects.selection.selectOne("Chez Léa") }),
    );
  }

  it("replaces the filters in place with the selection's actions, and Annuler brings them back", async () => {
    stubFetch([prospect("a", "Chez Léa")], 1);
    renderAt("/admin/prospects");
    const user = userEvent.setup();
    await tick(user);

    expect(screen.queryByRole("searchbox", { name: copy.prospects.search.label })).toBeNull();
    for (const filter of [
      copy.prospects.filters.status,
      copy.prospects.filters.agent,
      copy.prospects.filters.source,
    ]) {
      expect(screen.queryByRole("combobox", { name: filter })).toBeNull();
    }
    expect(screen.getByText(copy.prospects.selection.count(1))).toBeTruthy();
    expect(screen.getByRole("combobox", { name: copy.prospects.selection.assignTo })).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.selection.assign })).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.prospects.selection.unassign })).toBeTruthy();

    await user.click(screen.getByRole("button", { name: copy.prospects.selection.cancel }));

    expect(screen.getByRole("searchbox", { name: copy.prospects.search.label })).toBeTruthy();
    expect(statusSelect()).toBeTruthy();
    expect(screen.queryByText(copy.prospects.selection.count(1))).toBeNull();
    const box = screen.getByRole("checkbox", {
      name: copy.prospects.selection.selectOne("Chez Léa"),
    });
    expect(box.getAttribute("aria-checked") ?? String((box as HTMLInputElement).checked)).toBe(
      "false",
    );
  });

  it("offers Assigner à, Retirer l'assignation and Changer le statut in the row menu", async () => {
    stubFetch([{ ...prospect("a", "Chez Léa"), assignedTo: "lea@example.com" }], 1);
    renderAt("/admin/prospects");
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: copy.prospects.row.menu("Chez Léa") }),
    );

    const menu = await screen.findByRole("menu");
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]')).map((el) =>
      el.textContent?.trim(),
    );
    expect(items).toEqual([
      copy.prospects.row.assignTo,
      copy.prospects.row.unassign,
      copy.prospects.row.changeStatus,
    ]);
  });

  it("leaves Retirer l'assignation out of the row menu of an unassigned prospect", async () => {
    stubFetch([prospect("a", "Chez Léa")], 1);
    renderAt("/admin/prospects");
    const user = userEvent.setup();

    await user.click(
      await screen.findByRole("button", { name: copy.prospects.row.menu("Chez Léa") }),
    );

    const menu = await screen.findByRole("menu");
    expect(menu.textContent).not.toContain(copy.prospects.row.unassign);
    expect(menu.textContent).toContain(copy.prospects.row.assignTo);
  });

  it("toasts what the admin did when the selection is assigned", async () => {
    const posted = stubAssign(() => json({ assigned: 1 }));
    renderAt("/admin/prospects");
    const user = userEvent.setup();
    await tick(user);

    await user.click(screen.getByRole("combobox", { name: copy.prospects.selection.assignTo }));
    await user.click(await screen.findByRole("option", { name: "lea@example.com" }));
    await user.click(screen.getByRole("button", { name: copy.prospects.selection.assign }));

    expect(await screen.findByText(copy.prospects.assigned(1))).toBeTruthy();
    expect(posted).toEqual([{ ids: ["a"], assignedTo: "lea@example.com" }]);
  });

  it("toasts the failure when the assignment is refused, and keeps the selection to retry", async () => {
    const posted = stubAssign(() => json({ error: "internal" }, 500));
    renderAt("/admin/prospects");
    const user = userEvent.setup();
    await tick(user);

    await user.click(screen.getByRole("combobox", { name: copy.prospects.selection.assignTo }));
    await user.click(await screen.findByRole("option", { name: "lea@example.com" }));
    await user.click(screen.getByRole("button", { name: copy.prospects.selection.assign }));

    expect(await screen.findByText(copy.prospects.assignFailed)).toBeTruthy();
    expect(posted).toEqual([{ ids: ["a"], assignedTo: "lea@example.com" }]);
    expect(screen.getByText(copy.prospects.selection.count(1))).toBeTruthy();
  });

  it("toasts the unassignment and hands the slot back to the filters", async () => {
    const posted = stubAssign(() => json({ assigned: 1 }));
    renderAt("/admin/prospects");
    const user = userEvent.setup();
    await tick(user);

    await user.click(screen.getByRole("button", { name: copy.prospects.selection.unassign }));

    expect(await screen.findByText(copy.prospects.unassigned(1))).toBeTruthy();
    expect(posted).toEqual([{ ids: ["a"], assignedTo: null }]);
    await waitFor(() => expect(statusSelect()).toBeTruthy());
  });
});

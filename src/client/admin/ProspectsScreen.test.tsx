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
import { STATUS_LABELS, copy } from "../copy";
import { formatBrusselsDate } from "../format";
import type { Prospect } from "../../shared/schemas";
import { createAdminQueryClient } from "./query-client";
import { ProspectsScreen } from "./ProspectsScreen";

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Records every prospects request; the roster answers with one agent. */
function stubFetch(rows: Prospect[] = [], total = 13) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/admin/agents")) {
        return json({ agents: [{ email: "lea@example.com", role: "agent" }] });
      }
      asked.push(url);
      return json({ prospects: rows, total });
    }),
  );
  return asked;
}

/** Where the router is now, and two ways to leave from outside the screen. */
function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output data-testid="location">{location.pathname + location.search}</output>
      <Link to="/admin/prospects">sidebar</Link>
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
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

const location = () => screen.getByTestId("location").textContent;
const statusSelect = () => screen.getByRole("combobox", { name: copy.prospects.filters.status });

afterEach(() => {
  vi.unstubAllGlobals();
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

  it("clears every filter from the URL", async () => {
    stubFetch();
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
    stubFetch();
    renderAt("/admin", "/admin/prospects?status=converted");
    await screen.findByText(copy.prospects.count(13));

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: copy.prospects.clearFilters }));
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

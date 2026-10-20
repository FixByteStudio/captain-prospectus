import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter } from "react-router";
import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { STATUS_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { createAdminQueryClient } from "../query-client";
import { RoundScreen } from "./RoundScreen";
import { REMEMBERED_AGENT_KEY } from "./remembered-agent";
import { RoundMap } from "../../field/RoundMap";

// Real Leaflet is RoundMap.test.tsx's job; here only what the screen feeds it.
const mapMounts = vi.hoisted(() => ({ count: 0 }));
vi.mock("../../field/RoundMap", () => ({
  RoundMap: vi.fn(() => {
    useEffect(() => {
      mapMounts.count += 1;
    }, []);
    return <div data-testid="round-map" />;
  }),
}));

function lastMapProps(): Record<string, unknown> {
  const calls = vi.mocked(RoundMap).mock.calls;
  return (calls.at(-1)?.[0] ?? {}) as Record<string, unknown>;
}

beforeEach(() => {
  mapMounts.count = 0;
  vi.mocked(RoundMap).mockClear();
});

const t = copy.round;
const EMAIL = "lea@example.com";
const CAPTURED = Date.now() - 60_000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function prospect(id: string, name: string, lat: number | null, lng: number | null): Prospect {
  return {
    id,
    name,
    type: "restaurant",
    lat,
    lng,
    address: null,
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    status: "assigned",
    assignedTo: EMAIL,
    lastVisitAt: null,
    nextVisitAt: null,
  };
}

/** The tournée's stops still to do, as the server sends them (ADR-0036). */
function round(
  stops: [number, Prospect][],
  position: AgentRoundResponse["position"] = null,
): AgentRoundResponse {
  return {
    tournee: { startedAt: CAPTURED, stops: stops.map(([number, p]) => ({ number, prospect: p })) },
    position,
  };
}

// Numbers 1, 3 and 5: stops 2 and 4 are gone (visited or reassigned) and leave gaps.
// The server's number order is not the distance order from the position.
const PROSPECTS: [number, Prospect][] = [
  [1, prospect("far", "Zeste", 50.9, 4.4)],
  [3, prospect("none", "Alpha", null, null)],
  [5, prospect("near", "Madeleine", 50.8501, 4.3501)],
];
const NOT_STARTED: AgentRoundResponse = { tournee: null, position: null };

function setup(
  round: AgentRoundResponse,
  roundStatus = 200,
  rosterStatus = 200,
  roster: string[] = [EMAIL],
) {
  const asked: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/agents") {
        return json({ agents: roster.map((email) => ({ email, role: "agent" })) }, rosterStatus);
      }
      asked.push(url.pathname);
      return json(round, roundStatus);
    }),
  );
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  const view = (entry: string) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <QueryClientProvider client={client}>
          <RoundScreen />
        </QueryClientProvider>
      </MemoryRouter>,
    );
  return { asked, view };
}

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe("RoundScreen", () => {
  it("asks for an agent and fetches no round before one is chosen", async () => {
    const { asked, view } = setup(round(PROSPECTS));
    view("/admin/round");
    expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
    expect(asked).toEqual([]);
  });

  it("lists the swipe's numbers in order, with count, position age and distances", async () => {
    const { asked, view } = setup(
      round(PROSPECTS, { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: CAPTURED }),
    );
    view(`/admin/round?agent=${EMAIL}`);
    // Skeleton first, never the "choose an agent" prompt for a linked agent.
    expect(screen.getByRole("status").textContent).toBe(t.loading);
    expect(screen.queryByText(t.choosePrompt)).toBeNull();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);
    // The server's order and numbers, never re-sorted by distance; gaps stay gaps.
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^1.*Zeste/),
      expect.stringMatching(/^3.*Alpha/),
      expect.stringMatching(/^5.*Madeleine/),
    ]);
    expect(screen.getByText(t.count(3))).toBeTruthy();
    expect(screen.getByText(t.position(formatDateTime(CAPTURED)))).toBeTruthy();
    expect(items[0]?.textContent).toMatch(/\d+ km/);
    expect(items[1]?.textContent).not.toMatch(/\d+ (m|km)\b/);
    expect(items[2]?.textContent).toMatch(/\d+ m/);
    expect(asked).toEqual([`/api/admin/agents/${encodeURIComponent(EMAIL)}/round`]);
  });

  it("keeps the numbers with the notice and no distance when there is no position", async () => {
    const { view } = setup(round(PROSPECTS));
    view(`/admin/round?agent=${EMAIL}`);
    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/^1.*Zeste/),
      expect.stringMatching(/^3.*Alpha/),
      expect.stringMatching(/^5.*Madeleine/),
    ]);
    expect(screen.getByText(t.noPosition)).toBeTruthy();
    for (const li of items) expect(li.textContent).not.toMatch(/\d+ (m|km)\b/);
  });

  it("offers no Visiter, Y aller or link on any row", async () => {
    const { view } = setup(round(PROSPECTS));
    view(`/admin/round?agent=${EMAIL}`);
    for (const li of await screen.findAllByRole("listitem")) {
      expect(li.textContent).not.toMatch(/Visiter|Y aller/);
      expect(within(li).queryByRole("link")).toBeNull();
      expect(within(li).queryByRole("button")).toBeNull();
    }
  });

  it("shows the load-failed alert with a retry when the round fetch fails", async () => {
    const { view } = setup(round([]), 500);
    view(`/admin/round?agent=${EMAIL}`);
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.errors.retry })).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("says the agent has not started, with no rows, before the swipe", async () => {
    const { view } = setup(NOT_STARTED);
    view(`/admin/round?agent=${EMAIL}`);
    expect(await screen.findByText(t.notStarted(EMAIL))).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(screen.queryByText(t.empty)).toBeNull();
    expect(screen.queryByText(t.noPosition)).toBeNull();
    expect(screen.queryByText(t.count(0))).toBeNull();
  });

  it("shows the empty message for a tournée with every stop done", async () => {
    const { view } = setup(round([]));
    view(`/admin/round?agent=${EMAIL}`);
    await waitFor(() => expect(screen.getByText(t.empty)).toBeTruthy());
    expect(screen.getByText(t.count(0))).toBeTruthy();
  });

  it("fetches the round and renders rows once an agent is picked in the Select", async () => {
    const user = userEvent.setup();
    const { asked, view } = setup(round(PROSPECTS));
    view("/admin/round");
    await user.click(await screen.findByRole("combobox", { name: t.agentLabel }));
    await user.click(await screen.findByRole("option", { name: EMAIL }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    expect(asked).toEqual([`/api/admin/agents/${encodeURIComponent(EMAIL)}/round`]);
  });

  it("ignores an agent that is not in the roster: prompt, no round fetch", async () => {
    const { asked, view } = setup(round(PROSPECTS));
    view("/admin/round?agent=other@example.com");
    expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
    expect(asked).toEqual([]);
  });

  describe("remembered agent (GH #284)", () => {
    const OTHER = "marc@example.com";
    const stops = round(PROSPECTS);

    it("remembers the agent picked in the Select, for the next visit", async () => {
      const user = userEvent.setup();
      const first = setup(stops);
      const { unmount } = first.view("/admin/round");
      await user.click(await screen.findByRole("combobox", { name: t.agentLabel }));
      await user.click(await screen.findByRole("option", { name: EMAIL }));
      await screen.findAllByRole("listitem");
      unmount();

      const second = setup(stops);
      second.view("/admin/round");
      expect(await screen.findAllByRole("listitem")).toHaveLength(3);
      expect(second.asked).toEqual([`/api/admin/agents/${encodeURIComponent(EMAIL)}/round`]);
    });

    it("keeps the last pick when the plain link is followed without a remount", async () => {
      const user = userEvent.setup();
      const { asked } = setup(stops, 200, 200, [EMAIL, OTHER]);
      localStorage.setItem(REMEMBERED_AGENT_KEY, EMAIL);
      render(
        <MemoryRouter initialEntries={["/admin/round"]}>
          <QueryClientProvider client={createAdminQueryClient()}>
            <Link to="/admin/round">plain</Link>
            <RoundScreen />
          </QueryClientProvider>
        </MemoryRouter>,
      );
      await screen.findAllByRole("listitem");
      await user.click(screen.getByRole("combobox", { name: t.agentLabel }));
      await user.click(await screen.findByRole("option", { name: OTHER }));
      await waitFor(() => expect(asked.at(-1)).toContain(encodeURIComponent(OTHER)));
      await user.click(screen.getByRole("link", { name: "plain" }));
      await waitFor(() => expect(screen.getByRole("combobox").textContent).toBe(OTHER));
    });

    it("lets ?agent= win over the remembered agent, and keeps the memory", async () => {
      localStorage.setItem(REMEMBERED_AGENT_KEY, EMAIL);
      const { asked, view } = setup(stops, 200, 200, [EMAIL, OTHER]);
      view(`/admin/round?agent=${OTHER}`);
      await screen.findAllByRole("listitem");
      expect(asked).toEqual([`/api/admin/agents/${encodeURIComponent(OTHER)}/round`]);
      expect(localStorage.getItem(REMEMBERED_AGENT_KEY)).toBe(EMAIL);
    });

    it("shows the prompt when the remembered agent left the roster", async () => {
      localStorage.setItem(REMEMBERED_AGENT_KEY, "gone@example.com");
      const { asked, view } = setup(stops);
      view("/admin/round");
      expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
      expect(asked).toEqual([]);
    });

    it("works as before when storage throws", async () => {
      const user = userEvent.setup();
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("blocked");
      });
      try {
        const { view } = setup(stops);
        view("/admin/round");
        expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
        await user.click(await screen.findByRole("combobox", { name: t.agentLabel }));
        await user.click(await screen.findByRole("option", { name: EMAIL }));
        expect(await screen.findAllByRole("listitem")).toHaveLength(3);
      } finally {
        vi.restoreAllMocks();
      }
    });
  });

  it("shows the load-failed alert with a retry, and no prompt, when the roster fails", async () => {
    const { asked, view } = setup(round([]), 200, 500);
    view(`/admin/round?agent=${EMAIL}`);
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.errors.retry })).toBeTruthy();
    expect(screen.queryByText(t.choosePrompt)).toBeNull();
    expect(asked).toEqual([]);
  });

  it("keeps the no-position notice off an empty round", async () => {
    const { view } = setup(round([]));
    view(`/admin/round?agent=${EMAIL}`);
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.queryByText(t.noPosition)).toBeNull();
  });

  it("labels each row with its status badge", async () => {
    const dueToday: Prospect = {
      ...prospect("fu", "Relance", null, null),
      status: "follow_up",
      nextVisitAt: Date.now() - 1000,
    };
    const { view } = setup(
      round([
        [1, prospect("a", "Alpha", null, null)],
        [2, dueToday],
      ]),
    );
    view(`/admin/round?agent=${EMAIL}`);
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText(STATUS_LABELS.assigned)).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText(STATUS_LABELS.follow_up)).toBeTruthy();
  });

  describe("map pane", () => {
    const POS = { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: CAPTURED };

    it("is absent before an agent is chosen", async () => {
      const { view } = setup(round(PROSPECTS));
      view("/admin/round");
      await screen.findByText(t.choosePrompt);
      expect(screen.queryByTestId("round-map")).toBeNull();
    });

    it("is absent when the round fails to load", async () => {
      const { view } = setup(round([]), 500);
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByText(t.loadFailed);
      expect(screen.queryByTestId("round-map")).toBeNull();
    });

    it("with a position: swipe numbers, uncoordinated stop has no pin, gold on the lowest, path, position", async () => {
      const { view } = setup(round(PROSPECTS, POS));
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      const props = lastMapProps();
      expect(props.pins).toEqual([
        expect.objectContaining({ name: "Zeste", number: 1, next: true }),
        expect.objectContaining({ name: "Madeleine", number: 5, next: false }),
      ]);
      expect(props.path).toEqual([
        [50.9, 4.4],
        [50.8501, 4.3501],
      ]);
      expect(props.position).toEqual({ lat: 50.85, lng: 4.35 });
      expect(props).not.toHaveProperty("recentre");
      expect(props).not.toHaveProperty("onSelect");
    });

    it("without a position: the same numbers, gold and path, and no marker", async () => {
      const { view } = setup(round(PROSPECTS));
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      const props = lastMapProps();
      expect(props.pins).toEqual([
        expect.objectContaining({ name: "Zeste", number: 1, next: true }),
        expect.objectContaining({ name: "Madeleine", number: 5, next: false }),
      ]);
      expect(props.path).toEqual([
        [50.9, 4.4],
        [50.8501, 4.3501],
      ]);
      expect(props.position).toBeNull();
    });

    it("before the swipe: the map holds the position marker only", async () => {
      const { view } = setup({ tournee: null, position: POS });
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByText(t.notStarted(EMAIL));
      const props = lastMapProps();
      expect(props.pins).toEqual([]);
      expect(props.path).toEqual([]);
      expect(props.position).toEqual({ lat: 50.85, lng: 4.35 });
    });

    it("a gap keeps its number: the lowest remaining stop is gold, not number 1", async () => {
      const { view } = setup(
        round([
          [2, prospect("a", "Alpha", 50.8, 4.3)],
          [3, prospect("z", "Zeste", 50.9, 4.4)],
        ]),
      );
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      expect(lastMapProps().pins).toEqual([
        expect.objectContaining({ name: "Alpha", number: 2, next: true }),
        expect.objectContaining({ name: "Zeste", number: 3, next: false }),
      ]);
    });

    it("zero pins with a stored position: map mounted, centred on the position", async () => {
      const { view } = setup(round([], POS));
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByText(t.empty);
      const props = lastMapProps();
      expect(props.pins).toEqual([]);
      expect(props.path).toEqual([]);
      expect(props.position).toEqual({ lat: 50.85, lng: 4.35 });
    });

    it("asks the map to fit the stops, not the position", async () => {
      const { view } = setup(round(PROSPECTS, POS));
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByText("Madeleine");
      expect(lastMapProps().fitPosition).toBe(false);
    });

    it("mounts for a loaded round with zero pins", async () => {
      const { view } = setup(round([]));
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByText(t.empty);
      expect(screen.getByTestId("round-map")).toBeTruthy();
      expect(lastMapProps().pins).toEqual([]);
    });

    it("remounts when another agent is chosen", async () => {
      const user = userEvent.setup();
      const other = "marc@example.com";
      const { view } = setup(round(PROSPECTS), 200, 200, [EMAIL, other]);
      view(`/admin/round?agent=${EMAIL}`);
      await screen.findByTestId("round-map");
      expect(mapMounts.count).toBe(1);
      await user.click(screen.getByRole("combobox", { name: t.agentLabel }));
      await user.click(await screen.findByRole("option", { name: other }));
      // Passes even without `key`: the uncached switch goes through the skeleton.
      await waitFor(() => expect(mapMounts.count).toBe(2));
      // Back to a cached round: no skeleton in between, so only the key remounts it.
      await user.click(screen.getByRole("combobox", { name: t.agentLabel }));
      await user.click(await screen.findByRole("option", { name: EMAIL }));
      await waitFor(() => expect(mapMounts.count).toBe(3));
    });
  });
});

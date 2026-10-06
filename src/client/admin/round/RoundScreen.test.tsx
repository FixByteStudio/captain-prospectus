import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import userEvent from "@testing-library/user-event";
import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { AgentRoundResponse, Prospect } from "../../../shared/schemas";
import { STATUS_LABELS, copy } from "../../copy";
import { formatDateTime } from "../../format";
import { createAdminQueryClient } from "../query-client";
import { RoundScreen } from "./RoundScreen";
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

const PROSPECTS = [
  prospect("far", "Zeste", 50.9, 4.4),
  prospect("none", "Alpha", null, null),
  prospect("near", "Madeleine", 50.8501, 4.3501),
];

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

afterEach(() => vi.unstubAllGlobals());

describe("RoundScreen", () => {
  it("asks for an agent and fetches no round before one is chosen", async () => {
    const { asked, view } = setup({ prospects: PROSPECTS, position: null });
    view("/admin/tournee");
    expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
    expect(asked).toEqual([]);
  });

  it("lists the rule's order with count, position age and distances", async () => {
    const { asked, view } = setup({
      prospects: PROSPECTS,
      position: { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: CAPTURED },
    });
    view(`/admin/tournee?agent=${EMAIL}`);
    // Skeleton first, never the "choose an agent" prompt for a linked agent.
    expect(screen.getByRole("status").textContent).toBe(t.loading);
    expect(screen.queryByText(t.choosePrompt)).toBeNull();
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Madeleine"),
      expect.stringContaining("Zeste"),
      expect.stringContaining("Alpha"),
    ]);
    expect(screen.getByText(t.count(3))).toBeTruthy();
    expect(screen.getByText(t.position(formatDateTime(CAPTURED)))).toBeTruthy();
    expect(items[0]?.textContent).toMatch(/\d+ m/);
    expect(items[2]?.textContent).not.toMatch(/\d+ (m|km)\b/);
    expect(asked).toEqual([`/api/admin/agents/${encodeURIComponent(EMAIL)}/round`]);
  });

  it("sorts by name with the notice and no distance when there is no position", async () => {
    const { view } = setup({ prospects: PROSPECTS, position: null });
    view(`/admin/tournee?agent=${EMAIL}`);
    const items = await screen.findAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Alpha"),
      expect.stringContaining("Madeleine"),
      expect.stringContaining("Zeste"),
    ]);
    expect(screen.getByText(t.noPosition)).toBeTruthy();
    for (const li of items) expect(li.textContent).not.toMatch(/\d+ (m|km)\b/);
  });

  it("offers no Visiter, Y aller or link on any row", async () => {
    const { view } = setup({ prospects: PROSPECTS, position: null });
    view(`/admin/tournee?agent=${EMAIL}`);
    for (const li of await screen.findAllByRole("listitem")) {
      expect(li.textContent).not.toMatch(/Visiter|Y aller/);
      expect(within(li).queryByRole("link")).toBeNull();
      expect(within(li).queryByRole("button")).toBeNull();
    }
  });

  it("shows the load-failed alert with a retry when the round fetch fails", async () => {
    const { view } = setup({ prospects: [], position: null }, 500);
    view(`/admin/tournee?agent=${EMAIL}`);
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.errors.retry })).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });

  it("shows the empty message for an empty round", async () => {
    const { view } = setup({ prospects: [], position: null });
    view(`/admin/tournee?agent=${EMAIL}`);
    await waitFor(() => expect(screen.getByText(t.empty)).toBeTruthy());
    expect(screen.getByText(t.count(0))).toBeTruthy();
  });

  it("fetches the round and renders rows once an agent is picked in the Select", async () => {
    const user = userEvent.setup();
    const { asked, view } = setup({ prospects: PROSPECTS, position: null });
    view("/admin/tournee");
    await user.click(await screen.findByRole("combobox", { name: t.agentLabel }));
    await user.click(await screen.findByRole("option", { name: EMAIL }));
    expect(await screen.findAllByRole("listitem")).toHaveLength(3);
    expect(asked).toEqual([`/api/admin/agents/${encodeURIComponent(EMAIL)}/round`]);
  });

  it("ignores an agent that is not in the roster: prompt, no round fetch", async () => {
    const { asked, view } = setup({ prospects: PROSPECTS, position: null });
    view("/admin/tournee?agent=other@example.com");
    expect(await screen.findByText(t.choosePrompt)).toBeTruthy();
    expect(asked).toEqual([]);
  });

  it("shows the load-failed alert with a retry, and no prompt, when the roster fails", async () => {
    const { asked, view } = setup({ prospects: [], position: null }, 200, 500);
    view(`/admin/tournee?agent=${EMAIL}`);
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.errors.retry })).toBeTruthy();
    expect(screen.queryByText(t.choosePrompt)).toBeNull();
    expect(asked).toEqual([]);
  });

  it("keeps the no-position notice off an empty round", async () => {
    const { view } = setup({ prospects: [], position: null });
    view(`/admin/tournee?agent=${EMAIL}`);
    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.queryByText(t.noPosition)).toBeNull();
  });

  it("labels each row with its status badge", async () => {
    const dueToday: Prospect = {
      ...prospect("fu", "Relance", null, null),
      status: "follow_up",
      nextVisitAt: Date.now() - 1000,
    };
    const { view } = setup({
      prospects: [prospect("a", "Alpha", null, null), dueToday],
      position: null,
    });
    view(`/admin/tournee?agent=${EMAIL}`);
    const items = await screen.findAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0] as HTMLElement).getByText(STATUS_LABELS.assigned)).toBeTruthy();
    expect(within(items[1] as HTMLElement).getByText(STATUS_LABELS.follow_up)).toBeTruthy();
  });

  describe("map pane", () => {
    const POS = { lat: 50.85, lng: 4.35, accuracy: 10, capturedAt: CAPTURED };

    it("is absent before an agent is chosen", async () => {
      const { view } = setup({ prospects: PROSPECTS, position: null });
      view("/admin/tournee");
      await screen.findByText(t.choosePrompt);
      expect(screen.queryByTestId("round-map")).toBeNull();
    });

    it("is absent when the round fails to load", async () => {
      const { view } = setup({ prospects: [], position: null }, 500);
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findByText(t.loadFailed);
      expect(screen.queryByTestId("round-map")).toBeNull();
    });

    it("with a position: list numbers, uncoordinated stop has no pin, gold 1, path, position", async () => {
      const { view } = setup({ prospects: PROSPECTS, position: POS });
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      const props = lastMapProps();
      expect(props.pins).toEqual([
        expect.objectContaining({ name: "Madeleine", index: 1, next: true }),
        expect.objectContaining({ name: "Zeste", index: 2, next: false }),
      ]);
      expect(props.path).toEqual([
        [50.8501, 4.3501],
        [50.9, 4.4],
      ]);
      expect(props.position).toEqual({ lat: 50.85, lng: 4.35 });
      expect(props).not.toHaveProperty("recentre");
      expect(props).not.toHaveProperty("onSelect");
    });

    it("without a position: numbering follows the name order, no gold, no path, no position", async () => {
      const { view } = setup({ prospects: PROSPECTS, position: null });
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      const props = lastMapProps();
      expect(props.pins).toEqual([
        expect.objectContaining({ name: "Madeleine", index: 2, next: false }),
        expect.objectContaining({ name: "Zeste", index: 3, next: false }),
      ]);
      expect(props.path).toEqual([]);
      expect(props.position).toBeNull();
    });

    it("without a position: a coordinated first stop by name is not gold", async () => {
      const { view } = setup({
        prospects: [prospect("a", "Alpha", 50.8, 4.3), prospect("z", "Zeste", 50.9, 4.4)],
        position: null,
      });
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findAllByRole("listitem");
      expect(lastMapProps().pins).toEqual([
        expect.objectContaining({ name: "Alpha", index: 1, next: false }),
        expect.objectContaining({ name: "Zeste", index: 2, next: false }),
      ]);
    });

    it("zero pins with a stored position: map mounted, centred on the position", async () => {
      const { view } = setup({ prospects: [], position: POS });
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findByText(t.empty);
      const props = lastMapProps();
      expect(props.pins).toEqual([]);
      expect(props.path).toEqual([]);
      expect(props.position).toEqual({ lat: 50.85, lng: 4.35 });
    });

    it("mounts for a loaded round with zero pins", async () => {
      const { view } = setup({ prospects: [], position: null });
      view(`/admin/tournee?agent=${EMAIL}`);
      await screen.findByText(t.empty);
      expect(screen.getByTestId("round-map")).toBeTruthy();
      expect(lastMapProps().pins).toEqual([]);
    });

    it("remounts when another agent is chosen", async () => {
      const user = userEvent.setup();
      const other = "marc@example.com";
      const { view } = setup({ prospects: PROSPECTS, position: null }, 200, 200, [EMAIL, other]);
      view(`/admin/tournee?agent=${EMAIL}`);
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

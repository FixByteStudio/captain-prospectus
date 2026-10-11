import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { OUTCOME_TO_STATUS } from "../../shared/constants";
import type { OrphanCandidate, OrphanedVisit, OrphansResponse } from "../../shared/schemas";
import { OUTCOME_LABELS, copy } from "../copy";
import { formatDateTime } from "../format";
import { createAdminQueryClient } from "./query-client";
import { OrphansScreen } from "./OrphansScreen";
import { STATUS_EDGE } from "./status";
import { Toaster } from "../ui/sonner";

const t = copy.orphans;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function candidate(id: string, name: string, distanceM: number | null): OrphanCandidate {
  return { id, name, address: null, status: "new", assignedTo: null, distanceM };
}

const VISITED_AT = Date.UTC(2026, 8, 24, 14, 42);

function visit(id: string, overrides: Partial<OrphanedVisit> = {}): OrphanedVisit {
  return {
    id,
    prospectId: `gone-${id}`,
    agentEmail: "lea@example.com",
    visitedAt: VISITED_AT,
    receivedAt: VISITED_AT,
    quarantinedAt: VISITED_AT,
    reason: "unknown_prospect",
    flyerGiven: true,
    outcome: "converted",
    followUpAt: null,
    notes: "patron absent, repasser jeudi",
    prospectName: null,
    hasPosition: true,
    candidates: [candidate("pa", "Pizza Roma", 12), candidate("pb", "Roma Express", 48)],
    ...overrides,
  };
}

const NOT_ASSIGNED = visit("v2", {
  reason: "not_assigned",
  prospectId: "comptoir",
  prospectName: "Le Comptoir",
  agentEmail: "karim@example.com",
  outcome: "not_interested",
  flyerGiven: false,
  notes: null,
  candidates: [candidate("other", "Chez Marcel", 5), candidate("comptoir", "Le Comptoir", 30)],
});

type Post = { path: string; body: unknown };

/** Serves the queue, records every POST, and answers each with `post()`. */
function render_(
  queue: (posts: readonly Post[]) => Response,
  post: (path: string) => Response | Promise<Response> = (path) =>
    json(path.endsWith("/discard") ? { discarded: "x" } : { repaired: true }),
) {
  const posts: Post[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), "http://admin");
    if (init?.method === "POST") {
      posts.push({ path: url.pathname, body: JSON.parse(String(init.body)) });
      return post(url.pathname);
    }
    if (url.pathname === "/api/admin/visits/orphaned") return queue(posts);
    return json({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = createAdminQueryClient();
  client.setDefaultOptions({
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <OrphansScreen />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  const gets = () => fetchMock.mock.calls.filter(([, init]) => init?.method !== "POST").length;
  return { posts, gets, client };
}

function queue(body: OrphansResponse) {
  return () => json(body);
}

/** A row's attach buttons: every button but its « Supprimer ». */
function attachButtons(r: ReturnType<typeof within>): HTMLElement[] {
  const discard = t.discardAria(formatDateTime(VISITED_AT));
  return r
    .getAllByRole("button")
    .filter((b: HTMLElement) => b.getAttribute("aria-label") !== discard);
}

async function row(agent: string): Promise<HTMLElement> {
  return screen.findByRole("listitem", {
    name: t.rowAria(formatDateTime(VISITED_AT), agent),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OrphansScreen", () => {
  it("shows both reasons in one row shape: evidence, « Rattacher à » and « Supprimer »", async () => {
    render_(queue({ visits: [visit("v1"), NOT_ASSIGNED], remaining: 0 }));

    for (const [agent, reason, outcome] of [
      ["lea@example.com", t.reason.unknown_prospect, OUTCOME_LABELS.converted],
      ["karim@example.com", t.reason.not_assigned, OUTCOME_LABELS.not_interested],
    ] as const) {
      const r = within(await row(agent));
      expect(r.getByText(reason)).toBeTruthy();
      expect(r.getByText(outcome)).toBeTruthy();
      expect(r.getByText(agent)).toBeTruthy();
      expect(r.getByText(t.attachTo)).toBeTruthy();
      expect(
        r.getByRole("button", { name: t.discardAria(formatDateTime(VISITED_AT)) }),
      ).toBeTruthy();
    }

    // The edge forecasts the status repairing would set; happy-dom has no
    // CSS, so the class is what can be pinned.
    expect((await row("lea@example.com")).className).toContain(
      STATUS_EDGE[OUTCOME_TO_STATUS.converted],
    );
    // Every row action is secondary, never gold.
    for (const b of attachButtons(within(await row("lea@example.com")))) {
      expect(b.getAttribute("data-variant")).toBe("secondary");
    }
    expect(document.querySelector('[data-variant="default"]')).toBeNull();

    const unknown = within(await row("lea@example.com"));
    expect(unknown.getByText(t.flyer)).toBeTruthy();
    expect(unknown.getByText("« patron absent, repasser jeudi »")).toBeTruthy();
    // No dialog per row: nothing is open until « Supprimer » is pressed.
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("offers the server's candidates nearest first, the distance inside each button", async () => {
    render_(queue({ visits: [visit("v1")], remaining: 0 }));

    const r = within(await row("lea@example.com"));
    const buttons = attachButtons(r);
    expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
      t.attachAria("Pizza Roma", "12 m"),
      t.attachAria("Roma Express", "48 m"),
    ]);
    // Inside the target, not in a column beside it.
    expect(within(buttons[0] as HTMLElement).getByText("· 12 m")).toBeTruthy();
    expect(buttons[0]?.textContent).toContain("Pizza Roma");
  });

  it("attaches to the chosen candidate and says so, after the row has left the queue", async () => {
    const user = userEvent.setup();
    // The server drops the repaired row, as it does: the toast must survive
    // the row unmounting.
    const { posts } = render_(
      (sent) => json({ visits: sent.length > 0 ? [] : [visit("v1")], remaining: 0 }),
      () => json({ visitId: "v1", prospectId: "pa", repaired: true }),
    );

    const r = within(await row("lea@example.com"));
    await user.click(r.getByRole("button", { name: t.attachAria("Pizza Roma", "12 m") }));

    await waitFor(() =>
      expect(posts).toEqual([
        { path: "/api/admin/visits/orphaned/v1/repair", body: { prospectId: "pa" } },
      ]),
    );
    expect(await screen.findByText(t.attached("Pizza Roma"))).toBeTruthy();
    expect(await screen.findByText(t.empty)).toBeTruthy();
  });

  it("says the visit went to the survivor when the server followed a merge", async () => {
    const user = userEvent.setup();
    render_(queue({ visits: [visit("v1")], remaining: 0 }), () =>
      json({ visitId: "v1", prospectId: "survivor", repaired: true }),
    );

    const r = within(await row("lea@example.com"));
    await user.click(r.getByRole("button", { name: t.attachAria("Pizza Roma", "12 m") }));

    expect(await screen.findByText(t.attachedToSurvivor("Pizza Roma"))).toBeTruthy();
  });

  it("says the visit was already attached when the server answers a replay", async () => {
    const user = userEvent.setup();
    render_(queue({ visits: [visit("v1")], remaining: 0 }), () =>
      json({ visitId: "v1", prospectId: "pa", repaired: false }),
    );

    const r = within(await row("lea@example.com"));
    await user.click(r.getByRole("button", { name: t.attachAria("Pizza Roma", "12 m") }));

    expect(await screen.findByText(t.alreadyAttached)).toBeTruthy();
  });

  it("reports a repair the server refused", async () => {
    const user = userEvent.setup();
    render_(queue({ visits: [visit("v1")], remaining: 0 }), () => json({ error: "boom" }, 500));

    const r = within(await row("lea@example.com"));
    await user.click(r.getByRole("button", { name: t.attachAria("Pizza Roma", "12 m") }));

    expect(await screen.findByText(t.attachFailed)).toBeTruthy();
  });

  it("repairs another agent's visit against the prospect it named, with one button", async () => {
    const user = userEvent.setup();
    const { posts } = render_(queue({ visits: [NOT_ASSIGNED], remaining: 0 }));

    const r = within(await row("karim@example.com"));
    const attach = attachButtons(r);
    // Only the named prospect, with its distance from the candidates; the
    // nearer « Chez Marcel » is not offered.
    expect(attach.map((b) => b.getAttribute("aria-label"))).toEqual([
      t.attachAria("Le Comptoir", "30 m"),
    ]);

    await user.click(attach[0] as HTMLElement);
    await waitFor(() =>
      expect(posts).toEqual([
        { path: "/api/admin/visits/orphaned/v2/repair", body: { prospectId: "comptoir" } },
      ]),
    );
  });

  it("still offers the named prospect when the visit recorded no position", async () => {
    const user = userEvent.setup();
    const { posts } = render_(
      queue({ visits: [{ ...NOT_ASSIGNED, hasPosition: false, candidates: [] }], remaining: 0 }),
    );

    const r = within(await row("karim@example.com"));
    expect(r.queryByText(t.noPosition)).toBeNull();
    const attach = attachButtons(r);
    expect(attach.map((b) => b.getAttribute("aria-label"))).toEqual([
      t.attachAria("Le Comptoir", null),
    ]);
    expect(t.attachAria("Le Comptoir", null)).toBe("Rattacher cette visite à Le Comptoir");

    await user.click(attach[0] as HTMLElement);
    await waitFor(() =>
      expect(posts).toEqual([
        { path: "/api/admin/visits/orphaned/v2/repair", body: { prospectId: "comptoir" } },
      ]),
    );
  });

  it("offers the candidates for another agent's visit the server could not name", async () => {
    render_(queue({ visits: [{ ...NOT_ASSIGNED, prospectName: null }], remaining: 0 }));

    const r = within(await row("karim@example.com"));
    expect(attachButtons(r).map((b) => b.getAttribute("aria-label"))).toEqual([
      t.attachAria("Chez Marcel", "5 m"),
      t.attachAria("Le Comptoir", "30 m"),
    ]);
  });

  it("locks only the row whose repair is in flight, its « Supprimer » included", async () => {
    const user = userEvent.setup();
    let answer: (r: Response) => void = () => undefined;
    render_(
      queue({ visits: [visit("v1"), NOT_ASSIGNED], remaining: 0 }),
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );

    const busy = within(await row("lea@example.com"));
    const idle = within(await row("karim@example.com"));
    await user.click(busy.getByRole("button", { name: t.attachAria("Pizza Roma", "12 m") }));

    await waitFor(() =>
      expect(busy.getAllByRole("button").every((b) => (b as HTMLButtonElement).disabled)).toBe(
        true,
      ),
    );
    expect(idle.getAllByRole("button").some((b) => (b as HTMLButtonElement).disabled)).toBe(false);

    answer(json({ repaired: true }));
    await waitFor(() =>
      expect(busy.getAllByRole("button").some((b) => (b as HTMLButtonElement).disabled)).toBe(
        false,
      ),
    );
  });

  it("says so when a visit recorded no position, and offers no candidate", async () => {
    render_(queue({ visits: [visit("v1", { hasPosition: false, candidates: [] })], remaining: 0 }));

    const r = within(await row("lea@example.com"));
    expect(r.getByText(t.noPosition)).toBeTruthy();
    expect(r.queryByText(t.noCandidates)).toBeNull();
    expect(r.queryByText(t.attachTo)).toBeNull();
    expect(r.getAllByRole("button").map((b) => b.getAttribute("aria-label"))).toEqual([
      t.discardAria(formatDateTime(VISITED_AT)),
    ]);
  });

  it("does not blame the position when the visit has one but nothing is near", async () => {
    render_(queue({ visits: [visit("v1", { candidates: [] })], remaining: 0 }));

    const r = within(await row("lea@example.com"));
    expect(r.getByText(t.noCandidates)).toBeTruthy();
    expect(r.queryByText(t.noPosition)).toBeNull();
    expect(r.queryByText(t.attachTo)).toBeNull();
  });

  it("discards only after the destructive confirmation", async () => {
    const user = userEvent.setup();
    let answer: (r: Response) => void = () => undefined;
    const { posts } = render_(
      queue({ visits: [visit("v1")], remaining: 0 }),
      () => new Promise<Response>((resolve) => (answer = resolve)),
    );

    const discard = within(await row("lea@example.com")).getByRole("button", {
      name: t.discardAria(formatDateTime(VISITED_AT)),
    });

    // Cancel sends nothing.
    await user.click(discard);
    let dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(t.confirm.title)).toBeTruthy();
    expect(within(dialog).getByText(t.confirm.body)).toBeTruthy();
    await user.click(within(dialog).getByRole("button", { name: t.confirm.cancel }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts).toEqual([]);

    await user.click(discard);
    dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: t.confirm.confirm }));
    // While the delete is in flight the row stays locked and the dialog
    // cannot be cancelled out from under it.
    await waitFor(() => expect(discard.hasAttribute("disabled")).toBe(true));
    expect(
      within(dialog).getByRole("button", { name: t.confirm.cancel }).hasAttribute("disabled"),
    ).toBe(true);
    await user.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(discard.hasAttribute("disabled")).toBe(true);
    answer(json({ discarded: "v1" }));

    await waitFor(() =>
      expect(posts).toEqual([{ path: "/api/admin/visits/orphaned/v1/discard", body: {} }]),
    );
    expect(await screen.findByText(t.discarded)).toBeTruthy();
  });

  it("reports a discard the server refused", async () => {
    const user = userEvent.setup();
    render_(queue({ visits: [visit("v1")], remaining: 0 }), () => json({ error: "boom" }, 500));

    await user.click(
      within(await row("lea@example.com")).getByRole("button", {
        name: t.discardAria(formatDateTime(VISITED_AT)),
      }),
    );
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", { name: t.confirm.confirm }),
    );

    expect(await screen.findByText(t.discardFailed)).toBeTruthy();
  });

  it("counts the whole queue in the header, pages past the first included", async () => {
    render_(queue({ visits: [visit("v1"), NOT_ASSIGNED], remaining: 3 }));

    expect(await screen.findByText(t.count(5))).toBeTruthy();
    expect(t.count(5)).toBe("5 visites pas encore rattachées");
    expect(screen.getByText(t.lede)).toBeTruthy();
    expect(screen.getByText(t.overflow(3))).toBeTruthy();
  });

  it("keeps the header count over rows kept under a failed refetch", async () => {
    let fail = false;
    const { client } = render_(() =>
      fail ? json({ error: "boom" }, 500) : json({ visits: [visit("v1")], remaining: 0 }),
    );

    expect(await screen.findByText(t.count(1))).toBeTruthy();
    fail = true;
    await client.refetchQueries({ queryKey: ["admin", "visits", "orphans"] });

    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(await row("lea@example.com")).toBeTruthy();
    expect(screen.getByText(t.count(1))).toBeTruthy();
  });

  it("shows the healthy empty state, with no count", async () => {
    render_(queue({ visits: [], remaining: 0 }));

    expect(await screen.findByText(t.empty)).toBeTruthy();
    expect(screen.getByText(t.emptyHint)).toBeTruthy();
    expect(screen.getByRole("link", { name: t.emptyCta }).getAttribute("href")).toBe(
      "/admin/visites",
    );
    expect(screen.queryByText(/pas encore rattachée/)).toBeNull();
  });

  it("shows the load-failed Alert, and « Réessayer » fetches again", async () => {
    const user = userEvent.setup();
    const { gets } = render_(() => json({ error: "boom" }, 500));

    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    const before = gets();
    await user.click(screen.getByRole("button", { name: copy.errors.retry }));
    await waitFor(() => expect(gets()).toBe(before + 1));
  });
});

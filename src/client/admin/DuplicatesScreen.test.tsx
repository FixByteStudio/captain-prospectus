import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { DuplicatePair, Prospect } from "../../shared/schemas";
import { STATUS_LABELS, copy } from "../copy";
import { createAdminQueryClient } from "./query-client";
import { DuplicatesScreen } from "./DuplicatesScreen";
import { Toaster } from "../ui/sonner";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function prospect(id: string, name: string, overrides: Partial<Prospect> = {}): Prospect {
  return {
    id,
    name,
    type: "restaurant",
    lat: 50.85,
    lng: 4.35,
    address: "12 rue des Bouchers",
    phone: null,
    website: null,
    cuisine: null,
    source: "csv",
    status: "new",
    assignedTo: null,
    lastVisitAt: null,
    nextVisitAt: null,
    ...overrides,
  };
}

function pair(overrides: Partial<DuplicatePair> = {}): DuplicatePair {
  return {
    a: prospect("a", "Le Bouchon"),
    b: prospect("b", "Le Bouchon des Filles", {
      status: "assigned",
      assignedTo: "lea@example.com",
    }),
    distanceM: 12,
    aVisits: 0,
    bVisits: 3,
    ...overrides,
  };
}

function render_(fetchImpl: (input: RequestInfo | URL) => Promise<Response>) {
  vi.stubGlobal("fetch", vi.fn(fetchImpl));
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <DuplicatesScreen />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DuplicatesScreen", () => {
  it("shows a pair as one list item, with the distance once", async () => {
    render_(async (input) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        return json({ pairs: [pair()], truncated: false });
      }
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    expect(within(item).getByText("Le Bouchon")).toBeTruthy();
    expect(within(item).getByText("Le Bouchon des Filles")).toBeTruthy();
    expect(within(item).getAllByText("12 m")).toHaveLength(1);
    expect(within(item).getAllByRole("button", { name: /Garder/ })).toHaveLength(2);

    // Each side row is scoped from its own name, so what it carries — status,
    // visit count — is asserted against the right prospect, not the pair.
    function sideOf(name: string) {
      const nameEl = within(item).getByText(name);
      // The name sits in the row's own leading block, one level under the
      // Side row itself — grandparent() rather than a test-id.
      const row = nameEl.parentElement?.parentElement;
      if (!row) throw new Error(`no side row found for "${name}"`);
      return within(row);
    }
    expect(sideOf("Le Bouchon").getByText("Aucune visite")).toBeTruthy();
    expect(sideOf("Le Bouchon").getByText(STATUS_LABELS.new)).toBeTruthy();
    expect(sideOf("Le Bouchon des Filles").getByText("3 visites")).toBeTruthy();
    expect(sideOf("Le Bouchon des Filles").getByText(STATUS_LABELS.assigned)).toBeTruthy();
  });

  it("shows the unknown-distance copy once for the pair", async () => {
    render_(async () => json({ pairs: [pair({ distanceM: null })], truncated: false }));

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    expect(within(item).getAllByText(copy.duplicates.distanceUnknown)).toHaveLength(1);
  });

  it("keeps B: posts survivorId B, mergedId A, toasts and refetches", async () => {
    let mergeBody: unknown;
    let duplicatesCalls = 0;
    render_(async (input, init?: RequestInit) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        duplicatesCalls += 1;
        return json({ pairs: duplicatesCalls === 1 ? [pair()] : [], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") {
        mergeBody = JSON.parse(String(init?.body));
        return json({ dedupeKeyUpdated: false });
      }
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    const keepB = within(item).getByRole("button", {
      name: copy.duplicates.keepAria("Le Bouchon des Filles"),
    });
    await userEvent.click(keepB);

    await waitFor(() => expect(mergeBody).toEqual({ survivorId: "b", mergedId: "a" }));
    expect(await screen.findByText(copy.duplicates.merged("Le Bouchon des Filles"))).toBeTruthy();
    // The sweep is asked again, and the merged pair leaves the list.
    await waitFor(() => expect(duplicatesCalls).toBe(2));
    await waitFor(() =>
      expect(
        screen.queryByRole("listitem", {
          name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
        }),
      ).toBeNull(),
    );
  });

  it("keeps A: posts survivorId A, mergedId B", async () => {
    let mergeBody: unknown;
    render_(async (input, init?: RequestInit) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        return json({ pairs: [pair()], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") {
        mergeBody = JSON.parse(String(init?.body));
        return json({ dedupeKeyUpdated: false });
      }
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    const keepA = within(item).getByRole("button", {
      name: copy.duplicates.keepAria("Le Bouchon"),
    });
    await userEvent.click(keepA);

    await waitFor(() => expect(mergeBody).toEqual({ survivorId: "a", mergedId: "b" }));
    expect(await screen.findByText(copy.duplicates.merged("Le Bouchon"))).toBeTruthy();
  });

  it("undoes a merge from the toast: unmerges the absorbed side and asks the sweep again", async () => {
    const user = userEvent.setup();
    // Names of its own: earlier tests' toasts are still on screen.
    const marcel = pair({ a: prospect("m1", "Chez Marcel"), b: prospect("m2", "Marcel") });
    const posts: string[] = [];
    let duplicatesCalls = 0;
    render_(async (input, init?: RequestInit) => {
      const url = new URL(String(input), "http://admin");
      if (init?.method === "POST") posts.push(url.pathname);
      if (url.pathname === "/api/admin/prospects/duplicates") {
        duplicatesCalls += 1;
        return json({ pairs: [marcel], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") return json({ dedupeKeyUpdated: false });
      if (url.pathname === "/api/admin/prospects/m2/unmerge") return json(marcel.b);
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Chez Marcel", "Marcel"),
    });
    await user.click(
      within(item).getByRole("button", { name: copy.duplicates.keepAria("Chez Marcel") }),
    );

    const toastText = await screen.findByText(copy.duplicates.merged("Chez Marcel"));
    const toastEl = toastText.closest("[data-sonner-toast]") as HTMLElement;
    const before = duplicatesCalls;
    await user.click(within(toastEl).getByRole("button", { name: copy.duplicates.undo }));

    await waitFor(() =>
      expect(posts).toEqual(["/api/admin/prospects/merge", "/api/admin/prospects/m2/unmerge"]),
    );
    expect(await screen.findByText(copy.duplicates.unmerged("Marcel"))).toBeTruthy();
    await waitFor(() => expect(duplicatesCalls).toBeGreaterThan(before));
  });

  it("toasts a failed undo", async () => {
    const user = userEvent.setup();
    const roma = pair({ a: prospect("r1", "Pizza Roma"), b: prospect("r2", "Roma Express") });
    render_(async (input) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        return json({ pairs: [roma], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") return json({ dedupeKeyUpdated: false });
      if (url.pathname === "/api/admin/prospects/r2/unmerge") return json({}, 500);
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Pizza Roma", "Roma Express"),
    });
    await user.click(
      within(item).getByRole("button", { name: copy.duplicates.keepAria("Pizza Roma") }),
    );
    const toastEl = (await screen.findByText(copy.duplicates.merged("Pizza Roma"))).closest(
      "[data-sonner-toast]",
    ) as HTMLElement;
    await user.click(within(toastEl).getByRole("button", { name: copy.duplicates.undo }));

    expect(await screen.findByText(copy.duplicates.unmergeFailed)).toBeTruthy();
  });

  it("disables both Garder buttons while a merge is in flight, and re-enables after", async () => {
    let release: (body: unknown) => void = () => {};
    render_(async (input) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        return json({ pairs: [pair()], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") {
        return new Promise<Response>((resolve) => {
          release = (body) => resolve(json(body));
        });
      }
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    const keepA = within(item).getByRole("button", {
      name: copy.duplicates.keepAria("Le Bouchon"),
    });
    const keepB = within(item).getByRole("button", {
      name: copy.duplicates.keepAria("Le Bouchon des Filles"),
    });
    await userEvent.click(keepA);

    await waitFor(() => expect((keepA as HTMLButtonElement).disabled).toBe(true));
    expect((keepB as HTMLButtonElement).disabled).toBe(true);

    release({ dedupeKeyUpdated: false });

    await waitFor(() => expect((keepA as HTMLButtonElement).disabled).toBe(false));
    expect((keepB as HTMLButtonElement).disabled).toBe(false);
  });

  it("toasts a failure and keeps the pair on a 500", async () => {
    render_(async (input) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        return json({ pairs: [pair()], truncated: false });
      }
      if (url.pathname === "/api/admin/prospects/merge") {
        return json({}, 500);
      }
      return json({}, 404);
    });

    const item = await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    const keepB = within(item).getByRole("button", {
      name: copy.duplicates.keepAria("Le Bouchon des Filles"),
    });
    await userEvent.click(keepB);

    expect(await screen.findByText(copy.duplicates.mergeFailed)).toBeTruthy();
    expect(
      screen.getByRole("listitem", {
        name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
      }),
    ).toBeTruthy();
  });

  it("shows the healthy empty state with the toolbar count at 0", async () => {
    render_(async () => json({ pairs: [], truncated: false }));

    expect(await screen.findByText(copy.duplicates.empty)).toBeTruthy();
    expect(screen.getByText(copy.duplicates.emptyHint)).toBeTruthy();
    expect(screen.getByText("0 paire")).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.duplicates.emptyCta })).toBeTruthy();
  });

  it("shows no pair count while the first sweep is still in flight", async () => {
    let release: () => void = () => {};
    render_(async () => {
      await new Promise<void>((resolve) => (release = resolve));
      return json({ pairs: [], truncated: false });
    });

    // The skeleton stands in; no "0 paire"/"0 paires" is shown before the
    // sweep has actually answered — a count on the skeleton would announce a
    // healthy queue too early.
    expect(screen.queryByText(copy.duplicates.count(0))).toBeNull();
    expect(screen.queryByText(/\d+ paires?/)).toBeNull();

    release();
    expect(await screen.findByText(copy.duplicates.empty)).toBeTruthy();
    expect(screen.getByText(copy.duplicates.count(0))).toBeTruthy();
  });

  it("shows the truncation alert", async () => {
    render_(async () => json({ pairs: [pair()], truncated: true }));

    expect(await screen.findByText(copy.duplicates.truncated)).toBeTruthy();
  });

  it("relaunches the search on click, disabling the button while fetching", async () => {
    let calls = 0;
    let release: () => void = () => {};
    render_(async (input) => {
      const url = new URL(String(input), "http://admin");
      if (url.pathname === "/api/admin/prospects/duplicates") {
        calls += 1;
        // The second sweep is held open so the in-flight state can be seen.
        if (calls === 2) await new Promise<void>((resolve) => (release = resolve));
        return json({ pairs: [pair()], truncated: false });
      }
      return json({}, 404);
    });

    await screen.findByRole("listitem", {
      name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
    });
    expect(calls).toBe(1);

    const relaunch = screen.getByRole("button", { name: copy.duplicates.relaunch });
    await userEvent.click(relaunch);

    await waitFor(() => expect(calls).toBe(2));
    const busy = screen.getByRole("button", { name: copy.duplicates.relaunching });
    expect((busy as HTMLButtonElement).disabled).toBe(true);

    release();
    const idle = await screen.findByRole("button", { name: copy.duplicates.relaunch });
    expect((idle as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows the load-failed state, and its retry asks again", async () => {
    let calls = 0;
    render_(async () => {
      calls += 1;
      return calls === 1 ? json({}, 500) : json({ pairs: [pair()], truncated: false });
    });

    expect(await screen.findByText(copy.duplicates.loadFailed)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: copy.errors.retry }));

    expect(
      await screen.findByRole("listitem", {
        name: copy.duplicates.pairAria("Le Bouchon", "Le Bouchon des Filles"),
      }),
    ).toBeTruthy();
    expect(calls).toBe(2);
  });
});

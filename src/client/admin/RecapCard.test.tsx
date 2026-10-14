/**
 * The sidebar's recap card (docs/design.md › Layout). `recap.test.ts` pins the
 * lines; this pins what the card shows around them: nothing to click, nothing
 * while loading or after a failure, and the rail's Info button.
 *
 * Rendered without `AdminSidebar`: `SidebarFooter` is a plain div and
 * `Tooltip` brings its own provider, so no Sidebar context is needed.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { QueryClientProvider, onlineManager } from "@tanstack/react-query";
import type { RecapResponse } from "../../shared/schemas";
import { adminKeys } from "./queries";
import { createAdminQueryClient } from "./query-client";
import { RecapCard } from "./RecapCard";

const NOW = Date.parse("2026-10-14T10:00:00.000Z");

const WORKING_DAY: RecapResponse = {
  date: "2026-10-14",
  activeAgents: 1,
  rosterSize: 2,
  visitsToday: 12,
  lastReceivedAt: NOW - 4 * 60_000,
  serverTime: NOW,
};

function serve(response: () => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response()),
  );
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function renderCard(rail = false) {
  const client = createAdminQueryClient();
  const view = render(
    <QueryClientProvider client={client}>
      <RecapCard rail={rail} />
    </QueryClientProvider>,
  );
  return { ...view, client };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/** The dot beside the headline: decorative, so found through its line. */
function dotOf(headline: string): HTMLElement {
  const dot = screen.getByText(headline).querySelector("span[aria-hidden=true]");
  if (!(dot instanceof HTMLElement)) throw new Error(`no dot beside ${headline}`);
  return dot;
}

describe("RecapCard", () => {
  it("tells the day in full, with nothing to focus or click", async () => {
    serve(() => json(WORKING_DAY));
    const { container } = renderCard();

    expect(await screen.findByText("1 / 2 agents actifs")).toBeTruthy();
    expect(screen.getByText("mercredi 14 octobre")).toBeTruthy();
    expect(screen.getByText("12 visites")).toBeTruthy();
    expect(screen.getByText("Dernière visite reçue il y a 4 min")).toBeTruthy();
    expect(container.querySelectorAll("a, button, [tabindex]")).toHaveLength(0);
    expect(dotOf("1 / 2 agents actifs").className).toContain("bg-success");
  });

  it("drops the age line on a day with no visit", async () => {
    serve(() => json({ ...WORKING_DAY, activeAgents: 0, visitsToday: 0, lastReceivedAt: null }));
    renderCard();

    expect(await screen.findByText("Aucune visite")).toBeTruthy();
    expect(screen.queryByText(/Dernière visite reçue/)).toBeNull();
    expect(dotOf("0 / 2 agents actifs").className).toContain("bg-band-muted");
  });

  it("keeps the last answer while the browser is offline", async () => {
    serve(() => json(WORKING_DAY));
    renderCard();
    await screen.findByText("12 visites");

    try {
      act(() => onlineManager.setOnline(false));
      // The offline banner says the data is frozen; the card stays to match it.
      expect(screen.getByText("12 visites")).toBeTruthy();
    } finally {
      act(() => onlineManager.setOnline(true));
    }
  });

  it("shows no card while loading or once the poll has failed", async () => {
    serve(() => new Response("{}", { status: 500 }));
    const { container, client } = renderCard();

    expect(container.querySelector("[data-slot=sidebar-footer]")).toBeNull();
    // createAdminQueryClient retries once before the query settles as failed.
    await waitFor(() => expect(client.getQueryState(adminKeys.recap())?.status).toBe("error"), {
      timeout: 3000,
    });
    expect(container.querySelector("[data-slot=sidebar-footer]")).toBeNull();
  });

  it("is an Info button in the rail, named with every line", async () => {
    serve(() => json(WORKING_DAY));
    renderCard(true);

    const button = await screen.findByRole("button", {
      name: "Récapitulatif du jour : mercredi 14 octobre, 1 / 2 agents actifs, 12 visites, Dernière visite reçue il y a 4 min",
    });
    expect(button).toBeTruthy();
    expect(screen.queryByText("12 visites")).toBeNull();
  });

  it("polls every 15 s on a visible tab only, and catches up on focus", async () => {
    serve(() => json(WORKING_DAY));
    const { client } = renderCard();
    await screen.findByText("12 visites");

    const options = client.getQueryCache().find({ queryKey: adminKeys.recap() })
      ?.observers[0]?.options;
    expect(options?.refetchInterval).toBe(15_000);
    // TanStack's default, false, is what pauses the poll on a hidden tab.
    expect(options?.refetchIntervalInBackground).toBeUndefined();
    expect(options?.refetchOnWindowFocus).toBe(true);
  });
});

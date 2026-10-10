/**
 * Import rebuilt: the map path (GH #181) — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-181-import-map-rebuilt.md.
 * Narrow-viewport wrapping and dark-mode colours are a manual check: happy-dom
 * evaluates neither layout nor computed colour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { AreaCandidate, AreaSearchResponse } from "../../../shared/schemas";
import { copy } from "../../copy";
import { createAdminQueryClient } from "../query-client";
import { ImportScreen } from "./ImportScreen";
import type { Circle, Vertex } from "./map";

/**
 * A stub for the Leaflet-imperative canvas: buttons that call `onMapClick`
 * with fixed points, and text printing what was drawn, so the pure geometry
 * in `map.ts` stays the only thing under test on the drawing side.
 */
vi.mock("./MapCanvas", () => ({
  MapCanvas: ({
    onMapClick,
    polygon,
    circle,
  }: {
    onMapClick: (point: Vertex) => void;
    polygon: Vertex[];
    circle: Circle | null;
  }) => (
    <div data-testid="map-canvas">
      <button onClick={() => onMapClick([50.85, 4.35])}>click-1</button>
      <button onClick={() => onMapClick([50.86, 4.36])}>click-2</button>
      <button onClick={() => onMapClick([50.87, 4.37])}>click-3</button>
      <span data-testid="polygon-length">{polygon.length}</span>
      <span data-testid="circle-radius">{circle?.radius ?? ""}</span>
    </div>
  ),
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function candidate(over: Partial<AreaCandidate> = {}): AreaCandidate {
  return {
    sourceRef: "node/1",
    name: "L'Estaminet",
    type: "restaurant",
    lat: 50.8466,
    lng: 4.3528,
    address: "12 rue des Bouchers",
    phone: null,
    website: null,
    cuisine: null,
    named: true,
    likelyDuplicateOf: null,
    ...over,
  };
}

function answer(over: Partial<AreaSearchResponse> = {}): AreaSearchResponse {
  return { candidates: [], truncated: false, cached: false, ...over };
}

function renderScreen() {
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <MemoryRouter initialEntries={["/admin/import"]}>
      <QueryClientProvider client={client}>
        <ImportScreen />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

async function goToMap() {
  renderScreen();
  await userEvent.click(screen.getByRole("button", { name: copy.import.source.map.action }));
  await screen.findByTestId("map-canvas");
}

async function drawPolygon() {
  await userEvent.click(screen.getByText("click-1"));
  await userEvent.click(screen.getByText("click-2"));
  await userEvent.click(screen.getByText("click-3"));
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json(answer())),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MapStep", () => {
  it("switching provider clears the drawing and both results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ candidates: [candidate()] }))),
    );
    await goToMap();
    await drawPolygon();
    expect(screen.getByTestId("polygon-length").textContent).toBe("3");
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    await screen.findByText(copy.map.results.found(1));

    // Radix Select: open via keyboard on the combobox (a pointer-open can fail
    // in happy-dom), then pick the option by name rather than by position.
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(screen.getByRole("option", { name: copy.map.provider.google }));

    expect(screen.getByTestId("polygon-length").textContent).toBe("0");
    expect(screen.getByText(copy.map.circle.none)).toBeTruthy();
    expect(screen.getByText(copy.map.results.idleGoogle)).toBeTruthy();
    expect(screen.queryByText(copy.map.undo)).toBeNull();
    expect(screen.queryByText(copy.map.results.found(1))).toBeNull();
  });

  it("excludes an unnamed candidate from the tally, the count and the import", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        json(
          answer({
            candidates: [
              candidate({ sourceRef: "node/1", name: "L'Estaminet" }),
              candidate({ sourceRef: "node/2", name: "Chez Marcel" }),
              candidate({ sourceRef: "node/3", name: "", named: false }),
            ],
          }),
        ),
      ),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));

    expect(await screen.findByText(copy.map.results.found(2))).toBeTruthy();
    expect(screen.getByText(copy.map.results.unnamed(1))).toBeTruthy();
    const noName = screen.getByText(copy.map.results.noName);
    expect(noName.className).toContain("line-through");

    const startButton = screen.getByRole("button", { name: copy.map.results.start(2) });
    await userEvent.click(startButton);
    const [, sent] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const body = JSON.parse(String(sent?.[1]?.body)) as { rows: { sourceRef: string }[] };
    expect(body.rows.map((r) => r.sourceRef)).toEqual(["node/1", "node/2"]);
  });

  it("keeps a likely duplicate out unless ticked, and resets the tick on a new search", async () => {
    const named1 = candidate({ sourceRef: "node/1", name: "L'Estaminet" });
    const named2 = candidate({ sourceRef: "node/2", name: "Chez Marcel" });
    const likely = candidate({
      sourceRef: "node/3",
      name: "Le Sablon",
      likelyDuplicateOf: { id: "p1", name: "Le Sablon" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ candidates: [named1, named2, likely] }))),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));

    expect(await screen.findByRole("button", { name: copy.map.results.start(2) })).toBeTruthy();

    const checkbox = document.getElementById("include-likely");
    if (!checkbox) throw new Error("no include-likely checkbox");
    await userEvent.click(checkbox);
    expect(await screen.findByRole("button", { name: copy.map.results.start(3) })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    expect(await screen.findByRole("button", { name: copy.map.results.start(2) })).toBeTruthy();
  });

  it("shows the cached answer's age, in days, hours or under an hour, and a plain line with no age", async () => {
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ cached: true, cachedAt: threeDaysAgo }))),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    expect(await screen.findByText("Résultat en cache, obtenu il y a 3 jours.")).toBeTruthy();

    const fiveHoursAgo = Date.now() - 5 * 60 * 60 * 1000;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ cached: true, cachedAt: fiveHoursAgo }))),
    );
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    expect(await screen.findByText("Résultat en cache, obtenu il y a 5 heures.")).toBeTruthy();

    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ cached: true, cachedAt: tenMinutesAgo }))),
    );
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    expect(
      await screen.findByText("Résultat en cache, obtenu il y a moins d'une heure."),
    ).toBeTruthy();

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(answer({ cached: true }))),
    );
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    expect(await screen.findByText("Résultat en cache, actualisé sous 7 jours.")).toBeTruthy();
  });

  it("shows the circle radius in fr-FR", async () => {
    await goToMap();
    const trigger = screen.getByRole("combobox");
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    // click-1 places the centre; click-2, ~1.3 km away on the diagonal, sets
    // the radius through map.ts (radiusBetween is the great-circle distance,
    // not an east-west offset).
    await userEvent.click(screen.getByText("click-1"));
    await userEvent.click(screen.getByText("click-2"));
    // Literal, not built from the copy function under test: a decimal comma.
    expect(screen.getByText(/^Rayon \d,\d km/)).toBeTruthy();
    expect(copy.map.circle.radius(1500)).toBe("Rayon 1,5 km");
  });

  it("names how many rows already went in when a later batch fails, and Réessayer re-sends", async () => {
    const sizes: number[] = [];
    const candidates = Array.from({ length: 300 }, (_, i) =>
      candidate({ sourceRef: `node/${i}`, name: `Lieu ${i}` }),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
        if (String(url).includes("/import/overpass")) return json(answer({ candidates }));
        sizes.push((JSON.parse(String(init?.body)) as { rows: unknown[] }).rows.length);
        if (sizes.length === 2) return json({ error: "failed" }, 500);
        return json({ created: 1, updated: 0 });
      }),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    const startButton = await screen.findByRole("button", { name: copy.map.results.start(300) });
    await userEvent.click(startButton);

    expect(await screen.findByText(copy.map.failedAfter(250))).toBeTruthy();
    // Literal, not built from the copy function under test: this is the wire
    // that distinguishes it from `import.failedAfter`'s file-shaped wording.
    expect(
      screen.getByText(
        "L'import s'est interrompu après 250 lignes envoyées. Relancer l'import est sans risque.",
      ),
    ).toBeTruthy();
    const retry = screen.getByRole("button", { name: copy.import.actions.retry });
    await userEvent.click(retry);
    await screen.findByText(copy.import.result.title);
    expect(sizes).toEqual([250, 50, 250, 50]);
  });

  it("puts the provider above the map, and under it the vertex count, undo, clear, then the gold search (#185)", async () => {
    await goToMap();
    await drawPolygon();

    const order = [
      screen.getByRole("combobox", { name: copy.map.provider.label }),
      screen.getByTestId("map-canvas"),
      screen.getByText(copy.map.vertices(3)),
      screen.getByRole("button", { name: copy.map.undo }),
      screen.getByRole("button", { name: copy.map.clear }),
      screen.getByRole("button", { name: copy.map.search }),
    ];
    for (let i = 1; i < order.length; i++) {
      const [before, after] = [order[i - 1], order[i]];
      // DOCUMENT_POSITION_FOLLOWING: `after` comes later in the document.
      expect(before?.compareDocumentPosition(after as Node)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    }
    // Gold is the one main action; undo and clear stay secondary.
    expect(screen.getByRole("button", { name: copy.map.search }).dataset.variant).toBe("default");
    expect(screen.getByRole("button", { name: copy.map.undo }).dataset.variant).toBe("ghost");
    expect(screen.getByRole("button", { name: copy.map.clear }).dataset.variant).toBe("outline");
  });

  it("shows the Zone bar in ink with an accessible name, and no floating card (#370, #231)", async () => {
    const pending: { resolve: (() => void) | null } = { resolve: null };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: RequestInfo | URL) => {
        if (String(url).includes("/import/overpass"))
          return Promise.resolve(json(answer({ candidates: [candidate()] })));
        return new Promise((resolve) => {
          pending.resolve = () => resolve(json({ created: 1, updated: 0 }));
        });
      }),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));
    await userEvent.click(await screen.findByRole("button", { name: copy.map.results.start(1) }));

    const bar = await screen.findByRole("progressbar", { name: copy.import.progressLabel });
    expect(bar.querySelector('[data-slot="progress-indicator"]')?.className).toContain(
      "bg-foreground",
    );
    expect(screen.queryByRole("status")).toBeNull();

    pending.resolve?.();
    await screen.findByText(copy.import.result.title);
  });

  it("shows a failed search as a destructive Alert under the map (#185)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "internal" }, 500)),
    );
    await goToMap();
    await drawPolygon();
    await userEvent.click(screen.getByRole("button", { name: copy.map.search }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(copy.map.failed);
    expect(screen.getByRole("button", { name: copy.map.search })).toBeTruthy();
  });
});

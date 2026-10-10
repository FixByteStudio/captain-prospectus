/**
 * Import rebuilt (GH #180): the stepper fork, a rejected-row preview, the
 * running state, the result dialog and the failure Alert — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-180-import-csv-rebuilt.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { copy } from "../../copy";
import type { ImportsResponse } from "../../../shared/schemas";
import { createAdminQueryClient } from "../query-client";
import { ImportScreen } from "./ImportScreen";

// The map fork's own canvas is Leaflet-imperative and out of scope here
// (#181); a stub keeps the fork's presence assertable without a Leaflet DOM.
vi.mock("./MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A header, `rows` valid lines, then (optionally) a nameless one. The reject
 * comes last in the file so "listed first" in the preview is a real claim.
 */
function csvFile(rows: number, opts: { withReject?: boolean } = {}): File {
  const lines = ["nom,latitude,longitude"];
  for (let i = 0; i < rows; i++) {
    lines.push(`Le lieu ${i},50.8466,4.3528`);
  }
  if (opts.withReject) lines.push(",50.85,4.35");
  return new File([lines.join("\n")], "prospects.csv", { type: "text/csv" });
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  return input;
}

/** Body rows of the preview table, header excluded. */
function bodyRows(): HTMLElement[] {
  return screen.getAllByRole("row").slice(1);
}

/**
 * Source also reads the import log, so every stub answers that GET itself and
 * hands only the batch POSTs to `batch` (GH #390).
 */
type Handler = (url: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>;
function stubFetch(batch: Handler, imports: () => ImportsResponse = () => ({ imports: [] })) {
  const fetchMock = vi.fn<Handler>((url, init) =>
    String(url) === "/api/admin/imports" ? json(imports()) : batch(url, init),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The batch POSTs only, in order. */
function batchCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter(([url]) => String(url) !== "/api/admin/imports");
}

function beforeUnloadCancelled(): boolean {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
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

async function goToPreview(rows: number, opts: { withReject?: boolean } = {}) {
  renderScreen();
  await userEvent.upload(fileInput(), csvFile(rows, opts));
  await screen.findByText(copy.import.columns.lede);
  await userEvent.click(screen.getByText(copy.import.actions.toPreview));
  await screen.findByText(copy.import.preview.coordinates);
}

beforeEach(() => {
  stubFetch(() => json({ created: 0, updated: 0 }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ImportScreen", () => {
  it("lands a file picked on Source on Fichier & colonnes, step 2 of 3, Source done", async () => {
    renderScreen();
    const nav = screen.getByRole("navigation", { name: copy.import.steps.label });
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe(
      `1${copy.import.steps.current}${copy.import.steps.source}`,
    );

    await userEvent.upload(fileInput(), csvFile(1));
    await screen.findByText(copy.import.columns.lede);

    const items = within(nav).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      `${copy.import.steps.upcoming(1)}${copy.import.steps.source} (${copy.import.steps.done})`,
      `2${copy.import.steps.current}${copy.import.steps.columns}`,
      `3${copy.import.steps.upcoming(3)}${copy.import.steps.preview}`,
    ]);
    expect(copy.import.steps.columns).toBe("Fichier & colonnes");
    expect(copy.import.steps.preview).toBe("Aperçu & validation");
  });

  it("opens the file picker from « Importer un fichier »", async () => {
    renderScreen();
    const click = vi.spyOn(fileInput(), "click");
    await userEvent.click(screen.getByRole("button", { name: copy.import.source.csv.action }));
    expect(click).toHaveBeenCalledTimes(1);
  });

  it("returns to Source from Retour on step 2", async () => {
    renderScreen();
    await userEvent.upload(fileInput(), csvFile(1));
    await screen.findByText(copy.import.columns.lede);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.back }));

    expect(screen.getByRole("button", { name: copy.import.source.csv.action })).toBeTruthy();
    expect(screen.queryByText(copy.import.columns.lede)).toBeNull();
  });

  it("opens Zone from « Dessiner une zone », two steps only on the map path", async () => {
    renderScreen();
    await userEvent.click(screen.getByRole("button", { name: copy.import.source.map.action }));

    expect(screen.getByTestId("map-canvas")).toBeTruthy();
    const nav = screen.getByRole("navigation", { name: copy.import.steps.label });
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
    expect(within(nav).getByText(copy.import.steps.source).textContent).toContain(
      copy.import.steps.done,
    );
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toContain(
      copy.import.steps.map,
    );
  });

  it.each([
    ["an empty file", "nom,latitude\n", copy.import.file.emptyFile],
    ["a file with no header", "", copy.import.file.noHeaders],
  ])("shows %s as an Alert and stays on Source", async (_name, content, message) => {
    renderScreen();
    await userEvent.upload(fileInput(), new File([content], "x.csv", { type: "text/csv" }));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.import.source.csv.action })).toBeTruthy();
    expect(screen.queryByText(copy.import.columns.lede)).toBeNull();
  });

  it("shows an unreadable file as an Alert and stays on Source", async () => {
    renderScreen();
    const file = new File(["x"], "x.csv", { type: "text/csv" });
    vi.spyOn(file, "text").mockRejectedValue(new Error("unreadable"));
    await userEvent.upload(fileInput(), file);

    expect(await screen.findByText(copy.import.file.unreadable)).toBeTruthy();
    expect(screen.queryByText(copy.import.columns.lede)).toBeNull();
  });

  it("lists the rejected row first, struck through, with its reason; a ready row shows fr-FR coordinates", async () => {
    await goToPreview(1, { withReject: true });

    const [first, second] = bodyRows();
    if (!first || !second) throw new Error("expected two preview rows");
    expect(within(first).getByText(copy.import.reasons.missingName)).toBeTruthy();
    expect(within(first).getByText(copy.import.preview.line(2)).className).toContain(
      "line-through",
    );
    expect(within(second).getByText("Le lieu 0")).toBeTruthy();
    expect(within(second).getByText("50,8466 · 4,3528")).toBeTruthy();
  });

  it("summarises the counts, shares and separator, flags ready rows and shows step 3 of 3", async () => {
    // 3 valid + 1 rejected: 75 % / 25 %.
    await goToPreview(3, { withReject: true });

    expect(screen.getByText(copy.import.preview.summary(3, 4))).toBeTruthy();
    expect(screen.getByText(copy.import.preview.separator(","))).toBeTruthy();
    expect(screen.getByText(copy.import.preview.ready(3))).toBeTruthy();
    expect(screen.getByText(copy.import.preview.rejected(1))).toBeTruthy();
    expect(screen.getByText(copy.import.preview.share(75))).toBeTruthy();
    expect(screen.getByText(copy.import.preview.share(25))).toBeTruthy();
    expect(screen.getAllByText(copy.import.preview.readyChip)).toHaveLength(3);
    expect(screen.getByText(copy.import.columns.step(3, 3))).toBeTruthy();
  });

  it("filters the ledger to the rejected rows and back", async () => {
    await goToPreview(3, { withReject: true });
    expect(bodyRows()).toHaveLength(4);

    await userEvent.click(screen.getByRole("radio", { name: copy.import.preview.errors(1) }));
    const rows = bodyRows();
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText(copy.import.reasons.missingName)).toBeTruthy();

    await userEvent.click(screen.getByRole("radio", { name: copy.import.preview.all }));
    expect(bodyRows()).toHaveLength(4);
  });

  it("blocks leaving the page while running, disables Retour and Importer, and shows batch progress", async () => {
    const pending: { resolve: (() => void) | null } = { resolve: null };
    stubFetch(
      () =>
        new Promise<Response>((resolve) => {
          pending.resolve = () => resolve(json({ created: 1, updated: 0 }));
        }),
    );
    await goToPreview(1);
    expect(beforeUnloadCancelled()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    expect(await screen.findByText(copy.import.runningTitle)).toBeTruthy();
    expect(screen.getByText(copy.import.runningCount(0, 1))).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: copy.import.progressLabel });
    expect(bar.querySelector('[data-slot="progress-indicator"]')?.className).toContain(
      "bg-foreground",
    );
    expect(screen.getByRole("button", { name: copy.import.actions.back })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: copy.import.actions.start(1) })).toHaveProperty(
      "disabled",
      true,
    );
    expect(beforeUnloadCancelled()).toBe(true);

    pending.resolve?.();
    await screen.findByText(copy.import.result.title);
    expect(screen.queryByText(copy.import.runningTitle)).toBeNull();
    expect(beforeUnloadCancelled()).toBe(false);
  });

  it("sends the file name and the rejected-row count with the import log (ADR-0030)", async () => {
    const fetchMock = stubFetch(() => json({ created: 3, updated: 0 }));
    await goToPreview(3, { withReject: true });
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(3) }));
    await screen.findByText(copy.import.result.title);

    const body = JSON.parse(String(batchCalls(fetchMock)[0]?.[1]?.body)) as {
      importLog: Record<string, unknown>;
    };
    expect(body.importLog).toMatchObject({
      batchIndex: 0,
      batchCount: 1,
      rejected: 1,
      fileName: "prospects.csv",
    });
    expect(body.importLog).not.toHaveProperty("zoneVertices");
  });

  it("sends 300 rows as 250 then 50, reading 250 / 300 in between", async () => {
    const bodies: { rows: unknown[] }[] = [];
    const second: { resolve: (() => void) | null } = { resolve: null };
    stubFetch((_url, init) => {
      bodies.push(JSON.parse(String(init?.body)) as { rows: unknown[] });
      if (bodies.length === 1) return json({ created: 250, updated: 0 });
      return new Promise<Response>((resolve) => {
        second.resolve = () => resolve(json({ created: 50, updated: 0 }));
      });
    });
    await goToPreview(300);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(300) }));

    expect(await screen.findByText(copy.import.runningCount(250, 300))).toBeTruthy();
    expect(bodies.map((b) => b.rows.length)).toEqual([250, 50]);

    second.resolve?.();
    expect(await screen.findByText(copy.import.result.title)).toBeTruthy();
  });

  it("ends in a result dialog naming created, updated and rejected, and Terminer returns to Source", async () => {
    stubFetch(() => json({ created: 1, updated: 0 }));
    await goToPreview(1, { withReject: true });
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.import.result.title)).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.created(1), { exact: false })).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.updated(0), { exact: false })).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.skipped(1), { exact: false })).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("button", { name: copy.import.actions.done }));
    expect(await screen.findByText(copy.import.source.csv.title)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows Derniers imports on Source, empty at first", async () => {
    renderScreen();
    expect(screen.getByRole("heading", { name: copy.import.recent.title })).toBeTruthy();
    expect(await screen.findByText(copy.import.recent.empty)).toBeTruthy();
  });

  it("lists the import that just ran when Terminer returns to Source (GH #390)", async () => {
    let reads = 0;
    stubFetch(
      () => json({ created: 1, updated: 0 }),
      () => {
        reads += 1;
        return {
          imports:
            reads === 1
              ? []
              : [
                  {
                    id: crypto.randomUUID(),
                    source: "csv",
                    fileName: "prospects.csv",
                    zoneVertices: null,
                    zoneRadiusM: null,
                    created: 1,
                    updated: 0,
                    rejected: 0,
                    createdBy: "admin@exemple.be",
                    startedAt: Date.now(),
                    status: "done",
                  },
                ],
        };
      },
    );
    await goToPreview(1);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: copy.import.actions.done }));

    const table = await screen.findByRole("table", { name: copy.import.recent.title });
    expect(within(table).getByText("prospects.csv")).toBeTruthy();
  });

  it("names the rows already sent when a later batch fails, and Réessayer re-sends from the start", async () => {
    const sizes: number[] = [];
    stubFetch((_url, init) => {
      sizes.push((JSON.parse(String(init?.body)) as { rows: unknown[] }).rows.length);
      if (sizes.length === 2) return json({ error: "failed" }, 500);
      return json({ created: 1, updated: 0 });
    });
    await goToPreview(300);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(300) }));

    expect(await screen.findByText(copy.import.failedAfter(250))).toBeTruthy();
    expect(beforeUnloadCancelled()).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.retry }));
    await screen.findByText(copy.import.result.title);
    expect(sizes).toEqual([250, 50, 250, 50]);
  });

  it("names zero rows sent when the very first batch fails", async () => {
    stubFetch(() => json({ error: "failed" }, 500));
    await goToPreview(1);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    expect(await screen.findByText(copy.import.failedAfter(0))).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.import.actions.retry })).toBeTruthy();
  });

  it("formatCount groups thousands with a no-break space in the running count", () => {
    expect(copy.import.running(1284, 1300)).toMatch(/^Import en cours : 1\s284 \/ 1\s300$/);
  });
});

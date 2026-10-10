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
  await userEvent.click(screen.getByText(copy.import.source.csv));
  await userEvent.upload(fileInput(), csvFile(rows, opts));
  await screen.findByText(copy.import.columns.lede);
  await userEvent.click(screen.getByText(copy.import.actions.toPreview));
  await screen.findByText(copy.import.preview.coordinates);
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => json({ created: 0, updated: 0 })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ImportScreen", () => {
  it("forks to Fichier · Colonnes · Aperçu on the CSV path, Source marked done", async () => {
    renderScreen();
    const nav = screen.getByRole("navigation", { name: copy.import.steps.label });
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe(
      `1${copy.import.steps.current}${copy.import.steps.source}`,
    );

    await userEvent.click(screen.getByText(copy.import.source.csv));

    expect(screen.getByRole("button", { name: copy.import.file.choose })).toBeTruthy();
    const items = within(nav).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      `${copy.import.steps.upcoming(1)}${copy.import.steps.source} (${copy.import.steps.done})`,
      `2${copy.import.steps.current}${copy.import.steps.file}`,
      `3${copy.import.steps.upcoming(3)}${copy.import.steps.columns}`,
      `4${copy.import.steps.upcoming(4)}${copy.import.steps.preview}`,
    ]);
    expect(copy.import.steps.preview).toBe("Aperçu & validation");
    expect(nav.querySelector('[aria-current="step"]')?.textContent).toBe(
      `2${copy.import.steps.current}${copy.import.steps.file}`,
    );
  });

  it("forks to Zone, two steps only, on the map path", async () => {
    renderScreen();
    await userEvent.click(screen.getByText(copy.import.source.map));

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

  it("shows an empty file as an Alert and stays on Fichier", async () => {
    renderScreen();
    await userEvent.click(screen.getByText(copy.import.source.csv));
    await userEvent.upload(
      fileInput(),
      new File(["nom,latitude\n"], "vide.csv", { type: "text/csv" }),
    );

    expect(await screen.findByText(copy.import.file.emptyFile)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.import.file.choose })).toBeTruthy();
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

  it("blocks leaving the page while running, disables Retour and Importer, and shows batch progress", async () => {
    const pending: { resolve: (() => void) | null } = { resolve: null };
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            pending.resolve = () => resolve(json({ created: 1, updated: 0 }));
          }),
      ),
    );
    await goToPreview(1);
    expect(beforeUnloadCancelled()).toBe(false);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    expect(await screen.findByText(copy.import.running(0, 1))).toBeTruthy();
    expect(screen.getByRole("progressbar")).toBeTruthy();
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
    expect(beforeUnloadCancelled()).toBe(false);
  });

  it("sends 300 rows as 250 then 50, reading 250 / 300 in between", async () => {
    const bodies: { rows: unknown[] }[] = [];
    const second: { resolve: (() => void) | null } = { resolve: null };
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: RequestInfo | URL, init?: RequestInit) => {
        bodies.push(JSON.parse(String(init?.body)) as { rows: unknown[] });
        if (bodies.length === 1) return Promise.resolve(json({ created: 250, updated: 0 }));
        return new Promise((resolve) => {
          second.resolve = () => resolve(json({ created: 50, updated: 0 }));
        });
      }),
    );
    await goToPreview(300);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(300) }));

    expect(await screen.findByText(copy.import.running(250, 300))).toBeTruthy();
    expect(bodies.map((b) => b.rows.length)).toEqual([250, 50]);

    second.resolve?.();
    expect(await screen.findByText(copy.import.result.title)).toBeTruthy();
  });

  it("ends in a result dialog naming created, updated and rejected, and Terminer returns to Source", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ created: 1, updated: 0 })),
    );
    await goToPreview(1, { withReject: true });
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.import.result.title)).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.created(1), { exact: false })).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.updated(0), { exact: false })).toBeTruthy();
    expect(within(dialog).getByText(copy.import.result.skipped(1), { exact: false })).toBeTruthy();

    await userEvent.click(within(dialog).getByRole("button", { name: copy.import.actions.done }));
    expect(await screen.findByText(copy.import.source.csv)).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("names the rows already sent when a later batch fails, and Réessayer re-sends from the start", async () => {
    const sizes: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
        sizes.push((JSON.parse(String(init?.body)) as { rows: unknown[] }).rows.length);
        if (sizes.length === 2) return json({ error: "failed" }, 500);
        return json({ created: 1, updated: 0 });
      }),
    );
    await goToPreview(300);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(300) }));

    expect(await screen.findByText(copy.import.failedAfter(250))).toBeTruthy();
    expect(beforeUnloadCancelled()).toBe(false);

    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.retry }));
    await screen.findByText(copy.import.result.title);
    expect(sizes).toEqual([250, 50, 250, 50]);
  });

  it("names zero rows sent when the very first batch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json({ error: "failed" }, 500)),
    );
    await goToPreview(1);
    await userEvent.click(screen.getByRole("button", { name: copy.import.actions.start(1) }));

    expect(await screen.findByText(copy.import.failedAfter(0))).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.import.actions.retry })).toBeTruthy();
  });

  it("formatCount groups thousands with a no-break space in the running count", () => {
    expect(copy.import.running(1284, 1300)).toMatch(/^Import en cours : 1\s284 \/ 1\s300$/);
  });
});

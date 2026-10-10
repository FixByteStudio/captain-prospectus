/**
 * Derniers imports on Source (GH #390) — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-390-derniers-imports.md.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { copy } from "../../copy";
import { formatDateTime } from "../../format";
import type { ImportLogEntry, ImportsResponse } from "../../../shared/schemas";
import { createAdminQueryClient } from "../query-client";
import { RecentImports } from "./RecentImports";

const STARTED_AT = Date.UTC(2026, 9, 8, 14, 5);

function entry(over: Partial<ImportLogEntry> = {}): ImportLogEntry {
  return {
    id: crypto.randomUUID(),
    source: "csv",
    fileName: "a.csv",
    zoneVertices: null,
    zoneRadiusM: null,
    created: 118,
    updated: 6,
    rejected: 4,
    createdBy: "admin@exemple.be",
    startedAt: STARTED_AT,
    status: "done",
    ...over,
  };
}

function stub(response: ImportsResponse | Response) {
  const fetchMock = vi.fn<(url: string) => Promise<Response>>(async () =>
    response instanceof Response ? response : new Response(JSON.stringify(response)),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPanel() {
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false } });
  render(
    <QueryClientProvider client={client}>
      <RecentImports />
    </QueryClientProvider>,
  );
}

/** Body rows, header excluded. */
async function rows(): Promise<HTMLElement[]> {
  await screen.findByRole("table");
  return screen.getAllByRole("row").slice(1);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RecentImports", () => {
  it("reads the server's log from GET /api/admin/imports", async () => {
    const fetchMock = stub({ imports: [entry()] });
    renderPanel();
    await rows();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("/api/admin/imports");
  });

  it("shows a done CSV import with its count, author, success badge and edge", async () => {
    stub({ imports: [entry()] });
    renderPanel();
    const [row] = await rows();
    if (!row) throw new Error("no row");

    expect(within(row).getByText(formatDateTime(STARTED_AT))).toBeTruthy();
    expect(within(row).getByText(copy.import.recent.sources.csv ?? "")).toBeTruthy();
    expect(within(row).getByText("a.csv")).toBeTruthy();
    expect(row.querySelector("svg.lucide-file-spreadsheet")).not.toBeNull();
    expect(within(row).getByText("+118 créés · 6 mis à jour · 4 rejetés")).toBeTruthy();
    expect(within(row).getByText("admin@exemple.be")).toBeTruthy();
    const badge = within(row).getByText("Terminé");
    expect(badge.className).toContain("bg-tint-success");
    expect(row.className).toContain("var(--color-success)");
    expect(row.firstElementChild?.className).toContain(
      "md:shadow-[inset_4px_0_0_0_var(--color-success)]",
    );
  });

  it("names an OSM polygon by its vertices", async () => {
    stub({ imports: [entry({ source: "osm", fileName: null, zoneVertices: 7 })] });
    renderPanel();
    const [row] = await rows();
    expect(within(row as HTMLElement).getByText("Carte OpenStreetMap")).toBeTruthy();
    expect(within(row as HTMLElement).getByText("7 sommets")).toBeTruthy();
    expect((row as HTMLElement).querySelector("svg.lucide-map")).not.toBeNull();
  });

  it("names a Google circle by its radius, in km from 1 000 m", async () => {
    stub({
      imports: [
        entry({ source: "google", fileName: null, zoneRadiusM: 300 }),
        entry({ source: "google", fileName: null, zoneRadiusM: 1500 }),
      ],
    });
    renderPanel();
    const [small, large] = await rows();
    expect(within(small as HTMLElement).getByText("Carte Google")).toBeTruthy();
    expect(within(small as HTMLElement).getByText("Rayon 300 m")).toBeTruthy();
    expect((small as HTMLElement).querySelector("svg.lucide-map")).not.toBeNull();
    expect(within(large as HTMLElement).getByText("Rayon 1,5 km")).toBeTruthy();
  });

  it("falls back to the raw value for an unknown source", async () => {
    stub({ imports: [entry({ source: "field", fileName: null, zoneVertices: 3 })] });
    renderPanel();
    const [row] = await rows();
    expect(within(row as HTMLElement).getByText("field")).toBeTruthy();
    expect((row as HTMLElement).querySelector("svg.lucide-map")).not.toBeNull();
  });

  it("does not take an inherited property for a known source", async () => {
    stub({ imports: [entry({ source: "constructor" })] });
    renderPanel();
    const [row] = await rows();
    expect(within(row as HTMLElement).getByText("constructor")).toBeTruthy();
  });

  it("marks an interrupted import with the warn badge and edge", async () => {
    stub({ imports: [entry({ status: "interrupted" })] });
    renderPanel();
    const [row] = await rows();
    const badge = within(row as HTMLElement).getByText("Interrompu");
    expect(badge.className).toContain("bg-tint-warn");
    expect((row as HTMLElement).className).toContain("var(--color-warn)");
    expect((row as HTMLElement).firstElementChild?.className).toContain(
      "md:shadow-[inset_4px_0_0_0_var(--color-warn)]",
    );
  });

  it("reads a redacted file and admin as an aria-hidden dash", async () => {
    stub({ imports: [entry({ fileName: null, createdBy: null })] });
    renderPanel();
    const [row] = await rows();
    const dashes = within(row as HTMLElement).getAllByText("—");
    expect(dashes).toHaveLength(2);
    for (const dash of dashes) expect(dash.getAttribute("aria-hidden")).toBe("true");
  });

  it("agrees the counts in the singular", async () => {
    stub({ imports: [entry({ created: 1, updated: 1, rejected: 1 })] });
    renderPanel();
    const [row] = await rows();
    expect(within(row as HTMLElement).getByText("+1 créé · 1 mis à jour · 1 rejeté")).toBeTruthy();
  });

  it("keeps the server's order", async () => {
    stub({
      imports: [
        entry({ fileName: "third.csv", startedAt: 1 }),
        entry({ fileName: "first.csv", startedAt: 3 }),
        entry({ fileName: "second.csv", startedAt: 2 }),
      ],
    });
    renderPanel();
    const listed = await rows();
    expect(listed.map((r) => within(r).getByText(/\.csv$/).textContent)).toEqual([
      "third.csv",
      "first.csv",
      "second.csv",
    ]);
  });

  it("hides Par below md and shows it from md", async () => {
    stub({ imports: [entry()] });
    renderPanel();
    const [row] = await rows();
    const by = within(row as HTMLElement).getByText("admin@exemple.be");
    expect(by.className).toContain("hidden");
    expect(by.className).toContain("md:table-cell");
  });

  it("says so when nothing was imported yet", async () => {
    stub({ imports: [] });
    renderPanel();
    expect(await screen.findByText(copy.import.recent.empty)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByRole("heading", { name: copy.import.recent.title })).toBeTruthy();
  });

  it("keeps its head and offers a retry when the load fails", async () => {
    const fetchMock = stub(new Response("{}", { status: 500 }));
    renderPanel();
    expect(await screen.findByText(copy.import.recent.loadFailed)).toBeTruthy();
    expect(screen.getByRole("heading", { name: copy.import.recent.title })).toBeTruthy();

    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ imports: [entry()] })));
    await userEvent.click(screen.getByRole("button", { name: copy.errors.retry }));
    expect(await screen.findByText("a.csv")).toBeTruthy();
  });
});

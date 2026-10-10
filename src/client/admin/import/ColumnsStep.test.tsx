/**
 * Fichier & colonnes (GH #368): the Statut chips, the « Ignoré » rows, the
 * disabled « Voir l'aperçu » and « Changer de fichier » — the I/O matrix in
 * _bmad-output/implementation-artifacts/spec-gh-368-fichier-colonnes-mapping-table.md.
 */
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { copy } from "../../copy";
import { createAdminQueryClient } from "../query-client";
import { ColumnsStep } from "./ColumnsStep";
import { ImportScreen } from "./ImportScreen";
import { guessColumns, parseCsv } from "./csv";
import type { ColumnMap } from "./csv";

vi.mock("./MapCanvas", () => ({
  MapCanvas: () => <div data-testid="map-canvas" />,
}));

const FILE =
  "nom,latitude,longitude,adresse,id,commentaire\nChez Léa,50.8,4.3,Rue 1,IX-1,Rappeler\n";

function Harness({ text, initial }: { text: string; initial?: ColumnMap }) {
  const parsed = parseCsv(text);
  const [columns, setColumns] = useState<ColumnMap>(initial ?? guessColumns(parsed.headers));
  return (
    <ColumnsStep
      parsed={parsed}
      fileName="prospects.csv"
      fileSize={18_432}
      columns={columns}
      onChange={setColumns}
      onReplace={() => undefined}
      onBack={() => undefined}
      onNext={() => undefined}
    />
  );
}

/** The table row for a field label or an unused column's header. */
function row(label: string): HTMLElement {
  const cell = screen.getAllByRole("cell").find((c) => c.textContent?.startsWith(label));
  const tr = cell?.closest("tr");
  if (!tr) throw new Error(`no row for ${label}`);
  return tr;
}

function fileInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  return input;
}

afterEach(() => vi.restoreAllMocks());

describe("ColumnsStep", () => {
  it("shows one Statut chip per row, the field's own first", () => {
    render(<Harness text={FILE} />);
    const { status, fields } = copy.import.columns;

    expect(within(row(fields.name)).getByText(status.required)).toBeTruthy();
    expect(within(row(fields.lat)).getByText(status.gps)).toBeTruthy();
    expect(within(row(fields.lng)).getByText(status.gps)).toBeTruthy();
    expect(within(row(fields.sourceRef)).getByText(status.uniqueKey)).toBeTruthy();
    // Address has a column; Type has none.
    expect(within(row(fields.address)).getByText(status.detected)).toBeTruthy();
    expect(within(row(fields.type)).getByText(status.optional)).toBeTruthy();
  });

  it("marks a hand-picked column « Détecté » too, so every row keeps one chip", async () => {
    render(<Harness text={"nom,genre\nChez Léa,Café\n"} />);
    const { status, fields } = copy.import.columns;
    expect(within(row(fields.type)).getByText(status.optional)).toBeTruthy();

    await userEvent.click(screen.getByRole("combobox", { name: fields.type }));
    await userEvent.click(await screen.findByRole("option", { name: "genre" }));

    expect(within(row(fields.type)).getByText(status.detected)).toBeTruthy();
    expect(within(row(fields.type)).queryByText(status.optional)).toBeNull();
  });

  it("closes the table with an « Ignoré » row for a column that feeds no field", () => {
    render(<Harness text={FILE} />);
    const ignored = row("commentaire");
    expect(within(ignored).getByText(copy.import.columns.status.ignored)).toBeTruthy();
    expect(screen.getAllByText(copy.import.columns.status.ignored)).toHaveLength(1);
  });

  it("counts configured fields in the head and lines and columns in the foot", () => {
    render(<Harness text={FILE} />);
    expect(screen.getByText(copy.import.columns.configured(5, 9))).toBeTruthy();
    expect(screen.getByText(copy.import.columns.footer(1, 5))).toBeTruthy();
  });

  it("keeps « Voir l'aperçu » disabled until Nom has a column", () => {
    render(<Harness text={"commentaire\nx\n"} />);
    expect(screen.getByRole("button", { name: copy.import.actions.toPreview })).toHaveProperty(
      "disabled",
      true,
    );
  });

  it("gives Retour the secondary look and shows « Étape 2 sur 3 »", () => {
    render(<Harness text={FILE} />);
    expect(screen.getByRole("button", { name: copy.import.actions.back }).dataset.variant).toBe(
      "secondary",
    );
    expect(screen.getByText(copy.import.columns.step(2, 3))).toBeTruthy();
  });
});

describe("« Changer de fichier »", () => {
  function renderScreen() {
    const client = createAdminQueryClient();
    render(
      <MemoryRouter initialEntries={["/admin/import"]}>
        <QueryClientProvider client={client}>
          <ImportScreen />
        </QueryClientProvider>
      </MemoryRouter>,
    );
  }

  const csv = (name: string, text: string) => new File([text], name, { type: "text/csv" });

  async function openColumns() {
    renderScreen();
    await userEvent.upload(fileInput(), csv("first.csv", "nom,tel\nA,1\n"));
    await screen.findByText(copy.import.columns.lede);
  }

  it("replaces the file with a good one and re-guesses the columns", async () => {
    await openColumns();
    const { fields } = copy.import.columns;
    expect(screen.getByText("first.csv")).toBeTruthy();
    expect(within(row(fields.phone)).getByText("tel")).toBeTruthy();

    await userEvent.upload(fileInput(), csv("second.csv", "nom,adresse\nB,Rue 2\nC,Rue 3\n"));

    expect(await screen.findByText("second.csv")).toBeTruthy();
    expect(screen.queryByText("first.csv")).toBeNull();
    expect(screen.getByText(copy.import.columns.lines(2))).toBeTruthy();
    expect(within(row(fields.address)).getByText("Rue 2")).toBeTruthy();
    expect(within(row(fields.phone)).getByText(copy.import.columns.status.optional)).toBeTruthy();
  });

  it.each([
    ["an empty file", "nom,tel\n", copy.import.file.emptyFile],
    ["a file with no header", "", copy.import.file.noHeaders],
  ])("keeps the current file and mapping and shows the Alert for %s", async (_n, text, message) => {
    await openColumns();

    await userEvent.upload(fileInput(), csv("bad.csv", text));

    expect(await screen.findByText(message)).toBeTruthy();
    expect(screen.getByText("first.csv")).toBeTruthy();
    expect(screen.queryByText("bad.csv")).toBeNull();
    expect(within(row(copy.import.columns.fields.phone)).getByText("tel")).toBeTruthy();
  });

  it("keeps the current file when the new one is unreadable", async () => {
    await openColumns();
    const bad = csv("bad.csv", "x");
    vi.spyOn(bad, "text").mockRejectedValue(new Error("unreadable"));

    await userEvent.upload(fileInput(), bad);

    expect(await screen.findByText(copy.import.file.unreadable)).toBeTruthy();
    expect(screen.getByText("first.csv")).toBeTruthy();
  });

  it("clears the Alert once a good file is chosen", async () => {
    await openColumns();
    await userEvent.upload(fileInput(), csv("bad.csv", ""));
    await screen.findByText(copy.import.file.noHeaders);

    await userEvent.upload(fileInput(), csv("ok.csv", "nom\nA\n"));

    expect(await screen.findByText("ok.csv")).toBeTruthy();
    expect(screen.queryByText(copy.import.file.noHeaders)).toBeNull();
  });
});

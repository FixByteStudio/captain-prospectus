/**
 * Ajouter un prospect (GH #127): the two-column type chips, the tile-free
 * position card, the missing-name error, and Flow 4's climax — the new place
 * is the next stop on Tournée du jour at once, offline.
 *
 * `useSync` is mocked (as `VisitScreen.test.tsx` does) and `../api` rejects
 * every call, so nothing here can reach a network. The Tournée route is the
 * real `TodayScreen` reading the real Dexie tables, so "joins the round" is
 * the round's own reading, not a stub's.
 *
 * INVARIANT 2: the one write is an insert of the schema's fields — no
 * `status`, `source` or owner leaves the phone.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import Dexie from "dexie";
import { copy, TYPE_LABELS } from "../copy";
import { PROSPECT_TYPES } from "../../shared/constants";
import type { Prospect } from "../../shared/schemas";
import { fieldDb } from "./db";
import { AddProspectScreen } from "./AddProspectScreen";
import { TodayScreen } from "./TodayScreen";

const syncState = vi.hoisted(() => ({ confirmed: true }));

vi.mock("./useSync", () => ({
  useSyncState: () => ({
    identity: "agent@example.com",
    confirmed: syncState.confirmed,
    lastSyncAt: 1_700_000_000_000,
    syncNow: async () => {},
  }),
}));

vi.mock("../api", () => ({
  apiFetch: () => Promise.reject(new Error("offline")),
}));

/** Flow 4's pavement: the Minimes, Brussels. */
const HERE = { latitude: 50.8466, longitude: 4.3528 };

/** Every reading succeeds at `HERE` — the setup file's default is "denied". */
function grantPosition() {
  return vi
    .spyOn(navigator.geolocation, "getCurrentPosition")
    .mockImplementation((ok) =>
      ok({ coords: HERE, timestamp: Date.now() } as unknown as GeolocationPosition),
    );
}

/** A reading that never answers, so the screen stays "locating". */
function holdPosition() {
  return vi.spyOn(navigator.geolocation, "getCurrentPosition").mockImplementation(() => {});
}

function renderAdd() {
  return render(
    <MemoryRouter initialEntries={["/tournee/nouveau"]}>
      <Routes>
        <Route path="/tournee/nouveau" element={<AddProspectScreen />} />
        <Route path="/tournee" element={<TodayScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

const nameInput = () => screen.getByRole("textbox", { name: copy.fieldProspect.name });
const addButton = () => screen.getByRole("button", { name: copy.fieldProspect.save });
const typeGroup = () => screen.getByRole("radiogroup", { name: copy.fieldProspect.type });

afterEach(async () => {
  vi.restoreAllMocks();
  syncState.confirmed = true;
  await Promise.all([
    fieldDb.prospects.clear(),
    fieldDb.outboxProspects.clear(),
    fieldDb.outboxVisits.clear(),
    fieldDb.sentVisits.clear(),
  ]);
});

describe("AddProspectScreen", () => {
  it("opens with six chips in two columns over native radios, Restaurant checked", async () => {
    grantPosition();
    renderAdd();
    await screen.findByText("50,8466 · 4,3528");

    const group = typeGroup();
    expect(group.className).toContain("grid-cols-2");
    const radios = within(group).getAllByRole("radio");
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual([...PROSPECT_TYPES]);
    // Native inputs (ADR-0015), styled as choice tiles, not rows with a disc.
    for (const r of radios) {
      expect(r.tagName).toBe("INPUT");
      expect(r.className).toContain("sr-only");
    }
    expect(
      within(group).getByRole("radio", { name: TYPE_LABELS.restaurant, checked: true }),
    ).toBeTruthy();
  });

  it("shows the reading in fr-FR and offers Actualiser once there is one", async () => {
    grantPosition();
    renderAdd();

    expect(await screen.findByText("50,8466 · 4,3528")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.fieldProspect.positionRefresh })).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.fieldProspect.useMyPosition })).toBeNull();
  });

  it("says it is locating, with the button disabled, while a reading is outstanding", () => {
    holdPosition();
    renderAdd();

    expect(screen.getByText(copy.today.locating)).toBeTruthy();
    const button = screen.getByRole("button", { name: copy.fieldProspect.useMyPosition });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("after Actualiser, says it is locating under the reading Ajouter would still save", async () => {
    const ask = grantPosition();
    const user = userEvent.setup();
    renderAdd();
    await screen.findByText("50,8466 · 4,3528");

    ask.mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: copy.fieldProspect.positionRefresh }));

    expect(screen.getByText(copy.today.locating)).toBeTruthy();
    expect(screen.getByText("50,8466 · 4,3528")).toBeTruthy();
  });

  it("with no position, offers Utiliser ma position, which asks again and fills the card", async () => {
    // The setup file's default reading is "denied".
    const user = userEvent.setup();
    renderAdd();

    expect(await screen.findByText(copy.fieldProspect.positionNone)).toBeTruthy();
    const ask = grantPosition();
    await user.click(screen.getByRole("button", { name: copy.fieldProspect.useMyPosition }));

    expect(ask).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("50,8466 · 4,3528")).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.fieldProspect.positionRefresh })).toBeTruthy();
  });

  it("still adds the place with no position, with null coordinates", async () => {
    const user = userEvent.setup();
    renderAdd();
    await screen.findByText(copy.fieldProspect.positionNone);

    await user.type(nameInput(), "Friterie des Minimes");
    await user.click(addButton());

    expect(await screen.findByText(copy.fieldProspect.saved)).toBeTruthy();
    const [row] = await fieldDb.outboxProspects.toArray();
    expect(row?.lat).toBeNull();
    expect(row?.lng).toBeNull();
  });

  it("with Nom empty, shows the error under Nom, focuses it and writes nothing", async () => {
    grantPosition();
    const user = userEvent.setup();
    renderAdd();

    await user.click(addButton());

    expect(await screen.findByText(copy.fieldProspect.nameRequired)).toBeTruthy();
    expect(document.activeElement).toBe(nameInput());
    expect(await fieldDb.outboxProspects.count()).toBe(0);
  });

  it("adds one outbox row and lands on Tournée du jour, the place already the next stop", async () => {
    grantPosition();
    // A stop from the server, a few kilometres off: the new place, added
    // where the agent stands, must come before it (Flow 4, "the nearest stop").
    await fieldDb.prospects.add({
      id: "44444444-4444-4444-8444-444444444444",
      name: "Chez Léa",
      type: "restaurant",
      lat: 50.88,
      lng: 4.4,
      address: null,
      phone: null,
      website: null,
      cuisine: null,
      source: "csv",
      status: "assigned",
      assignedTo: "agent@example.com",
      lastVisitAt: null,
      nextVisitAt: null,
    } satisfies Prospect);

    const user = userEvent.setup();
    renderAdd();
    await screen.findByText("50,8466 · 4,3528");

    await user.type(nameInput(), "Friterie des Minimes");
    await user.click(within(typeGroup()).getByRole("radio", { name: TYPE_LABELS.fast_food }));
    await user.click(addButton());

    expect(await screen.findByText(copy.fieldProspect.saved)).toBeTruthy();
    const card = (await screen.findByText(copy.today.nextStop)).closest("article");
    expect(card).not.toBeNull();
    // `as HTMLElement`: asserted non-null on the line above.
    expect(within(card as HTMLElement).getByText("Friterie des Minimes")).toBeTruthy();

    const rows = await fieldDb.outboxProspects.toArray();
    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row).toMatchObject({
      name: "Friterie des Minimes",
      type: "fast_food",
      lat: HERE.latitude,
      lng: HERE.longitude,
      writtenBy: "agent@example.com",
    });
    // INVARIANT 2: the server owns these.
    expect(row).not.toHaveProperty("status");
    expect(row).not.toHaveProperty("source");
    expect(row).not.toHaveProperty("assignedTo");
  });

  /**
   * docs/backlog/013: the same cache-sourced-identity stamp `VisitScreen`
   * writes on a visit, here on the field prospect the outbox row carries.
   */
  it("stamps the outbox row unconfirmed while the identity is cache-sourced", async () => {
    syncState.confirmed = false;
    grantPosition();
    const user = userEvent.setup();
    renderAdd();
    await screen.findByText("50,8466 · 4,3528");

    await user.type(nameInput(), "Friterie des Minimes");
    await user.click(addButton());

    expect(await screen.findByText(copy.fieldProspect.saved)).toBeTruthy();
    const [row] = await fieldDb.outboxProspects.toArray();
    expect(row?.unconfirmed).toBe(true);
    expect(row?.writtenBy).toBe("agent@example.com");
  });

  it("writes once on a double tap, with the button disabled while it writes", async () => {
    grantPosition();
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    // Dexie's own promise, so the held write still settles in its transaction.
    const add = vi
      .spyOn(fieldDb.outboxProspects, "add")
      .mockImplementation(() => Dexie.Promise.resolve(gate).then(() => "held"));
    renderAdd();

    await user.type(nameInput(), "Friterie des Minimes");
    await user.dblClick(addButton());

    const busy = await screen.findByRole("button", { name: copy.fieldProspect.saving });
    expect((busy as HTMLButtonElement).disabled).toBe(true);
    expect(add).toHaveBeenCalledTimes(1);
    release();
    expect(await screen.findByText(copy.fieldProspect.saved)).toBeTruthy();
  });

  it("stays put with the storage error when the write fails, and can retry", async () => {
    grantPosition();
    const user = userEvent.setup();
    const add = vi
      .spyOn(fieldDb.outboxProspects, "add")
      .mockImplementationOnce(() => Dexie.Promise.reject(new Error("QuotaExceededError")));
    renderAdd();

    await user.type(nameInput(), "Friterie des Minimes");
    await user.click(addButton());

    expect((await screen.findByRole("alert")).textContent).toBe(copy.fieldProspect.saveFailed);
    expect(screen.queryByText(copy.today.nextStop)).toBeNull();

    add.mockRestore();
    await user.click(addButton());
    expect(await screen.findByText(copy.fieldProspect.saved)).toBeTruthy();
    expect(await fieldDb.outboxProspects.count()).toBe(1);
  });

  it("checks only the tapped chip, and arrow keys move the choice natively", async () => {
    grantPosition();
    const user = userEvent.setup();
    renderAdd();

    const group = typeGroup();
    await user.click(within(group).getByRole("radio", { name: TYPE_LABELS.food_truck }));
    expect(
      within(group)
        .getAllByRole("radio", { checked: true })
        .map((r) => r.getAttribute("value")),
    ).toEqual(["food_truck"]);

    await user.keyboard("{ArrowRight}");
    expect(
      within(group)
        .getAllByRole("radio", { checked: true })
        .map((r) => r.getAttribute("value")),
    ).toEqual(["other"]);
  });
});

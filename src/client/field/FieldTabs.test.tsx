/**
 * The tab bar's leave guard and current-tab wiring (GH #83).
 *
 * `tabs.test.ts` already covers `fieldTabs` and `isCurrentTab` as pure
 * functions; what nothing covered until now is that `FieldTabs` actually calls
 * `shouldAsk`, actually calls `event.preventDefault()`, and actually navigates
 * on confirm — deleting any of those three passed CI (GH #66's review
 * deferral). These tests fail when it does.
 */
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { copy } from "../copy";
import { FieldTabs } from "./FieldTabs";
import { LeaveGuardProvider, useRegisterDirty } from "./leave-guard";

/** The router's own pathname, so "did it navigate?" is asserted, not inferred. */
function CurrentPath() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

/** Stands in for VisitScreen / AddProspectScreen: their only contribution to
 * the guard is this one hook call (`VisitScreen.tsx`, `AddProspectScreen.tsx`). */
function DirtyForm() {
  useRegisterDirty(true);
  return null;
}

/** Lets a test unmount the dirty form the way leaving a screen does. */
function FormThatCanClose() {
  const [open, setOpen] = useState(true);
  return (
    <>
      {open && <DirtyForm />}
      <button type="button" onClick={() => setOpen(false)}>
        close-form
      </button>
    </>
  );
}

function renderTabs({
  path = "/round/abc123",
  children,
}: {
  path?: string;
  children?: React.ReactNode;
} = {}) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LeaveGuardProvider>
        <FieldTabs />
        {children}
        <CurrentPath />
      </LeaveGuardProvider>
    </MemoryRouter>,
  );
}

const pathname = () => screen.getByTestId("pathname").textContent;

describe("FieldTabs", () => {
  it("marks only the current tab with aria-current", () => {
    renderTabs({ path: "/round" });
    expect(
      screen.getByRole("link", { name: copy.nav.tabs.today }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("link", { name: copy.nav.tabs.add }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("lists Tournée, Carte, Carnet, Ajouter in order and marks Carte current on /round/map", () => {
    renderTabs({ path: "/round/map" });

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      copy.nav.tabs.today,
      copy.nav.tabs.map,
      copy.nav.tabs.carnet,
      copy.nav.tabs.add,
    ]);
    expect(screen.getByRole("link", { name: copy.nav.tabs.map }).getAttribute("aria-current")).toBe(
      "page",
    );
    expect(
      screen.getByRole("link", { name: copy.nav.tabs.today }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("navigates straight away when no form is dirty", async () => {
    const user = userEvent.setup();
    renderTabs();

    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pathname()).toBe("/round/new");
  });

  it("asks before leaving a dirty form, and stays put when cancelled", async () => {
    const user = userEvent.setup();
    renderTabs({ children: <DirtyForm /> });

    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));

    // `preventDefault` held the navigation back: the dialog is up and the
    // router has not moved.
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(screen.getByText(copy.nav.leaveGuard.body)).toBeTruthy();
    expect(pathname()).toBe("/round/abc123");

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.cancel }));
    expect(pathname()).toBe("/round/abc123");
  });

  it("closes on Escape without navigating, and asks again on the next tap", async () => {
    const user = userEvent.setup();
    renderTabs({ children: <DirtyForm /> });

    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));
    await user.keyboard("{Escape}");

    // Escape goes through the dialog's `onOpenChange`, not Annuler (GH #86).
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pathname()).toBe("/round/abc123");

    // The dismissed tap is dropped, not kept: the next one, to another tab,
    // asks afresh and Quitter follows it rather than the stale Ajouter.
    await user.click(screen.getByRole("link", { name: copy.nav.tabs.map }));
    expect(screen.getByRole("alertdialog")).toBeTruthy();
    expect(pathname()).toBe("/round/abc123");

    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));
    expect(pathname()).toBe("/round/map");
  });

  it("never asks when the dirty form's own tab is tapped", async () => {
    const user = userEvent.setup();
    // Ajouter is already current here, so tapping it navigates nowhere and
    // must not offer to discard the form the agent is still filling in
    // (`shouldAsk`, which takes the tab as `to` and the pathname as `current`).
    // A nested path under Ajouter (`tabs.test.ts` uses the same one), not the
    // exact string: "already current" is `isCurrentTab`'s subtree rule read
    // pathname-first, so this case also fails if the component ever passes
    // `shouldAsk` the tab and the pathname the wrong way round.
    renderTabs({ path: "/round/new/deep/er", children: <DirtyForm /> });

    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));

    // No dialog: the tap goes straight through, keeping the agent inside the
    // form's own route rather than offering to discard what they are typing.
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pathname()).toBe("/round/new");
  });

  it("navigates once the agent confirms", async () => {
    const user = userEvent.setup();
    renderTabs({ children: <DirtyForm /> });

    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));
    await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.leave }));

    expect(pathname()).toBe("/round/new");
  });

  it("stops asking once the dirty form unmounts", async () => {
    const user = userEvent.setup();
    renderTabs({ children: <FormThatCanClose /> });

    await user.click(screen.getByRole("button", { name: "close-form" }));
    await user.click(screen.getByRole("link", { name: copy.nav.tabs.add }));

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(pathname()).toBe("/round/new");
  });
});

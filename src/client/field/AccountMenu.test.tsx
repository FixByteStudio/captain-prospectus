/**
 * The account card (GH #561). happy-dom has no Popover API, so the card is
 * always in the DOM here: these tests cover what it holds and does. Opening and
 * closing (outside tap, avatar re-tap, Escape) belongs to the browser and is
 * checked there.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { copy } from "../copy/field";
import { THEME_STORAGE_KEY } from "../theme";
import { BUILD } from "../version";
import { AccountMenu } from "./AccountMenu";
import { LeaveGuardProvider, useRegisterDirty } from "./leave-guard";

const EMAIL = "marie.vandenbroucke@captain-prospectus.be";

function CurrentPath() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

function DirtyForm() {
  useRegisterDirty(true);
  return null;
}

function renderMenu({
  role = "agent",
  adminOnline = false,
  children,
}: {
  role?: "agent" | "admin";
  adminOnline?: boolean;
  children?: React.ReactNode;
} = {}) {
  return render(
    <MemoryRouter initialEntries={["/round"]}>
      <LeaveGuardProvider>
        <AccountMenu email={EMAIL} role={role} adminOnline={adminOnline} />
        {children}
        <CurrentPath />
      </LeaveGuardProvider>
    </MemoryRouter>,
  );
}

// Matched without whitespace: the <wbr> before « @ » reads as a space in happy-dom's name computation.
const card = () =>
  screen.getByRole("region", { name: (name) => name.replace(/\s/g, "") === EMAIL });
const radio = (name: string) => screen.getByRole("radio", { name }) as HTMLInputElement;

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});
afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("AccountMenu", () => {
  it("names the avatar button after the menu it opens, with the initials inside", () => {
    renderMenu();
    const button = screen.getByRole("button", { name: copy.nav.avatar(EMAIL) });
    expect(button.getAttribute("popovertarget")).toBe(card().id);
    expect(button.textContent).toBe("MV");
  });

  it("shows email, role, appearance and version for an agent, with no dashboard row", () => {
    renderMenu();
    const c = card();
    expect(within(c).getByText(copy.accountCard.role.agent)).toBeTruthy();
    expect(within(c).getByText(copy.accountCard.appearance, { selector: "p" })).toBeTruthy();
    expect(within(c).getByText(copy.accountCard.version(BUILD))).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.accountCard.dashboard })).toBeNull();
  });

  it("reads the version line as release · commit, or release · dev", () => {
    expect(copy.accountCard.version({ version: "0.1.0", commit: "a605114" })).toBe(
      "Version 0.1.0 · a605114",
    );
    expect(copy.accountCard.version({ version: "0.1.0", commit: "dev" })).toBe(
      "Version 0.1.0 · dev",
    );
  });

  it("puts a wrap point before the @ of a long address", () => {
    renderMenu();
    const email = card().querySelector("wbr");
    expect(email?.nextSibling?.textContent?.startsWith("@")).toBe(true);
  });

  it("shows the role of an admin who is offline without the dashboard row", () => {
    renderMenu({ role: "admin", adminOnline: false });
    expect(screen.getByText(copy.accountCard.role.admin)).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.accountCard.dashboard })).toBeNull();
  });

  describe("Apparence", () => {
    it("checks Système when nothing is pinned", () => {
      renderMenu();
      expect(radio(copy.accountCard.theme.system).checked).toBe(true);
      expect(radio(copy.accountCard.theme.dark).checked).toBe(false);
    });

    it("checks Système for a garbage pin", () => {
      document.documentElement.dataset.theme = "blue";
      renderMenu();
      expect(radio(copy.accountCard.theme.system).checked).toBe(true);
    });

    it("reads the page's pin, not storage", () => {
      document.documentElement.dataset.theme = "light";
      renderMenu();
      expect(radio(copy.accountCard.theme.light).checked).toBe(true);
    });

    it("pins Sombre at once: storage and <html data-theme>", async () => {
      const user = userEvent.setup();
      renderMenu();
      await user.click(radio(copy.accountCard.theme.dark));
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
      expect(document.documentElement.dataset.theme).toBe("dark");
      expect(radio(copy.accountCard.theme.dark).checked).toBe(true);
    });

    it("clears the pin on Système", async () => {
      const user = userEvent.setup();
      localStorage.setItem(THEME_STORAGE_KEY, "dark");
      document.documentElement.dataset.theme = "dark";
      renderMenu();
      expect(radio(copy.accountCard.theme.dark).checked).toBe(true);

      await user.click(radio(copy.accountCard.theme.system));
      expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
      expect(document.documentElement.dataset.theme).toBeUndefined();
      expect(radio(copy.accountCard.theme.system).checked).toBe(true);
    });
  });

  describe("Tableau de bord", () => {
    it("navigates to /admin when the form is clean", async () => {
      const user = userEvent.setup();
      renderMenu({ role: "admin", adminOnline: true });
      await user.click(screen.getByRole("button", { name: copy.accountCard.dashboard }));
      expect(screen.getByTestId("pathname").textContent).toBe("/admin");
    });

    it("asks through the leave guard when the form is dirty, and stays on Annuler", async () => {
      const user = userEvent.setup();
      renderMenu({ role: "admin", adminOnline: true, children: <DirtyForm /> });
      await user.click(screen.getByRole("button", { name: copy.accountCard.dashboard }));
      expect(screen.getByRole("alertdialog")).toBeTruthy();
      expect(screen.getByTestId("pathname").textContent).toBe("/round");

      await user.click(screen.getByRole("button", { name: copy.nav.leaveGuard.cancel }));
      expect(screen.queryByRole("alertdialog")).toBeNull();
      expect(screen.getByTestId("pathname").textContent).toBe("/round");
    });
  });
});

/**
 * The admin top bar's three live controls (GH #83).
 *
 * `nav.test.ts` and `theme.test.ts` cover `breadcrumbFor`, `isPaletteShortcut`
 * and `pinTheme` as pure functions, but nothing checked that the bar wires any
 * of them up: deleting `ThemeToggle`'s `onClick` or system listener,
 * `SearchPalette`'s buttons or keydown listener, or `AccountMenu`'s `href`
 * passed CI (GH #64 review deferral, GH #86).
 *
 * `TopBar` is rendered directly rather than through `AdminApp`, whose
 * `AdminLayout` would pull in TanStack Query, sonner and the whole Sidebar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { copy } from "../copy";
import { THEME_STORAGE_KEY } from "../theme";
import { LOGOUT_PATH } from "./access-logout";
import { TopBar } from "./TopBar";

const EMAIL = "admin@example.com";

function renderTopBar(pathname = "/admin/prospects") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <TopBar pathname={pathname} email={EMAIL} />
    </MemoryRouter>,
  );
}

/**
 * The system theme, with the one `change` listener `ThemeToggle` registers kept
 * so a test can flip the system under it.
 */
function stubSystemTheme(dark: boolean) {
  let listener: ((event: MediaQueryListEvent) => void) | undefined;
  const addEventListener = vi.fn((_type: string, fn: (event: MediaQueryListEvent) => void) => {
    listener = fn;
  });
  const removeEventListener = vi.fn();
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: dark,
    addEventListener,
    removeEventListener,
  } as unknown as MediaQueryList);

  return {
    addEventListener,
    removeEventListener,
    flip(matches: boolean) {
      act(() => listener?.({ matches } as MediaQueryListEvent));
    },
  };
}

beforeEach(() => {
  // A pin survives on <html> and in storage between tests otherwise, and the
  // toggle would start from the previous test's theme.
  delete document.documentElement.dataset.theme;
  localStorage.removeItem(THEME_STORAGE_KEY);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("TopBar", () => {
  it("pins the other theme on <html> when the toggle is clicked", async () => {
    const user = userEvent.setup();
    // Nothing pinned and the system is light, so the button offers dark.
    stubSystemTheme(false);
    renderTopBar();

    await user.click(screen.getByRole("button", { name: copy.theme.toDark }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    // The label names the action a click performs, so it swaps with the theme.
    expect(screen.getByRole("button", { name: copy.theme.toLight })).toBeTruthy();
  });

  it("follows the system live while nothing is pinned", () => {
    const system = stubSystemTheme(false);
    renderTopBar();

    system.flip(true);

    expect(screen.getByRole("button", { name: copy.theme.toLight })).toBeTruthy();
  });

  it("keeps a pinned theme when the system changes", async () => {
    const user = userEvent.setup();
    const system = stubSystemTheme(false);
    renderTopBar();
    await user.click(screen.getByRole("button", { name: copy.theme.toDark }));

    system.flip(false);

    expect(screen.getByRole("button", { name: copy.theme.toLight })).toBeTruthy();
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("stops following the system once unmounted", () => {
    const system = stubSystemTheme(false);
    const { unmount } = renderTopBar();

    unmount();

    const [, registered] = system.addEventListener.mock.calls[0] ?? [];
    expect(registered).toBeTypeOf("function");
    expect(system.removeEventListener).toHaveBeenCalledWith("change", registered);
  });

  it("opens the inert search palette on Ctrl+K, without a request", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderTopBar();

    expect(screen.queryByRole("dialog")).toBeNull();
    await user.keyboard("{Control>}k{/Control}");

    const dialog = await screen.findByRole("dialog");
    // The palette's whole content while search has no back end.
    expect(dialog.textContent).toContain(copy.search.unavailable);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("opens the palette on ⌘K too", async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.keyboard("{Meta>}k{/Meta}");

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain(copy.search.unavailable);
  });

  // The wide button and the icon one share a name, and happy-dom applies no
  // breakpoint CSS, so both are in the tree. Each gets its own render.
  it("opens the palette from either search button", async () => {
    const user = userEvent.setup();
    const { unmount } = renderTopBar();
    const count = screen.getAllByRole("button", { name: copy.search.button }).length;
    unmount();
    // Pinned, so a removed button fails here rather than shrinking the loop.
    expect(count).toBe(2);

    for (let index = 0; index < count; index++) {
      const view = renderTopBar();
      const button = screen.getAllByRole("button", { name: copy.search.button })[index];
      if (!button) throw new Error(`search button ${index} is missing`);

      await user.click(button);

      const dialog = await screen.findByRole("dialog");
      expect(dialog.textContent).toContain(copy.search.unavailable);
      view.unmount();
    }
  });

  it("signs out through a plain anchor to Access, not a router link", async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole("button", { name: copy.account.menu(EMAIL) }));

    // A router <Link> would be served the precached shell by the service
    // worker's navigateFallback and never reach Access (AccountMenu.tsx).
    const logout = await screen.findByRole("menuitem", { name: copy.account.logout });
    expect(logout.tagName).toBe("A");
    expect(logout.getAttribute("href")).toBe(LOGOUT_PATH);
  });
});

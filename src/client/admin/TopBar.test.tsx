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
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { copy } from "../copy";
import { THEME_STORAGE_KEY } from "../theme";
import { Toaster } from "../ui/sonner";
import { LOGOUT_PATH } from "./access-logout";
import { TopBar } from "./TopBar";

const EMAIL = "admin@example.com";

function Where() {
  return <output data-testid="where">{useLocation().pathname}</output>;
}

// The Toaster reads the system theme through `matchMedia` too, which would
// take the one listener `stubSystemTheme` keeps, so only the case that reads a
// toast mounts it.
function renderTopBar(pathname = "/admin/prospects", { toaster = false } = {}) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <TopBar pathname={pathname} email={EMAIL} />
      <Where />
      {toaster && <Toaster />}
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

  describe("Se déconnecter (GH #309)", () => {
    const realLocation = Object.getOwnPropertyDescriptor(window, "location");

    function stubLocation() {
      const location = { href: "https://app.example/admin" };
      Object.defineProperty(window, "location", { configurable: true, value: location });
      return location;
    }

    /** `/api/auth/logout` and `/api/me` answered separately; the calls are kept in order. */
    function stubApi(logout: () => Promise<Response>, me: () => Promise<Response>) {
      const calls: { url: string; method: string }[] = [];
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        calls.push({ url, method: init?.method ?? "GET" });
        return url === "/api/auth/logout" ? logout() : me();
      });
      return calls;
    }

    const noContent = () => Promise.resolve(new Response(null, { status: 204 }));
    const unauthorized = () => Promise.resolve(new Response("{}", { status: 401 }));
    const identity = () =>
      Promise.resolve(
        new Response(JSON.stringify({ email: EMAIL, role: "admin" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    afterEach(() => {
      vi.unstubAllGlobals();
      if (realLocation) Object.defineProperty(window, "location", realLocation);
    });

    async function chooseLogout() {
      const user = userEvent.setup();
      renderTopBar("/admin/prospects", { toaster: true });
      await user.click(screen.getByRole("button", { name: copy.account.menu(EMAIL) }));
      await user.click(await screen.findByRole("menuitem", { name: copy.account.logout }));
    }

    it("is a menu item, not a link: it ends the session before going anywhere", async () => {
      stubLocation();
      stubApi(noContent, unauthorized);
      const user = userEvent.setup();
      renderTopBar();

      await user.click(screen.getByRole("button", { name: copy.account.menu(EMAIL) }));

      const item = await screen.findByRole("menuitem", { name: copy.account.logout });
      expect(item.tagName).not.toBe("A");
      expect(item.getAttribute("href")).toBeNull();
    });

    it("opens /login when the session was all there was (POST ok, /api/me 401)", async () => {
      const location = stubLocation();
      const calls = stubApi(noContent, unauthorized);

      await chooseLogout();

      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
      expect(calls).toEqual([
        { url: "/api/auth/logout", method: "POST" },
        { url: "/api/me", method: "GET" },
      ]);
      expect(location.href).toBe("https://app.example/admin");
    });

    it("treats a Worker 401 on the POST as no session left: no toast, /api/me asked, /login", async () => {
      stubLocation();
      const calls = stubApi(unauthorized, unauthorized);

      await chooseLogout();

      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
      expect(calls.map((c) => c.url)).toEqual(["/api/auth/logout", "/api/me"]);
      expect(screen.queryByText(copy.errors.generic)).toBeNull();
    });

    it("treats an Access redirect on the POST the same way", async () => {
      stubLocation();
      const redirected = () => {
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, "type", { value: "opaqueredirect" });
        return Promise.resolve(response);
      };
      const calls = stubApi(redirected, redirected);

      await chooseLogout();

      await waitFor(() => expect(screen.getByTestId("where").textContent).toBe("/login"));
      expect(calls.map((c) => c.url)).toEqual(["/api/auth/logout", "/api/me"]);
      expect(screen.queryByText(copy.errors.generic)).toBeNull();
    });

    it("finishes with Access's logout when /api/me still answers", async () => {
      const location = stubLocation();
      stubApi(noContent, identity);

      await chooseLogout();

      await waitFor(() => expect(location.href).toBe(LOGOUT_PATH));
      expect(screen.getByTestId("where").textContent).not.toBe("/login");
    });

    it("stays put and says so when the POST never reaches the server", async () => {
      const location = stubLocation();
      const calls = stubApi(() => Promise.reject(new TypeError("Failed to fetch")), identity);

      await chooseLogout();

      expect(await screen.findByText(copy.errors.generic)).toBeTruthy();
      expect(calls).toEqual([{ url: "/api/auth/logout", method: "POST" }]);
      expect(screen.getByTestId("where").textContent).not.toBe("/login");
      expect(location.href).toBe("https://app.example/admin");
    });
  });
});

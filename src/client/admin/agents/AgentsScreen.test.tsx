/** The Agents page (GH #304): docs/design.md › Agents, ADR-0029. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { Device, User } from "../../../shared/schemas";
import { copy } from "../../copy";
import { formatBrusselsTime, formatDateTime, formatShortDate } from "../../format";
import { toast } from "sonner";
import { Toaster } from "../../ui/sonner";
import { adminKeys } from "../queries";
import { createAdminQueryClient } from "../query-client";
import { AgentsScreen } from "./AgentsScreen";

const t = copy.agents;

function setMobile(mobile: boolean) {
  return vi.spyOn(window, "matchMedia").mockImplementation(
    (query: string) =>
      ({
        matches: mobile && query === "(width < 768px)",
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
      }) as unknown as MediaQueryList,
  );
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function user(email: string, over: Partial<User> = {}): User {
  return {
    email,
    name: email.split("@")[0] ?? null,
    role: "agent",
    active: true,
    sessions: 0,
    openProspects: 0,
    devices: [],
    ...over,
  };
}

const ADMIN = user("sam@example.com", { name: "Sam Owner", role: "admin", sessions: 1 });
const LEA = user("lea@example.com", { name: "Léa Dupont", sessions: 2, openProspects: 3 });

type Call = { method: string; path: string; body: unknown };

/** Routes by method + path; `lists` answers successive GET /users in turn (last repeats). */
function stubFetch(
  lists: User[][],
  handlers: Record<string, (call: Call) => Response> = {},
): Call[] {
  const calls: Call[] = [];
  let gets = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input), "http://admin");
      const method = init?.method ?? "GET";
      const call: Call = {
        method,
        path: url.pathname,
        body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      };
      calls.push(call);
      const handler = handlers[`${method} ${url.pathname}`];
      if (handler) return handler(call);
      if (method === "GET" && url.pathname === "/api/admin/users") {
        const list = lists[Math.min(gets, lists.length - 1)] ?? [];
        gets += 1;
        return json({ users: list });
      }
      if (url.pathname === "/api/admin/agents") return json({ agents: [] });
      return json({}, 404);
    }),
  );
  return calls;
}

function renderScreen() {
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <AgentsScreen email="sam@example.com" />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { client, invalidate };
}

const assign = vi.fn();
vi.stubGlobal("location", { ...window.location, assign });

afterEach(() => {
  // sonner keeps its toasts in a module-level store; they would leak into the next test.
  toast.dismiss();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.stubGlobal("location", { ...window.location, assign });
  assign.mockReset();
});

async function openMenu(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: t.menu(name) }));
}

describe("AgentsScreen", () => {
  it("lists active users as the server sent them, with badge and Vous", async () => {
    stubFetch([[LEA, ADMIN, user("old@example.com", { active: false })]]);
    renderScreen();
    const rows = await screen.findAllByRole("row");
    expect(rows[1]?.textContent).toContain("Léa Dupont");
    expect(rows[1]?.textContent).toContain(t.enrolled);
    expect(rows[2]?.textContent).toContain(`sam@example.com · ${t.you}`);
    expect(screen.queryByText("old@example.com")).toBeNull();
    expect(
      screen.getByRole("button", { name: t.deactivated(1) }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("shows no Désactivés button when nobody is deactivated", async () => {
    stubFetch([[ADMIN, LEA]]);
    renderScreen();
    await screen.findByText("Léa Dupont");
    expect(screen.queryByRole("button", { name: /Désactivés/ })).toBeNull();
  });

  it("says so when the list cannot load, and retries", async () => {
    stubFetch([], { "GET /api/admin/users": () => json({}, 500) });
    renderScreen();
    expect(await screen.findByText(t.loadFailed)).toBeTruthy();
    expect(screen.getByRole("button", { name: copy.errors.retry })).toBeTruthy();
  });

  it("uses the email when the name is null", async () => {
    stubFetch([[user("root@example.com", { name: null, role: "admin" }), ADMIN]]);
    renderScreen();
    expect(await screen.findByRole("button", { name: t.menu("root@example.com") })).toBeTruthy();
  });

  it("renders a list below 768px", async () => {
    setMobile(true);
    stubFetch([[ADMIN, LEA]]);
    renderScreen();
    await screen.findByText("Léa Dupont");
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  describe("adding", () => {
    it("sends the email trimmed and lowercased, defaults to agent, and toasts", async () => {
      const calls = stubFetch([[ADMIN], [ADMIN, user("lea@x.be", { name: "Léa" })]], {
        "POST /api/admin/users": () => json(user("lea@x.be", { name: "Léa" }), 201),
      });
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.add }));
      await userEvent.type(screen.getByLabelText(t.addDialog.email), " Lea@X.be ");
      await userEvent.type(screen.getByLabelText(t.addDialog.name), "Léa");
      await userEvent.click(screen.getByRole("button", { name: t.addDialog.submit }));

      expect(await screen.findByText(t.toast.added)).toBeTruthy();
      const post = calls.find((c) => c.method === "POST");
      expect(post?.body).toEqual({ email: "lea@x.be", name: "Léa", role: "agent" });
      expect(await screen.findByText(t.notEnrolled)).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("refuses an empty name and a bad email without a request", async () => {
      const calls = stubFetch([[ADMIN]]);
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.add }));
      await userEvent.type(screen.getByLabelText(t.addDialog.email), "nope");
      await userEvent.click(screen.getByRole("button", { name: t.addDialog.submit }));
      expect(await screen.findByText(t.addDialog.emailInvalid)).toBeTruthy();
      expect(screen.getByText(t.addDialog.nameRequired)).toBeTruthy();
      expect(calls.some((c) => c.method === "POST")).toBe(false);
    });

    it("keeps the dialog open and explains a duplicate under the email", async () => {
      stubFetch([[ADMIN]], {
        "POST /api/admin/users": () => json({ error: "email_taken", message: "x" }, 409),
      });
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.add }));
      await userEvent.type(screen.getByLabelText(t.addDialog.email), "lea@example.com");
      await userEvent.type(screen.getByLabelText(t.addDialog.name), "Léa");
      await userEvent.click(screen.getByRole("button", { name: t.addDialog.submit }));
      expect(await screen.findByText(t.addDialog.emailTaken)).toBeTruthy();
      expect(screen.getByRole("dialog")).toBeTruthy();
      // Editing the address drops the duplicate sentence; resubmitting judges the new one.
      await userEvent.type(screen.getByLabelText(t.addDialog.email), "x");
      expect(screen.queryByText(t.addDialog.emailTaken)).toBeNull();
      await userEvent.clear(screen.getByLabelText(t.addDialog.email));
      await userEvent.type(screen.getByLabelText(t.addDialog.email), "nope");
      await userEvent.click(screen.getByRole("button", { name: t.addDialog.submit }));
      expect(await screen.findByText(t.addDialog.emailInvalid)).toBeTruthy();
      expect(screen.queryByText(t.addDialog.emailTaken)).toBeNull();
    });

    it("toasts the generic failure on any other error", async () => {
      stubFetch([[ADMIN]], { "POST /api/admin/users": () => json({ error: "bad" }, 400) });
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.add }));
      await userEvent.type(screen.getByLabelText(t.addDialog.email), "lea@example.com");
      await userEvent.type(screen.getByLabelText(t.addDialog.name), "Léa");
      await userEvent.click(screen.getByRole("button", { name: t.addDialog.submit }));
      expect(await screen.findByText(t.toast.failed)).toBeTruthy();
    });
  });

  describe("one-time code", () => {
    // 13:39 UTC on 7 October is 15:39 in Brussels.
    const ISSUED = { code: "K7QM2XPA", expiresAt: Date.UTC(2026, 9, 7, 13, 39) };
    const GENERATE = "POST /api/admin/users/lea%40example.com/code";

    function stubClipboard(writeText: (text: string) => Promise<void>) {
      const spy = vi.fn(writeText);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: spy },
        configurable: true,
      });
      return spy;
    }

    async function generateFor(name: string) {
      await openMenu(name);
      await userEvent.click(await screen.findByRole("menuitem", { name: t.generateCode }));
    }

    it("puts Générer un code first in every active row's menu, the admin's own included", async () => {
      stubFetch([[ADMIN, LEA]]);
      renderScreen();
      for (const name of ["Léa Dupont", "Sam Owner"]) {
        await openMenu(name);
        const items = await screen.findAllByRole("menuitem");
        expect(items[0]?.textContent).toBe(t.generateCode);
        await userEvent.keyboard("{Escape}");
      }
    });

    it("shows the code split 4 + 4 with its Brussels expiry, leaving the list alone", async () => {
      const calls = stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json(ISSUED, 201) });
      const { invalidate } = renderScreen();
      await generateFor("Léa Dupont");

      const dialog = await screen.findByRole("dialog", { name: t.codeDialog.title("Léa Dupont") });
      expect(within(dialog).getByText("K7QM 2XPA")).toBeTruthy();
      expect(
        within(dialog).getByText(t.codeDialog.validUntil(formatBrusselsTime(ISSUED.expiresAt))),
      ).toBeTruthy();
      expect(formatBrusselsTime(ISSUED.expiresAt)).toBe("15:39");
      expect(within(dialog).getByText(t.codeDialog.once)).toBeTruthy();
      expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).not.toContain(JSON.stringify(adminKeys.users()));

      await userEvent.click(within(dialog).getByRole("button", { name: t.codeDialog.done }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("copies the code and toasts, keeping it on screen", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json(ISSUED, 201) });
      renderScreen();
      await generateFor("Léa Dupont");
      const dialog = await screen.findByRole("dialog");

      const writeText = stubClipboard(() => Promise.resolve());
      fireEvent.click(within(dialog).getByRole("button", { name: t.codeDialog.copy }));

      expect(await screen.findByText(t.codeDialog.copied)).toBeTruthy();
      expect(writeText).toHaveBeenCalledWith("K7QM2XPA");
      expect(within(dialog).getByText("K7QM 2XPA")).toBeTruthy();
    });

    it("says to copy by hand when the clipboard refuses, keeping the code", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json(ISSUED, 201) });
      renderScreen();
      await generateFor("Léa Dupont");
      const dialog = await screen.findByRole("dialog");

      stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
      fireEvent.click(within(dialog).getByRole("button", { name: t.codeDialog.copy }));

      expect(await screen.findByText(t.codeDialog.copyFailed)).toBeTruthy();
      expect(within(dialog).getByText("K7QM 2XPA")).toBeTruthy();
    });

    it("generates from the row menu below 768px", async () => {
      setMobile(true);
      const calls = stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json(ISSUED, 201) });
      renderScreen();
      await generateFor("Léa Dupont");
      expect(
        await screen.findByRole("dialog", { name: t.codeDialog.title("Léa Dupont") }),
      ).toBeTruthy();
      expect(calls.filter((c) => c.method === "POST").map((c) => c.path)).toEqual([
        "/api/admin/users/lea%40example.com/code",
      ]);
    });

    it("toasts the generic failure and opens no dialog when generating fails", async () => {
      stubFetch([[ADMIN, LEA]], {
        [GENERATE]: () => json({ error: "user_inactive", message: "x" }, 409),
      });
      renderScreen();
      await generateFor("Léa Dupont");
      expect(await screen.findByText(t.toast.failed)).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("passphrase", () => {
    const P = t.passphraseDialog;
    const GENERATE = "POST /api/admin/me/passphrase";
    const PASSPHRASE = "K7QM2XPA9DWER4TN8BCH";

    function stubClipboard(writeText: (text: string) => Promise<void>) {
      const spy = vi.fn(writeText);
      Object.defineProperty(navigator, "clipboard", {
        value: { writeText: spy },
        configurable: true,
      });
      return spy;
    }

    async function replaceOwn() {
      await openMenu("Sam Owner");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.newPassphrase }));
      const confirm = await screen.findByRole("alertdialog", { name: P.confirmTitle });
      expect(within(confirm).getByText(P.confirmBody)).toBeTruthy();
      await userEvent.click(within(confirm).getByRole("button", { name: P.replace }));
      return screen.findByRole("dialog", { name: P.title });
    }

    it("offers Nouvelle phrase de passe after Générer un code on your own row only", async () => {
      stubFetch([[ADMIN, LEA, user("max@example.com", { name: "Max", role: "admin" })]]);
      renderScreen();
      await openMenu("Sam Owner");
      const items = await screen.findAllByRole("menuitem");
      expect(items.slice(0, 2).map((i) => i.textContent)).toEqual([
        t.generateCode,
        t.newPassphrase,
      ]);
      await userEvent.keyboard("{Escape}");
      for (const name of ["Léa Dupont", "Max"]) {
        await openMenu(name);
        await screen.findAllByRole("menuitem");
        expect(screen.queryByRole("menuitem", { name: t.newPassphrase })).toBeNull();
        await userEvent.keyboard("{Escape}");
      }
    });

    it("sends nothing when the confirmation is cancelled", async () => {
      const calls = stubFetch([[ADMIN, LEA]]);
      renderScreen();
      await openMenu("Sam Owner");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.newPassphrase }));
      const confirm = await screen.findByRole("alertdialog", { name: P.confirmTitle });
      await userEvent.click(within(confirm).getByRole("button", { name: P.cancel }));
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(calls.filter((c) => c.method === "POST")).toEqual([]);
    });

    it("confirms, then shows the passphrase in five groups of four, leaving the list alone", async () => {
      const calls = stubFetch([[ADMIN, LEA]], {
        [GENERATE]: () => json({ passphrase: PASSPHRASE }),
      });
      const { invalidate } = renderScreen();
      const dialog = await replaceOwn();

      expect(within(dialog).getByText("K7QM 2XPA 9DWE R4TN 8BCH")).toBeTruthy();
      expect(within(dialog).getByText(P.save)).toBeTruthy();
      expect(calls.filter((c) => c.method === "POST")).toEqual([
        { method: "POST", path: "/api/admin/me/passphrase", body: undefined },
      ]);
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).not.toContain(JSON.stringify(adminKeys.users()));

      await userEvent.click(within(dialog).getByRole("button", { name: P.done }));
      await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("keeps the passphrase on screen on Escape; only Terminé closes it", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json({ passphrase: PASSPHRASE }) });
      renderScreen();
      const dialog = await replaceOwn();

      await userEvent.keyboard("{Escape}");
      expect(screen.getByRole("dialog", { name: P.title })).toBe(dialog);
      expect(within(dialog).getByText("K7QM 2XPA 9DWE R4TN 8BCH")).toBeTruthy();
    });

    it("copies the passphrase and toasts, keeping it on screen", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json({ passphrase: PASSPHRASE }) });
      renderScreen();
      const dialog = await replaceOwn();

      const writeText = stubClipboard(() => Promise.resolve());
      fireEvent.click(within(dialog).getByRole("button", { name: P.copy }));

      expect(await screen.findByText(P.copied)).toBeTruthy();
      expect(writeText).toHaveBeenCalledWith(PASSPHRASE);
      expect(within(dialog).getByText("K7QM 2XPA 9DWE R4TN 8BCH")).toBeTruthy();
    });

    it("says to copy by hand when the clipboard refuses, keeping the passphrase", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json({ passphrase: PASSPHRASE }) });
      renderScreen();
      const dialog = await replaceOwn();

      stubClipboard(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
      fireEvent.click(within(dialog).getByRole("button", { name: P.copy }));

      expect(await screen.findByText(P.copyFailed)).toBeTruthy();
      expect(within(dialog).getByText("K7QM 2XPA 9DWE R4TN 8BCH")).toBeTruthy();
    });

    it("toasts the generic failure and shows no passphrase when generating fails", async () => {
      stubFetch([[ADMIN, LEA]], { [GENERATE]: () => json({ error: "not_found" }, 404) });
      renderScreen();
      await openMenu("Sam Owner");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.newPassphrase }));
      const confirm = await screen.findByRole("alertdialog", { name: P.confirmTitle });
      await userEvent.click(within(confirm).getByRole("button", { name: P.replace }));

      expect(await screen.findByText(t.toast.failed)).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("offers it on your own row below 768px, and not on another's", async () => {
      setMobile(true);
      const calls = stubFetch([[ADMIN, LEA]], {
        [GENERATE]: () => json({ passphrase: PASSPHRASE }),
      });
      renderScreen();
      await openMenu("Léa Dupont");
      await screen.findAllByRole("menuitem");
      expect(screen.queryByRole("menuitem", { name: t.newPassphrase })).toBeNull();
      await userEvent.keyboard("{Escape}");

      const dialog = await replaceOwn();
      expect(within(dialog).getByText("K7QM 2XPA 9DWE R4TN 8BCH")).toBeTruthy();
      expect(calls.filter((c) => c.method === "POST").map((c) => c.path)).toEqual([
        "/api/admin/me/passphrase",
      ]);
    });
  });

  describe("role change", () => {
    it("patches the role, toasts, and invalidates users and agents", async () => {
      const calls = stubFetch([[ADMIN, LEA]], {
        "PATCH /api/admin/users/lea%40example.com": () => new Response(null, { status: 204 }),
      });
      const { invalidate } = renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.makeAdmin }));
      expect(await screen.findByText(t.toast.roleChanged)).toBeTruthy();
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ role: "admin" });
      const keys = invalidate.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
      expect(keys).toContain(JSON.stringify(adminKeys.users()));
      expect(keys).toContain(JSON.stringify(adminKeys.agents()));
    });

    it("toasts the last-admin sentence on a 409", async () => {
      stubFetch([[ADMIN, LEA]], {
        "PATCH /api/admin/users/lea%40example.com": () =>
          json({ error: "last_admin", message: "x" }, 409),
      });
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.makeAdmin }));
      expect(await screen.findByText(t.lastAdmin)).toBeTruthy();
    });

    it("loads /tournee after you demote yourself", async () => {
      const second = user("max@example.com", { role: "admin" });
      stubFetch([[ADMIN, second]], {
        "PATCH /api/admin/users/sam%40example.com": () => new Response(null, { status: 204 }),
      });
      renderScreen();
      await openMenu("Sam Owner");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.makeAgent }));
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/tournee"));
    });

    it("disables both actions on the last active admin, with the reason", async () => {
      stubFetch([[ADMIN, LEA]]);
      renderScreen();
      await openMenu("Sam Owner");
      expect(
        (await screen.findByRole("menuitem", { name: t.makeAgent })).getAttribute("aria-disabled"),
      ).toBe("true");
      expect(
        screen.getByRole("menuitem", { name: t.deactivate }).getAttribute("aria-disabled"),
      ).toBe("true");
      expect(screen.getByText(t.lastAdmin)).toBeTruthy();
    });

    it("enables them when two admins are active", async () => {
      stubFetch([[ADMIN, user("max@example.com", { role: "admin" })]]);
      renderScreen();
      await openMenu("Sam Owner");
      expect(
        (await screen.findByRole("menuitem", { name: t.makeAgent })).getAttribute("aria-disabled"),
      ).toBeNull();
    });
  });

  describe("deactivating", () => {
    it.each([
      [0, "Aucun prospect n'est assigné à Léa Dupont."],
      [1, "1 prospect reste assigné à Léa Dupont."],
      [3, "3 prospects restent assignés à Léa Dupont."],
    ])("states %i open prospects from the refetch, not the stale list", async (n, sentence) => {
      // The first GET is the list on screen (1 open); the second is the dialog's refetch.
      stubFetch([
        [ADMIN, { ...LEA, openProspects: 1 }],
        [ADMIN, { ...LEA, openProspects: n }],
      ]);
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      const dialog = await screen.findByRole("alertdialog");
      await waitFor(() => expect(dialog.textContent).toContain(sentence));
      expect(dialog.textContent).toContain(t.deactivateDialog.always);
    });

    it("waits for the refetch before the destructive button works", async () => {
      let release: () => void = () => {};
      const gate = new Promise<void>((resolve) => (release = resolve));
      let gets = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          if (String(input) === "/api/admin/users") {
            gets += 1;
            if (gets > 1) await gate;
            return json({ users: [ADMIN, LEA] });
          }
          return json({ agents: [] });
        }),
      );
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      const dialog = await screen.findByRole("alertdialog");
      expect(
        within(dialog).getByRole("button", { name: t.deactivateDialog.confirm }),
      ).toHaveProperty("disabled", true);
      release();
      await waitFor(() =>
        expect(
          within(dialog).getByRole("button", { name: t.deactivateDialog.confirm }),
        ).toHaveProperty("disabled", false),
      );
    });

    it("toasts the failure and closes when the opening refetch fails", async () => {
      let gets = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async (input: RequestInfo | URL) => {
          if (String(input) === "/api/admin/users") {
            gets += 1;
            return gets > 1 ? json({}, 500) : json({ users: [ADMIN, LEA] });
          }
          return json({ agents: [] });
        }),
      );
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      expect(await screen.findByText(t.toast.failed)).toBeTruthy();
      await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    });

    it("patches active:false, toasts and moves the row to Désactivés", async () => {
      const off = { ...LEA, active: false, sessions: 0 };
      const calls = stubFetch(
        [
          [ADMIN, LEA],
          [ADMIN, LEA],
          [ADMIN, off],
        ],
        {
          "PATCH /api/admin/users/lea%40example.com": () => new Response(null, { status: 204 }),
        },
      );
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: t.deactivateDialog.confirm });
      await waitFor(() => expect(confirm).toHaveProperty("disabled", false));
      await userEvent.click(confirm);
      expect(await screen.findByText(t.toast.deactivated)).toBeTruthy();
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ active: false });
      expect(await screen.findByRole("button", { name: t.deactivated(1) })).toBeTruthy();
    });

    it("toasts the last-admin sentence on a 409", async () => {
      stubFetch([[ADMIN, user("max@example.com", { role: "admin" }), LEA]], {
        "PATCH /api/admin/users/lea%40example.com": () =>
          json({ error: "last_admin", message: "x" }, 409),
      });
      renderScreen();
      await openMenu("Léa Dupont");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: t.deactivateDialog.confirm });
      await waitFor(() => expect(confirm).toHaveProperty("disabled", false));
      await userEvent.click(confirm);
      expect(await screen.findByText(t.lastAdmin)).toBeTruthy();
    });

    it("loads /login after you deactivate yourself", async () => {
      stubFetch([[ADMIN, user("max@example.com", { role: "admin" })]], {
        "PATCH /api/admin/users/sam%40example.com": () => new Response(null, { status: 204 }),
      });
      renderScreen();
      await openMenu("Sam Owner");
      await userEvent.click(await screen.findByRole("menuitem", { name: t.deactivate }));
      const dialog = await screen.findByRole("alertdialog");
      const confirm = within(dialog).getByRole("button", { name: t.deactivateDialog.confirm });
      await waitFor(() => expect(confirm).toHaveProperty("disabled", false));
      await userEvent.click(confirm);
      await waitFor(() => expect(assign).toHaveBeenCalledWith("/login"));
    });
  });

  it("reactivates from Désactivés", async () => {
    const off = { ...LEA, active: false, sessions: 0 };
    const calls = stubFetch(
      [
        [ADMIN, off],
        [ADMIN, { ...off, active: true }],
      ],
      {
        "PATCH /api/admin/users/lea%40example.com": () => new Response(null, { status: 204 }),
      },
    );
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: t.deactivated(1) }));
    await userEvent.click(await screen.findByRole("button", { name: t.reactivate }));
    expect(await screen.findByText(t.toast.reactivated)).toBeTruthy();
    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ active: true });
    await waitFor(() => expect(screen.queryByRole("button", { name: /Désactivés/ })).toBeNull());
    expect(screen.getByText(t.notEnrolled)).toBeTruthy();
  });

  it("toasts the generic failure and keeps the screen when a reactivation fails", async () => {
    const off = { ...LEA, active: false, sessions: 0 };
    stubFetch([[ADMIN, off]], { "PATCH /api/admin/users/lea%40example.com": () => json({}, 500) });
    renderScreen();
    await userEvent.click(await screen.findByRole("button", { name: t.deactivated(1) }));
    await userEvent.click(await screen.findByRole("button", { name: t.reactivate }));
    expect(await screen.findByText(t.toast.failed)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.reactivate })).toBeTruthy();
  });

  describe("devices (GH #307)", () => {
    const PHONE: Device = {
      id: "a".repeat(32),
      label: "iPhone · Safari",
      createdAt: Date.UTC(2026, 8, 24, 10),
      lastSeenAt: Date.UTC(2026, 9, 7, 13, 24),
      current: false,
    };
    const MYSTERY: Device = { ...PHONE, id: "b".repeat(32), label: null };
    const HERE: Device = { ...PHONE, id: "c".repeat(32), label: "Mac · Safari", current: true };
    const lea = user("lea@example.com", {
      name: "Léa Dupont",
      sessions: 2,
      devices: [PHONE, MYSTERY],
    });
    const sam = user("sam@example.com", {
      name: "Sam Owner",
      role: "admin",
      sessions: 1,
      devices: [HERE],
    });
    const marc = user("marc@example.com", { name: "Marc Peeters" });
    const expand = (name: string) => screen.findByRole("button", { name: t.devices.expand(name) });

    it("opens a row's device lines from the chevron, with label and dates", async () => {
      stubFetch([[lea, sam]]);
      renderScreen();
      const chevron = await expand("Léa Dupont");
      expect(chevron.getAttribute("aria-expanded")).toBe("false");
      expect(screen.queryByText("iPhone · Safari")).toBeNull();

      await userEvent.click(chevron);

      expect(chevron.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("iPhone · Safari")).toBeTruthy();
      expect(screen.getByText(t.devices.unknown)).toBeTruthy();
      expect(
        screen.getAllByText(t.devices.enrolledOn(formatShortDate(PHONE.createdAt))),
      ).toHaveLength(2);
      expect(screen.getAllByText(t.devices.seenOn(formatDateTime(PHONE.lastSeenAt)))).toHaveLength(
        2,
      );
      expect(
        screen.getByRole("button", { name: t.devices.revokeLabel("iPhone · Safari") }).textContent,
      ).toBe(t.devices.revoke);
      expect(
        screen.getByRole("button", { name: t.devices.revokeLabel(t.devices.unknown) }),
      ).toBeTruthy();
    });

    it("reads Cet appareil, not Révoquer, on the session the page is open on", async () => {
      stubFetch([[lea, sam]]);
      renderScreen();
      await userEvent.click(await expand("Sam Owner"));
      expect(screen.getByText("Mac · Safari")).toBeTruthy();
      expect(screen.getByText(t.devices.current)).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Révoquer/ })).toBeNull();
    });

    it("says Aucun appareil inscrit. for a user with no session", async () => {
      stubFetch([[sam, marc]]);
      renderScreen();
      await userEvent.click(await expand("Marc Peeters"));
      expect(screen.getByText(t.devices.none)).toBeTruthy();
    });

    it("puts no chevron on a deactivated row", async () => {
      stubFetch([[sam, { ...marc, active: false }]]);
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.deactivated(1) }));
      expect(screen.queryByRole("button", { name: t.devices.expand("Marc Peeters") })).toBeNull();
    });

    it("revokes without confirmation, toasts, and invalidates users", async () => {
      const calls = stubFetch([[lea, sam]], {
        [`DELETE /api/admin/sessions/${PHONE.id}`]: () => new Response(null, { status: 204 }),
      });
      const { invalidate } = renderScreen();
      await userEvent.click(await expand("Léa Dupont"));
      const first = screen.getByRole("button", { name: t.devices.revokeLabel("iPhone · Safari") });

      await userEvent.click(first);

      expect(await screen.findByText(t.toast.revoked)).toBeTruthy();
      expect(calls.some((c) => c.method === "DELETE")).toBe(true);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: adminKeys.users() });
    });

    it("toasts the generic failure when revoking fails", async () => {
      stubFetch([[lea, sam]], {
        [`DELETE /api/admin/sessions/${PHONE.id}`]: () => json({}, 500),
      });
      renderScreen();
      await userEvent.click(await expand("Léa Dupont"));
      const first = screen.getByRole("button", { name: t.devices.revokeLabel("iPhone · Safari") });
      await userEvent.click(first);
      expect(await screen.findByText(t.toast.failed)).toBeTruthy();
      expect(screen.getByText("iPhone · Safari")).toBeTruthy();
    });

    it("reads a 404 as already revoked: success toast, users refetched", async () => {
      stubFetch([[lea, sam]], {
        [`DELETE /api/admin/sessions/${PHONE.id}`]: () => json({ error: "not_found" }, 404),
      });
      const { invalidate } = renderScreen();
      await userEvent.click(await expand("Léa Dupont"));
      await userEvent.click(
        screen.getByRole("button", { name: t.devices.revokeLabel("iPhone · Safari") }),
      );
      expect(await screen.findByText(t.toast.revoked)).toBeTruthy();
      expect(screen.queryByText(t.toast.failed)).toBeNull();
      expect(invalidate).toHaveBeenCalledWith({ queryKey: adminKeys.users() });
    });

    it("disables Révoquer while that device's revoke is in flight", async () => {
      let answer: (response: Response) => void = () => {};
      stubFetch([[lea, sam]], {
        [`DELETE /api/admin/sessions/${PHONE.id}`]: () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }) as unknown as Response,
      });
      renderScreen();
      await userEvent.click(await expand("Léa Dupont"));
      const button = screen.getByRole("button", { name: t.devices.revokeLabel("iPhone · Safari") });
      await userEvent.click(button);
      await waitFor(() => expect(button.hasAttribute("disabled")).toBe(true));
      expect(
        screen
          .getByRole("button", { name: t.devices.revokeLabel(t.devices.unknown) })
          .hasAttribute("disabled"),
      ).toBe(false);
      answer(new Response(null, { status: 204 }));
      expect(await screen.findByText(t.toast.revoked)).toBeTruthy();
    });

    it("lists the devices under the row below 768px, and revokes from there", async () => {
      setMobile(true);
      const calls = stubFetch([[lea, sam]], {
        [`DELETE /api/admin/sessions/${PHONE.id}`]: () => new Response(null, { status: 204 }),
      });
      renderScreen();
      await userEvent.click(await expand("Léa Dupont"));
      const row = screen.getByText("Léa Dupont").closest("li");
      if (!row) throw new Error("no row");
      expect(within(row).getByText("iPhone · Safari")).toBeTruthy();
      const first = within(row).getByRole("button", {
        name: t.devices.revokeLabel("iPhone · Safari"),
      });
      await userEvent.click(first);
      expect(await screen.findByText(t.toast.revoked)).toBeTruthy();
      expect(calls.find((c) => c.method === "DELETE")?.path).toBe(
        `/api/admin/sessions/${PHONE.id}`,
      );
    });
  });

  describe("below 768px", () => {
    it("says Vous and disables the last admin's actions", async () => {
      setMobile(true);
      stubFetch([[ADMIN, LEA]]);
      renderScreen();
      expect((await screen.findAllByRole("listitem"))[0]?.textContent).toContain(t.you);
      await openMenu("Sam Owner");
      expect(
        (await screen.findByRole("menuitem", { name: t.makeAgent })).getAttribute("aria-disabled"),
      ).toBe("true");
      expect(
        screen.getByRole("menuitem", { name: t.deactivate }).getAttribute("aria-disabled"),
      ).toBe("true");
      expect(screen.getByText(t.lastAdmin)).toBeTruthy();
    });

    it("reactivates from Désactivés", async () => {
      setMobile(true);
      const off = { ...LEA, active: false, sessions: 0 };
      const calls = stubFetch(
        [
          [ADMIN, off],
          [ADMIN, { ...off, active: true }],
        ],
        {
          "PATCH /api/admin/users/lea%40example.com": () => new Response(null, { status: 204 }),
        },
      );
      renderScreen();
      await userEvent.click(await screen.findByRole("button", { name: t.deactivated(1) }));
      await userEvent.click(await screen.findByRole("button", { name: t.reactivate }));
      expect(await screen.findByText(t.toast.reactivated)).toBeTruthy();
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ active: true });
    });
  });
});

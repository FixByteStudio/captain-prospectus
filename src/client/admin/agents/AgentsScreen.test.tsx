/** The Agents page (GH #304): docs/design.md › Agents, ADR-0029. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { User } from "../../../shared/schemas";
import { copy } from "../../copy";
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

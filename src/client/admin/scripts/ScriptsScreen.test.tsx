import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import type { Script } from "../../../shared/schemas";
import { copy } from "../../copy";
import { createAdminQueryClient } from "../query-client";
import { ScriptsScreen } from "./ScriptsScreen";
import { Toaster } from "../../ui/sonner";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function script(version: number, overrides: Partial<Script> = {}): Script {
  return {
    id: version,
    name: "default",
    version,
    isActive: false,
    createdAt: Date.UTC(2026, 8, version),
    questions: [
      {
        key: "has_delivery",
        label: "Proposez-vous la livraison ?",
        type: "yes_no",
        required: true,
      },
      {
        key: "pos_system",
        label: "Quel système de caisse ?",
        type: "single",
        options: ["Aucun", "Papier"],
      },
    ],
    ...overrides,
  };
}

const V3 = script(3, { isActive: true });
const V2 = script(2);

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function render_(fetchImpl: Fetch): { client: QueryClient; fetch: ReturnType<typeof vi.fn> } {
  const fetch = vi.fn(fetchImpl);
  vi.stubGlobal("fetch", fetch);
  const client = createAdminQueryClient();
  client.setDefaultOptions({ queries: { retry: false, refetchOnWindowFocus: false } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ScriptsScreen />
        <Toaster />
      </QueryClientProvider>
    </MemoryRouter>,
  );
  return { client, fetch };
}

/** GET answers `list`; POST answers `onPost` (a 200 with v4 by default). */
function api(list: () => Script[], onPost?: (body: unknown) => Promise<Response>): Fetch {
  return async (input, init) => {
    const url = new URL(String(input), "http://admin");
    if (url.pathname !== "/api/admin/scripts") return json({}, 404);
    if (init?.method === "POST") {
      const body: unknown = JSON.parse(String(init.body));
      return onPost ? onPost(body) : json(script(4, { isActive: true }));
    }
    return json({ scripts: list() });
  };
}

function card(n: number): HTMLElement {
  return screen.getByRole("listitem", { name: new RegExp(`^Question ${n} : `) });
}

function postBodies(fetch: ReturnType<typeof vi.fn>): unknown[] {
  return fetch.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "POST")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)) as unknown);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ScriptsScreen", () => {
  it("shows the active version as numbered cards and every version in a read-only rail", async () => {
    render_(api(() => [V3, V2]));

    await screen.findByRole("listitem", { name: /^Question 1 : Proposez-vous la livraison/ });
    expect(within(card(2)).getByText("2")).toBeTruthy();
    expect(within(card(2)).getByDisplayValue("Quel système de caisse ?")).toBeTruthy();

    const rail = screen.getByRole("complementary");
    expect(within(rail).getByText(copy.scripts.history.version(3))).toBeTruthy();
    expect(within(rail).getByText(copy.scripts.history.active)).toBeTruthy();
    expect(within(rail).getByText(copy.scripts.history.inactive)).toBeTruthy();
    expect(within(rail).queryAllByRole("button")).toHaveLength(0);
    expect(within(rail).queryAllByRole("link")).toHaveLength(0);
  });

  it("reorders from the keyboard and saves the new order", async () => {
    // happy-dom lays nothing out, so every card would sit at (0, 0) and the
    // keyboard sensor would find no card below the first. Each list item gets
    // a 100px slot by its position among its siblings.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (
      this: Element,
    ) {
      const li = this.closest("li");
      const i = li?.parentElement ? Array.from(li.parentElement.children).indexOf(li) : 0;
      return DOMRect.fromRect({ x: 0, y: i * 100, width: 400, height: 80 });
    });
    const user = userEvent.setup();
    const { fetch } = render_(api(() => [V3, V2]));

    const handle = await screen.findByRole("button", {
      name: copy.scripts.question.dragHandle("Proposez-vous la livraison ?"),
    });
    handle.focus();
    await user.keyboard("[Space]");
    await user.keyboard("[ArrowDown]");
    await user.keyboard("[Space]");

    await waitFor(() =>
      expect(within(card(1)).getByDisplayValue("Quel système de caisse ?")).toBeTruthy(),
    );

    await user.click(screen.getByRole("button", { name: copy.scripts.editor.save }));
    await user.click(await screen.findByRole("button", { name: copy.scripts.confirm.confirm }));

    await waitFor(() => expect(postBodies(fetch)).toHaveLength(1));
    const [body] = postBodies(fetch) as [{ questions: { key: string }[] }];
    expect(body.questions.map((q) => q.key)).toEqual(["pos_system", "has_delivery"]);
  });

  it("shows a saved key as locked text until Modifier la clé, then keeps the warning up", async () => {
    const user = userEvent.setup();
    render_(api(() => [V3]));

    await screen.findByRole("listitem", { name: /^Question 1 : / });
    const first = card(1);
    expect(within(first).getByText("has_delivery")).toBeTruthy();
    expect(within(first).getByText(copy.scripts.question.keyLocked)).toBeTruthy();
    expect(within(first).queryByRole("textbox", { name: copy.scripts.question.key })).toBeNull();

    await user.click(
      within(first).getByRole("button", {
        name: copy.scripts.question.unlockKeyAria("has_delivery"),
      }),
    );

    const key = within(first).getByRole("textbox", { name: copy.scripts.question.key });
    expect((key as HTMLInputElement).disabled).toBe(false);
    // The unlock button is gone, so focus moves to the input it revealed…
    await waitFor(() => expect(document.activeElement).toBe(key));
    // …and the input is described by the standing warning.
    const described = (key.getAttribute("aria-describedby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "");
    expect(described).toContain(copy.scripts.question.keyUnlockedWarning);
    expect(within(first).getByText(copy.scripts.question.keyUnlockedWarning)).toBeTruthy();

    await user.clear(key);
    await user.type(key, "delivery");
    // A standing warning in the card, not a toast: it is on screen once, there.
    expect(screen.getAllByText(copy.scripts.question.keyUnlockedWarning)).toHaveLength(1);
    expect(within(first).getByText(copy.scripts.question.keyUnlockedWarning)).toBeTruthy();
    // The other card stays locked.
    expect(within(card(2)).getByText("pos_system")).toBeTruthy();
  });

  it("suggests an editable key for a new question, with no lock", async () => {
    const user = userEvent.setup();
    render_(api(() => [V3]));

    await user.click(await screen.findByRole("button", { name: copy.scripts.question.add }));
    const third = card(3);
    await user.type(
      within(third).getByRole("textbox", { name: copy.scripts.question.label }),
      "Nombre de couverts",
    );

    const key = within(third).getByRole("textbox", { name: copy.scripts.question.key });
    expect((key as HTMLInputElement).value).toBe("nombre_de_couverts");
    expect(within(third).queryByRole("button", { name: /^Modifier la clé/ })).toBeNull();
    expect(within(third).getByText(copy.scripts.question.keyHint)).toBeTruthy();
  });

  it("names the version the confirmation will create", async () => {
    const user = userEvent.setup();
    const { fetch } = render_(api(() => [V3, V2]));

    await user.click(await screen.findByRole("button", { name: copy.scripts.editor.save }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.scripts.confirm.body(4))).toBeTruthy();
    expect(postBodies(fetch)).toHaveLength(0);
  });

  it("opens no dialog for an invalid draft and says why", async () => {
    const user = userEvent.setup();
    render_(api(() => [V3]));

    const name = await screen.findByRole("textbox", { name: copy.scripts.name });
    await user.clear(name);
    await user.click(screen.getByRole("button", { name: copy.scripts.editor.save }));

    expect(await screen.findAllByText(copy.scripts.errors.nameRequired)).not.toHaveLength(0);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("spins and locks the dialog while the save is in flight, then toasts the version", async () => {
    const user = userEvent.setup();
    let answer: (r: Response) => void = () => undefined;
    const held = new Promise<Response>((resolve) => {
      answer = resolve;
    });
    render_(
      api(
        () => [V3],
        () => held,
      ),
    );

    await user.click(await screen.findByRole("button", { name: copy.scripts.editor.save }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: copy.scripts.confirm.confirm }));

    const confirm = await within(dialog).findByRole("button", {
      name: new RegExp(copy.scripts.confirm.confirm),
    });
    await waitFor(() => expect((confirm as HTMLButtonElement).disabled).toBe(true));
    expect(within(confirm).getByRole("status", { name: copy.spinner })).toBeTruthy();
    const cancel = within(dialog).getByRole("button", { name: copy.scripts.confirm.cancel });
    expect((cancel as HTMLButtonElement).disabled).toBe(true);

    expect(within(dialog).queryByRole("button", { name: copy.close })).toBeNull();
    await user.keyboard("[Escape]");
    expect(screen.getByRole("dialog")).toBeTruthy();

    answer(json(script(4, { isActive: true })));
    expect(await screen.findByText(copy.scripts.editor.saved(4))).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("toasts the server's message for a failed save and closes the dialog", async () => {
    const user = userEvent.setup();
    render_(
      api(
        () => [V3],
        async () =>
          json({ error: "internal", message: "Le script est refusé par le serveur." }, 500),
      ),
    );

    await user.click(await screen.findByRole("button", { name: copy.scripts.editor.save }));
    await user.click(await screen.findByRole("button", { name: copy.scripts.confirm.confirm }));

    expect(await screen.findByText("Le script est refusé par le serveur.")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("toasts saveFailed when the save never reaches the server", async () => {
    const user = userEvent.setup();
    render_(
      api(
        () => [V3],
        () => Promise.reject(new TypeError("Failed to fetch")),
      ),
    );

    await user.click(await screen.findByRole("button", { name: copy.scripts.editor.save }));
    await user.click(await screen.findByRole("button", { name: copy.scripts.confirm.confirm }));

    expect(await screen.findByText(copy.scripts.editor.saveFailed)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("keeps an edit in progress when the scripts refetch in the background", async () => {
    const user = userEvent.setup();
    let list = [V3, V2];
    const { client } = render_(api(() => list));

    const name = await screen.findByRole("textbox", { name: copy.scripts.name });
    await user.clear(name);
    await user.type(name, "terrasses");

    list = [script(4, { isActive: true, name: "autre" }), { ...V3, isActive: false }, V2];
    await client.invalidateQueries();

    const rail = screen.getByRole("complementary");
    expect(await within(rail).findByText(copy.scripts.history.version(4))).toBeTruthy();
    expect(
      (screen.getByRole("textbox", { name: copy.scripts.name }) as HTMLInputElement).value,
    ).toBe("terrasses");
  });

  it("reseeds the form from the saved version, so a new question's key comes back locked", async () => {
    const user = userEvent.setup();
    const saved = script(4, {
      isActive: true,
      questions: [
        ...V3.questions,
        { key: "nombre_de_couverts", label: "Nombre de couverts", type: "number" },
      ],
    });
    render_(
      api(
        () => [V3],
        async () => json(saved),
      ),
    );

    await user.click(await screen.findByRole("button", { name: copy.scripts.question.add }));
    await user.type(
      within(card(3)).getByRole("textbox", { name: copy.scripts.question.label }),
      "Nombre de couverts",
    );
    await user.click(screen.getByRole("button", { name: copy.scripts.editor.save }));
    await user.click(await screen.findByRole("button", { name: copy.scripts.confirm.confirm }));

    // findAll: an earlier test's toast for the same version may still be up.
    expect(await screen.findAllByText(copy.scripts.editor.saved(4))).not.toHaveLength(0);
    await waitFor(() =>
      expect(
        within(card(3)).queryByRole("textbox", { name: copy.scripts.question.key }),
      ).toBeNull(),
    );
    expect(within(card(3)).getByText("nombre_de_couverts")).toBeTruthy();
  });

  it("names version 1 when the script is renamed", async () => {
    const user = userEvent.setup();
    render_(api(() => [V3, V2]));

    const name = await screen.findByRole("textbox", { name: copy.scripts.name });
    await user.clear(name);
    await user.type(name, "terrasses");
    await user.click(screen.getByRole("button", { name: copy.scripts.editor.save }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(copy.scripts.confirm.body(1))).toBeTruthy();
  });

  it("shows a duplicate key on the locked card that holds it, and opens no dialog", async () => {
    const user = userEvent.setup();
    render_(api(() => [V3]));

    await screen.findByRole("listitem", { name: /^Question 1 : / });
    await user.click(
      within(card(1)).getByRole("button", {
        name: copy.scripts.question.unlockKeyAria("has_delivery"),
      }),
    );
    const key = within(card(1)).getByRole("textbox", { name: copy.scripts.question.key });
    await user.clear(key);
    await user.type(key, "pos_system");
    await user.click(screen.getByRole("button", { name: copy.scripts.editor.save }));

    expect(await within(card(2)).findByText(copy.scripts.errors.duplicateKey)).toBeTruthy();
    expect(within(card(2)).getByText("pos_system")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so when there is no script yet", async () => {
    render_(api(() => []));

    expect(await screen.findByText(copy.scripts.question.empty)).toBeTruthy();
    expect(screen.getByText(copy.scripts.history.empty)).toBeTruthy();
    expect(screen.queryAllByRole("listitem", { name: /^Question / })).toHaveLength(0);
  });

  it("shows the load-failed alert with a retry that refetches", async () => {
    const user = userEvent.setup();
    let fail = true;
    const { fetch } = render_(async () => (fail ? json({}, 500) : json({ scripts: [V3] })));

    expect(await screen.findByText(copy.scripts.loadFailed)).toBeTruthy();
    fail = false;
    await user.click(screen.getByRole("button", { name: copy.errors.retry }));

    await screen.findByRole("listitem", { name: /^Question 1 : / });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
});

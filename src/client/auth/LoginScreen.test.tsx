/**
 * `/login`: the code form, the admin form behind its swap, and the lockout
 * (spec-gh-299, spec-gh-305, docs/design.md › The login page).
 *
 * `fetch` is stubbed rather than `apiFetch`, so the real wrapper decides what
 * a 401, a 5xx and a rejected request become — the screen's copy depends on
 * exactly that mapping.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { copy } from "../copy/field";
import { formatBrusselsTime } from "../format";
import { fieldDb } from "../field/db";
import type { PwaState } from "../pwa";
import type { Visit } from "../../shared/schemas";
import { LoginScreen } from "./LoginScreen";

const OWNER = "owner@example.com";

const noBuild = (): PwaState => ({
  needRefresh: false,
  offlineReady: true,
  update: vi.fn(),
  dismiss: vi.fn(),
});

function renderLogin(pwa: PwaState = noBuild()) {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginScreen pwa={pwa} />} />
        <Route path="/admin" element={<p>admin landing</p>} />
        <Route path="/round" element={<p>round landing</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

/** How many times the mount check asked `/api/me`; reset by every `stubFetch`. */
let meCalls = 0;

/**
 * `reply` answers the sign-in; `/api/me` (the mount check, GH #309) has its
 * own answer, a 401 unless a case says otherwise, and its calls stay out of
 * the returned list so the sign-in assertions read as before.
 */
function stubFetch(reply: () => Promise<Response>, me: () => Promise<Response> = json(401, {})) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  meCalls = 0;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "/api/me") {
      meCalls += 1;
      return me();
    }
    calls.push({ url: String(input), init });
    return reply();
  });
  return calls;
}

const json = (status: number, body: unknown) => () =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );

/** The admin form sits behind "Accès administrateur". */
async function toAdmin(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: copy.login.toAdmin }));
}

async function fillAndSubmit(email = OWNER, code = "secret phrase") {
  const user = userEvent.setup();
  await toAdmin(user);
  await user.type(screen.getByLabelText(copy.login.email), email);
  await user.type(screen.getByLabelText(copy.login.code), code);
  await user.click(screen.getByRole("button", { name: copy.login.submit }));
}

afterEach(async () => {
  vi.restoreAllMocks();
  await fieldDb.outboxVisits.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
});

describe("LoginScreen — admin form", () => {
  it("sends the admin kind and lands an admin on /admin", async () => {
    const calls = stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();

    await fillAndSubmit(" Owner@Example.com", " as typed ");

    expect(await screen.findByText("admin landing")).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      kind: "admin",
      email: OWNER,
      // Kept as typed: the server compares it exactly.
      code: " as typed ",
    });
  });

  it("lands an agent on the round", async () => {
    stubFetch(json(200, { email: "agent@example.com", role: "agent" }));
    renderLogin();
    await fillAndSubmit("agent@example.com");
    expect(await screen.findByText("round landing")).toBeTruthy();
  });

  it("says a 401 in one sentence and keeps what was typed", async () => {
    stubFetch(json(401, { error: "unauthorized", message: "x" }));
    renderLogin();

    await fillAndSubmit(OWNER, "wrong");

    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.adminRefused);
    expect((screen.getByLabelText(copy.login.email) as HTMLInputElement).value).toBe(OWNER);
    expect((screen.getByLabelText(copy.login.code) as HTMLInputElement).value).toBe("wrong");
  });

  it("says the network failed when the request never reached the server", async () => {
    stubFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    renderLogin();
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.unreachable);
  });

  it("says try again shortly on a 5xx", async () => {
    stubFetch(json(500, { error: "misconfigured", message: "x" }));
    renderLogin();
    await fillAndSubmit();
    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.failed);
  });

  it("masks the Code field and asks password managers not to save it", async () => {
    renderLogin();
    await toAdmin();
    const input = screen.getByLabelText(copy.login.code);
    expect(input.getAttribute("type")).toBe("password");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
  });

  it("asks for each empty field and sends nothing", async () => {
    const calls = stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();

    const user = userEvent.setup();
    await toAdmin(user);
    await user.click(screen.getByRole("button", { name: copy.login.submit }));

    expect(await screen.findByText(copy.login.emailRequired)).toBeTruthy();
    expect(screen.getByText(copy.login.codeRequired)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("disables the button offline, keeps the fields editable, and recovers online", async () => {
    stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();
    await toAdmin();

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    const button = screen.getByRole("button", { name: copy.login.submit }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toBe(copy.login.offline);

    const user = userEvent.setup();
    const email = screen.getByLabelText(copy.login.email) as HTMLInputElement;
    await user.type(email, OWNER);
    expect(email.value).toBe(OWNER);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LoginScreen — code form", () => {
  const codeInput = () => screen.getByLabelText(copy.login.code) as HTMLInputElement;

  async function submitCode(code: string, user = userEvent.setup()) {
    await user.type(codeInput(), code);
    await user.click(screen.getByRole("button", { name: copy.login.submit }));
  }

  it("is the default form, with the one-time-code field design.md asks for", () => {
    stubFetch(json(401, {}));
    renderLogin();
    expect(screen.getByText(copy.login.codeLede)).toBeTruthy();
    const input = codeInput();
    expect(input.type).toBe("text");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(input.getAttribute("autocapitalize")).toBe("characters");
    expect(input.getAttribute("spellcheck")).toBe("false");
    expect(input.hasAttribute("maxlength")).toBe(false);
    expect(screen.queryByLabelText(copy.login.email)).toBeNull();
  });

  it("sends the code exactly as typed and lands an agent on the round", async () => {
    const calls = stubFetch(json(200, { email: "agent@example.com", role: "agent" }));
    renderLogin();

    await submitCode("k7qm 2xpa");

    expect(await screen.findByText("round landing")).toBeTruthy();
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ kind: "code", code: "k7qm 2xpa" });
  });

  it("says a refused code and keeps what was typed", async () => {
    stubFetch(json(401, { error: "unauthorized", message: "x" }));
    renderLogin();

    await submitCode("k7qm 2xpa");

    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.codeRefused);
    expect(codeInput().value).toBe("k7qm 2xpa");
  });

  it("asks for an empty code and sends nothing", async () => {
    const calls = stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();
    await userEvent.setup().click(screen.getByRole("button", { name: copy.login.submit }));
    expect(await screen.findByText(copy.login.codeRequired)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("cannot swap while a sign-in is in flight", async () => {
    let answer: (response: Response) => void = () => {};
    stubFetch(() => new Promise<Response>((resolve) => (answer = resolve)));
    renderLogin();
    await submitCode("k7qm 2xpa");

    const swapButton = screen.getByRole("button", {
      name: copy.login.toAdmin,
    }) as HTMLButtonElement;
    await waitFor(() => expect(swapButton.disabled).toBe(true));

    answer(new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 }));
    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.codeRefused);
    expect(swapButton.disabled).toBe(false);
  });

  it("swaps forms in place, clearing a refusal and focusing the first field", async () => {
    stubFetch(json(401, { error: "unauthorized", message: "x" }));
    renderLogin();
    const user = userEvent.setup();
    await submitCode("nope", user);
    await screen.findByRole("alert");

    await toAdmin(user);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(copy.login.adminLede)).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByLabelText(copy.login.email));

    await user.click(screen.getByRole("button", { name: copy.login.toCode }));
    expect(document.activeElement).toBe(codeInput());
    // What was typed in the code form is still there.
    expect(codeInput().value).toBe("nope");
  });
});

describe("LoginScreen — lockout", () => {
  const NOW = Date.UTC(2026, 9, 7, 13, 14);
  const submitButton = () =>
    screen.getByRole("button", { name: copy.login.submit }) as HTMLButtonElement;

  function locked(retryAfter: string | null) {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (retryAfter !== null) headers["Retry-After"] = retryAfter;
    return () =>
      Promise.resolve(
        new Response(JSON.stringify({ error: "too_many_attempts", message: "x" }), {
          status: 429,
          headers,
        }),
      );
  }

  function setup() {
    vi.useFakeTimers({ shouldAdvanceTime: true, now: NOW });
    return userEvent.setup({ advanceTimers: (ms) => vi.advanceTimersByTime(ms) });
  }

  async function submitCode(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText(copy.login.code), "k7qm2xpa");
    await user.click(submitButton());
  }

  it("names the Brussels time, disables the button, then lifts on its own", async () => {
    const user = setup();
    stubFetch(locked("600"));
    renderLogin();
    await submitCode(user);

    const alert = await screen.findByRole("alert");
    const start = Date.now();
    expect(alert.textContent).toMatch(/^Trop de tentatives depuis cette connexion\. Réessayez à /);
    // The submit happened a few ms before `start`, so the minute is the same.
    expect(alert.textContent).toBe(copy.login.lockedUntil(formatBrusselsTime(start + 600_000)));
    expect(submitButton().disabled).toBe(true);
    // The fields stay editable.
    expect((screen.getByLabelText(copy.login.code) as HTMLInputElement).disabled).toBe(false);

    act(() => {
      vi.advanceTimersByTime(599_000);
    });
    expect(submitButton().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    await waitFor(() => expect(submitButton().disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("says a few minutes without a usable Retry-After, and lifts after 15 minutes", async () => {
    const user = setup();
    stubFetch(locked(null));
    renderLogin();
    await submitCode(user);

    expect((await screen.findByRole("alert")).textContent).toBe(copy.login.lockedForMinutes);
    act(() => {
      vi.advanceTimersByTime(14 * 60_000);
    });
    expect(submitButton().disabled).toBe(true);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    await waitFor(() => expect(submitButton().disabled).toBe(false));
  });

  it("keeps the lockout across the swap", async () => {
    const user = setup();
    stubFetch(locked("600"));
    renderLogin();
    await submitCode(user);
    await screen.findByRole("alert");

    await toAdmin(user);
    expect(screen.getByRole("alert").textContent).toMatch(/^Trop de tentatives/);
    expect(submitButton().disabled).toBe(true);
  });

  it("gives the Alert slot to offline, and shows the lockout again once online", async () => {
    const user = setup();
    stubFetch(locked("600"));
    renderLogin();
    await submitCode(user);
    await screen.findByRole("alert");

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(screen.getByRole("alert").textContent).toBe(copy.login.offline);
    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(screen.getByRole("alert").textContent).toMatch(/^Trop de tentatives/);
  });
});

describe("LoginScreen — a device that already has an identity (GH #309)", () => {
  const redirected = () => {
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, "type", { value: "opaqueredirect" });
    return Promise.resolve(response);
  };

  it.each([
    ["an admin", "admin", "admin landing"],
    ["an agent", "agent", "round landing"],
  ])("sends %s straight to their landing, replacing /login", async (_who, role, landing) => {
    stubFetch(json(200, {}), json(200, { email: OWNER, role }));
    renderLogin();

    expect(await screen.findByText(landing)).toBeTruthy();
    expect(meCalls).toBe(1);
  });

  it.each([
    ["a 401", json(401, { error: "unauthorized", message: "x" })],
    ["an opaque redirect", redirected],
    ["a network error", () => Promise.reject(new TypeError("Failed to fetch"))],
    ["an answer that is not an identity", json(200, { nope: true })],
  ])("keeps the form on %s, asking only once", async (_what, me) => {
    stubFetch(json(200, {}), me);
    renderLogin();

    expect(await screen.findByLabelText(copy.login.code)).toBeTruthy();
    // Let the mount check settle; it must neither retry nor redirect.
    await act(async () => {});
    expect(screen.queryByText("admin landing")).toBeNull();
    expect(screen.queryByText("round landing")).toBeNull();
    expect(meCalls).toBe(1);
  });
});

const queued = (): Visit => ({
  id: crypto.randomUUID(),
  prospectId: crypto.randomUUID(),
  visitedAt: Date.now(),
  lat: null,
  lng: null,
  flyerGiven: false,
  outcome: "interested",
  followUpAt: null,
  notes: null,
  scriptId: null,
  answers: {},
});

async function queueRows(count: number) {
  await fieldDb.outboxVisits.bulkAdd(
    Array.from({ length: count }, () => ({ ...queued(), writtenBy: "agent@example.com" })),
  );
}

describe("LoginScreen — visits waiting in the outbox", () => {
  it("says how many are kept, in the plural, and leaves every row", async () => {
    stubFetch(json(401, {}));
    await queueRows(2);
    renderLogin();

    expect(await screen.findByText(copy.login.outboxWaiting(2))).toBeTruthy();
    expect(copy.login.outboxWaiting(2)).toBe(
      "2 visites non envoyées sont gardées sur ce téléphone. Elles partiront après la connexion.",
    );
    expect(await fieldDb.outboxVisits.count()).toBe(2);
  });

  it("says it in the singular for one", async () => {
    stubFetch(json(401, {}));
    await queueRows(1);
    renderLogin();

    expect(
      await screen.findByText(
        "1 visite non envoyée est gardée sur ce téléphone. Elle partira après la connexion.",
      ),
    ).toBeTruthy();
  });

  it("shows no line when the outbox is empty", async () => {
    stubFetch(json(401, {}));
    // Call-through spy: awaiting its promise is awaiting the screen's own read.
    const count = vi.spyOn(fieldDb.outboxVisits, "count");
    renderLogin();

    await screen.findByLabelText(copy.login.code);
    await waitFor(() => expect(count).toHaveBeenCalled());
    await count.mock.results[0]?.value;
    await act(async () => {});
    expect(screen.queryByText(/non envoyée/)).toBeNull();
  });

  it("shows no line, and keeps the form, when the read fails", async () => {
    stubFetch(json(401, {}));
    await queueRows(2);
    const count = vi
      .spyOn(fieldDb.outboxVisits, "count")
      .mockRejectedValue(new Error("idb closed"));
    renderLogin();

    expect(await screen.findByLabelText(copy.login.code)).toBeTruthy();
    await waitFor(() => expect(count).toHaveBeenCalled());
    await act(async () => {});
    expect(screen.queryByText(/non envoyée/)).toBeNull();
  });

  it("keeps the line under the admin lede after the swap", async () => {
    stubFetch(json(401, {}));
    await queueRows(2);
    renderLogin();
    await screen.findByText(copy.login.outboxWaiting(2));

    await toAdmin();

    expect(screen.getByText(copy.login.adminLede)).toBeTruthy();
    expect(screen.getByText(copy.login.outboxWaiting(2))).toBeTruthy();
  });
});

describe("LoginScreen — a 426 on sign-in", () => {
  const upgrade = json(426, { error: "client_too_old", message: "x" });

  it("applies the waiting build when one is waiting, with no refusal Alert", async () => {
    stubFetch(upgrade);
    const pwa = { ...noBuild(), needRefresh: true };
    renderLogin(pwa);
    await fillAndSubmit();

    const prompt = await screen.findByRole("status");
    expect(prompt.textContent).toContain(copy.update.available);
    expect(screen.queryByRole("alert")).toBeNull();

    await userEvent.setup().click(screen.getByRole("button", { name: copy.update.apply }));
    expect(pwa.update).toHaveBeenCalledOnce();
  });

  it("reloads the page when no build is waiting yet", async () => {
    stubFetch(upgrade);
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });
    const pwa = noBuild();
    renderLogin(pwa);
    await fillAndSubmit();

    await userEvent.setup().click(await screen.findByRole("button", { name: copy.update.apply }));

    expect(reload).toHaveBeenCalledOnce();
    expect(pwa.update).not.toHaveBeenCalled();
  });

  it("hides the prompt on Plus tard and shows it again on the next 426", async () => {
    stubFetch(upgrade);
    renderLogin();
    await fillAndSubmit();
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: copy.update.dismiss }));
    expect(screen.queryByRole("status")).toBeNull();

    await user.click(screen.getByRole("button", { name: copy.login.submit }));
    expect(await screen.findByRole("status")).toBeTruthy();
  });

  it("shows no prompt just because a build is waiting", async () => {
    stubFetch(json(401, {}));
    renderLogin({ ...noBuild(), needRefresh: true });

    await screen.findByLabelText(copy.login.code);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

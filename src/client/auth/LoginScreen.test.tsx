/**
 * `/login`'s admin form (spec-gh-299, docs/design.md › The login page).
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
import { LoginScreen } from "./LoginScreen";

const OWNER = "owner@example.com";

function renderLogin() {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="/admin" element={<p>admin landing</p>} />
        <Route path="/tournee" element={<p>round landing</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function stubFetch(reply: () => Promise<Response>) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
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

async function fillAndSubmit(email = OWNER, passphrase = "secret phrase") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(copy.login.email), email);
  await user.type(screen.getByLabelText(copy.login.passphrase), passphrase);
  await user.click(screen.getByRole("button", { name: copy.login.submit }));
}

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => {
    window.dispatchEvent(new Event("online"));
  });
});

describe("LoginScreen", () => {
  it("sends the passphrase kind and lands an admin on /admin", async () => {
    const calls = stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();

    await fillAndSubmit(" Owner@Example.com", " as typed ");

    expect(await screen.findByText("admin landing")).toBeTruthy();
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("/api/auth/login");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      kind: "passphrase",
      email: OWNER,
      // Kept as typed: the server compares it exactly.
      passphrase: " as typed ",
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
    expect((screen.getByLabelText(copy.login.passphrase) as HTMLInputElement).value).toBe("wrong");
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

  it("asks for each empty field and sends nothing", async () => {
    const calls = stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();

    await userEvent.setup().click(screen.getByRole("button", { name: copy.login.submit }));

    expect(await screen.findByText(copy.login.emailRequired)).toBeTruthy();
    expect(screen.getByText(copy.login.passphraseRequired)).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("disables the button offline, keeps the fields editable, and recovers online", async () => {
    stubFetch(json(200, { email: OWNER, role: "admin" }));
    renderLogin();

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

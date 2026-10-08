import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import worker from "./index";
import { testSessionCookie } from "../../test/session";
import { TEST_ADMIN, TEST_AGENT } from "../../test/users";
import { workerFetch } from "../../test/worker-fetch";

/**
 * CAP-8: a non-GET /api request whose Origin is missing or foreign gets 403,
 * even with a valid session. A non-local host, so only the session identifies
 * the caller.
 */

const HOST = "https://captain.example";
const SYNC_BODY = JSON.stringify({ clientVersion: 1, prospects: [], visits: [] });

/** Sends the request exactly as given: no default Origin, unlike workerFetch. */
async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(new Request(`${HOST}${path}`, init), env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function sync(origin: string | null): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Cookie: await testSessionCookie(TEST_AGENT),
  };
  if (origin !== null) headers.Origin = origin;
  return rawFetch("/api/agent/sync", { method: "POST", headers, body: SYNC_BODY });
}

describe("requireSameOrigin", () => {
  it("lets the field sync POST through with the app's Origin", async () => {
    expect((await sync(HOST)).status).toBe(200);
  });

  it("refuses a foreign Origin with 403, even with a valid session", async () => {
    const response = await sync("https://evil.example");
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: "forbidden_origin" });
  });

  it("refuses a missing Origin with 403", async () => {
    expect((await sync(null)).status).toBe(403);
  });

  it("refuses Origin: null and a same-host origin on another scheme", async () => {
    expect((await sync("null")).status).toBe(403);
    expect((await sync("http://captain.example")).status).toBe(403);
  });

  it("refuses an admin PATCH from a foreign Origin", async () => {
    const cookie = await testSessionCookie(TEST_ADMIN);
    const patch = await rawFetch(`/api/admin/prospects/${crypto.randomUUID()}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookie,
        Origin: "https://evil.example",
      },
      body: JSON.stringify({ name: "x" }),
    });
    expect(patch.status).toBe(403);
  });

  it("covers /api/auth and /api/dev too", async () => {
    const login = await rawFetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "passphrase", email: "a@b.c", passphrase: "x" }),
    });
    expect(login.status).toBe(403);
    const logout = await rawFetch("/api/auth/logout", { method: "POST" });
    expect(logout.status).toBe(403);

    const seed = await workerFetch("http://localhost/api/dev/seed", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: "{}",
    });
    expect(seed.status).toBe(403);
  });

  it("does not check GET or HEAD", async () => {
    const cookie = await testSessionCookie(TEST_ADMIN);
    expect((await rawFetch("/api/me", { headers: { Cookie: cookie } })).status).toBe(200);
    expect(
      (await rawFetch("/api/me", { method: "HEAD", headers: { Cookie: cookie } })).status,
    ).toBe(200);
  });
});

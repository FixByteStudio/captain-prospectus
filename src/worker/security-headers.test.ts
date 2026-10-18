import { describe, expect, it } from "vitest";
import { MAX_REQUEST_BYTES } from "../shared/constants";
import { testSessionCookie } from "../../test/session";
import { TEST_AGENT } from "../../test/users";
import { workerFetch } from "../../test/worker-fetch";

/**
 * GH #454, docs/security.md "Clickjacking": every /api response carries
 * the security headers, including the ones produced before a route runs. The
 * static shell gets its own from public/_headers (config.test.ts).
 */

const HOST = "https://captain.example";

function expectSecurityHeaders(response: Response) {
  expect(response.headers.get("Strict-Transport-Security")).toBe(
    "max-age=31536000; includeSubDomains",
  );
  expect(response.headers.get("Content-Security-Policy")).toBe(
    "default-src 'none'; frame-ancestors 'none'",
  );
  expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
}

describe("API security headers", () => {
  it("are on a 200", async () => {
    const response = await workerFetch(`${HOST}/api/me`, {
      headers: { Cookie: await testSessionCookie(TEST_AGENT) },
    });
    expect(response.status).toBe(200);
    expectSecurityHeaders(response);
  });

  it("are on a 401 with no session", async () => {
    const response = await workerFetch(`${HOST}/api/me`);
    expect(response.status).toBe(401);
    expectSecurityHeaders(response);
  });

  it("are on a 403 from the origin check", async () => {
    const response = await workerFetch(`${HOST}/api/agent/sync`, {
      method: "POST",
      headers: { Origin: "https://evil.example" },
      body: "{}",
    });
    expect(response.status).toBe(403);
    expectSecurityHeaders(response);
  });

  it("are on the body cap's 413, which never reaches a route", async () => {
    const response = await workerFetch(`${HOST}/api/agent/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "x".repeat(MAX_REQUEST_BYTES + 1),
    });
    expect(response.status).toBe(413);
    expectSecurityHeaders(response);
  });

  it("are on an unknown route's 404", async () => {
    const response = await workerFetch(`${HOST}/api/nope`, {
      headers: { Cookie: await testSessionCookie(TEST_AGENT) },
    });
    expect(response.status).toBe(404);
    expectSecurityHeaders(response);
  });
});

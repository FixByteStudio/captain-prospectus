/**
 * What `apiFetch` and `downloadCsv` make of the two 401s (GH #309): the
 * Worker's own is a plain status, Access's is an opaque redirect. Both keep
 * `status` 401 but carry their own `code`, and only the Worker's satisfies
 * `isWorkerUnauthorized`.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, isWorkerUnauthorized } from "./api";
import { downloadCsv } from "./admin/queries";

function accessRedirect(): Response {
  const response = new Response(null, { status: 200 });
  Object.defineProperty(response, "type", { value: "opaqueredirect" });
  return response;
}

function stubFetch(response: Response) {
  const fetchFn = vi.fn(() => Promise.resolve(response));
  vi.stubGlobal("fetch", fetchFn);
  return fetchFn;
}

async function caught(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }
  throw new Error("expected the call to reject");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("apiFetch", () => {
  it("turns the Worker's 401 into status 401, code unauthorized", async () => {
    stubFetch(new Response("{}", { status: 401 }));

    const error = await caught(() => apiFetch("/api/me"));

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(isWorkerUnauthorized(error)).toBe(true);
  });

  it("turns an Access redirect into status 401, code access_redirect", async () => {
    stubFetch(accessRedirect());

    const error = await caught(() => apiFetch("/api/me"));

    expect(error).toMatchObject({ status: 401, code: "access_redirect" });
    expect(isWorkerUnauthorized(error)).toBe(false);
  });

  it("keeps other failures as they were, and they are not the Worker's 401", async () => {
    stubFetch(new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }));

    const error = await caught(() => apiFetch("/api/me"));

    expect(error).toMatchObject({ status: 403, code: "forbidden" });
    expect(isWorkerUnauthorized(error)).toBe(false);
  });

  it("is false for anything that is not an ApiError", () => {
    expect(isWorkerUnauthorized(new TypeError("Failed to fetch"))).toBe(false);
    expect(isWorkerUnauthorized(undefined)).toBe(false);
  });
});

describe("downloadCsv", () => {
  it("classifies the Worker's 401 the same way", async () => {
    stubFetch(new Response("", { status: 401 }));

    const error = await caught(() => downloadCsv("/api/x.csv", "x.csv", "failed"));

    expect(error).toMatchObject({ status: 401, code: "unauthorized" });
    expect(isWorkerUnauthorized(error)).toBe(true);
  });

  it("classifies an Access redirect the same way", async () => {
    stubFetch(accessRedirect());

    const error = await caught(() => downloadCsv("/api/x.csv", "x.csv", "failed"));

    expect(error).toMatchObject({ status: 401, code: "access_redirect" });
    expect(isWorkerUnauthorized(error)).toBe(false);
  });
});

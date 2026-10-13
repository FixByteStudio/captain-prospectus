/**
 * What `apiFetch` and `downloadCsv` make of a 401 and of an opaque redirect
 * (GH #309, #469): the Worker's 401 is the one signal of a lost session; a
 * redirect is an ordinary failure (status 0, code `error`).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiFetch, isWorkerUnauthorized } from "./api";
import { copy } from "./copy/field";
import { downloadCsv } from "./admin/queries";

function opaqueRedirect(): Response {
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

  it("turns an opaque redirect into an ordinary failure, status 0, code error", async () => {
    stubFetch(opaqueRedirect());

    const error = await caught(() => apiFetch("/api/me"));

    expect(error).toMatchObject({ status: 0, code: "error", message: copy.errors.generic });
    expect(isWorkerUnauthorized(error)).toBe(false);
  });

  it("asks fetch not to follow redirects, so a proxy's login page is never parsed", async () => {
    const fetchFn = stubFetch(new Response("{}", { status: 200 }));

    await apiFetch("/api/me");

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/me",
      expect.objectContaining({ redirect: "manual" }),
    );
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

  it("turns an opaque redirect into an ordinary failure carrying the caller's message", async () => {
    stubFetch(opaqueRedirect());

    const error = await caught(() => downloadCsv("/api/x.csv", "x.csv", "failed"));

    expect(error).toMatchObject({ status: 0, code: "error", message: "failed" });
    expect(isWorkerUnauthorized(error)).toBe(false);
  });

  it("asks fetch not to follow redirects, so a proxy's login page is never saved as the file", async () => {
    const fetchFn = stubFetch(new Response("", { status: 401 }));

    await caught(() => downloadCsv("/api/x.csv", "x.csv", "failed"));

    expect(fetchFn).toHaveBeenCalledWith(
      "/api/x.csv",
      expect.objectContaining({ redirect: "manual" }),
    );
  });
});

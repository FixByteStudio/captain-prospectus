import { describe, expect, it, vi } from "vitest";
import { MutationObserver } from "@tanstack/react-query";
import { ApiError } from "../api";
import { createAdminQueryClient } from "./query-client";
import { adminKeys } from "./queries";

describe("createAdminQueryClient", () => {
  it("invalidates every dashboard period after any successful mutation", async () => {
    const client = createAdminQueryClient();
    client.setQueryData(adminKeys.dashboard(30), { openProspects: 3 });
    client.setQueryData(adminKeys.dashboard(7), { openProspects: 3 });
    client.setQueryData(adminKeys.agents(), { agents: [] });

    await new MutationObserver(client, { mutationFn: async () => "assigned" }).mutate();

    expect(client.getQueryState(adminKeys.dashboard(30))?.isInvalidated).toBe(true);
    expect(client.getQueryState(adminKeys.dashboard(7))?.isInvalidated).toBe(true);
    // Only the dashboard: other queries keep their own invalidation rules.
    expect(client.getQueryState(adminKeys.agents())?.isInvalidated).toBe(false);
  });

  it("leaves the dashboard alone when a mutation fails", async () => {
    const client = createAdminQueryClient();
    client.setQueryData(adminKeys.dashboard(30), { openProspects: 3 });

    const failing = new MutationObserver(client, {
      mutationFn: async () => {
        throw new Error("refused");
      },
    });
    await expect(failing.mutate()).rejects.toThrow("refused");

    expect(client.getQueryState(adminKeys.dashboard(30))?.isInvalidated).toBe(false);
  });
});

describe("createAdminQueryClient › the Worker's 401 (GH #309)", () => {
  const unauthorized = () => new ApiError(401, "unauthorized", "x");
  const accessRedirect = () => new ApiError(401, "access_redirect", "x");

  it("calls onUnauthorized once when a query gets a Worker 401, however many fail", async () => {
    const onUnauthorized = vi.fn();
    const client = createAdminQueryClient(onUnauthorized);

    await Promise.allSettled([
      client.fetchQuery({
        queryKey: ["a"],
        queryFn: () => Promise.reject(unauthorized()),
        retry: false,
      }),
      client.fetchQuery({
        queryKey: ["b"],
        queryFn: () => Promise.reject(unauthorized()),
        retry: false,
      }),
    ]);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("calls it for a mutation too", async () => {
    const onUnauthorized = vi.fn();
    const client = createAdminQueryClient(onUnauthorized);

    await expect(
      new MutationObserver(client, { mutationFn: () => Promise.reject(unauthorized()) }).mutate(),
    ).rejects.toBeInstanceOf(ApiError);

    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it("leaves an Access redirect and other failures to the screens", async () => {
    const onUnauthorized = vi.fn();
    const client = createAdminQueryClient(onUnauthorized);

    for (const error of [accessRedirect(), new ApiError(500, "error", "x"), new Error("net")]) {
      await expect(
        client.fetchQuery({
          queryKey: [String(error)],
          queryFn: () => Promise.reject(error),
          retry: false,
        }),
      ).rejects.toBe(error);
    }

    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("does not retry a Worker 401, but retries once anything else", async () => {
    const client = createAdminQueryClient(() => {});
    const retry = client.getDefaultOptions().queries?.retry;
    if (typeof retry !== "function") throw new Error("retry is not a function");

    expect(retry(0, unauthorized())).toBe(false);
    expect(retry(0, new ApiError(500, "error", "x"))).toBe(true);
    expect(retry(1, new ApiError(500, "error", "x"))).toBe(false);
  });
});

/**
 * `useImportBatches` is not a `useMutation`, so the MutationCache in
 * query-client.ts never sees it — its own dashboard invalidation is the only
 * thing that makes Tableau de bord refetch after an import (GH #107).
 */
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { createAdminQueryClient } from "./query-client";
import {
  adminKeys,
  parseProspectFilters,
  prospectsHref,
  toQueryString,
  useImportBatches,
} from "./queries";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("useImportBatches", () => {
  it("marks the dashboard stale once an import has run", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ created: 1, updated: 0 }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    const client = createAdminQueryClient();
    client.setQueryData(adminKeys.dashboard(30), { openProspects: 3 });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useImportBatches(), { wrapper });
    await act(() => result.current.start([{ name: "Chez Léa", type: "restaurant" }]));

    expect(client.getQueryState(adminKeys.dashboard(30))?.isInvalidated).toBe(true);
  });
});

describe("Prospects' URL filters (GH #114)", () => {
  const parse = (query: string) => parseProspectFilters(new URLSearchParams(query));

  it("round-trips every filter through one spelling", () => {
    const filters = {
      status: ["new" as const, "follow_up" as const],
      dueBefore: 1_800_000_000_000,
      assignedTo: "lea@example.com",
      source: "osm" as const,
    };
    const query = toQueryString(filters);
    expect(query).toBe(
      "?status=new%2Cfollow_up&dueBefore=1800000000000&assignedTo=lea%40example.com&source=osm",
    );
    expect(parse(query.slice(1))).toEqual(filters);
    expect(prospectsHref({})).toBe("/admin/prospects");
  });

  it("carries `q` last, so it never disturbs an existing URL's own order (#179)", () => {
    const filters = { status: ["new" as const], q: "bistro" };
    const query = toQueryString(filters);
    expect(query).toBe("?status=new&q=bistro");
    expect(parse(query.slice(1))).toEqual(filters);
  });

  it("drops a blank or over-long `q` rather than sending it", () => {
    expect(parse("q=")).toEqual({});
    expect(parse("q=%20%20%20")).toEqual({});
    expect(parse(`q=${"a".repeat(201)}`)).toEqual({});
    expect(parse("q=bistro")).toEqual({ q: "bistro" });
  });

  it("round-trips inactiveAgent and drops any value but true (GH #308)", () => {
    const filters = { status: ["new" as const], inactiveAgent: true as const };
    const query = toQueryString(filters);
    expect(query).toBe("?status=new&inactiveAgent=true");
    expect(parse(query.slice(1))).toEqual(filters);
    expect(parse("inactiveAgent=1")).toEqual({});
    expect(parse("inactiveAgent=false")).toEqual({});
    expect(parse("inactiveAgent=")).toEqual({});
  });

  it("collapses duplicate statuses", () => {
    expect(parse("status=new,new")).toEqual({ status: ["new"] });
  });

  it("drops what the API would reject instead of throwing", () => {
    expect(parse("status=new,parti&dueBefore=abc&source=fax&assignedTo=nobody")).toEqual({});
    expect(parse("status=&dueBefore=")).toEqual({});
    expect(parse("status=new,&dueBefore=-1")).toEqual({});
    // Past the largest Date: formatting it would throw.
    expect(parse("dueBefore=9000000000000000")).toEqual({});
  });
});

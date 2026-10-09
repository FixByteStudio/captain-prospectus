import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/worker/index";

/**
 * Calls the Worker as a browser on the same origin would: `Origin` is the
 * URL's own unless the caller sets one, because the Worker refuses a non-GET
 * request without it (CAP-8, src/worker/origin.ts). `bindings` replaces
 * bindings of the test env for this one request, e.g. a `DB` from test/d1-hook.ts.
 */
export async function workerFetch(
  url: string,
  init?: RequestInit,
  bindings?: Partial<typeof env>,
): Promise<Response> {
  const request = new Request(url, init);
  if (!request.headers.has("Origin")) request.headers.set("Origin", new URL(url).origin);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, bindings ? { ...env, ...bindings } : env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

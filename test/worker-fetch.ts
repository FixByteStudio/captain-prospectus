import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import worker from "../src/worker/index";

/**
 * Calls the Worker as a browser on the same origin would: `Origin` is the
 * URL's own unless the caller sets one, because the Worker refuses a non-GET
 * request without it (CAP-8, src/worker/origin.ts).
 */
export async function workerFetch(url: string, init?: RequestInit): Promise<Response> {
  const request = new Request(url, init);
  if (!request.headers.has("Origin")) request.headers.set("Origin", new URL(url).origin);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

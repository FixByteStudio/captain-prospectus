/**
 * Fetch wrapper for /api.
 *
 * `redirect: "manual"` stays as a guard (ADR-0034): the Worker never
 * redirects `/api`, so a redirect is a proxy or a captive portal, never a lost
 * session. It comes back opaque and becomes an ordinary failure, instead of a
 * login page parsed as JSON. Only the Worker's 401 means the session is gone.
 */
import { copy } from "./copy/field";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    /** Seconds from a 429's Retry-After; null when absent or unusable. */
    readonly retryAfter: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Any 401: the Worker said this session is no longer valid; `/login` is the way back. */
export function isWorkerUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** The 401 `ApiError` for a response, or null. Shared with `downloadCsv`. */
export function authError(response: Response, message: string): ApiError | null {
  return response.status === 401 ? new ApiError(401, "unauthorized", message) : null;
}

/**
 * An opaque redirect as an ordinary failure (status 0, code `error`), or null.
 * Not a 401, so it never opens `/login` or drops a cache. Shared with `downloadCsv`.
 */
export function redirectError(response: Response, message: string): ApiError | null {
  return response.type === "opaqueredirect" ? new ApiError(0, "error", message) : null;
}

/** Retry-After as delta-seconds; an HTTP-date or junk is not usable. */
function retryAfterSeconds(header: string | null): number | null {
  if (header === null || !/^\s*\d+\s*$/.test(header)) return null;
  const seconds = Number(header);
  return seconds > 0 ? seconds : null;
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    redirect: "manual",
  });

  const authFailure = authError(response, copy.errors.sessionExpired);
  if (authFailure) throw authFailure;
  const redirected = redirectError(response, copy.errors.generic);
  if (redirected) throw redirected;
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      body.error ?? "error",
      body.message ?? copy.errors.generic,
      response.status === 429 ? retryAfterSeconds(response.headers.get("Retry-After")) : null,
    );
  }
  // 204 has no body (PATCH /api/admin/users/:email); parsing it would throw.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

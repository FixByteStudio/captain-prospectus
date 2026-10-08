/**
 * Fetch wrapper for /api.
 *
 * Access answers an expired session with a redirect to the login page;
 * `redirect: "manual"` turns that into an opaque response we can recognise
 * instead of parsing a login page as JSON (ADR-0006).
 */
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

  if (response.type === "opaqueredirect" || response.status === 401) {
    throw new ApiError(401, "auth", "Votre session a expiré. Reconnectez-vous.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new ApiError(
      response.status,
      body.error ?? "error",
      body.message ?? "Une erreur est survenue. Réessayez.",
      response.status === 429 ? retryAfterSeconds(response.headers.get("Retry-After")) : null,
    );
  }
  // 204 has no body (PATCH /api/admin/users/:email); parsing it would throw.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

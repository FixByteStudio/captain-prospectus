/**
 * Session primitives for our own login (ADR-0029): HMAC under AUTH_PEPPER, the
 * random token, and the `__Host-` cookie that carries it.
 *
 * Nothing here logs. A token, a hash or BREAK_GLASS in a log line would be a
 * credential in Workers observability (docs/security.md).
 */
import type { Role } from "../shared/constants";
import { CROCKFORD } from "../shared/credential";

export const SESSION_COOKIE = "__Host-cp_session";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Fixed lifetime from creation, per role. ADR-0029 wants a sliding expiry;
 * that and `last_seen_at` writes are a later entry of epic-own-login.
 */
export const SESSION_TTL_MS: Record<Role, number> = {
  admin: 30 * DAY_MS,
  agent: 90 * DAY_MS,
};

/**
 * The imported key lives in module scope, keyed by the pepper, so a request
 * pays one HMAC and not a key import too (INVARIANT 13: 10 ms CPU). Keyed
 * rather than a single slot so a test that swaps the pepper never hashes under
 * a stale key.
 */
const keyCache = new Map<string, Promise<CryptoKey>>();

function hmacKey(pepper: string): Promise<CryptoKey> {
  let key = keyCache.get(pepper);
  if (!key) {
    key = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(pepper),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    keyCache.set(pepper, key);
  }
  return key;
}

/** HMAC-SHA-256 digest; always 32 bytes, so two of them compare in constant time. */
export async function hmacBytes(pepper: string, value: string): Promise<ArrayBuffer> {
  return crypto.subtle.sign("HMAC", await hmacKey(pepper), new TextEncoder().encode(value));
}

/** HMAC-SHA-256 as lowercase hex: the only form a secret is stored in. */
export async function hmacHex(pepper: string, value: string): Promise<string> {
  const bytes = new Uint8Array(await hmacBytes(pepper, value));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** 32 random bytes, base64url without padding. */
export function newSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** How long a one-time code works once generated (identity-access.md). */
export const LOGIN_CODE_TTL_MS = 15 * 60 * 1000;

/**
 * `length` random Crockford characters, 5 bits each, read most significant
 * first from ceil(length × 5 / 8) random bytes; the spare low bits are dropped.
 */
function crockfordRandom(length: number): string {
  const byteCount = Math.ceil((length * 5) / 8);
  const spare = BigInt(byteCount * 8 - length * 5);
  const bytes = crypto.getRandomValues(new Uint8Array(byteCount));
  let bits = 0n;
  for (const b of bytes) bits = (bits << 8n) | BigInt(b);
  bits >>= spare;
  let out = "";
  for (let i = length - 1; i >= 0; i--)
    out += CROCKFORD.charAt(Number((bits >> BigInt(i * 5)) & 31n));
  return out;
}

/** 8 Crockford characters from 5 random bytes: 40 bits per code. */
export function newLoginCode(): string {
  return crockfordRandom(8);
}

/** An admin's passphrase (identity-access.md): 20 Crockford characters, 100 bits. */
export function newPassphrase(): string {
  return crockfordRandom(20);
}

/** One named cookie from a Cookie header, or null. */
export function readCookie(header: string | null | undefined, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=") || null;
  }
  return null;
}

/** `__Host-` demands Secure, Path=/ and no Domain; the rest is ADR-0029. */
export function sessionCookie(token: string, maxAgeMs: number): string {
  const maxAge = Math.floor(maxAgeMs / 1000);
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

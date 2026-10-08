/**
 * The one reading of a typed credential (identity-access.md, GH #305). The
 * server hashes what this returns; the client sends the code as typed and
 * never rewrites it, so the rule has a single home.
 */

/** Crockford base32: no I, L, O or U, so nothing on screen reads two ways. */
export const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Uppercase, drop spaces and hyphens, and read I/L as 1 and O as 0. */
export function normaliseCredential(typed: string): string {
  return typed.toUpperCase().replace(/[\s-]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0");
}

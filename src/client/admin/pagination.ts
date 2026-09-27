/**
 * Paging shapes shared by Visites and Prospects. Pure, so both screens' DOM
 * tests can trust one small module rather than re-deriving the arithmetic.
 *
 * Visites (GH #178) pages client-side over a held, in-memory list — there is
 * no server paging on the live feed and none may be added (docs/design.md's
 * "The candidate list is bounded and scrolls, and the live feed's is not"
 * reasoning extends here): the feed is capped at `ADMIN_VISITS_PAGE_SIZE` rows
 * and the page turns over that held array (`pageSlice`).
 *
 * Prospects (#179) pages on the server instead: the list endpoint already has
 * `limit`/`offset` and its own `total`, so `pageSlice` is not used there — only
 * `PAGE_SIZE`, `pageCount` and `pageItems`, over the server's own count.
 */

/** Rows per page, both screens (docs/design.md › "Pagination and export"). */
export const PAGE_SIZE = 25;

/** At least 1, even for an empty list, so "page 1 of 1" is always a valid page. */
export function pageCount(total: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** The rows for one 1-indexed page. Out-of-range pages simply come back empty. */
export function pageSlice<T>(items: readonly T[], page: number, pageSize: number = PAGE_SIZE): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export type PageItem = number | "ellipsis";

/**
 * Page numbers to print, with an "ellipsis" placeholder for a skipped run —
 * always first, last, and a small window around `current`.
 */
export function pageItems(current: number, total: number): PageItem[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  if (start > 2) items.push("ellipsis");
  for (let page = start; page <= end; page++) items.push(page);
  if (end < total - 1) items.push("ellipsis");

  items.push(total);
  return items;
}

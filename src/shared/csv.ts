/**
 * CSV serialisation, RFC 4180. The export rules (ISO-8601 timestamps, quoting,
 * null as empty, the `#` trailer) live in docs/api.md, "CSV exports"; this module
 * is pure so they can be unit-tested away from a database.
 */

/** A cell before it is written. `null` means empty, never the text "null". */
export type Cell = string | number | boolean | null | undefined;

/** Quote a field holding `,`, `"` or a newline, doubling any quote inside it. */
export function csvField(value: Cell): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "string" ? value : String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

/** One row, already escaped. */
export function csvRow(cells: readonly Cell[]): string {
  return cells.map(csvField).join(",");
}

/**
 * A whole file: header, rows, then `trailer`, the OSM attribution (INVARIANT 11).
 * CRLF line endings: Excel on Windows is the reader that cares, and every other
 * tool accepts them.
 */
export function csvFile(
  header: readonly string[],
  rows: readonly (readonly Cell[])[],
  trailer?: string,
): string {
  const lines = [csvRow(header), ...rows.map(csvRow)];
  if (trailer) lines.push(trailer);
  return lines.join("\r\n") + "\r\n";
}

/**
 * Epoch milliseconds as an ISO-8601 string, or empty. UTC because a column that
 * silently shifts an hour twice a year is worse than one that is explicitly UTC.
 */
export function csvTimestamp(ms: number | null | undefined): string {
  if (typeof ms !== "number") return "";
  return new Date(ms).toISOString();
}

/** `prospects-2026-09-23.csv` — the request's own date, in UTC. */
export function csvFilename(prefix: string, at: number): string {
  const day = new Date(at).toISOString().slice(0, 10);
  return `${prefix}-${day}.csv`;
}

/** `content-disposition` for a download, with the filename quoted. */
export function csvDisposition(filename: string): string {
  return `attachment; filename="${filename}"`;
}

/** OSM attribution, required on every export (INVARIANT 11). */
export const CSV_ATTRIBUTION = "# © OpenStreetMap contributors";

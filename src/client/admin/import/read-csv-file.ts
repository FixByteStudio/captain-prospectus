import { copy } from "../../copy";
import { parseCsv } from "./csv";
import type { ParsedCsv } from "./csv";

/**
 * Read a chosen file in the browser, never sending or storing it
 * (ingestion.md). A French message instead of a throw, so Source and a later
 * « Changer de fichier » show the same Alert for the same fault.
 */
export async function readCsvFile(file: File): Promise<{ parsed: ParsedCsv } | { error: string }> {
  try {
    const parsed = parseCsv(await file.text());
    if (parsed.headers.length === 0) return { error: copy.import.file.noHeaders };
    if (parsed.rows.length === 0) return { error: copy.import.file.emptyFile };
    return { parsed };
  } catch {
    return { error: copy.import.file.unreadable };
  }
}

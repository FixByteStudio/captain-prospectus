import { useRef, useState } from "react";
import { FileSpreadsheet, UploadIcon } from "lucide-react";
import { copy } from "../../copy";
import { Alert, AlertDescription } from "../../ui/alert";
import { Button } from "../../ui/button";
import { Surface } from "../Surface";
import { parseCsv } from "./csv";
import type { ParsedCsv } from "./csv";

/**
 * Step one: read the file. It is parsed here, in the browser, and never sent
 * or stored anywhere (ingestion.md) — which the hint says plainly, because a
 * customer list is the kind of thing people are right to be careful with.
 */
export function FileStep({ onParsed }: { onParsed: (name: string, csv: ParsedCsv) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    try {
      const parsed = parseCsv(await file.text());
      if (parsed.headers.length === 0) return setError(copy.import.file.noHeaders);
      if (parsed.rows.length === 0) return setError(copy.import.file.emptyFile);
      onParsed(file.name, parsed);
    } catch {
      setError(copy.import.file.unreadable);
    }
  }

  return (
    <Surface className="max-w-2xl p-5">
      <span className="bg-secondary text-foreground mb-4 grid size-10 place-items-center rounded-lg">
        <FileSpreadsheet aria-hidden="true" />
      </span>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void read(file);
          // Let the same file be chosen twice in a row after a correction.
          event.target.value = "";
        }}
      />

      <div>
        <Button onClick={() => input.current?.click()}>
          <UploadIcon />
          {copy.import.file.choose}
        </Button>
      </div>

      <p className="text-muted-foreground mt-3 max-w-prose">{copy.import.file.hint}</p>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </Surface>
  );
}

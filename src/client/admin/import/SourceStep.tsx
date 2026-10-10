import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { CircleCheck, FileSpreadsheet, Map as MapIcon } from "lucide-react";
import { copy } from "../../copy";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Surface } from "../Surface";
import type { ParsedCsv } from "./csv";
import { readCsvFile } from "./read-csv-file";

/**
 * Step one: which source — docs/domains/ingestion.md, "two sources, one
 * pipeline".
 *
 * Two equal cards (DESIGN.md › `source-card`), side by side from md and
 * stacked below it. « Importer un fichier » opens the file picker straight
 * away and the file is read here, so a bad file leaves the admin on Source
 * with the Alert under the cards; only a readable one moves on.
 *
 * The fork is the file or the map — not the provider. Which map provider is
 * searched is a choice inside the map step, because it changes the drawing
 * gesture and not the flow (ADR-0020).
 *
 * This is also the accessible fork. Drawing a polygon is a pointer gesture;
 * this screen, and everything down the CSV path, is reachable from a keyboard
 * (design.md, "The map import").
 */
export function SourceStep({
  onParsed,
  onChooseMap,
}: {
  onParsed: (file: File, csv: ParsedCsv) => void;
  onChooseMap: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function read(file: File) {
    setError(null);
    const result = await readCsvFile(file);
    if ("error" in result) setError(result.error);
    else onParsed(file, result.parsed);
  }

  return (
    <div>
      <p className="text-muted-foreground mb-4">{copy.import.source.lede}</p>

      <input
        ref={input}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void read(file);
          // Let the same file be chosen twice in a row after a correction.
          event.target.value = "";
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <SourceCard
          icon={<FileSpreadsheet aria-hidden="true" />}
          card={copy.import.source.csv}
          chip={copy.import.source.csv.format}
          variant="default"
          onClick={() => input.current?.click()}
        />
        <SourceCard
          icon={<MapIcon aria-hidden="true" />}
          card={copy.import.source.map}
          variant="secondary"
          onClick={onChooseMap}
        />
      </div>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function SourceCard({
  icon,
  card,
  chip,
  variant,
  onClick,
}: {
  icon: ReactNode;
  card: {
    tag: string;
    title: string;
    hint: string;
    bullets: readonly string[];
    flow: string;
    action: string;
  };
  chip?: string;
  variant: "default" | "secondary";
  onClick: () => void;
}) {
  return (
    <Surface className="flex flex-col p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <span className="bg-secondary text-foreground grid size-14 shrink-0 place-items-center rounded-lg">
          {icon}
        </span>
        <Badge variant="secondary">{card.tag}</Badge>
      </div>

      <h2 className="text-heading flex flex-wrap items-center gap-2">
        {card.title}
        {chip && (
          <Badge variant="outline" className="tnum">
            {chip}
          </Badge>
        )}
      </h2>
      <p className="text-muted-foreground mt-1.5 max-w-prose">{card.hint}</p>

      <ul className="text-meta mt-4 grid gap-x-4 gap-y-2 sm:grid-cols-2">
        {card.bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-1.5">
            <CircleCheck aria-hidden="true" className="text-success mt-px size-4 shrink-0" />
            {bullet}
          </li>
        ))}
      </ul>

      <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-4">
        <span className="text-meta text-muted-foreground">{card.flow}</span>
        <Button variant={variant} onClick={onClick}>
          {card.action}
        </Button>
      </div>
    </Surface>
  );
}

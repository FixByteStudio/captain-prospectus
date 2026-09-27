import { FileSpreadsheet, Map as MapIcon } from "lucide-react";
import type { ReactNode } from "react";
import { copy } from "../../copy";
import { Surface } from "../Surface";

/**
 * Step one: which source — docs/domains/ingestion.md, "two sources, one
 * pipeline".
 *
 * A fork, not a setting. The map is not a seventh nav link (the band already
 * carries six), and not a toggle on the file step either: the two paths ask
 * completely different second questions.
 *
 * A bordered, divided list rather than two tiles — design.md forbids cards on
 * the admin side, and the script editor already establishes the dense ledger
 * row as what this app uses instead.
 *
 * The fork is the file or the map — not the provider. Which map provider is
 * searched is a choice inside the map step, because it changes the drawing
 * gesture and not the flow (ADR-0020).
 *
 * This is also the accessible fork. Drawing a polygon is a pointer gesture;
 * this screen, and everything down the CSV path, is reachable from a keyboard
 * (design.md, "The map import").
 */
export function SourceStep({ onChoose }: { onChoose: (source: "csv" | "map") => void }) {
  return (
    <div>
      <p className="text-muted-foreground mb-4">{copy.import.source.lede}</p>
      <Surface className="max-w-2xl overflow-hidden">
        <ul className="divide-border divide-y">
          <Choice
            icon={<FileSpreadsheet aria-hidden="true" />}
            label={copy.import.source.csv}
            hint={copy.import.source.csvHint}
            onClick={() => onChoose("csv")}
          />
          <Choice
            icon={<MapIcon aria-hidden="true" />}
            label={copy.import.source.map}
            hint={copy.import.source.mapHint}
            onClick={() => onChoose("map")}
          />
        </ul>
      </Surface>
    </div>
  );
}

function Choice({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="hover:bg-accent focus-visible:bg-accent flex w-full items-start gap-3 px-3.5 py-3 text-left transition-colors"
      >
        <span className="bg-secondary text-foreground grid size-10 shrink-0 place-items-center rounded-lg">
          {icon}
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="font-medium">{label}</span>
          <span className="text-muted-foreground text-xs">{hint}</span>
        </span>
      </button>
    </li>
  );
}

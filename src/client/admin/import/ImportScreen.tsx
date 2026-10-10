import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import type { ImportRow } from "../../../shared/schemas";
import { copy } from "../../copy";
import { useImportBatches } from "../queries";
import { ScreenHeader } from "../ScreenHeader";
import { ColumnsStep } from "./ColumnsStep";
import { ImportStepper } from "./ImportStepper";
import { MapStep, type MapProvider } from "./MapStep";
import { PreviewStep } from "./PreviewStep";
import { ResultDialog } from "./ResultDialog";
import { SourceStep } from "./SourceStep";
import { guessColumns, mapRows } from "./csv";
import type { Source } from "../../../shared/constants";
import type { ColumnMap, ParsedCsv } from "./csv";

type Step = "source" | "columns" | "map" | "preview";

/**
 * The stepper shows the path the admin is on, not every path there is. The map
 * source has one step after the fork — the polygon and its results are the same
 * screen (design.md, "The map import") — so a three-step rail above it would be
 * describing a flow that does not exist.
 */
const CSV_STEPS: readonly { id: Step; label: string }[] = [
  { id: "source", label: copy.import.steps.source },
  { id: "columns", label: copy.import.steps.columns },
  { id: "preview", label: copy.import.steps.preview },
];

const MAP_STEPS: readonly { id: Step; label: string }[] = [
  { id: "source", label: copy.import.steps.source },
  { id: "map", label: copy.import.steps.map },
];

/**
 * CSV import — docs/domains/ingestion.md.
 *
 * Three steps on one page rather than a dialog: the mapping needs room for a
 * sample value under every field, and the preview is the moment the admin
 * decides, so it should not be a scrolling box. The admin always sees a preview
 * before anything is written.
 */
export function ImportScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("source");
  const [fork, setFork] = useState<"csv" | "map">("csv");
  /**
   * Which map provider the map step is on, held here rather than inside it.
   *
   * It is what the import is stamped with, and `useImportBatches` needs that
   * before a row is sent. Keeping it at this level also means the CSV path's
   * sender is untouched by ADR-0020 — its source is still just "csv".
   */
  const [provider, setProvider] = useState<MapProvider>("osm");
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [columns, setColumns] = useState<ColumnMap>({});

  // The sender is shared; only the `source` it stamps on each batch differs.
  const source: Source = fork === "csv" ? "csv" : provider;
  const importer = useImportBatches(source);

  const mapped = useMemo(
    () => (parsed ? mapRows(parsed, columns, copy.import.reasons) : []),
    [parsed, columns],
  );
  const ready = useMemo(() => mapped.flatMap((row) => (row.ok ? [row.row] : [])), [mapped]);
  const rejected = useMemo(() => mapped.filter((row) => !row.ok), [mapped]);

  // Source's first file and Fichier & colonnes' « Changer de fichier » both
  // land here: a readable file replaces the current one and re-guesses.
  function onParsed(file: File, csv: ParsedCsv) {
    setFileName(file.name);
    setFileSize(file.size);
    setParsed(csv);
    setColumns(guessColumns(csv.headers));
    setStep("columns");
  }

  function startOver() {
    setStep("source");
    setFork("csv");
    setProvider("osm");
    setFileName(null);
    setFileSize(null);
    setParsed(null);
    setColumns({});
    // MapStep holds the polygon, so remounting it at the fork is what clears
    // it — there is no third copy of that state to forget to reset.
    importer.reset();
  }

  function chooseMap() {
    setFork("map");
    setStep("map");
  }

  function run(rows: ImportRow[]) {
    importer.start(rows);
  }

  // A reload, a tab close or an outside navigation would lose every batch the
  // Worker has not yet answered; an in-app sidebar click is a router
  // navigation, not covered here: `useBlocker` needs a data router
  // (docs/design.md › The CSV import).
  useEffect(() => {
    if (!importer.isRunning) return;
    function guard(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [importer.isRunning]);

  const steps = step === "source" || fork === "csv" ? CSV_STEPS : MAP_STEPS;

  return (
    <section>
      <ImportStepper steps={steps} current={step} />

      <ScreenHeader className="mb-4" title={copy.import.title} />

      {step === "source" && <SourceStep onParsed={onParsed} onChooseMap={chooseMap} />}

      {step === "map" && (
        <MapStep
          provider={provider}
          onProviderChange={setProvider}
          progress={importer.progress}
          isRunning={importer.isRunning}
          error={importer.error}
          onBack={startOver}
          onStart={run}
        />
      )}

      {step === "columns" && parsed && (
        <ColumnsStep
          parsed={parsed}
          fileName={fileName}
          fileSize={fileSize}
          columns={columns}
          onChange={setColumns}
          onReplace={onParsed}
          onBack={() => setStep("source")}
          onNext={() => setStep("preview")}
        />
      )}

      {step === "preview" && parsed && (
        <PreviewStep
          ready={ready}
          rejected={rejected}
          progress={importer.progress}
          isRunning={importer.isRunning}
          error={importer.error}
          onBack={() => {
            // Otherwise a stale failure Alert (and its old count) would still
            // show after Retour → change columns → back to Aperçu.
            importer.reset();
            setStep("columns");
          }}
          onStart={() => run(ready)}
        />
      )}

      <ResultDialog
        result={importer.result}
        rejectedCount={rejected.length}
        onClose={startOver}
        onSeeProspects={() => navigate("/admin/prospects")}
      />
    </section>
  );
}

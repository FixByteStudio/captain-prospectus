import { useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Building2,
  FileSpreadsheet,
  Globe,
  Hash,
  Lock,
  MapPin,
  Phone,
  Tag,
  Utensils,
} from "lucide-react";
import { copy } from "../../copy";
import { formatFileSize } from "../../format";
import { Alert, AlertDescription } from "../../ui/alert";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/table";
import { Surface } from "../Surface";
import { ImportBottomBar } from "./ImportBottomBar";
import { MAPPABLE_FIELDS, sampleFor } from "./csv";
import type { ColumnMap, MappableField, ParsedCsv } from "./csv";
import { readCsvFile } from "./read-csv-file";

/** Radix cannot hold an empty string as a value. */
const SKIP = "__skip__";

const ICONS: Record<MappableField, ReactNode> = {
  name: <Building2 aria-hidden="true" />,
  type: <Tag aria-hidden="true" />,
  lat: <MapPin aria-hidden="true" />,
  lng: <MapPin aria-hidden="true" />,
  address: <MapPin aria-hidden="true" />,
  phone: <Phone aria-hidden="true" />,
  website: <Globe aria-hidden="true" />,
  cuisine: <Utensils aria-hidden="true" />,
  sourceRef: <Hash aria-hidden="true" />,
};

/**
 * The chip a row wears. The field's own chip comes first (Nom is « Requis »,
 * the coordinates « Coordonnées GPS », the source id « Clé unique »); every
 * other field reads « Détecté » once it has a column — guessed or picked by
 * hand, so each row keeps exactly one chip — and « Optionnel » while it has none.
 */
function StatusChip({ field, mapped }: { field: MappableField; mapped: boolean }) {
  const status = copy.import.columns.status;
  if (field === "name") return <Badge variant="tint-destructive">{status.required}</Badge>;
  if (field === "lat" || field === "lng") return <Badge variant="secondary">{status.gps}</Badge>;
  if (field === "sourceRef") {
    return (
      <Badge variant="secondary" className="bg-tint-warn text-warn">
        {status.uniqueKey}
      </Badge>
    );
  }
  return <Badge variant="secondary">{mapped ? status.detected : status.optional}</Badge>;
}

/**
 * Step two: the file, then which column is which.
 *
 * The first row's value sits in Exemple beside every select. That one detail
 * is what makes a mapping trustworthy in a single pass — without it the admin
 * is matching two lists of words and hoping.
 *
 * « Changer de fichier » reads with the same `readCsvFile` as Source. A good
 * file goes up through `onReplace` (which re-guesses the columns); a bad one
 * is shown here and changes nothing.
 */
export function ColumnsStep({
  parsed,
  fileName,
  fileSize,
  columns,
  onChange,
  onReplace,
  onBack,
  onNext,
}: {
  parsed: ParsedCsv;
  fileName: string | null;
  fileSize: number | null;
  columns: ColumnMap;
  onChange: (columns: ColumnMap) => void;
  onReplace: (file: File, csv: ParsedCsv) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  function set(field: MappableField, header: string) {
    const next = { ...columns };
    if (header === SKIP) delete next[field];
    else next[field] = header;
    onChange(next);
  }

  async function replace(file: File) {
    const result = await readCsvFile(file);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    setError(null);
    onReplace(file, result.parsed);
  }

  const used = new Set(Object.values(columns));
  const ignored = parsed.headers.filter((header) => !used.has(header));
  const configured = MAPPABLE_FIELDS.filter((field) => columns[field]).length;

  return (
    <div>
      <Surface className="flex flex-wrap items-center gap-4 px-5 py-4">
        <span className="bg-secondary text-foreground grid size-10 shrink-0 place-items-center rounded-lg">
          <FileSpreadsheet aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {fileName && <span className="font-medium break-all">{fileName}</span>}
            {fileSize !== null && (
              <Badge variant="secondary" className="tnum">
                {formatFileSize(fileSize)}
              </Badge>
            )}
            <Badge variant="secondary" className="tnum">
              {copy.import.columns.lines(parsed.rows.length)}
            </Badge>
          </div>
          <p className="text-meta text-muted-foreground mt-1 flex items-center gap-1.5">
            <Lock aria-hidden="true" className="size-3.5 shrink-0" />
            {copy.import.columns.inBrowser}
          </p>
        </div>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          tabIndex={-1}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void replace(file);
            // Let the same file be chosen twice in a row after a correction.
            event.target.value = "";
          }}
        />
        <Button variant="secondary" onClick={() => input.current?.click()}>
          {copy.import.columns.changeFile}
        </Button>
      </Surface>

      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Surface className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <h2 className="text-heading">{copy.import.columns.lede}</h2>
          <Badge variant="secondary" className="tnum">
            {copy.import.columns.configured(configured, MAPPABLE_FIELDS.length)}
          </Badge>
        </div>

        <Table>
          <TableHeader className="bg-secondary hidden md:table-header-group">
            <TableRow>
              <TableHead className="pl-5">{copy.import.columns.head.field}</TableHead>
              <TableHead>{copy.import.columns.head.column}</TableHead>
              <TableHead>{copy.import.columns.head.sample}</TableHead>
              <TableHead className="pr-5 text-right">{copy.import.columns.head.status}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MAPPABLE_FIELDS.map((field) => {
              const header = columns[field];
              const sample = sampleFor(parsed, header);
              return (
                <TableRow key={field} className="grid gap-2 px-5 py-3 md:table-row md:p-0">
                  <TableCell className="md:pl-5">
                    <span className="flex items-start gap-2.5 [&_svg]:mt-0.5 [&_svg]:size-4">
                      {ICONS[field]}
                      <span>
                        <span className="font-medium">{copy.import.columns.fields[field]}</span>
                        <span className="text-meta text-muted-foreground block max-w-xs">
                          {copy.import.columns.hints[field]}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select value={header ?? SKIP} onValueChange={(value) => set(field, value)}>
                      <SelectTrigger
                        aria-label={copy.import.columns.fields[field]}
                        className="w-full md:min-w-44"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={SKIP}>{copy.import.columns.skip}</SelectItem>
                        {parsed.headers.map((h) => (
                          <SelectItem key={h} value={h}>
                            {h}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    {header ? (
                      <Badge variant="secondary" className="tnum max-w-56 truncate">
                        {sample ?? copy.import.columns.noSample}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground" aria-hidden="true">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="md:pr-5 md:text-right">
                    <StatusChip field={field} mapped={Boolean(header)} />
                  </TableCell>
                </TableRow>
              );
            })}
            {ignored.map((header) => {
              const sample = sampleFor(parsed, header);
              return (
                <TableRow
                  key={`ignored:${header}`}
                  className="grid gap-2 px-5 py-3 md:table-row md:p-0"
                >
                  <TableCell className="text-muted-foreground md:pl-5">{header}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {copy.import.columns.skip}
                  </TableCell>
                  <TableCell>
                    {sample ? (
                      <Badge
                        variant="secondary"
                        className="tnum text-muted-foreground max-w-56 truncate italic"
                      >
                        {sample}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground" aria-hidden="true">
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="md:pr-5 md:text-right">
                    <Badge variant="secondary" className="text-muted-foreground">
                      {copy.import.columns.status.ignored}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <div className="border-border bg-secondary flex flex-wrap items-center justify-between gap-2 border-t px-5 py-3">
          <span className="text-meta text-muted-foreground">
            {copy.import.columns.unmappedNote}
          </span>
          <span className="text-meta text-muted-foreground tnum">
            {copy.import.columns.footer(parsed.rows.length, configured)}
          </span>
        </div>
      </Surface>

      {!columns.name && (
        <Alert variant="destructive" className="mt-4">
          <AlertDescription>{copy.import.columns.required}</AlertDescription>
        </Alert>
      )}

      <ImportBottomBar
        step={2}
        total={3}
        onBack={onBack}
        action={
          <Button disabled={!columns.name} onClick={onNext}>
            {copy.import.actions.toPreview}
          </Button>
        }
      />
    </div>
  );
}

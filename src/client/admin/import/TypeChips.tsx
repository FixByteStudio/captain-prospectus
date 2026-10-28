import type { ProspectType } from "../../../shared/constants";
import { TYPE_LABELS, copy } from "../../copy";
import { ToggleGroup, ToggleGroupItem } from "../../ui/toggle-group";
import { TYPE_CHIPS, countByChip, type TypeChip } from "./type-chips";

/** Separate pills, not a joined segment: each one is its own yes or no. */
const CHIP =
  "tnum text-muted-foreground data-[state=on]:bg-card data-[state=on]:text-foreground flex-none rounded-md px-3 first:rounded-md last:rounded-md data-[state=on]:shadow-sm";

/**
 * Which types an import brings in. Every chip keeps its count, ticked or not,
 * so the admin sees what they are leaving out, not only what they keep.
 */
export function TypeChips({
  rows,
  value,
  onChange,
  disabled,
}: {
  rows: readonly { type: ProspectType }[];
  value: TypeChip[];
  onChange: (next: TypeChip[]) => void;
  disabled?: boolean;
}) {
  const counts = countByChip(rows);
  return (
    <ToggleGroup
      type="multiple"
      size="sm"
      value={value}
      onValueChange={(next) => onChange(next as TypeChip[])}
      disabled={disabled}
      aria-label={copy.import.types.label}
      className="bg-secondary mb-3 w-fit flex-wrap gap-0.5 rounded-lg p-0.5"
    >
      {TYPE_CHIPS.map((chip) => (
        <ToggleGroupItem key={chip} value={chip} className={CHIP}>
          {copy.import.types.chip(TYPE_LABELS[chip], counts[chip])}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

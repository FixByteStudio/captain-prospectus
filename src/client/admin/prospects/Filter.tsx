import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";

/** Radix cannot hold an empty string as a value, so "any" stands for no filter. */
export const ANY = "any";

export function Filter({
  label,
  value,
  onChange,
  anyLabel,
  options,
  placeholder,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  anyLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <>
      <label className="text-muted-foreground" htmlFor={`filter-${label}`}>
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={`filter-${label}`} size="sm" className="w-44">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

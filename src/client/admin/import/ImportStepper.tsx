import { Check } from "lucide-react";
import { copy } from "../../copy";
import { cn } from "../../lib/utils";

export type StepDefinition<T extends string> = { id: T; label: string };

/**
 * The full-width rail shared by the CSV and map paths (DESIGN.md ›
 * `import-rail`, docs/design.md › The CSV import): done is an ink circle with
 * a check, current is gold with navy text and its `primary-edge`, future is
 * `secondary`. An overline (« Étape n », « En cours » on the current step)
 * sits above each label, and the line after a done step is gold: the darker
 * `primary-edge`, since palette rule 4 allows no bare `bg-primary` without an
 * edge and 2px leaves no room for one.
 *
 * It breaks out of the admin page padding (`-mx-4 -mt-6` undoes AdminLayout's
 * `<main className="px-4 pt-6">`) so the band sits directly under the top bar;
 * the layout itself does not change.
 *
 * Generic over the step id, so ImportScreen's own `Step` union is kept end to
 * end and an id `current` does not belong to `steps` fails to compile.
 *
 * Colour never carries the state alone (docs/design.md › The six rules): a done
 * step also gets a visually hidden "terminée" after its label. Below `sm`
 * only the current step is named; the other labels stay for screen readers.
 */
export function ImportStepper<T extends string>({
  steps,
  current,
}: {
  steps: readonly StepDefinition<T>[];
  current: T;
}) {
  const index = steps.findIndex((s) => s.id === current);

  return (
    <nav
      aria-label={copy.import.steps.label}
      className="bg-card border-border -mx-4 -mt-6 mb-6 border-b px-4 py-3.5 md:px-8"
    >
      <ol className="flex items-center">
        {steps.map((step, i) => {
          const done = i < index;
          const isCurrent = step.id === current;
          return (
            <li
              key={step.id}
              className={cn("flex items-center gap-2.5 sm:gap-4", i > 0 && "flex-1 pl-2.5 sm:pl-4")}
            >
              {i > 0 && (
                <span
                  className={cn(
                    "h-0.5 min-w-4 flex-1 rounded-full",
                    i <= index ? "bg-primary-edge" : "bg-border",
                  )}
                  aria-hidden="true"
                />
              )}
              <span
                className="flex flex-none items-center gap-3"
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "text-label tnum flex size-8 shrink-0 items-center justify-center rounded-full font-semibold",
                    done && "bg-foreground text-background",
                    isCurrent && "bg-primary text-primary-foreground border-primary-edge border",
                    !done && !isCurrent && "bg-secondary text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-4" /> : i + 1}
                </span>
                <span className={cn("flex flex-col", !isCurrent && "max-sm:sr-only")}>
                  <span
                    className={cn(
                      "text-overline tnum uppercase",
                      isCurrent ? "text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {isCurrent ? copy.import.steps.current : copy.import.steps.upcoming(i + 1)}
                  </span>
                  <span
                    className={cn(
                      "text-label",
                      isCurrent && "text-foreground font-semibold",
                      !isCurrent && !done && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                    {done && <span className="sr-only"> ({copy.import.steps.done})</span>}
                  </span>
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

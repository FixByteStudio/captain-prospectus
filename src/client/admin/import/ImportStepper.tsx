import { Check } from "lucide-react";
import { copy } from "../../copy";
import { cn } from "../../lib/utils";

export type StepDefinition<T extends string> = { id: T; label: string };

/**
 * The numbered stepper shared by the CSV and map paths (docs/design.md › The
 * CSV import) — replaces the text-only rail with a done/current/future
 * read: done is an ink circle with a check, current is gold with navy text
 * and its `primary-edge`, future is `secondary`.
 *
 * Generic over the step id, so ImportScreen's own `Step` union is kept end to
 * end and an id `current` does not belong to `steps` fails to compile.
 *
 * Colour never carries the state alone (docs/design.md › The six rules): a done step also gets a visually hidden "terminée" after its label,
 * so the state survives without the circle's fill.
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
    <nav aria-label={copy.import.steps.label} className="mb-5">
      <ol className="flex flex-wrap items-center gap-2.5">
        {steps.map((step, i) => {
          const done = i < index;
          const isCurrent = step.id === current;
          return (
            <li key={step.id} className="flex items-center gap-2.5">
              {i > 0 && <span className="bg-border h-px w-6" aria-hidden="true" />}
              <span
                className="flex items-center gap-2"
                aria-current={isCurrent ? "step" : undefined}
              >
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-meta font-semibold",
                    done && "bg-foreground text-background",
                    isCurrent && "bg-primary text-primary-foreground border-primary-edge border",
                    !done && !isCurrent && "bg-secondary text-muted-foreground",
                  )}
                  aria-hidden="true"
                >
                  {done ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={cn(
                    isCurrent && "text-foreground font-semibold",
                    !isCurrent && !done && "text-muted-foreground",
                  )}
                >
                  {step.label}
                  {done && <span className="sr-only"> ({copy.import.steps.done})</span>}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

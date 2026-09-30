/**
 * "Étape n sur 2 · <name>" — DESIGN.md › Step indicator, EXPERIENCE.md › Step
 * indicator (the redesign's own spec). `docs/design.md`, "The script is the
 * second screen" reverses this repo's earlier "no 1 sur 2, no dots" call to
 * match it. Renders on both steps, and only when the visit actually has one
 * (GH #123).
 */
import { copy } from "../copy/field";

export function StepIndicator({
  step,
  whenOnly = false,
}: {
  step: 1 | 2;
  /** Personne sur place: step 2 holds only the when step, no questions
   * (when-step.md), so it is named for that. */
  whenOnly?: boolean;
}) {
  // Step 1 is always Résultat; step 2 is Questions, or the when step alone.
  const name = step === 1 ? copy.visit.outcome : whenOnly ? copy.visit.when : copy.visit.questions;
  return (
    <p className="text-overline text-muted-foreground mt-3 flex items-center gap-1.5 uppercase">
      <span
        aria-hidden
        className="bg-primary ring-primary-edge size-1.5 shrink-0 rounded-full ring-1 ring-inset"
      />
      {copy.visit.step(step, 2, name)}
    </p>
  );
}

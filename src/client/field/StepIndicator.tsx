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
  step2 = "questions",
}: {
  step: 1 | 2;
  /** What step 2 actually holds: the script's questions, the when step
   * (when-step.md — À relancer, Personne sur place), or the refusal reason
   * (refusal-reasons.md — Pas intéressé). */
  step2?: "questions" | "when" | "refusal";
}) {
  // Step 1 is always Résultat; step 2 is named for whichever of the three it holds.
  const name =
    step === 1
      ? copy.visit.outcome
      : step2 === "when"
        ? copy.visit.when
        : step2 === "refusal"
          ? copy.visit.refusalReason
          : copy.visit.questions;
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

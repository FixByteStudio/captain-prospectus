import type { ReactNode } from "react";
import { copy } from "../../copy";
import { Button } from "../../ui/button";
import { Surface } from "../Surface";

/**
 * The card under each CSV step: Retour on the left, « Étape n sur 3 » and the
 * one gold action on the right (DESIGN.md › Components › Admin). Retour is
 * `secondary`, not the outline docs/design.md used to say. Shared by Fichier &
 * colonnes now and by Aperçu & validation later.
 */
export function ImportBottomBar({
  step,
  total,
  onBack,
  backDisabled = false,
  action,
}: {
  step: number;
  total: number;
  onBack: () => void;
  backDisabled?: boolean;
  action: ReactNode;
}) {
  return (
    <Surface className="mt-6 flex items-center gap-3 px-5 py-3.5">
      <Button variant="secondary" disabled={backDisabled} onClick={onBack}>
        {copy.import.actions.back}
      </Button>
      <span className="flex-1" />
      <span className="text-meta text-muted-foreground tnum">
        {copy.import.columns.step(step, total)}
      </span>
      {action}
    </Surface>
  );
}

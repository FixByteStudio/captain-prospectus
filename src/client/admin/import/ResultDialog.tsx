import { copy } from "../../copy";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import type { ImportRunResult } from "../queries";

/**
 * What actually happened, in the app's own words: created, updated, rejected.
 *
 * The rejected count is the one the run sent with its log, never the CSV state:
 * a file read before the admin turned to the map would otherwise be reported
 * for a map import (epic #363 retro, F3). On a map run it is the unnamed
 * places, so it says so.
 */
export function ResultDialog({
  result,
  onClose,
  onSeeProspects,
}: {
  result: ImportRunResult | null;
  onClose: () => void;
  onSeeProspects: () => void;
}) {
  return (
    <Dialog open={result !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{copy.import.result.title}</DialogTitle>
          <DialogDescription>
            {result && (
              <>
                {copy.import.result.created(result.created)}
                {" · "}
                {copy.import.result.updated(result.updated)}
                {result.rejected > 0 && (
                  <>
                    {" · "}
                    {result.source === "csv"
                      ? copy.import.result.skipped(result.rejected)
                      : copy.import.result.unnamed(result.rejected)}
                  </>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>
            {copy.import.actions.done}
          </Button>
          <Button onClick={onSeeProspects}>{copy.import.result.seeProspects}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

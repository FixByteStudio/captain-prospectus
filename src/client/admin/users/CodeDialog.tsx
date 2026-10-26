import type { LoginCodeResponse } from "../../../shared/schemas";
import { copy } from "../../copy";
import { formatBrusselsTime, formatBrusselsWeekday } from "../../format";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { copyToClipboard } from "./copy-to-clipboard";

const t = copy.users.codeDialog;

/**
 * The one time a code is shown (docs/design.md › Utilisateurs). Split 4 + 4 for
 * reading aloud; the server's normaliser ignores the space. The expiry is the
 * server's, in Brussels time, so a wrong device clock cannot misstate it. It
 * always names the day: an agent's code lasts 24 hours, and a time alone reads
 * as already past that afternoon.
 * Closing it any way is fine: the code works until it expires or is used.
 */
export function CodeDialog({
  name,
  issued,
  onClose,
}: {
  name: string;
  issued: LoginCodeResponse;
  onClose: () => void;
}) {
  const shown = `${issued.code.slice(0, 4)} ${issued.code.slice(4)}`;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title(name)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-display font-semibold tabular-nums">{shown}</p>
          <DialogDescription>
            {t.validUntil(
              formatBrusselsWeekday(issued.expiresAt),
              formatBrusselsTime(issued.expiresAt),
            )}
          </DialogDescription>
          <p className="text-muted-foreground text-meta">{t.once}</p>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => void copyToClipboard(issued.code, t)}>
            {t.copy}
          </Button>
          <Button onClick={onClose}>{t.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

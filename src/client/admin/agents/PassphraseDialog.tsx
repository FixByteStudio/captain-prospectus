import { useState } from "react";
import { toast } from "sonner";
import { copy } from "../../copy";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { useGeneratePassphrase } from "../queries";
import { copyToClipboard } from "./copy-to-clipboard";

const t = copy.agents.passphraseDialog;

/**
 * The signed-in admin's own new passphrase (docs/design.md › Agents). The old
 * one stops working the moment the server answers, so it asks first; then the
 * one time the passphrase is shown, in five groups of four that the server's
 * normaliser ignores. Mounted only while the flow runs.
 */
export function PassphraseDialog({ onClose }: { onClose: () => void }) {
  const generate = useGeneratePassphrase();
  const [passphrase, setPassphrase] = useState<string | null>(null);

  const replace = async () => {
    try {
      setPassphrase((await generate.mutateAsync()).passphrase);
    } catch {
      toast.error(copy.agents.toast.failed);
      onClose();
    }
  };

  if (passphrase === null) {
    return (
      <AlertDialog
        open
        onOpenChange={(open) => {
          if (!open && !generate.isPending) onClose();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>{t.confirmBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={generate.isPending}>{t.cancel}</AlertDialogCancel>
            <AlertDialogAction
              disabled={generate.isPending}
              onClick={(e) => {
                // Radix would close at once; the dialog stays until the server answers.
                e.preventDefault();
                void replace();
              }}
            >
              {t.replace}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  const shown = (passphrase.match(/.{1,4}/g) ?? []).join(" ");

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      {/* The old passphrase is already gone: a stray Escape or scrim click must not lose the new one. */}
      <DialogContent
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <p className="text-display font-semibold tabular-nums">{shown}</p>
          <DialogDescription>{t.save}</DialogDescription>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => void copyToClipboard(passphrase, t)}>
            {t.copy}
          </Button>
          <Button onClick={onClose}>{t.done}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

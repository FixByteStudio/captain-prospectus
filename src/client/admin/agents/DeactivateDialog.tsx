import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { User } from "../../../shared/schemas";
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
import { buttonVariants } from "../../ui/button-variants";
import { useUpdateUser, useUsers } from "../queries";
import { failureToast } from "./failure-toast";
import { displayName } from "./RowMenu";

const t = copy.agents.deactivateDialog;

/** Mounted only while a deactivation is pending, so mounting is "when it opens". */
export function DeactivateDialog({
  email,
  self,
  onClose,
}: {
  email: string;
  self: string;
  onClose: () => void;
}) {
  const users = useUsers();
  const update = useUpdateUser();
  const [fresh, setFresh] = useState(false);

  // The count must be the server's now, not the list's from minutes ago.
  const { refetch } = users;
  useEffect(() => {
    let live = true;
    void refetch().then((result) => {
      if (!live) return;
      // Nothing to confirm against: say so rather than wait forever.
      if (!result.isSuccess || !result.data.users.some((u) => u.email === email)) {
        toast.error(copy.agents.toast.failed);
        onClose();
        return;
      }
      setFresh(true);
    });
    return () => {
      live = false;
    };
  }, [refetch, email, onClose]);

  const user: User | undefined = users.data?.users.find((u) => u.email === email);
  const name = user ? displayName(user) : email;

  const confirm = async () => {
    try {
      await update.mutateAsync({ email, update: { active: false } });
    } catch (error) {
      failureToast(error);
      onClose();
      return;
    }
    toast.success(copy.agents.toast.deactivated);
    // App must re-read who you are, so a full load rather than a navigate.
    if (email === self) window.location.assign("/login");
    onClose();
  };

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !update.isPending) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t.title(name)}</AlertDialogTitle>
          <AlertDialogDescription>
            {fresh && user ? t.assigned(user.openProspects, name) : t.checking} {t.always}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={update.isPending}>{t.cancel}</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={!fresh || update.isPending}
            onClick={(e) => {
              // Radix would close at once; the dialog stays until the server answers.
              e.preventDefault();
              void confirm();
            }}
          >
            {t.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

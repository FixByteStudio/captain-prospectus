/**
 * The location dialog — docs/design.md › Before the swipe › The location dialog.
 *
 * An alert over the start screen with no way out: Escape and the overlay do
 * nothing (Radix's alert dialog already ignores the overlay), and the only
 * action is « Activer ». `open` is the gate's own: it closes when a reading
 * passes, and focus goes to the swipe, which a dialog would otherwise hand back
 * to whatever opened it.
 */
import type { RefObject } from "react";
import { Link } from "react-router";
import { MapPinIcon } from "lucide-react";
import { copy } from "../copy/field";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";
import { buttonVariants } from "@/ui/button-variants";
import { Spinner } from "@/ui/spinner";
import { cn } from "../lib/utils";
import type { LocationStatus } from "./location-gate";

function statusLine(status: LocationStatus): { text: string; busy: boolean } | null {
  switch (status.kind) {
    case "locating":
      return { text: copy.today.locating, busy: true };
    case "coarse":
      return { text: copy.location.coarse(status.meters), busy: true };
    case "refused":
      return { text: copy.location.refused, busy: false };
    case "unavailable":
      return { text: copy.location.unavailable, busy: false };
    default:
      return null;
  }
}

export function LocationDialog({
  open,
  status,
  onActivate,
  adminOnline,
  swipeRef,
}: {
  open: boolean;
  status: LocationStatus;
  onActivate: () => void;
  /** The dialog covers the « Tableau de bord » link above the track, so it carries its own. */
  adminOnline: boolean;
  swipeRef: RefObject<HTMLButtonElement | null>;
}) {
  const line = statusLine(status);
  return (
    <AlertDialog open={open}>
      <AlertDialogContent
        overlayClassName="backdrop-blur-sm"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          swipeRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="items-center text-center sm:text-center">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground ring-primary-edge flex size-12 items-center justify-center rounded-full ring-1 ring-inset"
          >
            <MapPinIcon className="size-6" />
          </span>
          <AlertDialogTitle>{copy.location.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            {copy.location.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {/* Always in the tree, empty before the first reading: a live region
            added with its text already in it is often not announced. */}
        <p
          role="status"
          aria-live="polite"
          className="flex items-center justify-center gap-2 text-base empty:hidden"
        >
          {line?.busy && <Spinner aria-hidden role="presentation" />}
          {line?.text}
        </p>

        <AlertDialogAction
          onClick={onActivate}
          className={cn(buttonVariants({ size: "touch" }), "w-full")}
        >
          {copy.location.activate}
        </AlertDialogAction>

        <p className="text-muted-foreground text-center text-sm">{copy.location.settings}</p>

        {adminOnline && (
          <Link to="/admin" className={buttonVariants({ variant: "secondary", size: "touch" })}>
            {copy.nav.tabs.dashboard}
          </Link>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}

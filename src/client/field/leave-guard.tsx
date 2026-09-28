/**
 * A tab tap, the sync strip's "Se reconnecter"/"Mettre à jour" and the field
 * update banner all unmount whichever field form is open, so none of them may
 * silently discard what the agent typed (#74, spec-gh-66). The open form
 * registers its `formState.isDirty` here; every caller runs its action
 * through `leave(proceed)` instead of calling it directly, so the one dialog
 * rendered by this provider is the only place that ever asks.
 *
 * `shouldAsk` is the pure part. It is tested in `leave-guard.test.tsx` with
 * the context plumbing, in the `dom` project, because this module now renders
 * the vendored AlertDialog (GH #83, widened for #74).
 */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { copy } from "../copy/field";
import { buttonVariants } from "@/ui/button-variants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/alert-dialog";
import { isCurrentTab } from "./tabs";

type LeaveGuardContextValue = {
  dirty: boolean;
  setDirty: (dirty: boolean) => void;
  /**
   * Runs `proceed` at once when the form is clean; when dirty, holds it and
   * opens the confirmation dialog instead. Reads the latest committed `dirty`
   * flag at the moment of the tap, matching #66's rule.
   */
  leave: (proceed: () => void) => void;
};

/** Outside a provider (admin) there is nothing to guard: `leave` just runs `proceed`. */
const LeaveGuardContext = createContext<LeaveGuardContextValue>({
  dirty: false,
  setDirty: () => {},
  leave: (proceed) => proceed(),
});

/** Wraps the field band and its routes, so every caller shares one dirty flag and one dialog. */
export function LeaveGuardProvider({ children }: { children: ReactNode }) {
  const [dirty, setDirty] = useState(false);
  /** The confirmed action waiting on the dialog; null closes it. */
  const [pending, setPending] = useState<(() => void) | null>(null);

  const value = useMemo<LeaveGuardContextValue>(
    () => ({
      dirty,
      setDirty,
      leave: (proceed) => {
        if (dirty) setPending(() => proceed);
        else proceed();
      },
    }),
    [dirty],
  );

  return (
    <LeaveGuardContext.Provider value={value}>
      {children}

      {/* One dialog for the whole field route: only one action can be pending at a time. */}
      <AlertDialog
        open={pending !== null}
        onOpenChange={(open) => {
          if (!open) setPending(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.nav.leaveGuard.title}</AlertDialogTitle>
            <AlertDialogDescription>{copy.nav.leaveGuard.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className={buttonVariants({ variant: "outline", size: "touch" })}>
              {copy.nav.leaveGuard.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              className={buttonVariants({ variant: "destructive", size: "touch" })}
              onClick={() => {
                pending?.();
              }}
            >
              {copy.nav.leaveGuard.leave}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </LeaveGuardContext.Provider>
  );
}

/** `FieldTabs`, the sync strip and the update banner read this to guard their own action. */
export function useLeaveGuard(): { dirty: boolean; leave: (proceed: () => void) => void } {
  const { dirty, leave } = useContext(LeaveGuardContext);
  return { dirty, leave };
}

/**
 * A field form calls this with its own `formState.isDirty` on every render.
 * Unmounting clears the flag unconditionally, so leaving by any route — a
 * confirmed tab tap, the browser back button, a save's own `navigate()` —
 * never leaves a stale "dirty" for the screen that mounts next.
 */
export function useRegisterDirty(dirty: boolean): void {
  const { setDirty } = useContext(LeaveGuardContext);
  useEffect(() => {
    setDirty(dirty);
  }, [dirty, setDirty]);
  useEffect(() => () => setDirty(false), [setDirty]);
}

/**
 * Whether tapping `to` while `current` is open should ask first. Tapping the
 * already-current tab never navigates, so it never asks either (I/O matrix,
 * spec-gh-66) — that row exists here, not just as a UI accident, because a
 * dirty form's own tab must stay silent. "Already current" is `isCurrentTab`,
 * the same subtree rule the bar highlights with — not exact string equality
 * — so a tab that reads as current (`/tournee/nouveau/` for Ajouter) never
 * asks either, even though the pathname itself differs from `to`.
 */
export function shouldAsk({
  dirty,
  to,
  current,
}: {
  dirty: boolean;
  to: string;
  current: string;
}): boolean {
  return dirty && !isCurrentTab(current, to);
}

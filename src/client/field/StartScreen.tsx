/**
 * The start screen — docs/design.md › Before the swipe, ADR-0036.
 *
 * It previews the day, it does not start it: the stops are what the swipe would
 * freeze now, with no number (numbers do not exist yet) and nothing to tap. The
 * swipe numbers them nearest-next from a reading taken at the swipe (the gate's
 * point when that fails), queues the tournée and its stops in the outbox, and
 * opens Tournée. The sync stays on: the band, the dot
 * and the strip are the frame's, not this screen's. Until a reading is precise
 * enough, the location dialog holds the screen (`useLocationGate`).
 */
import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { copy, TYPE_LABELS } from "../copy/field";
import { formatBrusselsWeekday } from "../format";
import { buttonVariants } from "@/ui/button-variants";
import { brusselsPeriod } from "../../shared/period";
import type { SnapshotProspect } from "../../shared/tournee";
import { numberStops } from "../../shared/tournee";
import { fieldDb, startTournee } from "./db";
import { useFieldNow } from "./field-clock";
import { LocationDialog } from "./LocationDialog";
import { StartSwipe } from "./StartSwipe";
import { useLocationGate } from "./useLocationGate";
import { useSyncState } from "./useSync";

/** What the visit and add-prospect forms leave in the router state, with the save's time. */
type SaveState = { saved?: boolean; savedAt?: number; added?: boolean; addedAt?: number };

/** The preview shows this many stops, then « et {n} autres arrêts ». */
const PREVIEW_STOPS = 7;

export function StartScreen({
  snapshot,
  adminOnline,
}: {
  snapshot: readonly SnapshotProspect[];
  adminOnline: boolean;
}) {
  const { status, point, swipePoint, activate } = useLocationGate();
  const swipeRef = useRef<HTMLButtonElement | null>(null);
  const { identity, confirmed, syncNow } = useSyncState();
  const navigate = useNavigate();
  const today = useFieldNow();
  // A form that was open at midnight saved first, then landed here with this
  // state (docs/design.md › Midnight): the dialog says the visit is safe, once.
  // Only a save made in the clock's day counts: the state of an earlier save,
  // still on this history entry when the gate flipped, is yesterday's.
  const location = useLocation();
  const [notice] = useState(() => {
    const kept = location.state as SaveState | null;
    const at = kept?.saved ? kept.savedAt : kept?.added ? kept.addedAt : undefined;
    if (at === undefined || at < brusselsPeriod(today, 1).from) return undefined;
    return kept?.saved ? copy.visit.saved : copy.fieldProspect.saved;
  });
  // Read once, then dropped, so a reload does not show it again.
  const hasState = location.state !== null;
  useEffect(() => {
    if (hasState) void navigate(location.pathname, { replace: true, state: null });
  }, [hasState, location.pathname, navigate]);
  const [starting, setStarting] = useState(false);
  const [failed, setFailed] = useState(false);
  // State lags a frame behind a second event; one day must not start twice.
  const busy = useRef(false);

  const preview = [...snapshot]
    .sort((a, b) => a.name.localeCompare(b.name, "fr"))
    .slice(0, PREVIEW_STOPS);
  const hidden = snapshot.length - preview.length;

  async function start() {
    if (busy.current || !point) return;
    busy.current = true;
    setStarting(true);
    setFailed(false);

    const startedAt = Date.now();
    const tourneeId = crypto.randomUUID();
    // Never rejects and never blocks the start: at worst it is the gate's point.
    const from = (await swipePoint()) ?? point;
    const stops = numberStops(snapshot, from).map(({ item, number }) => ({
      id: crypto.randomUUID(),
      tourneeId,
      prospectId: item.id,
      number,
      addedAt: startedAt,
    }));
    try {
      // `!confirmed`: the same rule a visit follows when the identity is cached.
      await startTournee(
        fieldDb,
        { tournee: { id: tourneeId, startedAt }, stops },
        identity,
        !confirmed,
      );
    } catch {
      busy.current = false;
      setStarting(false);
      setFailed(true);
      return;
    }
    void syncNow();
    void navigate("/tournee", { replace: true });
  }

  return (
    <>
      <section>
        <p className="text-overline text-muted-foreground uppercase">
          {formatBrusselsWeekday(today)}
        </p>
        <h2 className="text-title">{copy.today.title}</h2>
        <p className="tnum text-muted-foreground text-base">
          {copy.today.remaining(snapshot.length)}
        </p>
        <p className="text-muted-foreground mt-2 text-base">{copy.start.explainer}</p>

        <div className="bg-card border-border mt-4 rounded-xl border">
          <ul aria-label={copy.start.previewLabel} className="divide-border divide-y">
            {preview.map((stop) => (
              <li key={stop.id} className="flex min-h-13 items-center gap-3 px-3.5 py-2">
                <span aria-hidden className="bg-muted-foreground/40 size-2 shrink-0 rounded-full" />
                <div className="min-w-0">
                  <p className="text-base font-medium break-words">{stop.name}</p>
                  <p className="text-muted-foreground text-meta break-words">
                    {copy.today.meta(TYPE_LABELS[stop.type], stop.address)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <p className="text-muted-foreground border-border border-t px-3.5 py-3 text-base">
              {copy.start.more(hidden)}
            </p>
          )}
        </div>
      </section>

      {/* Where the tab bar will be. Fixed above the safe area. */}
      <div className="safe-bottom bg-background border-border fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3">
        <div className="mx-auto flex max-w-xl flex-col gap-2 pb-3">
          {adminOnline && (
            <Link to="/admin" className={buttonVariants({ variant: "secondary", size: "touch" })}>
              {copy.nav.tabs.dashboard}
            </Link>
          )}
          <StartSwipe
            ref={swipeRef}
            ready={point !== null}
            starting={starting}
            onStart={() => void start()}
          />
          {failed && (
            <p role="alert" className="text-destructive text-sm">
              {copy.start.storageError}
            </p>
          )}
        </div>
      </div>

      <LocationDialog
        open={point === null}
        status={status}
        onActivate={activate}
        adminOnline={adminOnline}
        swipeRef={swipeRef}
        notice={notice}
      />
    </>
  );
}

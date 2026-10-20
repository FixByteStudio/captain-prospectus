import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  Route,
  Routes,
  useMatch,
  useNavigate,
  useOutletContext,
} from "react-router";
import {
  LockIcon,
  MapPinOffIcon,
  TriangleAlertIcon,
  WifiOffIcon,
  type LucideIcon,
} from "lucide-react";
import { apiFetch } from "./api";
import { Band, BandBrand, UpdatePrompt } from "./Band";
import { copy } from "./copy/field";
import type { MeResponse } from "../shared/schemas";
import { usePwa, type PwaState } from "./pwa";
import { buttonVariants } from "@/ui/button-variants";
import { AdminOfflineScreen } from "./auth/AdminOfflineScreen";
import { cn } from "./lib/utils";
import { brusselsPeriod } from "../shared/period";
import { AccountMenu } from "./field/AccountMenu";
import { FieldTabs } from "./field/FieldTabs";
import { useFieldNow } from "./field/field-clock";
import { LeaveGuardProvider, useLeaveGuard } from "./field/leave-guard";
import { NoTourneeMessage } from "./field/NoTourneeMessage";
import { StartScreen } from "./field/StartScreen";
import { TodayScreen } from "./field/TodayScreen";
import type { TourneeGate } from "./field/tournee-gate";
import { useTourneeGate } from "./field/useTourneeGate";
import { SyncDot, SyncStrip, useSyncView } from "./field/SyncIndicator";
import { hidesUpdateBanner } from "./field/sync-view";
import { SyncProvider } from "./field/useSync";
import {
  clearAgentCache,
  confirmOutbox,
  fieldDb,
  getMeta,
  releaseUnconfirmed,
  setMeta,
} from "./field/db";
import { resolveIdentity } from "./field/identity";
import { useOnline } from "./hooks/use-online";
import { LoginScreen } from "./auth/LoginScreen";

/**
 * The admin side is a separate chunk, fetched only when an admin opens one of
 * its routes.
 *
 * An agent's phone is the constraint: it loads this app outdoors on a bad
 * connection to log a visit, and it has no business downloading TanStack Query,
 * Radix, sonner and PapaParse to do it (vision.md; the bundle note in
 * ADR-0014). The field screens stay in the entry chunk for that reason.
 *
 * `lazy` wants a default export and this repo uses named ones, hence the remap.
 */
const AdminApp = lazy(() =>
  import("./admin/AdminApp").then((module) => ({ default: module.AdminApp })),
);

/**
 * The round is what an agent needs the moment the app opens; the visit form
 * and add-prospect form are one tap away from it. Splitting them out is what
 * ADR-0014's own consequence asks for when the entry chunk crosses its budget
 * ("split further before adding to it") — measured at the end of M2, this is
 * that split.
 *
 * The service worker precaches every chunk regardless (workbox `generateSW`
 * globs `**\/*.js`), so this does not change what an agent downloads on
 * install or how the app behaves with no signal — VisitScreen is still
 * reachable offline the instant the round loads. It changes only how much JS
 * runs before the first paint of the list itself.
 */
const VisitScreen = lazy(() =>
  import("./field/VisitScreen").then((module) => ({ default: module.VisitScreen })),
);
const AddProspectScreen = lazy(() =>
  import("./field/AddProspectScreen").then((module) => ({ default: module.AddProspectScreen })),
);
/**
 * Leaflet is reached through this chunk (RoundMap.tsx, which the visit's
 * tablet pane also loads lazily, spec-gh-126), not the entry one (ADR-0026):
 * an agent who never opens Carte should not have it block the round's first
 * paint. It is still precached regardless (spec-gh-121, VitePWA's
 * globPatterns), so "lazy" here means off the first paint, not off the
 * download — Carte still works the first time it is opened offline.
 */
const CarteScreen = lazy(() =>
  import("./field/CarteScreen").then((module) => ({ default: module.CarteScreen })),
);

/**
 * Carnet, lazy like Carte: the agent only opens it after the first stop, so the
 * entry chunk does not carry it (ADR-0026).
 */
const CarnetScreen = lazy(() =>
  import("./field/CarnetScreen").then((module) => ({ default: module.CarnetScreen })),
);

/** What `FieldFrame` hands the routes under it: the gate it already decided, and the clock it decided it on. */
type FieldContext = { gate: TourneeGate; now: number };

/**
 * The field routes, agent-only (ADR-0037), behind the tournée gate
 * (ADR-0036, docs/design.md › Before the swipe): a no-tournée message, the
 * start screen, or the app. Every `/round/*` path is gated, a deep link to a
 * stop included, because the app opens at the swipe.
 */
function FieldRoutes() {
  const { gate, now } = useOutletContext<FieldContext>();

  if (gate.kind === "loading") {
    return <p className="text-muted-foreground" aria-busy="true" />;
  }
  if (gate.kind === "neverLoaded" || gate.kind === "nothingAssigned") {
    return <NoTourneeMessage kind={gate.kind} />;
  }
  if (gate.kind === "start") {
    // Keyed by the Brussels day, so midnight remounts it: its date and its
    // location dialog are the new day's, and a reading from yesterday is not.
    return <StartScreen key={brusselsPeriod(now, 1).from} snapshot={gate.snapshot} />;
  }

  return (
    <Routes>
      {/* Relative to the parent's /round/*. "map", "logbook" and "new"
          come before ":id" so neither is ever read as a prospect id. */}
      <Route index element={<TodayScreen />} />
      <Route
        path="map"
        element={
          <Suspense fallback={<p className="text-muted-foreground" aria-busy="true" />}>
            <CarteScreen />
          </Suspense>
        }
      />
      <Route
        path="logbook"
        element={
          <Suspense fallback={<p className="text-muted-foreground" aria-busy="true" />}>
            <CarnetScreen />
          </Suspense>
        }
      />
      <Route
        path="new"
        element={
          <Suspense fallback={<p className="text-muted-foreground" aria-busy="true" />}>
            <AddProspectScreen />
          </Suspense>
        }
      />
      <Route
        path=":id"
        element={
          <Suspense fallback={<p className="text-muted-foreground" aria-busy="true" />}>
            <VisitScreen />
          </Suspense>
        }
      />
    </Routes>
  );
}

/**
 * The field-only band: the one frame whose band row carries more than the
 * brand. Admin screens get their own frame instead of this one: `AdminApp`
 * renders as a sibling route, not nested inside `FieldFrame`.
 */
function FieldFrame({ pwa, email }: { pwa: PwaState; email: string }) {
  const now = useFieldNow();
  // `FieldFrame` also wraps the forbidden and not-found fallbacks (neither is
  // under /round), so the subtitle names a tab only when there is one.
  const onTournee = useMatch("/round/*");
  const onAddProspect = useMatch("/round/new/*");
  const onCarte = useMatch("/round/map/*");
  const onCarnet = useMatch("/round/logbook/*");
  // A form is a visit (`/round/:id`, which is none of the tabs) or the
  // add-prospect form: the gate waits for those at midnight (`holdGate`).
  const onStop = useMatch("/round/:id");
  const onForm = onAddProspect !== null || (onStop !== null && !onCarte && !onCarnet);
  const gate = useTourneeGate(email, now, onForm);
  // The tabs are the app, and the app opens at the swipe: no tab bar on a gate
  // screen. The band, its dot and the strip stay, because the sync is never gated.
  const gateOpen = gate.kind === "open";
  // No tab subtitle while a gate screen stands in for the tab: a deep link to
  // Carte must not read « Carte » over the start screen.
  const subtitle = !gateOpen
    ? undefined
    : onAddProspect
      ? copy.nav.subtitle.add
      : onCarte
        ? copy.nav.subtitle.map
        : onCarnet
          ? copy.nav.subtitle.carnet
          : onTournee
            ? copy.nav.subtitle.today
            : undefined;

  // The update-needed strip already says a build is waiting; the banner
  // would repeat it (hidesUpdateBanner, sync-view.ts).
  const hideUpdatePrompt = hidesUpdateBanner(useSyncView());

  return (
    <>
      <Band>
        <BandBrand subtitle={subtitle} />
        {/* Below 768px this detaches to a fixed bar at the bottom of the
            screen; from 768px it sits right here, in the band's own row.
            Below 768px it is `position: fixed` (out of flow) and claims no
            width here at all, so it cannot push the sync pill and avatar to
            the row's right edge the way the band nav it replaced used to —
            `ml-auto` on the wrapper below does that instead, standing down
            once the tab bar is back in flow and doing that job itself. */}
        {gateOpen && <FieldTabs />}
        <span className="ml-auto md:ml-0">
          <SyncDot />
        </span>
        <AccountMenu email={email} />
      </Band>

      {!hideUpdatePrompt && <UpdatePrompt pwa={pwa} />}
      <SyncStrip pwa={pwa} />

      {/* .safe-bottom moved to the tab bar (FieldTabs): it is now the
          bottommost fixed element on a phone. .pb-tab-bar (app.css) clears
          its real height plus the inset it carries, so the bar never covers
          the last row of content — a screen with its own action bar
          (VisitScreen, AddProspectScreen) additionally clears that with
          `.pb-action-bar` on its own form. */}
      <main
        className={cn(
          "px-4 pt-6",
          gateOpen ? "pb-tab-bar" : gate.kind === "start" ? "pb-start-track" : "pb-page",
        )}
      >
        <Outlet context={{ gate, now } satisfies FieldContext} />
      </main>
    </>
  );
}

/**
 * DESIGN.md's empty-state pattern (a 64px `secondary` icon tile, one line,
 * one button) reused for the field route's fallback screens: not found,
 * forbidden, an admin route on a cached identity, and the identity error below.
 * That one carries no action: an agent who cannot be identified has nowhere
 * useful to be sent (a revoked session opens `/login` instead).
 */
function FieldEmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: LucideIcon;
  message: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="bg-secondary text-muted-foreground flex size-16 items-center justify-center rounded-xl">
        <Icon aria-hidden className="size-7" />
      </span>
      <p className="text-heading">{message}</p>
      {action && (
        <Link to={action.to} className={buttonVariants({ variant: "outline", size: "touch" })}>
          {action.label}
        </Link>
      )}
    </div>
  );
}

/**
 * Shown while the lazy admin chunk loads, so an admin sees a band rather than
 * a blank page. Built from entry-chunk pieces only: the real admin frame
 * (`AdminLayout`) lives in the chunk this is standing in for.
 */
function AdminFrameFallback() {
  return (
    <>
      <Band>
        <BandBrand />
      </Band>
      <main className="px-4 pt-6 pb-page">
        <p className="text-muted-foreground" aria-busy="true" />
      </main>
    </>
  );
}

/**
 * The outer shell: the service worker, and `/login` beside everything else.
 *
 * `/login` is a sibling route rather than a branch inside `GatedApp`, so it
 * never runs the identity hooks below: the screen asks `/api/me` once itself,
 * only to skip the form for a live identity (GH #309, ADR-0029).
 */
export function App() {
  // Registers the service worker on mount, before and regardless of whether
  // `/api/me` answers. See the note on `UpdatePrompt`.
  const pwa = usePwa();

  return (
    <Routes>
      <Route path="/login" element={<LoginScreen pwa={pwa} />} />
      {/* Above `GatedApp`, not inside `FieldFrame`: its identity re-check asks
          the guard before it opens /login (GH #356). Admin screens never
          register a dirty form, so there `leave` just runs. */}
      <Route
        path="*"
        element={
          <LeaveGuardProvider>
            <GatedApp pwa={pwa} />
          </LeaveGuardProvider>
        }
      />
    </Routes>
  );
}

function GatedApp({ pwa }: { pwa: PwaState }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [error, setError] = useState<{ message: string } | null>(null);
  /** True when the identity came from the cache rather than from the server.
   * Not a network signal — a Worker 500 or a captive portal lands here too —
   * so it must never be read as "offline" (that conflation is the bug
   * spec-gh-115 removes; see `useOnline` below for the real one). The
   * `/admin/*` fallback below is the one reader that words it that way. */
  const [identityFromCache, setIdentityFromCache] = useState(false);
  /** Bumped to re-run the identity effect once the network is confirmed live
   * for a session that started on a cached identity (spec-gh-115). */
  const [recheck, setRecheck] = useState(0);
  const online = useOnline();

  // docs/backlog/013: at most one `/api/me` in flight, so `recheckIdentity` —
  // called from every sync trigger while unconfirmed, not just the one online
  // transition below — cannot pile up concurrent requests and burn quota
  // (free-tier-budget.md) on a session that is already waiting on one.
  const identityInFlight = useRef(false);
  /** True while a re-check runs, so the Hors ligne screen's button reflects
   * one started by the `online` effect too. */
  const [checking, setChecking] = useState(false);
  const recheckIdentity = useCallback(() => {
    if (identityInFlight.current) return;
    setChecking(true);
    // Set here, synchronously, not only in the effect below: the effect only
    // runs after React commits the `recheck` update, and two callers of
    // `recheckIdentity` in that window would both pass the guard and each
    // queue an increment.
    identityInFlight.current = true;
    setRecheck((n) => n + 1);
  }, []);

  const navigate = useNavigate();
  // The identity effect below must not re-run (and re-ask `/api/me`) each time
  // `navigate` changes identity with the location, so it reads the latest one here.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);
  // Same reason: the identity effect reads the latest `leave`, whose dirty flag
  // is the open form's at the moment the re-check answers.
  const { leave } = useLeaveGuard();
  const leaveRef = useRef(leave);
  useEffect(() => {
    leaveRef.current = leave;
  }, [leave]);

  /**
   * Identity, with an offline fallback — but only for genuine unreachability.
   *
   * The whole product is "an agent can log a visit with no network", so the
   * shell must not be the thing that blocks on one. The branching itself
   * lives in `field/identity.ts`, tested there; this effect only runs the
   * fetch, reads the cache, and applies whatever it decides.
   */
  useEffect(() => {
    let cancelled = false;
    identityInFlight.current = true;

    const settle = async (result: Parameters<typeof resolveIdentity>[0]) => {
      const cached = await getMeta(fieldDb, "identity");
      if (cancelled) return;
      const outcome = resolveIdentity(result, cached);

      if (outcome.kind === "error") {
        // The Worker's 401 opens `/login` through the leave guard: a
        // re-check of a cache-started session can answer over an open visit
        // form, which "Annuler" must keep (GH #356). Nothing below runs until
        // the agent confirms, so the cache the form reads is intact meanwhile.
        // An expired cookie cannot confirm anyone, so nothing is re-stamped to
        // "the current identity": `releaseUnconfirmed` only drops the flag, and
        // a flagged row keeps the cached email it was written under. It runs
        // before `clearAgentCache`, which takes the only other record of that
        // email, and for every row, not only this session's: a row can be
        // `unconfirmed` from an earlier, ended launch. The cache goes so that
        // airplane mode does not hand the round back
        // (docs/domains/identity-access.md). The outbox stays: INVARIANT 5.
        if (outcome.revoked) {
          leaveRef.current(() => {
            void (async () => {
              await releaseUnconfirmed(fieldDb);
              await clearAgentCache(fieldDb);
              void navigateRef.current("/login", { replace: true });
            })();
          });
          return;
        }
        setError({ message: outcome.message });
        return;
      }
      // A different agent signed in on this device since the last cached
      // identity: their round and visit-history cache are not this agent's
      // to see (docs/security.md: "Agent reading other agents' data"). The
      // outbox is never touched here — INVARIANT 5 — and the previous
      // identity's rows in it are held back by `runSync`, which sends only
      // rows stamped with the identity it is given (backlog/005).
      if (outcome.identitySwitched) {
        await clearAgentCache(fieldDb);
        if (cancelled) return;
      }
      // docs/backlog/013: a live answer confirms whoever it names, whatever
      // this *session* started as — a row can be `unconfirmed` from a launch
      // that ended (network lost, app killed) before its own confirmation
      // landed, so this runs on every live answer, not only when
      // `identityFromCache` was true a moment ago. Idempotent and a no-op
      // with nothing flagged. Runs before `setMe`/`setIdentityFromCache` flip
      // `confirmed` true on `SyncProvider`, so nothing already queued can
      // reach `runSync` still carrying the flag.
      if (!outcome.offline) {
        await confirmOutbox(fieldDb, outcome.identity.email);
        if (cancelled) return;
      }
      setMe(outcome.identity);
      setIdentityFromCache(outcome.offline);
      // The cached copy is never treated as proof, online or offline: the
      // Worker re-derives identity from the session on every
      // request (INVARIANT 10). Only overwrite the cache with a live answer,
      // never with the cache's own value.
      if (!outcome.offline) void setMeta(fieldDb, "identity", outcome.identity);
    };

    apiFetch<unknown>("/api/me")
      .then((body) => settle({ ok: true, body }))
      .catch((error: unknown) => settle({ ok: false, error }))
      .finally(() => {
        identityInFlight.current = false;
        setChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [recheck]);

  // Only a session running on a cached identity gains from re-asking
  // `/api/me`, and only once the browser actually reports a live network —
  // a raw `online` *event* listener would miss one that fires while the
  // first fetch is still in flight, and would never fire at all for a
  // cache-sourced identity produced with `navigator.onLine` still true (a
  // Worker 500, a captive portal, a DNS failure — every case `resolveIdentity`
  // funnels to the cache branch with no `offline` event to catch). Reading
  // both `identityFromCache` and `online` as state instead catches the
  // transition however it was reached. This cannot loop: a re-check that
  // fails leaves both unchanged, so it fires once per true transition.
  useEffect(() => {
    // `recheck` exists precisely to convert "these two external signals both
    // read true" into one `/api/me` attempt, decoupled from the fetch
    // effect's own dependency array so that effect setting
    // `identityFromCache` cannot retrigger this one (see above).
    // Routed through `recheckIdentity` (not `setRecheck` directly) so this
    // and the heartbeat's own re-check (docs/backlog/013, `useSync.tsx`)
    // share the one `identityInFlight` guard and cannot both start a fetch.
    if (identityFromCache && online) recheckIdentity();
  }, [identityFromCache, online, recheckIdentity]);

  if (error) {
    return (
      <>
        <Band>
          <BandBrand />
        </Band>
        <main className="px-4 pt-6 pb-page">
          <FieldEmptyState icon={TriangleAlertIcon} message={error.message} />
        </main>
      </>
    );
  }
  // An agent should not see a blank, unbranded screen for the moment
  // /api/me is still in flight, so this carries the band too.
  if (!me) {
    return (
      <>
        <Band>
          <BandBrand />
        </Band>
        <main className="px-4 pt-6 pb-page" aria-busy="true" />
      </>
    );
  }

  // One role, one side (ADR-0037). An admin gets /admin/* and nothing else, and
  // runs no sync: the Worker answers 403 to an admin on /api/agent/*. Any
  // leftover outbox rows stay in Dexie untouched (invariant 5).
  if (me.role === "admin") {
    return (
      <Routes>
        <Route
          path="/admin/*"
          element={
            // The cached role only picks this static screen (invariant 10): it
            // opens no route or data. Only a live `/api/me` opens the frame.
            identityFromCache ? (
              <AdminOfflineScreen checking={checking} onRetry={recheckIdentity} />
            ) : (
              <Suspense fallback={<AdminFrameFallback />}>
                <AdminApp email={me.email} updatePrompt={<UpdatePrompt pwa={pwa} />} />
              </Suspense>
            )
          }
        />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    );
  }

  return (
    <SyncProvider
      identity={me.email}
      confirmed={!identityFromCache}
      recheckIdentity={recheckIdentity}
    >
      <Routes>
        {/* Not under FieldFrame: the redirect target decides which frame shows. */}
        <Route path="/" element={<Navigate to="/round" replace />} />

        {/* The field-only band. The forbidden and not-found fallbacks live
            here too, since neither screen is admin chrome. */}
        <Route element={<FieldFrame pwa={pwa} email={me.email} />}>
          <Route path="/round/*" element={<FieldRoutes />} />
          <Route
            path="/admin/*"
            element={
              // A cached identity proves no role (invariant 10), so it gets
              // the network's answer, never the permission one
              // (EXPERIENCE.md § State Patterns, Offline after a reload).
              // The same sentence shows when `/api/me` failed with the
              // browser online: that case has no wording of its own yet.
              identityFromCache ? (
                <FieldEmptyState
                  icon={WifiOffIcon}
                  message={copy.adminRoute.offline}
                  action={{ to: "/round", label: copy.visit.back }}
                />
              ) : (
                <FieldEmptyState
                  icon={LockIcon}
                  message={copy.errors.forbidden}
                  action={{ to: "/round", label: copy.visit.back }}
                />
              )
            }
          />
          <Route
            path="*"
            element={
              <FieldEmptyState
                icon={MapPinOffIcon}
                message={copy.errors.notFound}
                action={{ to: "/round", label: copy.visit.back }}
              />
            }
          />
        </Route>
      </Routes>
    </SyncProvider>
  );
}

import { useSearchParams } from "react-router";
import { copy, STATUS_LABELS, TYPE_LABELS } from "../../copy";
import { formatDateTime, formatDistance } from "../../format";
import { cn } from "../../lib/utils";
import { edgeFor } from "../../field/StopRow";
import { StopNumber } from "../../field/StopNumber";
import type { AgentRoundResponse } from "../../../shared/schemas";
import type { TodayItem } from "../../../shared/today";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../ui/select";
import { Label } from "../../ui/label";
import { Skeleton } from "../../ui/skeleton";
import { ScreenHeader } from "../ScreenHeader";
import { ScreenState } from "../ScreenState";
import { Surface } from "../Surface";
import { BADGE_SHAPE, STATUS_BADGE } from "../status";
import { useAgentRound, useAgents } from "../queries";
import { RoundMap } from "../../field/RoundMap";
import { roundMap, roundStops } from "./round-list";

const t = copy.round;

/**
 * An agent's round for today, read-only (design.md "The admin round view").
 * The agent lives in `?agent=` so a reload or a shared link keeps the choice.
 */
export function RoundScreen() {
  const [params, setParams] = useSearchParams();
  const agents = useAgents();
  const roster = agents.data?.agents ?? [];
  const asked = params.get("agent");
  // An agent outside the roster is ignored: the placeholder shows instead.
  const agent = asked && roster.some((a) => a.email === asked) ? asked : null;
  const round = useAgentRound(agent);
  // A linked agent waits for the roster under the skeleton, not the "choose" prompt.
  const waitingForRoster = asked !== null && agents.isPending;

  // The fetch time stands for "now": stable across renders, and the day the rule reads.
  const stops = round.data && agent ? roundStops(round.data, round.dataUpdatedAt) : null;
  const position = round.data?.position ?? null;
  const drawn = stops ? roundMap(stops, position) : null;

  return (
    <section>
      <ScreenHeader
        className="mb-4"
        title={t.title}
        actions={
          stops && <span className="text-muted-foreground tnum">{t.count(stops.length)}</span>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Label className="text-muted-foreground font-normal" htmlFor="round-agent">
          {t.agentLabel}
        </Label>
        <Select
          value={agent ?? ""}
          onValueChange={(email) => setParams({ agent: email }, { replace: true })}
        >
          <SelectTrigger id="round-agent" size="sm" className="w-64">
            <SelectValue placeholder={t.choosePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {roster.map((a) => (
              <SelectItem key={a.email} value={a.email}>
                {a.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {position && (
          <span className="text-muted-foreground tnum">
            {t.position(formatDateTime(position.capturedAt))}
          </span>
        )}
      </div>

      {agents.isError && agents.data === undefined ? (
        // Without a roster there is nothing to choose from: say so, not "choose".
        <ScreenState<AgentRoundResponse>
          data={null}
          isPending={false}
          isError
          isFetching={agents.isFetching}
          onRetry={() => void agents.refetch()}
          loadFailed={t.loadFailed}
          skeleton={<Skeleton className="h-12 w-full" />}
        >
          {() => null}
        </ScreenState>
      ) : agent === null && !waitingForRoster ? (
        <p className="text-muted-foreground">{t.choosePrompt}</p>
      ) : (
        <ScreenState<AgentRoundResponse>
          data={round.data}
          isPending={round.isPending || waitingForRoster}
          isError={round.isError}
          isFetching={round.isFetching}
          onRetry={() => void round.refetch()}
          loadFailed={t.loadFailed}
          loading={t.loading}
          skeleton={
            <Surface className="space-y-3 p-3.5">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </Surface>
          }
        >
          {(data) => (
            <>
              {data.position === null && stops && stops.length > 0 && (
                <p className="text-muted-foreground mb-3">{t.noPosition}</p>
              )}
              <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:items-start">
                <Surface className="overflow-hidden md:col-start-1 md:row-start-1">
                  {stops && stops.length === 0 ? (
                    <p className="text-muted-foreground p-4">{t.empty}</p>
                  ) : (
                    <ul className="divide-border divide-y">
                      {stops?.map((stop, i) => (
                        <RoundRow key={stop.id} stop={stop} index={i + 1} />
                      ))}
                    </ul>
                  )}
                </Surface>
                {/* A Leaflet container needs a definite height: 280 px on phones (story 5.6), viewport-tall and sticky from md so the map stays in view as the list scrolls. */}
                {drawn && (
                  <Surface className="order-first h-70 overflow-hidden md:sticky md:top-4 md:order-none md:col-start-2 md:row-start-1 md:h-[80dvh]">
                    <RoundMap
                      key={agent}
                      pins={drawn.pins}
                      path={drawn.path}
                      position={drawn.point}
                    />
                  </Surface>
                )}
              </div>
            </>
          )}
        </ScreenState>
      )}
    </section>
  );
}

function RoundRow({ stop, index }: { stop: TodayItem; index: number }) {
  return (
    <li className={cn("flex items-center gap-3 px-3 py-2.5", edgeFor(stop))}>
      <StopNumber index={index} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{stop.name}</span>
        <span className="text-muted-foreground text-meta block truncate">
          {copy.today.meta(TYPE_LABELS[stop.type], stop.address)}
        </span>
      </span>
      {stop.status && (
        <span className={cn(BADGE_SHAPE, STATUS_BADGE[stop.status])}>
          {STATUS_LABELS[stop.status]}
        </span>
      )}
      {stop.distanceM !== null && (
        <span className="tnum shrink-0 text-right font-medium">
          {formatDistance(stop.distanceM)}
        </span>
      )}
    </li>
  );
}

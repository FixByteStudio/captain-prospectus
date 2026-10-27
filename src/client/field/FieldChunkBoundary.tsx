import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { TriangleAlertIcon } from "lucide-react";
import { copy } from "../copy/field";
import { ChunkBoundary, type ChunkRecovery } from "../lib/ChunkBoundary";
import { Spinner } from "@/ui/spinner";
import { buttonVariants } from "@/ui/button-variants";

/**
 * What a field screen shows when its chunk will not load (a stale hash after a
 * deploy; the chunks are precached, so rarely a dead uplink). It sits in the
 * content area, under the band and tabs the field frame already draws, so the
 * agent can still leave for another tab. Not « Hors ligne »: that screen has
 * no field link (ADR-0037), and the round itself is still there.
 */
function FieldScreenFailed({ checking, stillFailing, retry }: ChunkRecovery) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-12 text-center">
      <span className="bg-secondary text-muted-foreground flex size-16 items-center justify-center rounded-xl">
        <TriangleAlertIcon aria-hidden className="size-7" />
      </span>
      <h1 className="text-heading">{copy.fieldChunk.title}</h1>
      <p className="text-muted-foreground">{copy.fieldChunk.body}</p>
      {stillFailing && !checking && (
        <p role="status" className="text-muted-foreground">
          {copy.fieldChunk.stillFailing}
        </p>
      )}
      {/* Native button, as on every field screen (ADR-0015). */}
      <button
        type="button"
        className={buttonVariants({ size: "touch" })}
        disabled={checking}
        aria-busy={checking}
        onClick={retry}
      >
        {checking && <Spinner aria-hidden />}
        {checking ? copy.fieldChunk.checking : copy.fieldChunk.retry}
      </button>
    </div>
  );
}

/** The `Suspense` of a lazy field screen, with a retry in place of a throw past the page. */
export function FieldChunkBoundary<P>({
  load,
  children,
}: {
  load: () => Promise<{ default: ComponentType<P> }>;
  children: (Screen: LazyExoticComponent<ComponentType<P>>) => ReactNode;
}) {
  return (
    <ChunkBoundary
      load={load}
      fallback={<p className="text-muted-foreground" aria-busy="true" />}
      Recovery={FieldScreenFailed}
    >
      {children}
    </ChunkBoundary>
  );
}

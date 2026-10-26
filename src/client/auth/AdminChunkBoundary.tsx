import {
  Component,
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type LazyExoticComponent,
  type ReactNode,
} from "react";
import { AdminOfflineScreen } from "./AdminOfflineScreen";

/** What `import()` of a chunk resolves to, once remapped for `lazy`. */
type ChunkModule<P> = { default: ComponentType<P> };

/** Marks a failed chunk request, so a bug while the admin side renders is never worded as being offline. */
class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super("The admin chunk failed to load.", { cause });
    this.name = "ChunkLoadError";
  }
}

function lazyChunk<P>(load: () => Promise<ChunkModule<P>>) {
  return lazy(() =>
    load().catch((cause: unknown) => {
      throw new ChunkLoadError(cause);
    }),
  );
}

/** Catches the marker above and nothing else: any other error keeps propagating. */
class ChunkCatcher extends Component<
  { recovery: ReactNode; children: ReactNode },
  { error: unknown }
> {
  override state: { error: unknown } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  override render() {
    const { error } = this.state;
    // Rethrown from render, so it reaches the next boundary up as it would have.
    if (error !== null && !(error instanceof ChunkLoadError)) throw error;
    return error === null ? this.props.children : this.props.recovery;
  }
}

/**
 * The `Suspense` of a lazy chunk that is not precached (ADR-0019), with the
 * recovery ADR-0037 gives an admin: the Hors ligne screen, whose « Réessayer »
 * asks for the chunk again. A stale hash after a deploy and a dead uplink read
 * the same (no probe, no `navigator.onLine`).
 *
 * `lazy` remembers a rejected import for good, so the retry imports on its own
 * and, once that lands, swaps in a fresh `lazy` over the module it got.
 * Entry chunk only: `load` is the one place that names the admin side.
 */
export function AdminChunkBoundary<P>({
  load,
  fallback,
  children,
}: {
  load: () => Promise<ChunkModule<P>>;
  fallback: ReactNode;
  children: (Chunk: LazyExoticComponent<ComponentType<P>>) => ReactNode;
}) {
  const [Chunk, setChunk] = useState(() => lazyChunk(load));
  // Remounts the catcher after a good retry, which clears its failed state.
  const [attempt, setAttempt] = useState(0);
  const [checking, setChecking] = useState(false);
  const [stillFailing, setStillFailing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const retry = useCallback(async () => {
    setChecking(true);
    setStillFailing(false);
    try {
      const loaded = await load();
      if (!mounted.current) return;
      setChunk(() => lazy(() => Promise.resolve(loaded)));
      setAttempt((n) => n + 1);
    } catch {
      if (mounted.current) setStillFailing(true);
    } finally {
      if (mounted.current) setChecking(false);
    }
  }, [load]);

  return (
    <ChunkCatcher
      key={attempt}
      recovery={
        <AdminOfflineScreen checking={checking} onRetry={retry} stillFailing={stillFailing} />
      }
    >
      <Suspense fallback={fallback}>{children(Chunk)}</Suspense>
    </ChunkCatcher>
  );
}

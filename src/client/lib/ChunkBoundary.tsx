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

/** What `import()` of a chunk resolves to, once remapped for `lazy`. */
type ChunkModule<P> = { default: ComponentType<P> };

/** Marks a failed chunk request, so a bug while the admin side renders is never worded as being offline. */
class ChunkLoadError extends Error {
  constructor(cause: unknown) {
    super("A lazy chunk failed to load.", { cause });
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

/** What a recovery screen is handed: the retry and where it stands. */
export type ChunkRecovery = {
  checking: boolean;
  /** The last retry failed too: say so, so the press is not silent. */
  stillFailing: boolean;
  retry: () => void;
};

/**
 * The `Suspense` of a lazy chunk, with a recovery in place of a throw past the
 * page when its import fails. A stale hash after a deploy and a dead uplink
 * read the same (no probe, no `navigator.onLine`). The admin side and the field
 * screens each bring their own recovery and wording.
 *
 * `lazy` remembers a rejected import for good, so the retry imports on its own
 * and, once that lands, swaps in a fresh `lazy` over the module it got.
 * `load` must be stable (module scope), or every render re-creates the retry.
 */
export function ChunkBoundary<P>({
  load,
  fallback,
  Recovery,
  children,
}: {
  load: () => Promise<ChunkModule<P>>;
  fallback: ReactNode;
  Recovery: ComponentType<ChunkRecovery>;
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
      recovery={<Recovery checking={checking} stillFailing={stillFailing} retry={retry} />}
    >
      <Suspense fallback={fallback}>{children(Chunk)}</Suspense>
    </ChunkCatcher>
  );
}

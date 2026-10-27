import type { ComponentType, LazyExoticComponent, ReactNode } from "react";
import { ChunkBoundary, type ChunkRecovery } from "../lib/ChunkBoundary";
import { AdminOfflineScreen } from "./AdminOfflineScreen";

function AdminRecovery({ checking, stillFailing, retry }: ChunkRecovery) {
  return <AdminOfflineScreen checking={checking} onRetry={retry} stillFailing={stillFailing} />;
}

/**
 * The `Suspense` of the admin chunk, which is not precached (ADR-0019), with
 * the recovery ADR-0037 gives an admin: the Hors ligne screen, whose
 * « Réessayer » asks for the chunk again. Entry chunk only: `load` is the one
 * place that names the admin side.
 */
export function AdminChunkBoundary<P>({
  load,
  fallback,
  children,
}: {
  load: () => Promise<{ default: ComponentType<P> }>;
  fallback: ReactNode;
  children: (Chunk: LazyExoticComponent<ComponentType<P>>) => ReactNode;
}) {
  return (
    <ChunkBoundary load={load} fallback={fallback} Recovery={AdminRecovery}>
      {children}
    </ChunkBoundary>
  );
}

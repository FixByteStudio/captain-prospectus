import type { ReactNode } from "react";
import { copy } from "../copy";
import { useOnline } from "../hooks/use-online";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";

/**
 * The one loading / load-failed convention every admin screen shares
 * (GH #175, generalised from `DashboardScreen`'s original state gate):
 * a skeleton in the content's own shape while nothing has arrived yet, a
 * destructive Alert with a disabled-while-fetching retry when a fetch fails,
 * and — the case a plain "loading vs. error" switch misses — that Alert
 * sitting *above* data TanStack Query kept from a previous, successful
 * fetch, never replacing it.
 */
export function ScreenState<T>({
  data,
  isPending,
  isError,
  isFetching,
  onRetry,
  loadFailed,
  loading,
  skeleton,
  children,
}: {
  data: T | null | undefined;
  isPending: boolean;
  isError: boolean;
  isFetching: boolean;
  onRetry: () => void;
  /** The screen's own French string — reused, never replaced. */
  loadFailed: string;
  /** Read out while the skeleton stands in, same as DashboardScreen's own. */
  loading?: string;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  // GH #209 (GH #85): the admin offline banner already says data is stale;
  // a second Alert per panel would repeat it, so it stands down offline too
  // — including a first load that already failed, which the skeleton stands
  // in for rather than rendering nothing at all.
  const online = useOnline();
  const busy = data == null && (isPending || !online);
  return (
    <>
      {/* Outside the aria-busy container, so it is announced rather than
          hidden (DashboardScreen.tsx's own comment on this). */}
      {loading && (
        <p role="status" className="sr-only">
          {busy ? loading : ""}
        </p>
      )}

      {busy ? (
        <div aria-busy="true">{skeleton}</div>
      ) : (
        <>
          {isError && online && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>{loadFailed}</AlertTitle>
              <AlertDescription>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={isFetching}
                  onClick={onRetry}
                >
                  {copy.errors.retry}
                </Button>
              </AlertDescription>
            </Alert>
          )}
          {data != null && children(data)}
        </>
      )}
    </>
  );
}

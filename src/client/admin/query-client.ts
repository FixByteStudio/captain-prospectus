import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { isWorkerUnauthorized } from "../api";
import { adminKeys } from "./queries";

/**
 * The admin side's one QueryClient (ADR-0013: TanStack Query is admin-only).
 *
 * Every successful mutation marks Tableau de bord stale here, in one place,
 * rather than in each hook's `onSuccess` — so a mutation added later cannot
 * forget to, and the dashboard refetches as soon as it is on screen, whatever
 * staleTime a later story sets (GH #107). Not awaited: a mutation resolves
 * without waiting for a refetch.
 *
 * The same goes for the Worker's 401: any query or mutation that gets one
 * calls `onUnauthorized` (the router's `/login`, GH #309), once, however many
 * requests were in flight. An Access redirect is not this — it keeps the
 * screens' session-expired error. A 401 is not retried either: asking again
 * with the same dead cookie cannot succeed.
 */
export function createAdminQueryClient(onUnauthorized: () => void = () => {}): QueryClient {
  let signedOut = false;
  const handle = (error: unknown) => {
    if (signedOut || !isWorkerUnauthorized(error)) return;
    signedOut = true;
    onUnauthorized();
  };

  const client = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: (failures, error) => failures < 1 && !isWorkerUnauthorized(error),
      },
    },
    queryCache: new QueryCache({ onError: handle }),
    mutationCache: new MutationCache({
      onError: handle,
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: adminKeys.dashboards() });
      },
    }),
  });
  return client;
}

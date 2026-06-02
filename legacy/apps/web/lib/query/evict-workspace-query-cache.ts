import type { QueryClient } from "@tanstack/react-query";

/** Workspace-scoped React Query key prefixes evicted on tenant session switch. */
const WORKSPACE_QUERY_ROOTS = [
  "settings",
  "tours",
  "users",
  "bookings",
  "registrations",
  "leader",
  "auditTrail",
  "reconciliationTriage",
  "me",
  "workspace-user-booking-summary",
  "tenantConfig",
  "workspace-tour-crew-members",
  "finance",
] as const;

let registeredWorkspaceQueryClient: QueryClient | null = null;

/** Registers the app QueryClient for synchronous eviction from AuthProvider (outside QueryClientProvider). */
export function registerWorkspaceQueryClient(client: QueryClient | null): void {
  registeredWorkspaceQueryClient = client;
}

/**
 * Synchronously drops workspace React Query partitions before auth context swaps tenantId.
 * In-flight network cancels are handled separately via cancelInflightBffGets in AuthProvider.
 */
export function evictWorkspaceQueryCaches(queryClient?: QueryClient): void {
  const client = queryClient ?? registeredWorkspaceQueryClient;
  if (!client) {
    return;
  }
  const cache = client.getQueryCache();
  for (const root of WORKSPACE_QUERY_ROOTS) {
    for (const query of cache.findAll({ queryKey: [root] })) {
      void query.cancel({ revert: true });
      cache.remove(query);
    }
    client.removeQueries({ queryKey: [root] });
  }
}

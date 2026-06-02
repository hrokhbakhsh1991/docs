"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";

import { useInvalidateWorkspaceQueriesOnSwitch } from "@/hooks/use-invalidate-workspace-queries-on-switch";
import { registerWorkspaceQueryClient } from "@/lib/query/evict-workspace-query-cache";

function WorkspaceQueryScopeSync(): null {
  useInvalidateWorkspaceQueriesOnSwitch();
  return null;
}

export function TourOpsQueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 2,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30_000),
            refetchOnWindowFocus: false,
          },
          mutations: {
            retry: false,
          },
        },
      })
  );
  useEffect(() => {
    registerWorkspaceQueryClient(client);
    return () => registerWorkspaceQueryClient(null);
  }, [client]);
  return (
    <QueryClientProvider client={client}>
      <WorkspaceQueryScopeSync />
      {children}
    </QueryClientProvider>
  );
}

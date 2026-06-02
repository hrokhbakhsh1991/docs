import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

import { AuthProvider } from "@/lib/auth/auth-context";
import { ThemeProvider } from "@/lib/theme/theme-provider";

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export type AppTestProvidersProps = {
  children: ReactNode;
  queryClient?: QueryClient;
};

/**
 * Unified RTL shell: theme → React Query → auth hydration.
 * Pair with {@link installAuthFetchMock} (Vitest) or jest `installAuthFetchMock` before render.
 */
export function AppTestProviders({ children, queryClient: queryClientProp }: AppTestProvidersProps) {
  const [defaultClient] = useState(() => createTestQueryClient());
  const client = queryClientProp ?? defaultClient;

  return (
    <ThemeProvider>
      <QueryClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

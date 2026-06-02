/** Vitest-facing re-exports; Jest specs should import from `@/lib/test/AppTestProviders`. */
export {
  AppTestProviders,
  createTestQueryClient,
  type AppTestProvidersProps,
} from "@/lib/test/AppTestProviders";

export {
  createSessionHydrateResponse,
  createUnauthenticatedSessionResponse,
} from "@/lib/test/session-fixtures";

export {
  installAuthFetchMock,
  resetAuthTestStorage,
  type AuthFetchMockSessionType,
  type InstallAuthFetchMockOptions,
} from "@/lib/test/install-auth-fetch-mock.vitest";

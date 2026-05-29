/**
 * Jest module mocks shared by wizard integration tests (see `jest.setup.ts`).
 */

jest.mock("@/lib/auth/membership-ability-context", () => ({
  fetchMembershipAbilityContext: jest.fn(async () => null),
}));

jest.mock("@/lib/tour-ops-api-origin", () => ({
  resolveTourOpsApiBaseUrl: () => "http://localhost:3001",
  isTourOpsApiConfigured: () => true,
  normalizeTourOpsApiOrigin: (raw: string) => raw.replace(/\/$/, ""),
}));

/**
 * Vitest module mocks shared by auth + wizard integration tests.
 * Import once at the top of a spec (side-effect).
 */
import { vi } from "vitest";

vi.mock("@/lib/auth/membership-ability-context", () => ({
  fetchMembershipAbilityContext: vi.fn(async () => null),
}));

vi.mock("@/lib/tour-ops-api-origin", () => ({
  resolveTourOpsApiBaseUrl: () => "http://localhost:3001",
  isTourOpsApiConfigured: () => true,
  normalizeTourOpsApiOrigin: (raw: string) => raw.replace(/\/$/, ""),
}));

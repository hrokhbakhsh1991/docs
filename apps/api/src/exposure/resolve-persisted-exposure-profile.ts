import type { ExposureProfile, ExposureProfileContext } from "./exposure-profile";
import type { ExposureProfileRepository } from "./exposure-profile.repository";
import { createExposureProfileRepository } from "./prisma-exposure-profile.repository";
import { resolveRegistrySeededExposureProfile } from "./resolve-registry-seeded-exposure-profile";

export type ResolvePersistedExposureProfileInput = {
  readonly tenantId: string;
  readonly context: ExposureProfileContext;
};

/**
 * Phase 8b — loads tenant-scoped exposure profiles, seeding from registry metadata on first use.
 */
export async function resolvePersistedExposureProfileForContext(
  input: ResolvePersistedExposureProfileInput,
  deps: {
    readonly repository?: ExposureProfileRepository;
  } = {},
): Promise<ExposureProfile | null> {
  const seed = await resolveRegistrySeededExposureProfile(input.context);
  if (seed === null) {
    return null;
  }

  const repository = deps.repository ?? createExposureProfileRepository();
  return repository.ensureSeededProfile({
    tenantId: input.tenantId,
    seed,
  });
}

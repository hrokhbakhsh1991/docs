import type { CatalogRegistry } from "./catalog-registry";
import { generateUuid } from "../utils/crypto";
import { catalogRegistry } from "./catalog-registry";
import { safeRemintTripDetailsRegistryWalk, type RegistryWalkContext } from "./safe-remint-registry-walk";

export type DenaliTripDetailsCloneSource = Record<string, unknown>;

export type CloneTripDetailsResult = {
  tripDetails: DenaliTripDetailsCloneSource;
  photoIdRemap: ReadonlyMap<string, string>;
};

export type CloneTripDetailsWithRemapOptions = {
  registry?: CatalogRegistry;
  remintUuid?: () => string;
};

/**
 * Safe-Remint clone: {@link safeRemintTripDetailsRegistryWalk} copies catalog FKs verbatim and
 * remints tour-instance ids only — no `cloneJson` + spread (ghost keys from source are dropped).
 */
export function cloneTripDetailsWithRemap(
  source: DenaliTripDetailsCloneSource | null | undefined,
  options?: CloneTripDetailsWithRemapOptions,
): CloneTripDetailsResult | undefined {
  if (!source || typeof source !== "object") {
    return undefined;
  }

  const ctx: RegistryWalkContext = {
    registry: options?.registry ?? catalogRegistry,
    remintUuid: options?.remintUuid ?? (() => generateUuid()),
    photoIdRemap: new Map<string, string>(),
  };

  const tripDetails = safeRemintTripDetailsRegistryWalk(source, ctx);

  if (Object.keys(tripDetails).length === 0) {
    return undefined;
  }

  return { tripDetails, photoIdRemap: ctx.photoIdRemap };
}

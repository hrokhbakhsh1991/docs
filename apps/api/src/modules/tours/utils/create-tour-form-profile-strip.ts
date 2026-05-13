import type { TourFormProfile } from "@repo/types";
import {
  URBAN_LOGISTICS_WHITELIST_KEYS,
  defaultTourFormProfileForTourType,
  getTourFormProfileDescriptor,
  normalizeTourFormProfileInput,
} from "@repo/types";
import type { Repository } from "typeorm";

import type { TourType } from "../entities/tour.entity";

import type { CreateTourDto } from "../dto/create-tour.dto";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import { WorkspaceTourThemeEntity } from "../../settings-locations/entities/workspace-tour-theme.entity";

/**
 * Which branch of the profile-first precedence chain produced the resolved profile
 * (Phase P9 adoption telemetry — `promptq.md`).
 */
export type FormProfileWriteResolutionSource = "explicit_client" | "workspace_theme" | "tour_type_default";

/**
 * Resolves {@link TourFormProfile} for writes (strip, invariants, `form_profile_snapshot`) **and**
 * records which precedence branch won.
 *
 * First id in `tripDetails.overview.tourThemeIds` is the **primary** theme (same ordering as the web
 * wizard mapper), used to load the theme row's `form_profile` when no explicit profile is sent.
 *
 * **Precedence (profile-first):**
 * 1. `explicitFormProfile` when the client sent the field (invalid values normalize to `general`).
 * 2. Workspace theme row for `tourThemeIds[0]`.
 * 3. {@link defaultTourFormProfileForTourType} from commercial `tourType` (compatibility adapter).
 */
export async function resolveTourFormProfileFromTripDetailsWithSource(
  tenantId: string,
  tripDetails: TourTripDetails | null | undefined,
  tourType: TourType | null | undefined,
  themesRepo: Repository<WorkspaceTourThemeEntity>,
  explicitFormProfile?: unknown,
): Promise<{ profile: TourFormProfile; source: FormProfileWriteResolutionSource }> {
  if (explicitFormProfile !== undefined) {
    return {
      profile: normalizeTourFormProfileInput(explicitFormProfile),
      source: "explicit_client",
    };
  }
  const ids = tripDetails?.overview?.tourThemeIds;
  const mainId =
    Array.isArray(ids) && ids.length > 0 && typeof ids[0] === "string" ? ids[0].trim() : "";
  if (mainId.length > 0) {
    const row = await themesRepo.findOne({
      where: { id: mainId, workspaceId: tenantId },
      select: { formProfile: true },
    });
    if (row) {
      return {
        profile: normalizeTourFormProfileInput(row.formProfile),
        source: "workspace_theme",
      };
    }
  }
  return {
    profile: defaultTourFormProfileForTourType(tourType ?? undefined),
    source: "tour_type_default",
  };
}

export async function resolveTourFormProfileFromTripDetails(
  tenantId: string,
  tripDetails: TourTripDetails | null | undefined,
  tourType: TourType | null | undefined,
  themesRepo: Repository<WorkspaceTourThemeEntity>,
  explicitFormProfile?: unknown,
): Promise<TourFormProfile> {
  const { profile } = await resolveTourFormProfileFromTripDetailsWithSource(
    tenantId,
    tripDetails,
    tourType,
    themesRepo,
    explicitFormProfile,
  );
  return profile;
}

export async function resolveTourFormProfileForCreateDtoWithSource(
  tenantId: string,
  dto: CreateTourDto,
  themesRepo: Repository<WorkspaceTourThemeEntity>,
): Promise<{ profile: TourFormProfile; source: FormProfileWriteResolutionSource }> {
  return resolveTourFormProfileFromTripDetailsWithSource(
    tenantId,
    dto.tripDetails as TourTripDetails | undefined,
    dto.tourType ?? undefined,
    themesRepo,
    dto.formProfile,
  );
}

export async function resolveTourFormProfileForCreateDto(
  tenantId: string,
  dto: CreateTourDto,
  themesRepo: Repository<WorkspaceTourThemeEntity>,
): Promise<TourFormProfile> {
  const { profile } = await resolveTourFormProfileForCreateDtoWithSource(tenantId, dto, themesRepo);
  return profile;
}

/**
 * Logistics keys that remain when `urban_event` strips the logistics wizard group (dates / meet).
 *
 * Canonical single source: {@link URBAN_LOGISTICS_WHITELIST_KEYS} in `@repo/types`. This
 * `Set` wrapper exists only for the existing `.has(key)` call sites in `assert-create-tour-invariants.ts`
 * — those call sites can be migrated to the array form in Phase C without re-touching the constant.
 */
export const URBAN_LOGISTICS_WHITELIST: ReadonlySet<string> = new Set(URBAN_LOGISTICS_WHITELIST_KEYS);

/**
 * Server mirror of web `stripInactiveTourCreateGroupsForProfile` (Phase 4): drop tripDetails branches
 * that the resolved profile does not expose. Mutates `td` in place.
 *
 * Phase P10 (promptq.md): branches are driven by the declarative descriptor in
 * `packages/types/src/tour-form-profile-descriptors.ts:strip` — the per-profile `switch`
 * collapsed to a single table read. Adding a new profile no longer requires editing this
 * function (only the descriptor row + a parity-spec assertion).
 */
export function stripTripDetailsForFormProfile(profile: TourFormProfile, td: TourTripDetails): void {
  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null
  ) {
    return;
  }

  const root = td as TourTripDetails & Record<string, unknown>;

  for (const key of strip.clearsTripDetailsRoots) {
    root[key] = undefined;
  }

  if (
    strip.itineraryKeysToDelete.length > 0 &&
    root.itinerary != null &&
    typeof root.itinerary === "object"
  ) {
    const it = { ...(root.itinerary as Record<string, unknown>) };
    for (const k of strip.itineraryKeysToDelete) {
      delete it[k];
    }
    root.itinerary = it as TourTripDetails["itinerary"];
  }

  if (strip.logisticsWhitelist != null) {
    if (root.logistics != null && typeof root.logistics === "object") {
      const log = root.logistics as Record<string, unknown>;
      const slim: Record<string, unknown> = {};
      for (const key of strip.logisticsWhitelist) {
        if (log[key] !== undefined) {
          slim[key] = log[key];
        }
      }
      root.logistics = slim as TourTripDetails["logistics"];
    }
  }
}

/**
 * Same as {@link stripTripDetailsForFormProfile}, plus clears root `transportModes` when
 * the descriptor's `strip.clearsRootTransportModes` flag is set (currently `urban_event`
 * only — see `tour-form-profile-descriptors.spec.ts` for the parity assertion).
 */
export function stripCreateTourDtoForFormProfile(profile: TourFormProfile, dto: CreateTourDto): void {
  const { strip } = getTourFormProfileDescriptor(profile);
  if (
    strip.clearsTripDetailsRoots.length === 0 &&
    strip.itineraryKeysToDelete.length === 0 &&
    strip.logisticsWhitelist == null &&
    !strip.clearsRootTransportModes
  ) {
    return;
  }
  if (dto.tripDetails != null && typeof dto.tripDetails === "object") {
    stripTripDetailsForFormProfile(profile, dto.tripDetails as TourTripDetails);
  }

  if (strip.clearsRootTransportModes) {
    delete dto.transportModes;
  }
}

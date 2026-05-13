import { TOUR_FORM_PROFILE_VALUES, type TourFormProfile } from "./tour-form-profile";
import type { TourType } from "./tour-classification";
import {
  URBAN_LOGISTICS_WHITELIST_KEYS,
  type UrbanLogisticsWhitelistKey,
} from "./tour-domain-profile";

/**
 * Trip-details **overview** keys (under `tripDetails.overview`) that are inventory / policy
 * relevant only for `mountain_outdoor`-class itineraries.
 *
 * Canonical authoring location since Phase P14 (promptq.md follow-up) — `trip-details-inventory-policy.ts`
 * remains a thin re-export shim for backward compatibility with existing imports but is no
 * longer authoritative. Adding a new mountain-only overview key is a single edit here.
 *
 * Consumers:
 * - API persistence guards (`applyMountainOverviewFieldGatesForFormProfile` in
 *   `apps/api/src/modules/tours/utils/tour-type-gates.ts`) — strips the key for every
 *   non-`mountain_outdoor` profile via the descriptor's
 *   {@link TourFormProfileInvariantHints.mountainOverviewKeysToStripFromOverview}.
 * - Web Edit base matrix (`apps/web/src/features/tours/config/tripDetailsFieldConfig.ts`)
 *   — hides the corresponding `overview.<key>` rows for non-mountain profiles via
 *   {@link mountainOnlyTripDetailsOverviewFieldIds}.
 */
export const MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS = ["maxAltitudeMeters"] as const;

export type MountainOnlyTripDetailsOverviewKey =
  (typeof MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS)[number];

/**
 * # Declarative profile descriptors (Phase P10 — promptq.md)
 *
 * Single source of truth for the **profile-axis configuration** that previously lived as
 * scattered `switch (profile)` chains across web + API. Each consumer reads the descriptor
 * row instead of branching inline; adding a new profile becomes _one new row + one i18n key_.
 *
 * ## What lives here vs what does not
 *
 * - **Here:** profile slug, FA display key, default `TourType`, the set of inactive wizard
 *   field-group ids, the strip-on-write deltas (which root keys clear, which logistics keys
 *   survive for urban-style trims, whether transport modes are cleared), and the
 *   invariant-hint flags consumed by server `assert-create-tour-invariants.ts`.
 *
 * - **Not here:** per-field wizard visibility / required-ness (those live in
 *   `apps/web/src/features/tours/wizard/profileRules/rules.ts:BASE_FIELD_RULES` — the rules
 *   layer is already declarative and profile-agnostic; this descriptor table is the
 *   _structural_ layer above it). **Exception:** the Edit trip-details **base** matrix still
 *   needs a small set of `mountain_outdoor`-only preset rows (the `"recommended"` tier that
 *   the wizard rules layer does not model yet) — those rows live in
 *   {@link TourFormProfileEditHints.tripDetailsPresetOverrides} so product policy stays
 *   co-located with the other profile tables instead of a free-floating object in web-only
 *   code.
 *
 * ## Why use string ids for `inactiveFieldGroups`
 *
 * `FieldGroupId` is owned by `apps/web/src/features/tours/wizard/fieldGroups.ts` which
 * cannot be imported from `@repo/types` (cross-package layering: `apps/web` depends on
 * `@repo/types`, not the other way). We pin the strings here as `WizardFieldGroupSlug` and
 * the web `fieldGroups.ts` asserts equality with its `FieldGroupId` union at type level
 * in `tour-form-profile-descriptors.spec.ts` (and at runtime in
 * `getInactiveFieldGroupsForProfile`).
 */
export type WizardFieldGroupSlug =
  | "basic_info"
  | "pricing_capacity"
  | "schedule_location"
  | "itinerary"
  | "participation"
  | "logistics"
  | "policies"
  | "review";

/**
 * Top-level `TourCreateFormValues` keys this profile's strip path resets to wizard defaults.
 * Kept as string slugs for the same cross-package-layering reason as
 * {@link WizardFieldGroupSlug}.
 */
export type TourCreateRootSlug =
  | "overview"
  | "autoAcceptRegistrations"
  | "pricing"
  | "schedule"
  | "location"
  | "itinerary"
  | "participation"
  | "logistics"
  | "policies";

export interface TourFormProfileStripDeltas {
  /**
   * `tripDetails.*` roots that the **server-side** strip (`stripTripDetailsForFormProfile`)
   * sets to `undefined` for this profile (e.g. `participation` for `urban_event` /
   * `cinema_event`).
   */
  readonly clearsTripDetailsRoots: readonly ("participation" | "itinerary" | "logistics")[];
  /**
   * Keys inside `tripDetails.itinerary` to delete (e.g. `dayPlans`, `segmentActivities` for
   * single-evening events).
   */
  readonly itineraryKeysToDelete: readonly ("dayPlans" | "segmentActivities")[];
  /**
   * When present, `tripDetails.logistics` is replaced with only the keys in this whitelist.
   * `urban_event` is the canonical case (single canonical list shared with API + web; see
   * {@link URBAN_LOGISTICS_WHITELIST_KEYS}).
   */
  readonly logisticsWhitelist?: readonly UrbanLogisticsWhitelistKey[];
  /**
   * When `true`, the create-DTO strip path also deletes the root `transportModes` field
   * (currently `urban_event` only — events held at a single venue should not advertise a
   * transport plan).
   */
  readonly clearsRootTransportModes: boolean;
}

export interface TourFormProfileInvariantHints {
  /**
   * When `true`, `tripDetails.overview` may contain the keys in
   * {@link MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS} (e.g. `maxAltitudeMeters`); other
   * profiles strip them server-side via the API's `applyMountainOverviewFieldGatesForFormProfile`.
   */
  readonly allowsMountainOnlyOverviewKeys: boolean;
  /**
   * When `true`, the server invariant asserts root `transportModes` is empty/absent for
   * this profile (currently `urban_event` only — mirrors
   * `strip.clearsRootTransportModes`).
   */
  readonly requiresEmptyRootTransportModes: boolean;
  /**
   * Keys under `tripDetails.overview` that the API's
   * `applyMountainOverviewFieldGatesForFormProfile` helper deletes when this profile does
   * **not** allow mountain-only data. `mountain_outdoor` uses an empty tuple (nothing
   * stripped); every other profile uses the canonical list from
   * {@link MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS} (parity-tested).
   */
  readonly mountainOverviewKeysToStripFromOverview: readonly MountainOnlyTripDetailsOverviewKey[];
}

/** Requiredness tier for Edit-only preset rows (wizard `FieldRule` still uses optional/required/forbidden only). */
export type EditTripDetailsOverrideRequiredness = "optional" | "recommended" | "required";

export interface TourFormProfileEditHints {
  /**
   * Preset rows for the Edit trip-details base matrix (`apps/web/.../tripDetailsFieldConfig.ts`)
   * before the `getFieldRule` overlay. Empty for every profile except `mountain_outdoor`.
   */
  readonly tripDetailsPresetOverrides: readonly {
    readonly id: string;
    readonly visibility: "editable";
    readonly requiredness: EditTripDetailsOverrideRequiredness;
  }[];
}

export interface TourFormProfileDescriptor {
  readonly slug: TourFormProfile;
  /** i18n key for FA display (matches `apps/web/src/features/tours/wizard/profileRules/rules.ts:PROFILE_DISPLAY_KEYS`). */
  readonly displayKeyFa: string;
  /**
   * Default commercial `TourType` for this profile (when a workspace uses this profile as
   * the canonical option). Reverse direction lives in `defaultTourFormProfileForTourType`.
   * `null` for profiles that have no preferred commercial type (e.g. `general`).
   */
  readonly defaultTourType: TourType | null;
  /**
   * Wizard field groups that are inactive for this profile. The wizard rail / required-ness
   * derivation reads this list via `getInactiveFieldGroupsForProfile`.
   */
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];
  /**
   * When `true`, the capacity wizard step is treated as redundant for this profile because
   * its `stepTriggerFields` only reference pricing + legacy logistics group-size paths that
   * are not mounted for urban/cinema shells — see `isWizardStepRedundantForProfile`.
   */
  readonly wizardCapacityStepRedundant: boolean;
  /**
   * Profile-aware strip deltas applied by the server (and mirrored by the web
   * `stripInactiveTourCreateGroupsForProfile`).
   */
  readonly strip: TourFormProfileStripDeltas;
  /** Server invariant flags. */
  readonly invariants: TourFormProfileInvariantHints;
  /** Edit-form preset hints (kept small — wizard rules remain the primary source for the wizard). */
  readonly edit: TourFormProfileEditHints;
}

const MOUNTAIN_OVERVIEW_STRIP_KEYS: readonly MountainOnlyTripDetailsOverviewKey[] = [
  ...MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS,
];

const MOUNTAIN_OUTDOOR_EDIT_PRESETS = [
  { id: "participation.minimumAge", visibility: "editable" as const, requiredness: "required" as const },
  { id: "overview.difficultyLevel", visibility: "editable" as const, requiredness: "required" as const },
  { id: "participation.gearRequiredIds", visibility: "editable" as const, requiredness: "required" as const },
  {
    id: "participation.technicalSkillRequired",
    visibility: "editable" as const,
    requiredness: "recommended" as const,
  },
  { id: "logistics.meetingPoint", visibility: "editable" as const, requiredness: "required" as const },
  { id: "logistics.departureDate", visibility: "editable" as const, requiredness: "required" as const },
  { id: "logistics.returnDate", visibility: "editable" as const, requiredness: "recommended" as const },
  {
    id: "logistics.transportationNotes",
    visibility: "editable" as const,
    requiredness: "recommended" as const,
  },
  { id: "logistics.groupSizeMin", visibility: "editable" as const, requiredness: "recommended" as const },
  { id: "logistics.groupSizeMax", visibility: "editable" as const, requiredness: "recommended" as const },
] as const satisfies readonly TourFormProfileEditHints["tripDetailsPresetOverrides"][number][];

const general: TourFormProfileDescriptor = {
  slug: "general",
  displayKeyFa: "tours.profiles.general",
  defaultTourType: null,
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
  strip: {
    clearsTripDetailsRoots: [],
    itineraryKeysToDelete: [],
    clearsRootTransportModes: false,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: false,
    requiresEmptyRootTransportModes: false,
    mountainOverviewKeysToStripFromOverview: MOUNTAIN_OVERVIEW_STRIP_KEYS,
  },
  edit: { tripDetailsPresetOverrides: [] },
};

const mountainOutdoor: TourFormProfileDescriptor = {
  slug: "mountain_outdoor",
  displayKeyFa: "tours.profiles.mountain_outdoor",
  defaultTourType: "mountain",
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
  strip: {
    clearsTripDetailsRoots: [],
    itineraryKeysToDelete: [],
    clearsRootTransportModes: false,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: true,
    requiresEmptyRootTransportModes: false,
    mountainOverviewKeysToStripFromOverview: [],
  },
  edit: { tripDetailsPresetOverrides: MOUNTAIN_OUTDOOR_EDIT_PRESETS },
};

const natureTrip: TourFormProfileDescriptor = {
  slug: "nature_trip",
  displayKeyFa: "tours.profiles.nature_trip",
  defaultTourType: "nature",
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
  strip: {
    clearsTripDetailsRoots: [],
    itineraryKeysToDelete: [],
    clearsRootTransportModes: false,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: false,
    requiresEmptyRootTransportModes: false,
    mountainOverviewKeysToStripFromOverview: MOUNTAIN_OVERVIEW_STRIP_KEYS,
  },
  edit: { tripDetailsPresetOverrides: [] },
};

const urbanEvent: TourFormProfileDescriptor = {
  slug: "urban_event",
  displayKeyFa: "tours.profiles.urban_event",
  defaultTourType: "city",
  inactiveFieldGroups: ["itinerary", "participation", "logistics"],
  wizardCapacityStepRedundant: true,
  strip: {
    clearsTripDetailsRoots: ["participation"],
    itineraryKeysToDelete: ["dayPlans", "segmentActivities"],
    logisticsWhitelist: URBAN_LOGISTICS_WHITELIST_KEYS,
    clearsRootTransportModes: true,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: false,
    requiresEmptyRootTransportModes: true,
    mountainOverviewKeysToStripFromOverview: MOUNTAIN_OVERVIEW_STRIP_KEYS,
  },
  edit: { tripDetailsPresetOverrides: [] },
};

const cinemaEvent: TourFormProfileDescriptor = {
  slug: "cinema_event",
  displayKeyFa: "tours.profiles.cinema_event",
  defaultTourType: null,
  inactiveFieldGroups: ["itinerary", "participation"],
  wizardCapacityStepRedundant: true,
  strip: {
    clearsTripDetailsRoots: ["participation"],
    itineraryKeysToDelete: ["dayPlans", "segmentActivities"],
    clearsRootTransportModes: false,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: false,
    requiresEmptyRootTransportModes: false,
    mountainOverviewKeysToStripFromOverview: MOUNTAIN_OVERVIEW_STRIP_KEYS,
  },
  edit: { tripDetailsPresetOverrides: [] },
};

const culturalTour: TourFormProfileDescriptor = {
  slug: "cultural_tour",
  displayKeyFa: "tours.profiles.cultural_tour",
  defaultTourType: "cultural",
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
  strip: {
    clearsTripDetailsRoots: [],
    itineraryKeysToDelete: [],
    clearsRootTransportModes: false,
  },
  invariants: {
    allowsMountainOnlyOverviewKeys: false,
    requiresEmptyRootTransportModes: false,
    mountainOverviewKeysToStripFromOverview: MOUNTAIN_OVERVIEW_STRIP_KEYS,
  },
  edit: { tripDetailsPresetOverrides: [] },
};

export const TOUR_FORM_PROFILE_DESCRIPTORS: Readonly<
  Record<TourFormProfile, TourFormProfileDescriptor>
> = {
  general,
  mountain_outdoor: mountainOutdoor,
  nature_trip: natureTrip,
  urban_event: urbanEvent,
  cinema_event: cinemaEvent,
  cultural_tour: culturalTour,
};

/**
 * Look up the descriptor row for a profile. Throws (rather than returning `undefined`) so
 * call sites can rely on the table being total over {@link TourFormProfile}; any future
 * profile slug must add a row at the same time it is added to `TOUR_FORM_PROFILE_VALUES`.
 */
export function getTourFormProfileDescriptor(
  profile: TourFormProfile,
): TourFormProfileDescriptor {
  const row = TOUR_FORM_PROFILE_DESCRIPTORS[profile];
  if (!row) {
    throw new Error(
      `getTourFormProfileDescriptor: no descriptor row for profile "${String(profile)}". ` +
        `Add an entry to TOUR_FORM_PROFILE_DESCRIPTORS alongside the new TOUR_FORM_PROFILE_VALUES literal.`,
    );
  }
  return row;
}

/**
 * Internal totality check — every literal in `TOUR_FORM_PROFILE_VALUES` MUST have a
 * descriptor row. Imported by `tour-form-profile-descriptors.spec.ts`; not exported from
 * the package index.
 */
export function __assertDescriptorTotality(): void {
  for (const profile of TOUR_FORM_PROFILE_VALUES) {
    void getTourFormProfileDescriptor(profile);
  }
}

/**
 * Trip-details field ids (under `tripDetails.*`) for overview keys in
 * {@link MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS}. Used by the Edit base matrix to hide
 * mountain-only inventory fields for non-`mountain_outdoor` profiles — stays in lock-step
 * with the canonical key list in `trip-details-inventory-policy.ts`.
 */
export function mountainOnlyTripDetailsOverviewFieldIds(): readonly string[] {
  return MOUNTAIN_ONLY_TRIP_DETAILS_OVERVIEW_KEYS.map((k) => `overview.${k}`);
}

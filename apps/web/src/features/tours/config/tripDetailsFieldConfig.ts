import type { EventKind } from "../policies/tour-kind-policy";

export type FieldVisibility = "hidden" | "readonly" | "editable";
export type FieldRequiredness = "optional" | "recommended" | "required";
export type UserRole = "guest" | "member" | "leader" | "admin";

export type FieldRoleConstraint = {
  minRoleForEdit?: UserRole;
  minRoleForView?: UserRole;
};

export type FieldConfigBase = {
  visibility: FieldVisibility;
  requiredness: FieldRequiredness;
  labelOverride?: string;
  descriptionOverride?: string;
  /**
   * Minimum workspace/JWT role thresholds (rank-based). Used by core capacity fields.
   * When `allowedRoles` / `viewOnlyRoles` are set (non-empty), list-based RBAC takes precedence instead.
   */
  role?: FieldRoleConstraint;
  /**
   * Explicit allow-list for edit access when `visibility === "editable"`.
   * Omit or leave empty to keep this dimension open (subject only to `role` thresholds / EventKind visibility).
   */
  allowedRoles?: UserRole[];
  /**
   * Roles that may see the field read-only when `visibility === "editable"`.
   * Evaluated only when list-based RBAC is active (see `allowedRoles` / `viewOnlyRoles`).
   */
  viewOnlyRoles?: UserRole[];
};

export type TripDetailsFieldId =
  | "overview.mainDestination"
  | "overview.destinationRegion"
  | "overview.tourThemeIds"
  | "overview.tripStyles"
  | "overview.difficultyLevel"
  | "overview.elevationGainMeters"
  | "overview.maxAltitudeMeters"
  | "overview.shortIntro"
  | "itinerary.highlights"
  | "itinerary.includedVisits"
  | "itinerary.excludedVisits"
  | "itinerary.optionalActivities"
  | "itinerary.outline"
  | "itinerary.programNotes"
  | "itinerary.specialExperiences"
  | "itinerary.dayPlans"
  | "logistics.meetingPoint"
  | "logistics.departureMeetingTime"
  | "logistics.departureDate"
  | "logistics.returnDate"
  | "logistics.returnPoint"
  | "logistics.transportationNotes"
  | "logistics.accommodationTypes"
  | "logistics.accommodationNotes"
  | "logistics.mealPlan"
  | "logistics.mealNotes"
  | "logistics.supportServices"
  | "logistics.includedServices"
  | "logistics.excludedServices"
  | "logistics.optionalServices"
  | "logistics.guideLanguageIds"
  | "logistics.groupSizeMin"
  | "logistics.groupSizeMax"
  | "participation.minimumAge"
  | "participation.maximumAge"
  | "participation.genderRestriction"
  | "participation.fitnessLevel"
  | "participation.experienceLevel"
  | "participation.technicalSkillRequired"
  | "participation.requirements"
  | "participation.skillsRequired"
  | "participation.gearRequiredIds"
  | "participation.gearOptionalIds"
  | "participation.documentsRequired"
  | "participation.suitableFor"
  | "participation.notSuitableFor"
  | "participation.medicalRestrictions"
  | "policies.reservationRules"
  | "policies.cancellationPolicy"
  | "policies.refundPolicy"
  | "policies.attendanceRules"
  | "policies.lateArrivalPolicy"
  | "policies.noShowPolicy"
  | "policies.confirmationPolicy"
  | "policies.capacityPolicy"
  | "policies.weatherPolicy"
  | "policies.safetyPolicy";

export type CoreFieldId = "core.totalCapacity" | "core.capacity";

export type TripDetailsFieldConfig = FieldConfigBase & {
  id: TripDetailsFieldId;
};

export type CoreFieldConfig = FieldConfigBase & {
  id: CoreFieldId;
};

export type EventKindFieldConfig = {
  kind: EventKind;
  tripDetails: TripDetailsFieldConfig[];
  core: CoreFieldConfig[];
};

const FIELD_IDS: readonly TripDetailsFieldId[] = [
  "overview.mainDestination",
  "overview.destinationRegion",
  "overview.tourThemeIds",
  "overview.tripStyles",
  "overview.difficultyLevel",
  "overview.elevationGainMeters",
  "overview.maxAltitudeMeters",
  "overview.shortIntro",
  "itinerary.highlights",
  "itinerary.includedVisits",
  "itinerary.excludedVisits",
  "itinerary.optionalActivities",
  "itinerary.outline",
  "itinerary.programNotes",
  "itinerary.specialExperiences",
  "itinerary.dayPlans",
  "logistics.meetingPoint",
  "logistics.departureMeetingTime",
  "logistics.departureDate",
  "logistics.returnDate",
  "logistics.returnPoint",
  "logistics.transportationNotes",
  "logistics.accommodationTypes",
  "logistics.accommodationNotes",
  "logistics.mealPlan",
  "logistics.mealNotes",
  "logistics.supportServices",
  "logistics.includedServices",
  "logistics.excludedServices",
  "logistics.optionalServices",
  "logistics.guideLanguageIds",
  "logistics.groupSizeMin",
  "logistics.groupSizeMax",
  "participation.minimumAge",
  "participation.maximumAge",
  "participation.genderRestriction",
  "participation.fitnessLevel",
  "participation.experienceLevel",
  "participation.technicalSkillRequired",
  "participation.requirements",
  "participation.skillsRequired",
  "participation.gearRequiredIds",
  "participation.gearOptionalIds",
  "participation.medicalRestrictions",
  "participation.documentsRequired",
  "participation.suitableFor",
  "participation.notSuitableFor",
  "policies.reservationRules",
  "policies.cancellationPolicy",
  "policies.refundPolicy",
  "policies.attendanceRules",
  "policies.lateArrivalPolicy",
  "policies.noShowPolicy",
  "policies.confirmationPolicy",
  "policies.capacityPolicy",
  "policies.weatherPolicy",
  "policies.safetyPolicy",
];

const CORE_FIELD_IDS: readonly CoreFieldId[] = ["core.totalCapacity", "core.capacity"];

/**
 * Mountain-only fields — never relevant for non-mountain kinds.
 * Hidden from the form and stripped on the server when `tourType !== mountain`
 * (see `apps/api/src/modules/tours/utils/tour-type-gates.ts`).
 */
const MOUNTAIN_ONLY_FIELD_IDS: readonly TripDetailsFieldId[] = ["overview.maxAltitudeMeters"];

const NON_MOUNTAIN_HIDDEN_OVERRIDES: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> =
  Object.fromEntries(
    MOUNTAIN_ONLY_FIELD_IDS.map((id) => [id, { visibility: "hidden", requiredness: "optional" }]),
  ) as Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>>;

function buildKindTripDetailsConfig(
  overrides: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> = {},
): TripDetailsFieldConfig[] {
  return FIELD_IDS.map((id) => ({
    id,
    ...(overrides[id] ?? { visibility: "editable", requiredness: "optional" }),
  }));
}

function allCoreEditableOptional(): CoreFieldConfig[] {
  return CORE_FIELD_IDS.map((id) => ({
    id,
    visibility: "editable",
    requiredness: "optional",
  }));
}

const GENERIC_CONFIG: EventKindFieldConfig = {
  kind: "generic",
  tripDetails: buildKindTripDetailsConfig(NON_MOUNTAIN_HIDDEN_OVERRIDES),
  core: allCoreEditableOptional(),
};

const MOUNTAIN_OVERRIDES: Partial<Record<TripDetailsFieldId, Omit<TripDetailsFieldConfig, "id">>> = {
  "participation.minimumAge": { visibility: "editable", requiredness: "required" },
  "overview.difficultyLevel": { visibility: "editable", requiredness: "required" },
  "participation.gearRequiredIds": { visibility: "editable", requiredness: "required" },
  "participation.technicalSkillRequired": { visibility: "editable", requiredness: "recommended" },
  "logistics.meetingPoint": { visibility: "editable", requiredness: "required" },
  "logistics.departureDate": { visibility: "editable", requiredness: "required" },
  "logistics.returnDate": { visibility: "editable", requiredness: "recommended" },
  "logistics.transportationNotes": { visibility: "editable", requiredness: "recommended" },
  "logistics.groupSizeMin": { visibility: "editable", requiredness: "recommended" },
  "logistics.groupSizeMax": { visibility: "editable", requiredness: "recommended" },
};

const MOUNTAIN_CONFIG: EventKindFieldConfig = {
  kind: "mountain",
  tripDetails: buildKindTripDetailsConfig(MOUNTAIN_OVERRIDES),
  core: allCoreEditableOptional(),
};

const EVENT_KIND_CONFIGS: Record<EventKind, EventKindFieldConfig> = {
  generic: GENERIC_CONFIG,
  mountain: MOUNTAIN_CONFIG,
  cultural: {
    kind: "cultural",
    tripDetails: buildKindTripDetailsConfig(NON_MOUNTAIN_HIDDEN_OVERRIDES),
    core: allCoreEditableOptional(),
  },
  city_tour: {
    kind: "city_tour",
    tripDetails: buildKindTripDetailsConfig(NON_MOUNTAIN_HIDDEN_OVERRIDES),
    core: allCoreEditableOptional(),
  },
  workshop: {
    kind: "workshop",
    tripDetails: buildKindTripDetailsConfig(NON_MOUNTAIN_HIDDEN_OVERRIDES),
    core: allCoreEditableOptional(),
  },
};

export function getTripDetailsFieldConfigForKind(kind: EventKind): TripDetailsFieldConfig[] {
  return EVENT_KIND_CONFIGS[kind]?.tripDetails ?? GENERIC_CONFIG.tripDetails;
}

const CORE_ROLE_OVERRIDES: Partial<Record<CoreFieldId, FieldRoleConstraint>> = {
  "core.totalCapacity": { minRoleForView: "leader", minRoleForEdit: "leader" },
  "core.capacity": { minRoleForView: "leader", minRoleForEdit: "leader" },
};

function withCoreRoleOverrides(rows: CoreFieldConfig[]): CoreFieldConfig[] {
  return rows.map((row) => ({
    ...row,
    role: CORE_ROLE_OVERRIDES[row.id] ?? row.role,
  }));
}

for (const kind of Object.keys(EVENT_KIND_CONFIGS) as EventKind[]) {
  EVENT_KIND_CONFIGS[kind] = {
    ...EVENT_KIND_CONFIGS[kind],
    core: withCoreRoleOverrides(EVENT_KIND_CONFIGS[kind].core),
  };
}

export function getCoreFieldConfigForKind(kind: EventKind): CoreFieldConfig[] {
  return EVENT_KIND_CONFIGS[kind]?.core ?? GENERIC_CONFIG.core;
}

export function normalizeFieldUserRole(rawRole: string | null | undefined): UserRole {
  const normalized = (rawRole ?? "").trim().toLowerCase();
  if (normalized === "owner" || normalized === "admin") return "admin";
  if (normalized === "leader") return "leader";
  if (normalized === "member") return "member";
  return "guest";
}

function roleRank(role: UserRole): number {
  if (role === "guest") return 0;
  if (role === "member") return 1;
  if (role === "leader") return 2;
  return 3;
}

function meetsMinRole(current: UserRole, min: UserRole | undefined): boolean {
  if (!min) return true;
  return roleRank(current) >= roleRank(min);
}

function hasListBasedRbac(config: FieldConfigBase | undefined): boolean {
  const a = config?.allowedRoles;
  const v = config?.viewOnlyRoles;
  return (Array.isArray(a) && a.length > 0) || (Array.isArray(v) && v.length > 0);
}

export type ResolvedFieldAccess = {
  /** Effective UI mode after global visibility + RBAC. */
  accessLevel: FieldVisibility;
  /** Same as `accessLevel` (kept for callers that already use `.visibility`). */
  visibility: FieldVisibility;
  canView: boolean;
  canEdit: boolean;
  requiredness: FieldRequiredness;
};

/**
 * Resolves effective field access: EventKind `visibility` / `requiredness` plus optional RBAC.
 * - `visibility === "hidden"` → always hidden.
 * - `visibility === "readonly"` → always readonly (no role escalation to edit).
 * - `visibility === "editable"`:
 *   - If `allowedRoles` or `viewOnlyRoles` is non-empty → list-based rules: edit if role ∈ allowedRoles,
 *     else readonly if role ∈ viewOnlyRoles, else hidden.
 *   - Else if `role.minRoleForView` / `minRoleForEdit` → rank thresholds (e.g. core capacity).
 *   - Else → editable for all roles.
 */
export function resolveFieldAccess<T extends FieldConfigBase>(config: T | undefined, viewerRole: UserRole): ResolvedFieldAccess {
  const visibility = config?.visibility ?? "editable";
  const requiredness = config?.requiredness ?? "optional";

  if (visibility === "hidden") {
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }
  if (visibility === "readonly") {
    const level = "readonly" as const;
    return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
  }

  if (hasListBasedRbac(config)) {
    const allowed = config!.allowedRoles ?? [];
    const viewOnly = config!.viewOnlyRoles ?? [];
    if (allowed.includes(viewerRole)) {
      const level = "editable" as const;
      return { accessLevel: level, visibility: level, canView: true, canEdit: true, requiredness };
    }
    if (viewOnly.includes(viewerRole)) {
      const level = "readonly" as const;
      return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
    }
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }

  const canViewByRole = meetsMinRole(viewerRole, config?.role?.minRoleForView);
  const canEditByRole = meetsMinRole(viewerRole, config?.role?.minRoleForEdit);
  if (!canViewByRole) {
    const level = "hidden" as const;
    return { accessLevel: level, visibility: level, canView: false, canEdit: false, requiredness };
  }
  if (!canEditByRole) {
    const level = "readonly" as const;
    return { accessLevel: level, visibility: level, canView: true, canEdit: false, requiredness };
  }
  const level = "editable" as const;
  return { accessLevel: level, visibility: level, canView: true, canEdit: true, requiredness };
}


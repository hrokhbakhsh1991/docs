import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";

import type {
  DenaliFieldDefinition,
  DenaliZodFieldKind,
} from "../field-registry/denaliFieldRegistryData";
import { DENALI_TOUR_KIND_VALUES } from "../types/legacy/repo-types";

import { shouldRenderDenaliRegistryField } from "./denali-composite-anchors";
import type { DenaliCompositeRendererId } from "./platform-renderer-ids";

/** Canonical-path overrides (legacy `DENALI_ZOD_KIND_ALIASES`). */
export const DENALI_COMPOSITE_BY_CANONICAL_PATH: Readonly<
  Partial<Record<string, DenaliCompositeRendererId>>
> = {
  startDateTime: "denali.datetime",
  endDateTime: "denali.datetime-end",
  "program.themeIds": "denali.program-content",
  "program.guideLanguageIds": "denali.guide-language-ids",
  "tripDetails.overview.customServiceLabels": "denali.custom-services",
  leaderUserIds: "denali.leader-user-ids",
  "tripDetails.metrics.elevationGain": "denali.elevation-gain",
  "participants.minimumAge": "denali.pricing-participants",
  "pricing.requiresPayment": "denali.pricing-payment",
};

/** zodKind → composite renderer id (legacy `DENALI_ZOD_KIND_COMPONENTS`). */
export const DENALI_COMPOSITE_BY_ZOD_KIND: Readonly<
  Partial<Record<DenaliZodFieldKind, DenaliCompositeRendererId>>
> = {
  tourType: "denali.tour-kind-basics",
  destinationId: "denali.destination",
  transportMode: "denali.transport-mode",
  difficultyLevel: "denali.difficulty-level",
  approximateReturnTime: "denali.approximate-return-time",
  photos: "denali.photos",
  itinerary: "denali.itinerary",
  gatheringPoints: "denali.gathering-points",
  gearItems: "denali.gear",
  locationData: "denali.location-zones",
  minRequiredPeaks: "denali.peak-experience",
};

export type DenaliFieldRendererResolution = {
  readonly rendererId: string;
  readonly kind: WorkspaceFieldKind;
  readonly enumOptions?: readonly string[];
};

function enumOptionsForZodKind(zodKind: DenaliZodFieldKind): readonly string[] | undefined {
  switch (zodKind) {
    case "tourType":
      return DENALI_TOUR_KIND_VALUES;
    case "transportMode":
      return ["organizer_vehicle", "bus", "minibus", "train", "shared_cars", "none"];
    case "paymentMode":
      return ["offline_receipt"];
    case "publishStatus":
      return ["draft", "active"];
    default:
      return undefined;
  }
}

function primitiveKindForZodKind(zodKind: DenaliZodFieldKind): WorkspaceFieldKind {
  switch (zodKind) {
    case "title":
    case "stringOptional":
    case "socialMediaLink":
      return "text";
    case "paymentMode":
    case "publishStatus":
      return "enum";
    case "booleanOptional":
    case "adminCapacityApproval":
      return "boolean";
    case "capacityMax":
    case "optionalInt":
    case "optionalPositiveInt":
    case "fitnessLevel":
      return "number";
    default:
      return "text";
  }
}

export function resolveDenaliCompositeRendererId(
  field: DenaliFieldDefinition
): DenaliCompositeRendererId | null {
  if (!shouldRenderDenaliRegistryField(field)) {
    return null;
  }

  const byPath = DENALI_COMPOSITE_BY_CANONICAL_PATH[field.canonicalPath];
  if (byPath != null) {
    return byPath;
  }

  return DENALI_COMPOSITE_BY_ZOD_KIND[field.zodKind] ?? null;
}

export function resolveDenaliFieldRenderer(
  field: DenaliFieldDefinition
): DenaliFieldRendererResolution | null {
  if (!shouldRenderDenaliRegistryField(field)) {
    return null;
  }

  const compositeId = resolveDenaliCompositeRendererId(field);
  if (compositeId != null) {
    return { rendererId: compositeId, kind: "composite" };
  }

  const kind = primitiveKindForZodKind(field.zodKind);
  const enumOptions = kind === "enum" ? enumOptionsForZodKind(field.zodKind) : undefined;
  return {
    rendererId: kind,
    kind,
    ...(enumOptions != null ? { enumOptions } : {}),
  };
}

export function getDenaliCompositeRegistry(): Readonly<
  Record<DenaliCompositeRendererId, { readonly zodKinds: readonly DenaliZodFieldKind[] }>
> {
  const byId = new Map<DenaliCompositeRendererId, DenaliZodFieldKind[]>();
  for (const [zodKind, compositeId] of Object.entries(DENALI_COMPOSITE_BY_ZOD_KIND) as Array<
    [DenaliZodFieldKind, DenaliCompositeRendererId]
  >) {
    const list = byId.get(compositeId) ?? [];
    list.push(zodKind);
    byId.set(compositeId, list);
  }
  for (const compositeId of Object.values(
    DENALI_COMPOSITE_BY_CANONICAL_PATH
  ) as DenaliCompositeRendererId[]) {
    if (!byId.has(compositeId)) {
      byId.set(compositeId, []);
    }
  }
  return Object.freeze(
    Object.fromEntries(
      [...byId.entries()].map(([id, zodKinds]) => [
        id,
        Object.freeze({ zodKinds: Object.freeze([...zodKinds]) }),
      ])
    )
  ) as Record<DenaliCompositeRendererId, { readonly zodKinds: readonly DenaliZodFieldKind[] }>;
}

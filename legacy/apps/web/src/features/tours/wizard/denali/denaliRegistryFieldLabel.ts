import type { useTranslations } from "next-intl";

import {
  DENALI_FIELD_REGISTRY,
  type DenaliFieldRegistryEntry,
} from "./registry/DenaliFieldRegistry";

type DenaliT = ReturnType<typeof useTranslations<"tours.denali">>;

const RHF_FIELD_I18N_OVERRIDES: Record<string, string> = {
  "basicInfo.tourType": "basic.categoryLabel",
  "basicInfo.publishStatus": "basic.publishStatus",
  "transport.transportMode": "transport.transportModeLabel",
  "programNature.themeIds": "program.themesLabel",
  "programNature.itinerary": "program.itineraryOutline",
  "programNature.hikingHoursApprox": "program.hikingHours",
  "pricingPayment.paymentMode": "pricing.offlineOnlyHint",
  "photosData.photos": "photos.title",
};

function normalizeIssueFormPath(path: string): string {
  const stripped = path.replace(/\.(message|type|ref)$/, "");
  const itineraryMatch = stripped.match(/^programNature\.itinerary\.\d+\.(\w+)/);
  if (itineraryMatch) {
    return "programNature.itinerary";
  }
  if (/^tripDetails\.logistics\.gatheringPoints/.test(stripped)) {
    return "tripDetails.logistics.gatheringPoints";
  }
  const zoneMatch = stripped.match(/^basicInfo\.(gatheringPoint|startPoint|summitPoint|campPoint|endPoint)/);
  if (zoneMatch) {
    return `basicInfo.${zoneMatch[1]}`;
  }
  return stripped;
}

function findRegistryEntryForFormPath(formPath: string): DenaliFieldRegistryEntry | undefined {
  const normalized = normalizeIssueFormPath(formPath);
  return DENALI_FIELD_REGISTRY.find((row) => row.rhfPath === normalized);
}

function rhfPathToI18nKey(rhfPath: string): string | null {
  const override = RHF_FIELD_I18N_OVERRIDES[rhfPath];
  if (override) return override;

  const [prefix, field] = rhfPath.split(".");
  if (!prefix || !field) return null;

  switch (prefix) {
    case "basicInfo":
      return `basic.${field}`;
    case "programNature":
      return `program.${field}`;
    case "participantRequirements":
      return `participants.${field}`;
    case "pricingPayment":
      return `pricing.${field}`;
    case "transport":
      return `transport.${field}`;
    case "policies":
      return `policies.${field}`;
    case "photosData":
      return field === "photos" ? "photos.title" : `photos.${field}`;
    case "tripDetails":
      if (field === "logistics") return "basic.locationZones.gatheringPoint";
      return null;
    default:
      return null;
  }
}

/** Human-readable field label via registry RHF path + Denali i18n keys used on wizard steps. */
export function resolveDenaliRegistryFieldLabel(formPath: string, t: DenaliT): string {
  const normalized = normalizeIssueFormPath(formPath);
  const registryEntry = findRegistryEntryForFormPath(normalized);

  const i18nKey =
    (registryEntry ? rhfPathToI18nKey(registryEntry.rhfPath) : null) ??
    rhfPathToI18nKey(normalized);

  if (i18nKey) {
    try {
      return t(i18nKey as Parameters<DenaliT>[0]);
    } catch {
      /* fall through */
    }
  }

  return normalized.split(".").pop() ?? normalized;
}

export function resolveDenaliRegistryStepId(formPath: string) {
  const registryEntry = findRegistryEntryForFormPath(normalizeIssueFormPath(formPath));
  return registryEntry?.stepId;
}

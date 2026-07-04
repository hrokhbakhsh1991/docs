import type {
  PublicCatalogGatheringPoint,
  PublicCatalogGearItem,
} from "@app-tour/workspace-sdk";

import {
  readDenaliCanonicalPhotoRows,
  readDenaliFirstPhotoHttpsUrl,
} from "../list/read-denali-first-photo";
import { isDenaliHttpsImageUrl } from "../schemas/denaliFileAssetSchema";
import { parseDenaliGearItems } from "../ui/logic/denali-gear-types";
import {
  parseDenaliGatheringPoints,
  parseDenaliLocationData,
} from "../ui/logic/denali-location-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function readCanonicalPath(data: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[part];
  }
  return current;
}

function readString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return Number.isInteger(value) ? value : Math.trunc(value);
}

function readBoolean(value: unknown): boolean {
  return value === true;
}

function readStringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const items = value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
  return Object.freeze(items);
}

function readLocationGatheringPoint(value: unknown): PublicCatalogGatheringPoint | null {
  const location = parseDenaliLocationData(value);
  const label = [location.label, location.address].filter((part) => part != null && part.length > 0).join(" — ");
  if (label.length === 0 && location.latitude == null && location.longitude == null) {
    return null;
  }
  return Object.freeze({
    label: label.length > 0 ? label : "—",
    ...(location.latitude != null ? { latitude: location.latitude } : { latitude: null }),
    ...(location.longitude != null ? { longitude: location.longitude } : { longitude: null }),
  });
}

function readGatheringPoints(data: Record<string, unknown>): PublicCatalogGatheringPoint | null {
  const points = parseDenaliGatheringPoints(readCanonicalPath(data, "tripDetails.logistics.gatheringPoints"));
  const primary = points.find((point) => point.isPrimary === true) ?? points[0];
  if (primary == null) {
    return readLocationGatheringPoint(readCanonicalPath(data, "startPoint"));
  }
  const label = [primary.name, primary.address].filter((part) => part != null && part.length > 0).join(" — ");
  if (label.length === 0 && primary.latitude == null && primary.longitude == null) {
    return null;
  }
  return Object.freeze({
    label: label.length > 0 ? label : "—",
    ...(primary.latitude != null ? { latitude: primary.latitude } : { latitude: null }),
    ...(primary.longitude != null ? { longitude: primary.longitude } : { longitude: null }),
  });
}

function readGearItems(data: Record<string, unknown>): readonly PublicCatalogGearItem[] | undefined {
  const raw =
    readCanonicalPath(data, "participants.gearItems") ??
    readCanonicalPath(data, "participantRequirements.gearItems");
  const items = parseDenaliGearItems(raw).map((item) =>
    Object.freeze({
      name: item.name.trim(),
      isRequired: item.isRequired,
    })
  );
  return items.length > 0 ? Object.freeze(items) : undefined;
}

export type DenaliCatalogDetailEgress = {
  readonly destinationLabel?: string | null;
  readonly longDescription?: string | null;
  readonly hikingHoursApprox?: number | null;
  readonly hikingGoHours?: number | null;
  readonly hikingReturnHours?: number | null;
  readonly peakHeightMeters?: number | null;
  readonly trailDistanceKm?: number | null;
  readonly elevationGainMeters?: number | null;
  readonly minimumAge?: number | null;
  readonly maximumAge?: number | null;
  readonly fitnessPrerequisiteText?: string | null;
  readonly approximateReturnTime?: string | null;
  readonly gatheringPoint?: PublicCatalogGatheringPoint | null;
  readonly meetingPointText?: string | null;
  readonly gearItems?: readonly PublicCatalogGearItem[];
  readonly includedServices?: readonly string[];
  readonly excludedServices?: readonly string[];
  readonly includesTourInsurance?: boolean;
  readonly paymentMode?: string | null;
  readonly photoUrls?: readonly string[];
};

export type ReadDenaliCatalogDetailEgressOptions = {
  readonly destinationNameById?: ReadonlyMap<string, string>;
  readonly photoUrlById?: ReadonlyMap<string, string>;
  readonly coverImageUrl?: string | null;
};

export function readDenaliCatalogGalleryPhotoUrls(
  data: Record<string, unknown>,
  options?: Pick<ReadDenaliCatalogDetailEgressOptions, "photoUrlById" | "coverImageUrl">
): readonly string[] | undefined {
  const urls: string[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined) => {
    if (url == null || url.length === 0 || seen.has(url)) {
      return;
    }
    seen.add(url);
    urls.push(url);
  };

  for (const row of readDenaliCanonicalPhotoRows(data)) {
    const httpsUrl = readString(row.url);
    if (httpsUrl != null && isDenaliHttpsImageUrl(httpsUrl)) {
      add(httpsUrl);
      continue;
    }
    const id = readString(row.id);
    if (id != null && options?.photoUrlById != null) {
      add(options.photoUrlById.get(id) ?? null);
    }
  }

  add(options?.coverImageUrl ?? readDenaliFirstPhotoHttpsUrl(data.photos));
  return urls.length > 0 ? Object.freeze(urls) : undefined;
}

/** Map Denali canonical tour data to PR-D detail egress fields. */
export function readDenaliCatalogDetailEgress(
  data: Record<string, unknown>,
  options?: ReadDenaliCatalogDetailEgressOptions
): DenaliCatalogDetailEgress {
  const destinationId = readString(data.destinationId);
  const destinationLabel =
    destinationId != null && options?.destinationNameById != null
      ? readString(options.destinationNameById.get(destinationId))
      : null;

  const longDescription = readString(readCanonicalPath(data, "program.longDescription"));
  const hikingHoursApprox = readInteger(readCanonicalPath(data, "program.hikingHoursApprox"));
  const hikingGoHours = readInteger(readCanonicalPath(data, "program.hikingGoHours"));
  const hikingReturnHours = readInteger(readCanonicalPath(data, "program.hikingReturnHours"));
  const peakHeightMeters = readInteger(readCanonicalPath(data, "tripDetails.overview.peakHeight"));
  const trailDistanceKm = readInteger(readCanonicalPath(data, "tripDetails.overview.trailDistanceKm"));
  const elevationGainMeters = readInteger(readCanonicalPath(data, "tripDetails.metrics.elevationGain"));
  const minimumAge = readInteger(readCanonicalPath(data, "participants.minimumAge"));
  const maximumAge = readInteger(readCanonicalPath(data, "participants.maximumAge"));
  const fitnessPrerequisiteText = readString(
    readCanonicalPath(data, "participants.fitnessPrerequisiteText")
  );
  const approximateReturnTime = readString(data.approximateReturnTime);
  const gatheringPoint = readGatheringPoints(data);
  const meetingPointText =
    readString(data.meetingPoint) ?? readString(data.startPointLocationText);
  const gearItems = readGearItems(data);
  const includedServices = readStringArray(
    readCanonicalPath(data, "tripDetails.logistics.includedServices")
  );
  const excludedServices = readStringArray(
    readCanonicalPath(data, "tripDetails.logistics.excludedServices")
  );
  const includesTourInsurance = readBoolean(readCanonicalPath(data, "pricing.includesTourInsurance"));
  const paymentMode =
    readString(readCanonicalPath(data, "pricing.paymentMode")) ??
    readString(readCanonicalPath(data, "pricingPayment.paymentMode"));
  const photoUrls = readDenaliCatalogGalleryPhotoUrls(data, {
    photoUrlById: options?.photoUrlById,
    coverImageUrl: options?.coverImageUrl,
  });

  return Object.freeze({
    ...(destinationLabel != null ? { destinationLabel } : {}),
    ...(longDescription != null ? { longDescription } : {}),
    ...(hikingHoursApprox != null ? { hikingHoursApprox } : {}),
    ...(hikingGoHours != null ? { hikingGoHours } : {}),
    ...(hikingReturnHours != null ? { hikingReturnHours } : {}),
    ...(peakHeightMeters != null ? { peakHeightMeters } : {}),
    ...(trailDistanceKm != null ? { trailDistanceKm } : {}),
    ...(elevationGainMeters != null ? { elevationGainMeters } : {}),
    ...(minimumAge != null ? { minimumAge } : {}),
    ...(maximumAge != null ? { maximumAge } : {}),
    ...(fitnessPrerequisiteText != null ? { fitnessPrerequisiteText } : {}),
    ...(approximateReturnTime != null ? { approximateReturnTime } : {}),
    ...(gatheringPoint != null ? { gatheringPoint } : {}),
    ...(meetingPointText != null ? { meetingPointText } : {}),
    ...(gearItems != null ? { gearItems } : {}),
    ...(includedServices.length > 0 ? { includedServices } : {}),
    ...(excludedServices.length > 0 ? { excludedServices } : {}),
    ...(includesTourInsurance ? { includesTourInsurance: true } : {}),
    ...(paymentMode != null ? { paymentMode } : {}),
    ...(photoUrls != null ? { photoUrls } : {}),
  });
}

import type { DenaliTourKind } from "../../types/legacy/repo-types";
import { readDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import {
  parseDenaliItineraryDays,
  type DenaliItineraryDay,
  type DenaliItinerarySegment,
} from "../../schemas/denaliItineraryDaySchema";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  getCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";

import { parseStringArray } from "./denali-array-field-utils";
import { parseDenaliGearItems } from "./denali-gear-types";
import {
  DENALI_LOCATION_ZONE_PATHS,
  parseDenaliGatheringPoints,
  parseDenaliLocationData,
} from "./denali-location-types";
import { parseDenaliTourPhotos } from "./denali-photo-types";

export type DenaliReviewCatalog = {
  readonly destinationNameById: ReadonlyMap<string, string>;
  readonly leaderNameById: ReadonlyMap<string, string>;
  readonly themeNameById: ReadonlyMap<string, string>;
  readonly languageNameById: ReadonlyMap<string, string>;
};

export type DenaliReviewRow = {
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
};

export type DenaliReviewCard = {
  readonly title: string;
  readonly body?: string;
  readonly meta?: string;
  readonly variant?: "default" | "self";
};

export type DenaliReviewSection = {
  readonly stepId: string;
  readonly title: string;
  readonly rows: readonly DenaliReviewRow[];
  readonly chips?: readonly string[];
  readonly cards?: readonly DenaliReviewCard[];
};

export type DenaliReviewHero = {
  readonly title: string;
  readonly categoryLabel: string;
  readonly destination: string;
  readonly schedule: string;
};

export type DenaliReviewFormatLabels = {
  readonly fieldLabel: (canonicalPath: string) => string;
  readonly stepLabel: (stepId: string) => string;
  readonly tourKindLabel: (slug: string) => string;
  readonly transportModeLabel: (mode: string) => string;
  readonly publishStatusLabel: (status: string) => string;
  readonly locationZoneLabel: (path: string) => string;
  readonly yes: string;
  readonly no: string;
  readonly gearRequired: string;
  readonly gearOptional: string;
  readonly photoCount: (count: number) => string;
  readonly dayLabel: (day: number) => string;
  readonly primaryGathering: string;
};

function pushRow(
  rows: DenaliReviewRow[],
  label: string,
  value: string,
  multiline = false
): void {
  if (value.trim().length === 0) {
    return;
  }
  rows.push({ label, value, ...(multiline ? { multiline: true } : {}) });
}

function boolLabel(raw: string, labels: Pick<DenaliReviewFormatLabels, "yes" | "no">): string {
  if (raw === "true") {
    return labels.yes;
  }
  if (raw === "false") {
    return labels.no;
  }
  return "";
}

function mapIds(ids: readonly string[], catalog: ReadonlyMap<string, string>): string {
  return ids
    .map((id) => catalog.get(id) ?? id)
    .filter((entry) => entry.trim().length > 0)
    .join("، ");
}

function formatLocation(value: unknown): string {
  const location = parseDenaliLocationData(value);
  const parts = [location.label, location.address].filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0
  );
  return parts.join(" — ");
}

export function buildDenaliReviewHero(
  draft: DenaliTourWizardDraft,
  catalog: DenaliReviewCatalog,
  labels: DenaliReviewFormatLabels
): DenaliReviewHero {
  const title = getCanonicalStringValue(draft, "title");
  const category = getCanonicalStringValue(draft, "category");
  const destinationId = getCanonicalStringValue(draft, "destinationId");
  const startDateTime = getCanonicalStringValue(draft, "startDateTime");
  const endDateTime = getCanonicalStringValue(draft, "endDateTime");
  const scheduleParts = [startDateTime, endDateTime].filter((part) => part.trim().length > 0);

  return {
    title,
    categoryLabel:
      category.trim().length > 0 ? labels.tourKindLabel(category) : "",
    destination: catalog.destinationNameById.get(destinationId) ?? destinationId,
    schedule: scheduleParts.join(" → "),
  };
}

export function buildDenaliReviewSections(
  draft: DenaliTourWizardDraft,
  catalog: DenaliReviewCatalog,
  labels: DenaliReviewFormatLabels
): readonly DenaliReviewSection[] {
  const sections: DenaliReviewSection[] = [];

  const basicRows: DenaliReviewRow[] = [];
  const category = getCanonicalStringValue(draft, "category");
  const basics = readDenaliCanonicalBasics(
    category.trim().length > 0 ? (category as DenaliTourKind) : undefined
  );
  if (basics != null) {
    pushRow(basicRows, labels.fieldLabel("category"), labels.tourKindLabel(category));
  }
  pushRow(basicRows, labels.fieldLabel("title"), getCanonicalStringValue(draft, "title"));
  pushRow(
    basicRows,
    labels.fieldLabel("destinationId"),
    catalog.destinationNameById.get(getCanonicalStringValue(draft, "destinationId")) ??
      getCanonicalStringValue(draft, "destinationId")
  );
  pushRow(
    basicRows,
    labels.fieldLabel("tripDetails.overview.peakHeight"),
    getCanonicalStringValue(draft, "tripDetails.overview.peakHeight")
  );
  pushRow(basicRows, labels.fieldLabel("startDateTime"), getCanonicalStringValue(draft, "startDateTime"));
  pushRow(basicRows, labels.fieldLabel("endDateTime"), getCanonicalStringValue(draft, "endDateTime"));
  pushRow(
    basicRows,
    labels.fieldLabel("approximateReturnTime"),
    getCanonicalStringValue(draft, "approximateReturnTime")
  );
  pushRow(basicRows, labels.fieldLabel("capacityMax"), getCanonicalStringValue(draft, "capacityMax"));
  pushRow(basicRows, labels.fieldLabel("capacityMin"), getCanonicalStringValue(draft, "capacityMin"));
  const leaderIds = parseStringArray(getCanonicalValue(draft, "leaderUserIds"));
  pushRow(basicRows, labels.fieldLabel("leaderUserIds"), mapIds(leaderIds, catalog.leaderNameById));
  pushRow(
    basicRows,
    labels.fieldLabel("requiresLocalGuide"),
    boolLabel(getCanonicalStringValue(draft, "requiresLocalGuide"), labels)
  );
  pushRow(basicRows, labels.fieldLabel("localGuideName"), getCanonicalStringValue(draft, "localGuideName"));
  pushRow(
    basicRows,
    labels.fieldLabel("requiresManualAdminApproval"),
    boolLabel(getCanonicalStringValue(draft, "requiresManualAdminApproval"), labels)
  );
  pushRow(basicRows, labels.fieldLabel("socialMediaLink"), getCanonicalStringValue(draft, "socialMediaLink"));
  if (basicRows.length > 0) {
    sections.push({
      stepId: "denali_basic",
      title: labels.stepLabel("denali_basic"),
      rows: basicRows,
    });
  }

  const photoRows: DenaliReviewRow[] = [];
  const themeIds = parseStringArray(getCanonicalValue(draft, "program.themeIds"));
  const themeNames = mapIds(themeIds, catalog.themeNameById);
  pushRow(photoRows, labels.fieldLabel("program.themeIds"), themeNames);
  pushRow(
    photoRows,
    labels.fieldLabel("program.shortDescription"),
    getCanonicalStringValue(draft, "program.shortDescription"),
    true
  );
  pushRow(
    photoRows,
    labels.fieldLabel("program.longDescription"),
    getCanonicalStringValue(draft, "program.longDescription"),
    true
  );
  const photos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));
  pushRow(photoRows, labels.fieldLabel("photos"), labels.photoCount(photos.length));
  if (photoRows.length > 0 || photos.length > 0) {
    sections.push({
      stepId: "denali_photos",
      title: labels.stepLabel("denali_photos"),
      rows: photoRows,
      cards: photos.map((photo) => ({
        title: photo.label?.trim() || labels.fieldLabel("photos"),
        meta:
          photo.day != null
            ? labels.dayLabel(photo.day)
            : undefined,
      })),
    });
  }

  const programRows: DenaliReviewRow[] = [];
  const languageIds = parseStringArray(getCanonicalValue(draft, "program.guideLanguageIds"));
  pushRow(
    programRows,
    labels.fieldLabel("program.guideLanguageIds"),
    mapIds(languageIds, catalog.languageNameById)
  );
  pushRow(
    programRows,
    labels.fieldLabel("program.difficultyLevel"),
    getCanonicalStringValue(draft, "program.difficultyLevel")
  );
  pushRow(
    programRows,
    labels.fieldLabel("program.hikingHoursApprox"),
    getCanonicalStringValue(draft, "program.hikingHoursApprox")
  );
  pushRow(
    programRows,
    labels.fieldLabel("program.hikingGoHours"),
    getCanonicalStringValue(draft, "program.hikingGoHours")
  );
  pushRow(
    programRows,
    labels.fieldLabel("program.hikingReturnHours"),
    getCanonicalStringValue(draft, "program.hikingReturnHours")
  );
  pushRow(
    programRows,
    labels.fieldLabel("tripDetails.metrics.elevationGain"),
    getCanonicalStringValue(draft, "tripDetails.metrics.elevationGain")
  );
  const itinerary = parseDenaliItineraryDays(getCanonicalValue(draft, "program.itinerary"));
  const tourPhotos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));
  const photoLabelById = new Map(
    tourPhotos
      .filter((photo) => typeof photo.id === "string" && photo.id.trim().length > 0)
      .map((photo) => [photo.id!.trim(), photo.label?.trim() ?? ""] as const)
  );
  if (programRows.length > 0 || itinerary.length > 0) {
    sections.push({
      stepId: "denali_program",
      title: labels.stepLabel("denali_program"),
      rows: programRows,
      cards: itinerary
        .filter(
          (day: DenaliItineraryDay) =>
            (day.title?.trim().length ?? 0) > 0 ||
            (day.summary?.trim().length ?? 0) > 0 ||
            day.segments.some((segment: DenaliItinerarySegment) => segment.title.trim().length > 0)
        )
        .map((day: DenaliItineraryDay) => {
          const segmentLines = day.segments
            .filter((segment: DenaliItinerarySegment) => segment.title.trim().length > 0)
            .map((segment: DenaliItinerarySegment) => {
              const parts = [segment.title.trim()];
              if (segment.startTime?.trim()) {
                parts.unshift(segment.startTime.trim());
              }
              if (segment.locationLabel?.trim()) {
                parts.push(`@ ${segment.locationLabel.trim()}`);
              } else if (segment.destinationId?.trim()) {
                const destinationName =
                  catalog.destinationNameById.get(segment.destinationId.trim()) ??
                  segment.destinationId.trim();
                parts.push(`@ ${destinationName}`);
              }
              if (segment.photoIds != null && segment.photoIds.length > 0) {
                const photoLabels = segment.photoIds
                  .map((photoId: string) => photoLabelById.get(photoId) ?? "")
                  .filter((label: string) => label.length > 0);
                if (photoLabels.length > 0) {
                  parts.push(`Photos: ${photoLabels.join(", ")}`);
                } else {
                  parts.push(`Photos: ${segment.photoIds.length}`);
                }
              }
              return parts.join(" — ");
            });
          const bodyParts = [
            day.summary?.trim(),
            segmentLines.length > 0 ? segmentLines.join("\n") : undefined,
          ].filter((part) => part != null && part.length > 0);
          return {
            title: day.title?.trim() || labels.dayLabel(day.dayNumber ?? 1),
            body: bodyParts.length > 0 ? bodyParts.join("\n\n") : undefined,
            meta: labels.dayLabel(day.dayNumber ?? 1),
          };
        }),
    });
  }

  const logisticsRows: DenaliReviewRow[] = [];
  const transportMode = getCanonicalStringValue(draft, "transport.mode");
  pushRow(
    logisticsRows,
    labels.fieldLabel("transport.mode"),
    transportMode.trim().length > 0 ? labels.transportModeLabel(transportMode) : ""
  );
  pushRow(
    logisticsRows,
    labels.fieldLabel("transport.cost"),
    getCanonicalStringValue(draft, "transport.cost")
  );
  pushRow(
    logisticsRows,
    labels.fieldLabel("transport.dongAmount"),
    getCanonicalStringValue(draft, "transport.dongAmount")
  );
  pushRow(
    logisticsRows,
    labels.fieldLabel("transport.notes"),
    getCanonicalStringValue(draft, "transport.notes"),
    true
  );
  for (const zone of DENALI_LOCATION_ZONE_PATHS) {
    pushRow(
      logisticsRows,
      labels.locationZoneLabel(zone.path),
      formatLocation(getCanonicalValue(draft, zone.path))
    );
  }
  const gatheringPoints = parseDenaliGatheringPoints(getCanonicalValue(draft, "gatheringPoints"));
  for (const point of gatheringPoints) {
    const name = point.name?.trim() ?? "";
    const address = point.address?.trim() ?? "";
    if (name.length === 0 && address.length === 0) {
      continue;
    }
    pushRow(
      logisticsRows,
      labels.fieldLabel("gatheringPoints"),
      [name, address, point.isPrimary ? labels.primaryGathering : ""].filter(Boolean).join(" — ")
    );
  }
  const included = parseStringArray(getCanonicalValue(draft, "tripDetails.logistics.includedServices"));
  const excluded = parseStringArray(getCanonicalValue(draft, "tripDetails.logistics.excludedServices"));
  const customLabels = parseStringArray(
    getCanonicalValue(draft, "tripDetails.overview.customServiceLabels")
  );
  const gear = parseDenaliGearItems(getCanonicalValue(draft, "participants.gearItems"));
  if (
    logisticsRows.length > 0 ||
    included.length > 0 ||
    excluded.length > 0 ||
    customLabels.length > 0 ||
    gear.length > 0
  ) {
    sections.push({
      stepId: "denali_logistics",
      title: labels.stepLabel("denali_logistics"),
      rows: logisticsRows,
      chips: [...included, ...customLabels],
      cards: [
        ...gear.map((item) => ({
          title: item.name,
          meta: item.isRequired ? labels.gearRequired : labels.gearOptional,
        })),
        ...excluded.map((service) => ({
          title: service,
          meta: labels.fieldLabel("tripDetails.logistics.excludedServices"),
          variant: "self" as const,
        })),
      ],
    });
  }

  const pricingRows: DenaliReviewRow[] = [];
  pushRow(
    pricingRows,
    labels.fieldLabel("pricing.requiresPayment"),
    boolLabel(getCanonicalStringValue(draft, "pricing.requiresPayment"), labels)
  );
  pushRow(
    pricingRows,
    labels.fieldLabel("participants.minimumAge"),
    getCanonicalStringValue(draft, "participants.minimumAge")
  );
  pushRow(
    pricingRows,
    labels.fieldLabel("participants.minRequiredPeaks"),
    getCanonicalStringValue(draft, "participants.minRequiredPeaks")
  );
  pushRow(
    pricingRows,
    labels.fieldLabel("participants.nationalIdRequired"),
    boolLabel(getCanonicalStringValue(draft, "participants.nationalIdRequired"), labels)
  );
  if (pricingRows.length > 0) {
    sections.push({
      stepId: "denali_pricing",
      title: labels.stepLabel("denali_pricing"),
      rows: pricingRows,
    });
  }

  const legalRows: DenaliReviewRow[] = [];
  pushRow(
    legalRows,
    labels.fieldLabel("policies.policiesText"),
    getCanonicalStringValue(draft, "policies.policiesText"),
    true
  );
  pushRow(
    legalRows,
    labels.fieldLabel("policies.cancellationDeadlineHours"),
    getCanonicalStringValue(draft, "policies.cancellationDeadlineHours")
  );
  pushRow(
    legalRows,
    labels.fieldLabel("policies.cancellationPenaltyPercentage"),
    getCanonicalStringValue(draft, "policies.cancellationPenaltyPercentage")
  );
  if (legalRows.length > 0) {
    sections.push({
      stepId: "denali_legal",
      title: labels.stepLabel("denali_legal"),
      rows: legalRows,
    });
  }

  return sections;
}

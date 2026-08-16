import type { RenderStepPlan } from "@app-tour/platform-core";

import type { DenaliTourKind } from "../../types/legacy/repo-types";
import { readDenaliCanonicalBasics } from "../../adapters/denaliCanonicalBasicsControl";
import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../../composites/denali-composite-anchors";
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

import { isDenaliWizardFieldVisibleOnDraft } from "../../wizard/denali-wizard-field-visibility";
import type { DenaliCreateWizardStepId } from "../../layout/stepIds";
import type { DenaliRuleFieldStep } from "../../rules/denaliRuleModel";

import { parseStringArray } from "./denali-array-field-utils";
import { parseDenaliGearItems, type DenaliGearItem } from "./denali-gear-types";
import {
  DENALI_LOCATION_ZONE_PATHS,
  denaliLocationZoneOverviewPath,
  parseDenaliLocationData,
  resolveDenaliGatheringPointsFromStorage,
  resolveDenaliLocationZoneFromStorage,
} from "./denali-location-types";
import { parseDenaliTourPhotos, type DenaliTourPhoto } from "./denali-photo-types";
import { formatSocialMediaLinkForReview } from "./denali-social-media-link-logic";

export type DenaliReviewCatalog = {
  readonly destinationNameById: ReadonlyMap<string, string>;
  readonly leaderNameById: ReadonlyMap<string, string>;
  readonly themeNameById: ReadonlyMap<string, string>;
  readonly languageNameById: ReadonlyMap<string, string>;
  readonly equipmentIconKeyById: ReadonlyMap<string, string | null>;
};

export type DenaliReviewRow = {
  readonly canonicalPath?: string;
  readonly label: string;
  readonly value: string;
  readonly multiline?: boolean;
  /** ED-EMPTY-OPT-01 — operator skip / empty optional catalog field. */
  readonly emptyOptional?: boolean;
};

export type DenaliReviewCard = {
  readonly kind?: "text" | "itinerary" | "excluded";
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
  /** Read-only tour photos for `denali_photos` (visual grid — not text cards). */
  readonly photos?: readonly DenaliTourPhoto[];
  /** Compact gear list for `denali_logistics`. */
  readonly gearItems?: readonly DenaliGearItem[];
};

export type DenaliReviewHero = {
  readonly title: string;
  readonly categoryLabel: string;
  readonly destination: string;
  readonly schedule: string;
  readonly coverPhoto?: DenaliTourPhoto;
};

export type DenaliReviewFormatLabels = {
  readonly fieldLabel: (canonicalPath: string) => string;
  readonly stepLabel: (stepId: string) => string;
  readonly tourKindLabel: (slug: string) => string;
  readonly transportModeLabel: (mode: string) => string;
  readonly fitnessLevelLabel: (level: string) => string;
  readonly publishStatusLabel: (status: string) => string;
  readonly locationZoneLabel: (path: string) => string;
  /** Display-only — canonical storage stays ISO (INV-DENALI-REVIEW-01). */
  readonly formatDatetime: (iso: string) => string;
  readonly yes: string;
  readonly no: string;
  readonly gearRequired: string;
  readonly gearOptional: string;
  readonly photoCount: (count: number) => string;
  readonly dayLabel: (day: number) => string;
  readonly primaryGathering: string;
  readonly socialMediaTelegramAutoLabel: string;
  /** ED-EMPTY-OPT-01 — review value when an optional catalog field was skipped. */
  readonly optionalEmptyValue: string;
};

function pushRow(
  rows: DenaliReviewRow[],
  canonicalPath: string,
  label: string,
  value: string,
  multiline = false
): void {
  if ((value ?? "").trim().length === 0) {
    return;
  }
  rows.push({
    canonicalPath,
    label,
    value,
    ...(multiline ? { multiline: true } : {}),
  });
}

function pushOptionalEmptyRow(
  rows: DenaliReviewRow[],
  canonicalPath: string,
  label: string,
  value: string
): void {
  rows.push({
    canonicalPath,
    label,
    value,
    emptyOptional: true,
  });
}

function pushRowWhenFieldVisible(
  draft: DenaliTourWizardDraft,
  rows: DenaliReviewRow[],
  labels: DenaliReviewFormatLabels,
  canonicalPath: string,
  stepId: DenaliRuleFieldStep | DenaliCreateWizardStepId,
  value: string,
  multiline = false
): void {
  if (!isDenaliWizardFieldVisibleOnDraft(draft, canonicalPath, stepId)) {
    return;
  }
  pushRow(rows, canonicalPath, labels.fieldLabel(canonicalPath), value, multiline);
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

/** RFC 4122 UUID (any version) — review must never echo these when the catalog miss. */
const DENALI_REVIEW_OPAQUE_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isDenaliReviewOpaqueCatalogId(value: string): boolean {
  return DENALI_REVIEW_OPAQUE_ID.test(value.trim());
}

/**
 * ED-REV-UUID-01 / INV-DENALI-REVIEW-02 — catalog display name for an id.
 * Loading or miss + UUID → empty (caller skips the row). Non-UUID slugs may pass through.
 */
export function resolveDenaliReviewCatalogName(
  id: string,
  catalog: ReadonlyMap<string, string>
): string {
  const trimmed = id.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const named = catalog.get(trimmed);
  if (named != null && named.trim().length > 0) {
    return named.trim();
  }
  if (isDenaliReviewOpaqueCatalogId(trimmed)) {
    return "";
  }
  return trimmed;
}

function mapIds(ids: readonly string[], catalog: ReadonlyMap<string, string>): string {
  return ids
    .map((id) => resolveDenaliReviewCatalogName(id, catalog))
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

function resolveDenaliReviewCoverPhoto(draft: DenaliTourWizardDraft): DenaliTourPhoto | undefined {
  const photos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));
  if (photos.length === 0) {
    return undefined;
  }
  const withAsset = photos.find(
    (photo) => (photo.url?.trim().length ?? 0) > 0 || (photo.storageKey?.trim().length ?? 0) > 0
  );
  return withAsset ?? photos[0];
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
  const scheduleParts = [startDateTime, endDateTime]
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => labels.formatDatetime(part))
    .filter((part) => part.trim().length > 0);

  return {
    title,
    categoryLabel:
      category.trim().length > 0 ? labels.tourKindLabel(category) : "",
    destination: resolveDenaliReviewCatalogName(destinationId, catalog.destinationNameById),
    schedule: scheduleParts.join(" → "),
    coverPhoto: resolveDenaliReviewCoverPhoto(draft),
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
    pushRow(basicRows, "category", labels.fieldLabel("category"), labels.tourKindLabel(category));
  }
  pushRow(basicRows, "title", labels.fieldLabel("title"), getCanonicalStringValue(draft, "title"));
  pushRow(
    basicRows,
    "destinationId",
    labels.fieldLabel("destinationId"),
    resolveDenaliReviewCatalogName(
      getCanonicalStringValue(draft, "destinationId"),
      catalog.destinationNameById
    )
  );
  pushRowWhenFieldVisible(
    draft,
    basicRows,
    labels,
    "tripDetails.overview.peakHeight",
    "denali_basic",
    getCanonicalStringValue(draft, "tripDetails.overview.peakHeight")
  );
  pushRowWhenFieldVisible(
    draft,
    basicRows,
    labels,
    "tripDetails.overview.trailDistanceKm",
    "denali_basic",
    getCanonicalStringValue(draft, "tripDetails.overview.trailDistanceKm")
  );
  pushRow(
    basicRows,
    "startDateTime",
    labels.fieldLabel("startDateTime"),
    labels.formatDatetime(getCanonicalStringValue(draft, "startDateTime"))
  );
  pushRow(
    basicRows,
    "endDateTime",
    labels.fieldLabel("endDateTime"),
    labels.formatDatetime(getCanonicalStringValue(draft, "endDateTime"))
  );
  pushRow(
    basicRows,
    "approximateReturnTime",
    labels.fieldLabel("approximateReturnTime"),
    getCanonicalStringValue(draft, "approximateReturnTime")
  );
  pushRow(basicRows, "capacityMax", labels.fieldLabel("capacityMax"), getCanonicalStringValue(draft, "capacityMax"));
  pushRow(basicRows, "capacityMin", labels.fieldLabel("capacityMin"), getCanonicalStringValue(draft, "capacityMin"));
  const leaderIds = parseStringArray(getCanonicalValue(draft, "leaderUserIds"));
  pushRow(basicRows, "leaderUserIds", labels.fieldLabel("leaderUserIds"), mapIds(leaderIds, catalog.leaderNameById));
  pushRow(
    basicRows,
    "requiresLocalGuide",
    labels.fieldLabel("requiresLocalGuide"),
    boolLabel(getCanonicalStringValue(draft, "requiresLocalGuide"), labels)
  );
  pushRow(basicRows, "localGuideName", labels.fieldLabel("localGuideName"), getCanonicalStringValue(draft, "localGuideName"));
  pushRow(
    basicRows,
    "requiresManualAdminApproval",
    labels.fieldLabel("requiresManualAdminApproval"),
    boolLabel(getCanonicalStringValue(draft, "requiresManualAdminApproval"), labels)
  );
  pushRow(
    basicRows,
    "socialMediaLink",
    labels.fieldLabel("socialMediaLink"),
    formatSocialMediaLinkForReview(
      getCanonicalStringValue(draft, "socialMediaLink"),
      labels.socialMediaTelegramAutoLabel
    )
  );
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
  pushRow(photoRows, "program.themeIds", labels.fieldLabel("program.themeIds"), themeNames);
  pushRow(
    photoRows,
    "program.shortDescription",
    labels.fieldLabel("program.shortDescription"),
    getCanonicalStringValue(draft, "program.shortDescription"),
    true
  );
  pushRowWhenFieldVisible(
    draft,
    photoRows,
    labels,
    "program.longDescription",
    "denali_photos",
    getCanonicalStringValue(draft, "program.longDescription"),
    true
  );
  const photos = parseDenaliTourPhotos(getCanonicalValue(draft, "photos"));
  if (photos.length === 0) {
    pushOptionalEmptyRow(
      photoRows,
      "photos",
      labels.fieldLabel("photos"),
      labels.optionalEmptyValue
    );
  } else {
    pushRow(photoRows, "photos", labels.fieldLabel("photos"), labels.photoCount(photos.length));
  }
  if (photoRows.length > 0 || photos.length > 0) {
    sections.push({
      stepId: "denali_photos",
      title: labels.stepLabel("denali_photos"),
      rows: photoRows,
      photos,
    });
  }

  const programRows: DenaliReviewRow[] = [];
  const languageIds = parseStringArray(getCanonicalValue(draft, "program.guideLanguageIds"));
  if (languageIds.length === 0) {
    pushOptionalEmptyRow(
      programRows,
      "program.guideLanguageIds",
      labels.fieldLabel("program.guideLanguageIds"),
      labels.optionalEmptyValue
    );
  } else {
    pushRow(
      programRows,
      "program.guideLanguageIds",
      labels.fieldLabel("program.guideLanguageIds"),
      mapIds(languageIds, catalog.languageNameById)
    );
  }
  pushRow(
    programRows,
    "program.difficultyLevel",
    labels.fieldLabel("program.difficultyLevel"),
    getCanonicalStringValue(draft, "program.difficultyLevel")
  );
  pushRowWhenFieldVisible(
    draft,
    programRows,
    labels,
    "program.hikingHoursApprox",
    "denali_program",
    getCanonicalStringValue(draft, "program.hikingHoursApprox")
  );
  pushRowWhenFieldVisible(
    draft,
    programRows,
    labels,
    "program.hikingGoHours",
    "denali_program",
    getCanonicalStringValue(draft, "program.hikingGoHours")
  );
  pushRowWhenFieldVisible(
    draft,
    programRows,
    labels,
    "program.hikingReturnHours",
    "denali_program",
    getCanonicalStringValue(draft, "program.hikingReturnHours")
  );
  pushRowWhenFieldVisible(
    draft,
    programRows,
    labels,
    "tripDetails.metrics.elevationGain",
    "denali_program",
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
                const destinationName = resolveDenaliReviewCatalogName(
                  segment.destinationId.trim(),
                  catalog.destinationNameById
                );
                if (destinationName.length > 0) {
                  parts.push(`@ ${destinationName}`);
                }
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
            kind: "itinerary" as const,
          };
        }),
    });
  }

  const logisticsRows: DenaliReviewRow[] = [];
  const transportMode = getCanonicalStringValue(draft, "transport.mode");
  pushRow(
    logisticsRows,
    "transport.mode",
    labels.fieldLabel("transport.mode"),
    transportMode.trim().length > 0 ? labels.transportModeLabel(transportMode) : ""
  );
  pushRow(
    logisticsRows,
    "transport.transportCost",
    labels.fieldLabel("transport.transportCost"),
    getCanonicalStringValue(draft, "transport.transportCost")
  );
  pushRow(
    logisticsRows,
    "transport.dongAmount",
    labels.fieldLabel("transport.dongAmount"),
    getCanonicalStringValue(draft, "transport.dongAmount")
  );
  pushRow(
    logisticsRows,
    "transport.transportNotes",
    labels.fieldLabel("transport.transportNotes"),
    getCanonicalStringValue(draft, "transport.transportNotes"),
    true
  );
  for (const zone of DENALI_LOCATION_ZONE_PATHS) {
    pushRow(
      logisticsRows,
      zone.path,
      labels.locationZoneLabel(zone.path),
      formatLocation(
        resolveDenaliLocationZoneFromStorage(
          getCanonicalValue(draft, zone.path),
          getCanonicalValue(draft, denaliLocationZoneOverviewPath(zone.path))
        )
      )
    );
  }
  const gatheringPoints = resolveDenaliGatheringPointsFromStorage(
    getCanonicalValue(draft, "gatheringPoints"),
    getCanonicalValue(draft, "tripDetails.logistics.gatheringPoints")
  );
  for (const point of gatheringPoints) {
    const name = point.name?.trim() ?? "";
    const address = point.address?.trim() ?? "";
    if (name.length === 0 && address.length === 0) {
      continue;
    }
    pushRow(
      logisticsRows,
      "gatheringPoints",
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
  if (gear.length === 0) {
    pushOptionalEmptyRow(
      logisticsRows,
      "participants.gearItems",
      labels.fieldLabel("participants.gearItems"),
      labels.optionalEmptyValue
    );
  }
  if (included.length === 0 && excluded.length === 0 && customLabels.length === 0) {
    pushOptionalEmptyRow(
      logisticsRows,
      "tripDetails.logistics.includedServices",
      labels.fieldLabel("tripDetails.logistics.includedServices"),
      labels.optionalEmptyValue
    );
  }
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
      gearItems: gear,
      cards: excluded.map((service) => ({
        kind: "excluded" as const,
        title: service,
        meta: labels.fieldLabel("tripDetails.logistics.excludedServices"),
        variant: "self" as const,
      })),
    });
  }

  const pricingRows: DenaliReviewRow[] = [];
  pushRow(
    pricingRows,
    "pricing.requiresPayment",
    labels.fieldLabel("pricing.requiresPayment"),
    boolLabel(getCanonicalStringValue(draft, "pricing.requiresPayment"), labels)
  );
  pushRow(
    pricingRows,
    "pricing.prepaymentEnabled",
    labels.fieldLabel("pricing.prepaymentEnabled"),
    boolLabel(getCanonicalStringValue(draft, "pricing.prepaymentEnabled"), labels)
  );
  pushRow(
    pricingRows,
    "pricing.prepaymentPercent",
    labels.fieldLabel("pricing.prepaymentPercent"),
    getCanonicalStringValue(draft, "pricing.prepaymentPercent")
  );
  pushRow(
    pricingRows,
    "pricing.basePricePerPerson",
    labels.fieldLabel("pricing.basePricePerPerson"),
    getCanonicalStringValue(draft, "pricing.basePricePerPerson")
  );
  pushRow(
    pricingRows,
    "participants.minimumAge",
    labels.fieldLabel("participants.minimumAge"),
    getCanonicalStringValue(draft, "participants.minimumAge")
  );
  pushRowWhenFieldVisible(
    draft,
    pricingRows,
    labels,
    "participants.maximumAge",
    "denali_pricing",
    getCanonicalStringValue(draft, "participants.maximumAge")
  );
  pushRowWhenFieldVisible(
    draft,
    pricingRows,
    labels,
    "participants.fitnessLevel",
    "denali_pricing",
    labels.fitnessLevelLabel(getCanonicalStringValue(draft, "participants.fitnessLevel"))
  );
  pushRow(
    pricingRows,
    "participants.minRequiredPeaks",
    labels.fieldLabel("participants.minRequiredPeaks"),
    getCanonicalStringValue(draft, "participants.minRequiredPeaks")
  );
  pushRow(
    pricingRows,
    "participants.nationalIdRequired",
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
    "policies.policiesText",
    labels.fieldLabel("policies.policiesText"),
    getCanonicalStringValue(draft, "policies.policiesText"),
    true
  );
  pushRow(
    legalRows,
    "policies.cancellationDeadlineHours",
    labels.fieldLabel("policies.cancellationDeadlineHours"),
    getCanonicalStringValue(draft, "policies.cancellationDeadlineHours")
  );
  pushRow(
    legalRows,
    "policies.cancellationPenaltyPercentage",
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

const CATEGORY_REVIEW_DEPENDENTS = ["duration", "eventVariant"] as const;

const START_POINT_REVIEW_DEPENDENTS = ["summitPoint", "campPoint", "endPoint"] as const;

function resolveCompositeDependentsForAnchor(anchor: string): readonly string[] {
  const listed = DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[anchor];
  if (listed != null) {
    return listed;
  }
  // Ghost aliases / location shells — not step-nav expand targets.
  if (anchor === "category") {
    return CATEGORY_REVIEW_DEPENDENTS;
  }
  if (anchor === "startPoint") {
    return START_POINT_REVIEW_DEPENDENTS;
  }
  return [];
}

/** Expand visible render-plan fields to include composite dependents (INV-WIZ-002). */
export function expandDenaliReviewVisibleCanonicalPaths(
  contentSteps: readonly RenderStepPlan[]
): ReadonlySet<string> {
  const paths = new Set<string>();
  for (const step of contentSteps) {
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      paths.add(field.canonicalPath);
      for (const dependent of resolveCompositeDependentsForAnchor(field.canonicalPath)) {
        paths.add(dependent);
      }
    }
  }
  return paths;
}

function filterDenaliReviewSectionByVisiblePaths(
  section: DenaliReviewSection,
  visiblePaths: ReadonlySet<string>
): DenaliReviewSection | null {
  const rows = section.rows.filter(
    (row) => row.canonicalPath == null || visiblePaths.has(row.canonicalPath)
  );

  let chips = section.chips;
  let cards = section.cards;
  let photos = section.photos;
  let gearItems = section.gearItems;

  if (section.stepId === "denali_photos" && !visiblePaths.has("photos")) {
    photos = undefined;
  }
  if (section.stepId === "denali_program" && !visiblePaths.has("program.itinerary")) {
    cards = cards?.filter((card) => card.kind !== "itinerary");
  }
  if (section.stepId === "denali_logistics") {
    if (
      !visiblePaths.has("tripDetails.logistics.includedServices") &&
      !visiblePaths.has("tripDetails.overview.customServiceLabels")
    ) {
      chips = undefined;
    }
    if (!visiblePaths.has("participants.gearItems")) {
      gearItems = undefined;
    }
    if (!visiblePaths.has("tripDetails.logistics.excludedServices")) {
      cards = cards?.filter((card) => card.kind !== "excluded" && card.variant !== "self");
    }
    if (cards != null && cards.length === 0) {
      cards = undefined;
    }
  }

  const hasBody =
    rows.length > 0 ||
    (chips?.length ?? 0) > 0 ||
    (cards?.length ?? 0) > 0 ||
    (photos?.length ?? 0) > 0 ||
    (gearItems?.length ?? 0) > 0;
  if (!hasBody) {
    return null;
  }

  return {
    ...section,
    rows,
    ...(chips != null ? { chips } : {}),
    ...(cards != null ? { cards } : {}),
    ...(photos != null ? { photos } : {}),
    ...(gearItems != null ? { gearItems } : {}),
  };
}

/**
 * Template-driven review sections — only steps and fields present in `contentSteps`.
 * `contentSteps` must exclude the injected review step (host passes visibleSteps − review).
 */
export function buildDenaliReviewSectionsFromVisibleSteps(
  draft: DenaliTourWizardDraft,
  contentSteps: readonly RenderStepPlan[],
  catalog: DenaliReviewCatalog,
  labels: DenaliReviewFormatLabels
): readonly DenaliReviewSection[] {
  const allowedStepIds = new Set(contentSteps.map((step) => step.stepId));
  const visiblePaths = expandDenaliReviewVisibleCanonicalPaths(contentSteps);
  const sections = buildDenaliReviewSections(draft, catalog, labels);
  const filtered: DenaliReviewSection[] = [];

  for (const section of sections) {
    if (!allowedStepIds.has(section.stepId)) {
      continue;
    }
    const next = filterDenaliReviewSectionByVisiblePaths(section, visiblePaths);
    if (next != null) {
      filtered.push(next);
    }
  }

  return filtered;
}

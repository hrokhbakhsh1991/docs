"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";

import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";

import { parseIsoToYmdAndTime } from "../denaliDatetime";
import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { splitGearByRequired } from "../denaliGearSelection";
import { logDenaliWizardDiagnosticReport } from "../denaliWizardDiagnostic";
import { TourPublishStatusField } from "@/components/tours/TourPublishStatusField";
import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";
import { denaliLocationAddressText } from "@repo/types/denali";

import { useDenaliCanonicalModel } from "../hooks/useDenaliCanonicalModel";
import { getDenaliWizardSubmitIssues } from "../validation/denaliWizardFormZod";
import { useDenaliWizardFormSnapshot } from "../hooks/useDenaliWizardFormSnapshot";
import { getDenaliStepTitleFa } from "@/features/tours/wizard/denaliStepConfig";
import { DenaliReviewParticipantsDisplay } from "./DenaliReviewParticipantsDisplay";
import { DenaliReviewValidationSummary } from "../components/DenaliReviewValidationSummary";
import { useWizardStateGuard } from "../hooks/useWizardStateGuard";
import {
  denaliCanonicalOptionalTrimmedString,
  sanitizeDenaliCanonicalModel,
} from "../denaliCanonicalSchemaRegistry";

function ReviewSection({
  title,
  testId,
  children,
}: {
  title: string;
  testId: string;
  children: ReactNode;
}) {
  return (
    <section data-testid={`denali-review-section-${testId}`} style={{ display: "grid", gap: "0.5rem" }}>
      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>{title}</h3>
      <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>{children}</dl>
    </section>
  );
}

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt style={{ fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: "0.15rem 0 0" }}>{value}</dd>
    </div>
  );
}

function GearReviewLists({
  requiredNames,
  optionalNames,
  requiredTitle,
  optionalTitle,
}: {
  requiredNames: string[];
  optionalNames: string[];
  requiredTitle: string;
  optionalTitle: string;
}) {
  if (requiredNames.length === 0 && optionalNames.length === 0) return null;

  const pillContainerStyle: React.CSSProperties = {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
    marginTop: "0.25rem",
  };

  const pillStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "0.15rem 0.6rem",
    borderRadius: "9999px",
    fontSize: "0.75rem",
    fontWeight: 500,
    border: "1px solid",
  };

  return (
    <>
      {requiredNames.length > 0 ? (
        <div data-testid="denali-review-gear-required">
          <dt style={{ fontWeight: 600 }}>{requiredTitle}</dt>
          <dd style={pillContainerStyle}>
            {requiredNames.map((name, index) => (
              <span
                key={`required-${name}-${index}`}
                style={{
                  ...pillStyle,
                  backgroundColor: "var(--color-danger-50, #fef2f2)",
                  color: "var(--color-danger-700, #b91c1c)",
                  borderColor: "var(--color-danger-200, #fecaca)",
                }}
              >
                🚨 {name}
              </span>
            ))}
          </dd>
        </div>
      ) : null}
      {optionalNames.length > 0 ? (
        <div data-testid="denali-review-gear-optional">
          <dt style={{ fontWeight: 600 }}>{optionalTitle}</dt>
          <dd style={pillContainerStyle}>
            {optionalNames.map((name, index) => (
              <span
                key={`optional-${name}-${index}`}
                style={{
                  ...pillStyle,
                  backgroundColor: "var(--color-primary-50, #eff6ff)",
                  color: "var(--color-primary-700, #1d4ed8)",
                  borderColor: "var(--color-primary-200, #bfdbfe)",
                }}
              >
                🎒 {name}
              </span>
            ))}
          </dd>
        </div>
      ) : null}
    </>
  );
}

function formatScheduleLine(iso: string | undefined): string | undefined {
  if (!iso?.trim()) return undefined;
  const { ymd, time } = parseIsoToYmdAndTime(iso);
  if (!ymd) return undefined;
  return time ? `${ymd} ${time}` : ymd;
}

export function DenaliReviewStep() {
  const t = useTranslations("tours.denali");
  const { getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const formForUi = useDenaliWizardFormSnapshot();

  const { basicsSelection, ruleSet } = useDenaliCanonical();
  const canonicalModelRaw = useDenaliCanonicalModel();
  const canonicalModel = useMemo(
    () => sanitizeDenaliCanonicalModel(canonicalModelRaw),
    [canonicalModelRaw],
  );
  const {
    title,
    destinationId,
    capacityMax,
    capacityMin,
    leaderUserIds,
    requiresLocalGuide,
    localGuideName,
    startPointLocationText,
    socialMediaLink,
    startDateTime,
    endDateTime,
    approximateReturnTime,
    requiresManualAdminApproval,
    gatheringPoints,
    startPoint,
    overview,
    metrics,
    program,
    transport,
    pricing,
    participants,
    policies,
    photos,
  } = canonicalModel;
  const { isVisible: isReviewFieldVisible, arePathsVisible: areReviewPathsVisible } =
    useDenaliStepFieldRules("review");

  const {
    publishStatus,
    publishIssues,
    publishReadinessBlocked,
    disableActivePublish,
    requestStatus,
    enforceSafeStatus,
  } = useWizardStateGuard({ disableActiveWhileNotReady: true });
  const equipmentQuery = useSettingsEquipment();
  const diagnosticLoggedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const submitIssues = getDenaliWizardSubmitIssues(formForUi, undefined, ruleSet);
    console.log("[DenaliReviewStep] getDenaliWizardSubmitIssues", {
      count: submitIssues.length,
      issues: submitIssues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
        code: issue.code,
      })),
    });
  }, [formForUi, ruleSet]);

  useEffect(() => {
    if (diagnosticLoggedRef.current) return;
    if (equipmentQuery.isLoading) return;
    diagnosticLoggedRef.current = true;
    logDenaliWizardDiagnosticReport({
      form: getValues(),
      activeEquipment: equipmentQuery.data,
      source: "review-step-mount",
    });
  }, [equipmentQuery.data, equipmentQuery.isLoading, getValues]);

  useEffect(() => {
    enforceSafeStatus();
  }, [enforceSafeStatus]);

  const showOutdoorProgram = areReviewPathsVisible(
    ["program.difficultyLevel", "program.hikingHoursApprox"],
    formForUi,
  );
  const showEventVariant = isReviewFieldVisible("eventVariant", formForUi);

  const themesQuery = useSettingsTourThemes();
  const themeLabels = useMemo(() => {
    const seen = new Set<string>();
    const ids = (program.themeIds ?? []).filter((id) => {
      const trimmed = id?.trim();
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    if (ids.length === 0) return undefined;
    const names = ids
      .map((id) => themesQuery.data?.find((row) => row.id === id)?.name ?? id)
      .filter(Boolean);
    return names.length > 0 ? names.join("، ") : undefined;
  }, [program.themeIds, themesQuery.data]);

  const destinationsQuery = useTourDestinations();
  const destinationLabel = useMemo(() => {
    const id = destinationId?.trim();
    if (!id) return undefined;
    for (const group of destinationsQuery.groupedRegions) {
      const hit = group.items.find((item) => item.id === id);
      if (hit) {
        return group.regionName ? `${hit.name} (${group.regionName})` : hit.name;
      }
    }
    return id;
  }, [destinationId, destinationsQuery.groupedRegions]);

  const categoryLabel = basicsSelection ? t(`basic.categories.${basicsSelection.category}`) : "";
  const durationLabel = basicsSelection ? t(`basic.durations.${basicsSelection.duration}`) : "";
  const eventLabel =
    basicsSelection?.eventVariant != null
      ? t(`basic.eventVariants.${basicsSelection.eventVariant}`)
      : undefined;

  const capacitySummary = useMemo(() => {
    const max = capacityMax;
    const min = capacityMin;
    if (max == null && min == null) return undefined;
    if (min != null && max != null) return `${min} – ${max}`;
    if (max != null) return String(max);
    return min != null ? String(min) : undefined;
  }, [capacityMax, capacityMin]);

  const crewMembersQuery = useWorkspaceTourCrewMembers();

  const workspaceLeaderLabels = useMemo(() => {
    const seen = new Set<string>();
    const ids = (leaderUserIds ?? []).filter((id) => {
      const trimmed = id?.trim();
      if (!trimmed || seen.has(trimmed)) return false;
      seen.add(trimmed);
      return true;
    });
    if (ids.length === 0) return undefined;
    return ids
      .map((id) => {
        const hit = crewMembersQuery.data?.find((m) => m.id === id);
        return hit?.name?.trim() || hit?.email || hit?.phone || id;
      })
      .filter(Boolean)
      .join("، ");
  }, [leaderUserIds, crewMembersQuery.data]);

  const { requiredGearNames, optionalGearNames } = useMemo(() => {
    const nameForId = (id: string) =>
      equipmentQuery.data?.find((eq) => eq.id === id)?.name ?? id;
    const { required, optional } = splitGearByRequired(participants.gearItems);
    return {
      requiredGearNames: required.map((row) => nameForId(row.id)).filter(Boolean),
      optionalGearNames: optional.map((row) => nameForId(row.id)).filter(Boolean),
    };
  }, [participants.gearItems, equipmentQuery.data]);

  const gatheringPointsForReview = useMemo(() => {
    const seen = new Set<string>();
    return (gatheringPoints ?? []).filter((station) => {
      const id = station.id?.trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [gatheringPoints]);

  return (
    <div style={{ display: "grid", gap: "0.85rem", fontSize: "0.9rem" }} data-testid="denali-step-review">
      <DenaliReviewValidationSummary />

      <p style={{ margin: 0, color: "#64748b" }}>{t("review.intro")}</p>

      {publishIssues.length > 0 ? (
        <div
          role="alert"
          style={{
            padding: "1rem",
            background: "#fffbeb",
            color: "#92400e",
            border: "1px solid #fcd34d",
            borderRadius: "8px",
          }}
          data-testid="denali-review-publish-readiness-warning"
        >
          <p style={{ fontWeight: 600, margin: "0 0 0.5rem" }}>
            {t("review.publishDraftOnlyWarning")}
          </p>
          <ul style={{ margin: 0, paddingRight: "1.25rem" }}>
            {publishIssues.map((issue, index) => (
              <li key={`${issue.code}-${issue.path ?? issue.message}-${index}`}>
                {issue.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <TourPublishStatusField
        value={publishStatus === "active" ? "active" : "draft"}
        onChange={(next: TourFormLifecycleStatus) => {
          requestStatus(next);
        }}
        disableValues={disableActivePublish ? (["active"] as const) : undefined}
        data-testid="denali-review-publish-status"
      />

      <ReviewSection title={getDenaliStepTitleFa("denali_basic")} testId="basic">
        <ReviewRow label={t("basic.title")} value={title} />
        <ReviewRow label={t("basic.categoryLabel")} value={categoryLabel} />
        <ReviewRow label={t("basic.durationLabel")} value={durationLabel} />
        {showEventVariant ? (
          <ReviewRow label={t("basic.eventVariantLabel")} value={eventLabel} />
        ) : null}
        <ReviewRow label={t("basic.destination")} value={destinationLabel} />
        {isReviewFieldVisible("tripDetails.overview.peakHeight", formForUi) ? (
          <ReviewRow
            label={t("basic.peakHeight")}
            value={overview?.peakHeight != null ? String(overview.peakHeight) : undefined}
          />
        ) : null}
        <ReviewRow label={t("basic.workspaceLeaders")} value={workspaceLeaderLabels} />
        <ReviewRow
          label={t("basic.requiresLocalGuide")}
          value={
            requiresLocalGuide === true ? t("review.yes") : t("review.no")
          }
        />
        {requiresLocalGuide === true ? (
          <ReviewRow label={t("basic.localGuideName")} value={localGuideName?.trim()} />
        ) : null}
        <ReviewRow
          label={t("basic.startPointLocationText")}
          value={startPointLocationText}
        />
        <ReviewRow label="لینک شبکه اجتماعی" value={socialMediaLink} />
        <ReviewRow
          label={t("basic.startDateTime")}
          value={formatScheduleLine(startDateTime)}
        />
        {endDateTime ? (
          <ReviewRow
            label={t("basic.endDateTime")}
            value={formatScheduleLine(endDateTime)}
          />
        ) : null}
        <ReviewRow
          label={t("basic.approximateReturnTime")}
          value={approximateReturnTime}
        />
        <ReviewRow label={t("review.capacity")} value={capacitySummary} />
        <ReviewRow
          label={t("basic.requiresManualAdminApproval")}
          value={requiresManualAdminApproval === true ? t("review.yes") : t("review.no")}
        />
      </ReviewSection>

      <ReviewSection title={getDenaliStepTitleFa("denali_photos")} testId="photos">
        <ReviewRow label={t("program.themesLabel")} value={themeLabels} />
        <ReviewRow label={t("program.shortDescription")} value={program.shortDescription} />
        <ReviewRow label={t("program.longDescription")} value={program.longDescription} />
        <ReviewRow
          label="گالری عکس"
          value={
            (photos?.length ?? 0) > 0
              ? `${photos!.length} عکس`
              : undefined
          }
        />
      </ReviewSection>

      <ReviewSection title={getDenaliStepTitleFa("denali_program")} testId="program">
        {showOutdoorProgram ? (
          <>
            <ReviewRow
              label={t("program.difficultyLevel")}
              value={
                program.difficultyLevel != null
                  ? String(program.difficultyLevel)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingHours")}
              value={
                program.hikingHoursApprox != null
                  ? String(program.hikingHoursApprox)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingGoHours")}
              value={
                program.hikingGoHours != null
                  ? String(program.hikingGoHours)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingReturnHours")}
              value={
                program.hikingReturnHours != null
                  ? String(program.hikingReturnHours)
                  : undefined
              }
            />
            {isReviewFieldVisible("tripDetails.metrics.elevationGain", formForUi) ? (
              <ReviewRow
                label={t("program.elevationGain")}
                value={
                  metrics?.elevationGain != null ? String(metrics.elevationGain) : undefined
                }
              />
            ) : null}
          </>
        ) : null}
        {isReviewFieldVisible("program.itinerary", formForUi) &&
        (program.itinerary?.length ?? 0) > 0 ? (
          <div>
            <dt style={{ fontWeight: 600 }}>{t("review.dailyItinerary")}</dt>
            <dd style={{ margin: "0.15rem 0 0", display: "grid", gap: "0.35rem" }}>
              {program.itinerary!.map((row, itineraryIndex) => (
                <div key={`itinerary-day-${row.day}-${itineraryIndex}`}>
                  <strong>{t("program.dailyActivitiesDay", { day: row.day })}</strong>
                  {denaliCanonicalOptionalTrimmedString(
                    "program.itinerary.locationText",
                    row.locationText,
                  ) || row.location?.addressText?.trim() ? (
                    <span>
                      {" "}
                      —{" "}
                      {denaliCanonicalOptionalTrimmedString(
                        "program.itinerary.locationText",
                        row.locationText,
                      ) || row.location?.addressText?.trim()}
                      {row.location?.latitude != null && row.location?.longitude != null
                        ? ` (${row.location.latitude.toFixed(4)}, ${row.location.longitude.toFixed(4)})`
                        : ""}
                    </span>
                  ) : null}
                  <div style={{ marginTop: "0.15rem" }}>{row.activities || "—"}</div>
                  {(row.photos?.length ?? 0) > 0 ? (
                    <div
                      style={{
                        display: "flex",
                        gap: "0.35rem",
                        marginTop: "0.35rem",
                        flexWrap: "wrap",
                      }}
                    >
                      {row.photos!.map((photo, photoIndex) =>
                        photo.url?.trim() ? (
                          <img
                            key={`${photo.id ?? "photo"}-${photoIndex}`}
                            src={photo.url}
                            alt=""
                            style={{
                              width: 48,
                              height: 48,
                              objectFit: "cover",
                              borderRadius: 4,
                            }}
                          />
                        ) : null,
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </dd>
          </div>
        ) : null}
      </ReviewSection>

      <ReviewSection title={getDenaliStepTitleFa("denali_logistics")} testId="logistics">
        <ReviewRow
          label={t("transport.transportModeLabel")}
          value={t(`transport.transportMode.${transport.mode}`)}
        />
        {isReviewFieldVisible("transport.transportCost", formForUi) && transport.transportCost != null ? (
          <ReviewRow
            label={t("transport.transportCost")}
            value={String(transport.transportCost)}
          />
        ) : null}
        {isReviewFieldVisible("transport.allowPersonalCar", formForUi) ? (
          <ReviewRow
            label={t("transport.allowPersonalCar")}
            value={transport.allowPersonalCar ? t("review.yes") : t("review.no")}
          />
        ) : null}
        {isReviewFieldVisible("transport.dongAmount", formForUi) ? (
          <ReviewRow
            label={t("transport.dongAmount")}
            value={String(transport.dongAmount ?? "")}
          />
        ) : null}
        {gatheringPointsForReview.map((station, index) => {
          const rowKey = `gathering-${station.id?.trim() || "row"}-${index}`;
          const label = station.title
            ? `${t("basic.locationZones.gatheringPoint")} — ${station.title}`
            : `${t("basic.locationZones.gatheringPoint")} ${index + 1}`;
          const value = [station.time?.trim(), denaliLocationAddressText(station.location)]
            .filter(Boolean)
            .join(" · ");
          return (
            <div key={rowKey}>
              <ReviewRow label={label} value={value} />
            </div>
          );
        })}
        <ReviewRow
          label={t("basic.locationZones.startPoint")}
          value={denaliLocationAddressText(startPoint)}
        />
        <GearReviewLists
          requiredNames={requiredGearNames}
          optionalNames={optionalGearNames}
          requiredTitle={t("gear.reviewRequiredTitle")}
          optionalTitle={t("gear.reviewOptionalTitle")}
        />
      </ReviewSection>

      <ReviewSection title={getDenaliStepTitleFa("denali_pricing")} testId="pricing">
        <ReviewRow
          label={t("pricing.requiresPayment")}
          value={pricing.requiresPayment === true ? t("review.yes") : t("review.no")}
        />
        {pricing.requiresPayment === true ? (
          <ReviewRow
            label={t("pricing.basePricePerPerson")}
            value={
              pricing.basePricePerPerson != null
                ? String(pricing.basePricePerPerson)
                : undefined
            }
          />
        ) : null}
        <ReviewRow
          label={t("pricing.includesTourInsurance")}
          value={pricing.includesTourInsurance === true ? t("review.yes") : t("review.no")}
        />
        {participants.minRequiredPeaks != null ? (
          <ReviewRow
            label="حداقل قله‌های صعودشده (تایید خودکار)"
            value={String(participants.minRequiredPeaks)}
          />
        ) : null}
        <ReviewRow
          label={t("participants.fitnessPrerequisite")}
          value={participants.fitnessPrerequisiteText}
        />
        {isReviewFieldVisible("policies.policiesText", formForUi) &&
        policies.policiesText?.trim() ? (
          <ReviewRow label={t("policies.notes")} value={policies.policiesText} />
        ) : null}
        {policies.cancellationDeadlineHours != null ? (
          <ReviewRow
            label={t("policies.cancellationDeadlineHours")}
            value={String(policies.cancellationDeadlineHours)}
          />
        ) : null}
        {policies.cancellationPenaltyPercentage != null ? (
          <ReviewRow
            label={t("policies.cancellationPenaltyPercentage")}
            value={`${policies.cancellationPenaltyPercentage}%`}
          />
        ) : null}
      </ReviewSection>

      <DenaliReviewParticipantsDisplay form={formForUi} />
    </div>
  );
}

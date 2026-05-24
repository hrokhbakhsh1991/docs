"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";

import { useSettingsTourThemes } from "@/hooks/use-settings-tour-themes";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useSettingsEquipment } from "@/hooks/use-settings-equipment";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";

import { flattenDenaliFormErrors } from "../flattenDenaliFormErrors";
import { parseIsoToYmdAndTime } from "../denaliDatetime";
import { useDenaliCanonical } from "../DenaliCanonicalContext";
import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { splitGearByRequired } from "../denaliGearSelection";
import { logDenaliWizardDiagnosticReport } from "../denaliWizardDiagnostic";
import { TourPublishStatusField } from "@/components/tours/TourPublishStatusField";
import type { TourFormLifecycleStatus } from "@/components/tours/tour-lifecycle";
import { denaliLocationAddressText } from "@repo/types/denali";

import { getDenaliWizardPublishReadinessIssues } from "../validation/denaliWizardPublishReadiness";
import { DenaliReviewParticipantsDisplay } from "./DenaliReviewParticipantsDisplay";

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
  const {
    control,
    getValues,
    setValue,
    formState: { errors },
  } = useFormContext<DenaliCreateTourWizardForm>();

  const publishStatus =
    (useWatch({ control, name: "basicInfo.publishStatus" }) as "draft" | "active" | undefined) ??
    "draft";
  const formSnapshot = useWatch({ control }) as DenaliCreateTourWizardForm | undefined;

  const { canonicalModel, basicsSelection } = useDenaliCanonical();
  const formForUi = formSnapshot ?? getValues();
  const { isVisible: isReviewFieldVisible, arePathsVisible: areReviewPathsVisible } =
    useDenaliStepFieldRules("review");

  const publishReadinessIssues = useMemo(
    () => getDenaliWizardPublishReadinessIssues(formForUi),
    [formForUi],
  );
  const publishReadinessBlocked = publishStatus === "active" && publishReadinessIssues.length > 0;
  const equipmentQuery = useSettingsEquipment();
  const diagnosticLoggedRef = useRef(false);

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

  const showOutdoorProgram = areReviewPathsVisible(
    ["program.difficultyLevel", "program.hikingHoursApprox"],
    formForUi,
  );
  const showEventVariant = isReviewFieldVisible("eventVariant", formForUi);

  const themesQuery = useSettingsTourThemes();
  const themeLabels = useMemo(() => {
    const seen = new Set<string>();
    const ids = (canonicalModel.program.themeIds ?? []).filter((id) => {
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
  }, [canonicalModel.program.themeIds, themesQuery.data]);

  const destinationsQuery = useTourDestinations();
  const destinationLabel = useMemo(() => {
    const id = canonicalModel.destinationId?.trim();
    if (!id) return undefined;
    for (const group of destinationsQuery.groupedRegions) {
      const hit = group.items.find((item) => item.id === id);
      if (hit) {
        return group.regionName ? `${hit.name} (${group.regionName})` : hit.name;
      }
    }
    return id;
  }, [canonicalModel.destinationId, destinationsQuery.groupedRegions]);

  const categoryLabel = basicsSelection ? t(`basic.categories.${basicsSelection.category}`) : "";
  const durationLabel = basicsSelection ? t(`basic.durations.${basicsSelection.duration}`) : "";
  const eventLabel =
    basicsSelection?.eventVariant != null
      ? t(`basic.eventVariants.${basicsSelection.eventVariant}`)
      : undefined;

  const capacitySummary = useMemo(() => {
    const max = canonicalModel.capacityMax;
    const min = canonicalModel.capacityMin;
    if (max == null && min == null) return undefined;
    if (min != null && max != null) return `${min} – ${max}`;
    if (max != null) return String(max);
    return min != null ? String(min) : undefined;
  }, [canonicalModel.capacityMax, canonicalModel.capacityMin]);

  const crewMembersQuery = useWorkspaceTourCrewMembers();
  const flatErrors = flattenDenaliFormErrors(errors);

  const workspaceLeaderLabels = useMemo(() => {
    const seen = new Set<string>();
    const ids = (canonicalModel.leaderUserIds ?? []).filter((id) => {
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
  }, [canonicalModel.leaderUserIds, crewMembersQuery.data]);

  const { requiredGearNames, optionalGearNames } = useMemo(() => {
    const nameForId = (id: string) =>
      equipmentQuery.data?.find((eq) => eq.id === id)?.name ?? id;
    const { required, optional } = splitGearByRequired(canonicalModel.participants.gearItems);
    return {
      requiredGearNames: required.map((row) => nameForId(row.id)).filter(Boolean),
      optionalGearNames: optional.map((row) => nameForId(row.id)).filter(Boolean),
    };
  }, [canonicalModel.participants.gearItems, equipmentQuery.data]);

  const gatheringPointsForReview = useMemo(() => {
    const seen = new Set<string>();
    return (canonicalModel.gatheringPoints ?? []).filter((station) => {
      const id = station.id?.trim();
      if (!id) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [canonicalModel.gatheringPoints]);

  return (
    <div style={{ display: "grid", gap: "0.85rem", fontSize: "0.9rem" }} data-testid="denali-step-review">
      {flatErrors.length > 0 && (
        <div
          style={{
            padding: "1rem",
            background: "#fef2f2",
            color: "#b91c1c",
            border: "1px solid #fca5a5",
            borderRadius: "8px",
          }}
          data-testid="denali-summary-error"
        >
          <p style={{ fontWeight: 600, margin: "0 0 0.5rem" }}>
            خطاهای زیر در فرم وجود دارد. لطفاً به مراحل قبل بازگشته و آن‌ها را برطرف کنید:
          </p>
          <ul style={{ margin: 0, paddingLeft: "1.5rem" }}>
            {flatErrors.map((entry, index) => (
              <li key={`${entry.path}-${index}`}>{`${entry.path}: ${entry.message}`}</li>
            ))}
          </ul>
        </div>
      )}

      <p style={{ margin: 0, color: "#64748b" }}>{t("review.intro")}</p>

      {publishReadinessBlocked ? (
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
            {publishReadinessIssues.map((issue, index) => (
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
          if (next === "archived") return;
          if (next === "active" && publishReadinessIssues.length > 0) {
            return;
          }
          setValue("basicInfo.publishStatus", next === "active" ? "active" : "draft", {
            shouldDirty: true,
          });
        }}
        disableValues={publishReadinessIssues.length > 0 ? (["active"] as const) : undefined}
        data-testid="denali-review-publish-status"
      />

      <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
        <ReviewRow label={t("basic.title")} value={canonicalModel.title} />
        <ReviewRow label={t("basic.categoryLabel")} value={categoryLabel} />
        <ReviewRow label={t("basic.durationLabel")} value={durationLabel} />
        {showEventVariant ? (
          <ReviewRow label={t("basic.eventVariantLabel")} value={eventLabel} />
        ) : null}
        <ReviewRow label={t("basic.destination")} value={destinationLabel} />
        <ReviewRow label={t("basic.workspaceLeaders")} value={workspaceLeaderLabels} />
        <ReviewRow
          label={t("basic.requiresLocalGuide")}
          value={
            canonicalModel.requiresLocalGuide === true ? t("review.yes") : t("review.no")
          }
        />
        {canonicalModel.requiresLocalGuide === true ? (
          <ReviewRow
            label={t("basic.localGuideName")}
            value={canonicalModel.localGuideName?.trim()}
          />
        ) : null}
        <ReviewRow
          label={t("basic.startPointLocationText")}
          value={canonicalModel.startPointLocationText}
        />
        <ReviewRow label="لینک شبکه اجتماعی" value={canonicalModel.socialMediaLink} />
        <ReviewRow
          label={t("basic.startDateTime")}
          value={formatScheduleLine(canonicalModel.startDateTime)}
        />
        {canonicalModel.endDateTime ? (
          <ReviewRow
            label={t("basic.endDateTime")}
            value={formatScheduleLine(canonicalModel.endDateTime)}
          />
        ) : null}
        <ReviewRow
          label={t("basic.approximateReturnTime")}
          value={canonicalModel.approximateReturnTime}
        />
        <ReviewRow label={t("review.capacity")} value={capacitySummary} />
        <ReviewRow label={t("program.themesLabel")} value={themeLabels} />
        <ReviewRow label={t("program.shortDescription")} value={canonicalModel.program.shortDescription} />
        {showOutdoorProgram ? (
          <>
            <ReviewRow
              label={t("program.difficultyLevel")}
              value={
                canonicalModel.program.difficultyLevel != null
                  ? String(canonicalModel.program.difficultyLevel)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingHours")}
              value={
                canonicalModel.program.hikingHoursApprox != null
                  ? String(canonicalModel.program.hikingHoursApprox)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingGoHours")}
              value={
                canonicalModel.program.hikingGoHours != null
                  ? String(canonicalModel.program.hikingGoHours)
                  : undefined
              }
            />
            <ReviewRow
              label={t("program.hikingReturnHours")}
              value={
                canonicalModel.program.hikingReturnHours != null
                  ? String(canonicalModel.program.hikingReturnHours)
                  : undefined
              }
            />
            {isReviewFieldVisible("program.altitudeMeasurement", formForUi) ? (
              <ReviewRow
                label={t("program.altitudeMeasurement")}
                value={
                  canonicalModel.program.altitudeMeasurement != null
                    ? String(canonicalModel.program.altitudeMeasurement)
                    : undefined
                }
              />
            ) : null}
          </>
        ) : null}
        {isReviewFieldVisible("program.itinerary", formForUi) &&
        (canonicalModel.program.itinerary?.length ?? 0) > 0 ? (
          <div>
            <dt style={{ fontWeight: 600 }}>{t("review.dailyItinerary")}</dt>
            <dd style={{ margin: "0.15rem 0 0", display: "grid", gap: "0.35rem" }}>
              {canonicalModel.program.itinerary!.map((row, itineraryIndex) => (
                <div key={`itinerary-day-${row.day}-${itineraryIndex}`}>
                  <strong>{t("program.dailyActivitiesDay", { day: row.day })}</strong>
                  {row.locationText?.trim() || row.location?.addressText?.trim() ? (
                    <span>
                      {" "}
                      — {row.locationText?.trim() || row.location?.addressText?.trim()}
                      {row.location?.latitude != null && row.location?.longitude != null
                        ? ` (${row.location.latitude.toFixed(4)}, ${row.location.longitude.toFixed(4)})`
                        : ""}
                    </span>
                  ) : null}
                  <div style={{ marginTop: "0.15rem" }}>{row.activities.trim() || "—"}</div>
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
        <ReviewRow
          label={t("transport.transportModeLabel")}
          value={t(`transport.transportMode.${canonicalModel.transport.mode}`)}
        />
        {isReviewFieldVisible("transport.transportCost", formForUi) && canonicalModel.transport.transportCost != null ? (
          <ReviewRow
            label={t("transport.transportCost")}
            value={String(canonicalModel.transport.transportCost)}
          />
        ) : null}
        {isReviewFieldVisible("transport.allowPersonalCar", formForUi) ? (
          <ReviewRow
            label={t("transport.allowPersonalCar")}
            value={canonicalModel.transport.allowPersonalCar ? t("review.yes") : t("review.no")}
          />
        ) : null}
        {isReviewFieldVisible("transport.dongAmount", formForUi) ? (
          <ReviewRow
            label={t("transport.dongAmount")}
            value={String(canonicalModel.transport.dongAmount ?? "")}
          />
        ) : null}
        <ReviewRow
          label={t("pricing.requiresPayment")}
          value={
            canonicalModel.pricing.requiresPayment === true ? t("review.yes") : t("review.no")
          }
        />
        {canonicalModel.pricing.requiresPayment === true ? (
          <ReviewRow
            label={t("pricing.basePricePerPerson")}
            value={
              canonicalModel.pricing.basePricePerPerson != null
                ? String(canonicalModel.pricing.basePricePerPerson)
                : undefined
            }
          />
        ) : null}
        <ReviewRow
          label={t("basic.requiresManualAdminApproval")}
          value={
            canonicalModel.requiresManualAdminApproval === true
              ? t("review.yes")
              : t("review.no")
          }
        />
        <ReviewRow
          label={t("pricing.includesTourInsurance")}
          value={
            canonicalModel.pricing.includesTourInsurance === true
              ? t("review.yes")
              : t("review.no")
          }
        />
        {gatheringPointsForReview.map((station, index) => {
          const rowKey = `gathering-${station.id?.trim() || "row"}-${index}`;
          const label = station.title.trim()
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
          value={denaliLocationAddressText(canonicalModel.startPoint)}
        />
        {canonicalModel.participants.minRequiredPeaks != null ? (
          <ReviewRow
            label="حداقل قله‌های صعودشده (تایید خودکار)"
            value={String(canonicalModel.participants.minRequiredPeaks)}
          />
        ) : null}
        <ReviewRow
          label={t("participants.fitnessPrerequisite")}
          value={canonicalModel.participants.fitnessPrerequisiteText}
        />
        {isReviewFieldVisible("policies.policiesText", formForUi) &&
        canonicalModel.policies.policiesText?.trim() ? (
          <ReviewRow label={t("policies.notes")} value={canonicalModel.policies.policiesText} />
        ) : null}
        {canonicalModel.policies.cancellationDeadlineHours != null ? (
          <ReviewRow
            label={t("policies.cancellationDeadlineHours")}
            value={String(canonicalModel.policies.cancellationDeadlineHours)}
          />
        ) : null}
        {canonicalModel.policies.cancellationPenaltyPercentage != null ? (
          <ReviewRow
            label={t("policies.cancellationPenaltyPercentage")}
            value={`${canonicalModel.policies.cancellationPenaltyPercentage}%`}
          />
        ) : null}
        <GearReviewLists
          requiredNames={requiredGearNames}
          optionalNames={optionalGearNames}
          requiredTitle={t("gear.reviewRequiredTitle")}
          optionalTitle={t("gear.reviewOptionalTitle")}
        />
      </dl>

      <DenaliReviewParticipantsDisplay form={formForUi} />
    </div>
  );
}

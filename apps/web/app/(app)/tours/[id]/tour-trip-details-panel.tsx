"use client";

import type { TourDetailAccessLevel, TourDetailViewHints, TourDto } from "@repo/types";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import { Card, CardBody, CardHeader, CardTitle } from "@tour/ui";

import {
  TourDetailLockedContent,
  type TourDetailLockedReason,
  type TourDetailLockedVariant,
} from "@/components/tours/TourDetailLockedContent";
import {
  labelExperienceLevel,
  labelFitnessLevel,
  labelGenderRestriction,
} from "@/components/tours/wizard/legacy/participationLabels";
import styles from "./tour-detail-client.module.css";

type Props = {
  tour: TourDto;
  accessLevel?: TourDetailAccessLevel;
  viewHints?: TourDetailViewHints;
  showRegister?: boolean;
  onRegister?: () => void;
};

function formatTransportModesList(modes: TourDto["transportModes"] | undefined): string | undefined {
  if (!modes?.length) return undefined;
  return modes.map((m) => TRANSPORT_LABELS[m] ?? m).join("، ");
}

const TRANSPORT_LABELS: Record<string, string> = {
  plane: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  midibus: "میدل‌باس",
  private_car: "خودرو شخصی",
};

function trimStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function MetaRow({ term, children }: { term: string; children: ReactNode }) {
  if (children == null || children === false) return null;
  if (typeof children === "string" && children.trim() === "") return null;
  return (
    <div className={styles.field}>
      <dt className={styles.term}>{term}</dt>
      <dd className={styles.def}>{children}</dd>
    </div>
  );
}

function Subheading({ children }: { children: ReactNode }) {
  return (
    <h4
      style={{
        margin: "var(--space-4) 0 var(--space-2)",
        fontSize: "var(--text-small-size)",
        fontWeight: 600,
        color: "var(--color-text-primary)",
      }}
    >
      {children}
    </h4>
  );
}

export function TourTripDetailsPanel({
  tour,
  accessLevel = "GUEST",
  viewHints = { gpsUnlocked: false, gpsUnlockAt: null },
  showRegister = false,
  onRegister,
}: Props) {
  const t = useTranslations("tours");
  const tAcc = useTranslations("tours.new");
  const tDenali = useTranslations("tours.denali");

  const isGuest = accessLevel === "GUEST";
  const isPurchased = accessLevel === "PURCHASED_USER";
  const showGpsLocked = isPurchased && !viewHints.gpsUnlocked;

  const td = tour.details?.tripDetails;
  if (td == null || typeof td !== "object" || Array.isArray(td)) {
    return null;
  }

  const overview =
    td.overview != null && typeof td.overview === "object" && !Array.isArray(td.overview)
      ? (td.overview as Record<string, unknown>)
      : undefined;
  const logistics =
    td.logistics != null && typeof td.logistics === "object" && !Array.isArray(td.logistics)
      ? (td.logistics as Record<string, unknown>)
      : undefined;
  const participation =
    td.participation != null && typeof td.participation === "object" && !Array.isArray(td.participation)
      ? (td.participation as Record<string, unknown>)
      : undefined;
  const policies =
    td.policies != null && typeof td.policies === "object" && !Array.isArray(td.policies)
      ? (td.policies as Record<string, unknown>)
      : undefined;
  const itinerary =
    td.itinerary != null && typeof td.itinerary === "object" && !Array.isArray(td.itinerary)
      ? (td.itinerary as Record<string, unknown>)
      : undefined;

  const shortIntro = trimStr(overview?.shortIntro);
  const denaliTourKindRaw = trimStr(overview?.denaliTourKind);
  const denaliTourKindLabel = denaliTourKindRaw
    ? tDenali(`tourKind.${denaliTourKindRaw}` as "tourKind.mountain_day")
    : "";
  const privateCarModeRaw = trimStr(logistics?.privateCarMode);
  const privateCarModeLabel = privateCarModeRaw
    ? tDenali(`transport.privateCarMode.${privateCarModeRaw}` as "transport.privateCarMode.car_share_fixed_dong")
    : "";
  const difficultyRating =
    typeof overview?.difficultyLevel === "number" && Number.isFinite(overview.difficultyLevel)
      ? overview.difficultyLevel
      : undefined;
  const elevationGainMeters =
    typeof overview?.elevationGainMeters === "number" && Number.isFinite(overview.elevationGainMeters)
      ? overview.elevationGainMeters
      : undefined;
  const itineraryOutline = trimStr(itinerary?.outline);
  const programNotes = trimStr(itinerary?.programNotes);
  const gatheringPoints = logistics?.gatheringPoints;
  const hasGatheringPoints =
    Array.isArray(gatheringPoints) && gatheringPoints.length > 0;
  const departureDate = trimStr(logistics?.departureDate);
  const returnDate = trimStr(logistics?.returnDate);
  const departureMeetingTime = trimStr(logistics?.departureMeetingTime);
  const returnMeetingTime = trimStr(logistics?.returnMeetingTime);
  const meetingPoint = trimStr(logistics?.meetingPoint);
  const returnPoint = trimStr(logistics?.returnPoint);
  const transportationNotes = trimStr(logistics?.transportationNotes);
  const accommodationNotes = trimStr(logistics?.accommodationNotes);
  const mealNotes = trimStr(logistics?.mealNotes);
  const primaryTransportMode = trimStr(logistics?.primaryTransportMode);
  const transportModesSummary = formatTransportModesList(tour.transportModes);
  const fuelShareToman =
    typeof logistics?.fuelShareToman === "number" && Number.isFinite(logistics.fuelShareToman)
      ? logistics.fuelShareToman
      : undefined;
  const leaderProvidesInsurance = logistics?.leaderProvidesInsurance === true;
  const leaderInsuranceNotes = trimStr(logistics?.leaderInsuranceNotes);
  const groupSizeMin =
    typeof logistics?.groupSizeMin === "number" && Number.isFinite(logistics.groupSizeMin)
      ? logistics.groupSizeMin
      : undefined;
  const groupSizeMax =
    typeof logistics?.groupSizeMax === "number" && Number.isFinite(logistics.groupSizeMax)
      ? logistics.groupSizeMax
      : undefined;

  const accommodationSlugs = Array.isArray(logistics?.accommodationTypes)
    ? (logistics!.accommodationTypes as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];

  const requirements = trimStr(participation?.requirements);
  const technicalSkillRequired = trimStr(participation?.technicalSkillRequired);
  const minimumAge =
    typeof participation?.minimumAge === "number" && Number.isFinite(participation.minimumAge)
      ? participation.minimumAge
      : undefined;
  const genderRestriction = trimStr(participation?.genderRestriction);
  const experienceLevel = trimStr(participation?.experienceLevel);
  const fitnessLevel = trimStr(participation?.fitnessLevel);
  const sportsInsuranceRequired = participation?.sportsInsuranceRequired === true;
  const registrationNationalIdRequired = participation?.registrationNationalIdRequired === true;
  const skillsRequired = Array.isArray(participation?.skillsRequired)
    ? (participation!.skillsRequired as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  const documentsRequired = Array.isArray(participation?.documentsRequired)
    ? (participation!.documentsRequired as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];

  const cancellationPolicy = trimStr(policies?.cancellationPolicy);
  const refundPolicy = trimStr(policies?.refundPolicy);
  const attendanceRules = trimStr(policies?.attendanceRules);
  const safetyPolicy = trimStr(policies?.safetyPolicy);
  const weatherPolicy = trimStr(policies?.weatherPolicy);
  const reservationRules = trimStr(policies?.reservationRules);

  const segmentActivities = itinerary?.segmentActivities;
  const dayPlans = itinerary?.dayPlans;

  let itineraryBody: ReactNode = null;
  if (Array.isArray(segmentActivities) && segmentActivities.length > 0) {
    itineraryBody = (
      <ul className={styles.equipmentList}>
        {segmentActivities.map((day, idx) => {
          if (!day || typeof day !== "object") return null;
          const d = day as Record<string, unknown>;
          const title = trimStr(d.title) || `${t("detail_itineraryDay")} ${typeof d.dayNumber === "number" ? d.dayNumber : idx + 1}`;
          const desc = trimStr(d.description);
          return (
            <li key={`seg-${idx}`}>
              <strong>{title}</strong>
              {desc ? <> — {desc}</> : null}
            </li>
          );
        })}
      </ul>
    );
  } else if (Array.isArray(dayPlans) && dayPlans.length > 0) {
    itineraryBody = (
      <ul className={styles.equipmentList}>
        {dayPlans.map((row, idx) => {
          if (!row || typeof row !== "object") return null;
          const d = row as Record<string, unknown>;
          const dayNum = typeof d.day === "number" ? d.day : idx + 1;
          const title = trimStr(d.title) || `${t("detail_itineraryDay")} ${dayNum}`;
          const desc = trimStr(d.description);
          return (
            <li key={`dp-${idx}`}>
              <strong>{title}</strong>
              {desc ? <> — {desc}</> : null}
            </li>
          );
        })}
      </ul>
    );
  }

  const accommodationLabels =
    accommodationSlugs.length > 0
      ? accommodationSlugs.map((slug) => tAcc(`trip_accommodation_${slug}` as Parameters<typeof tAcc>[0])).join("، ")
      : "";

  const hasGuestLogisticsDates =
    isGuest && (departureDate || returnDate || departureMeetingTime || returnMeetingTime);

  const hasLogisticsBlock =
    hasGuestLogisticsDates ||
    (!isGuest &&
      (departureDate ||
        returnDate ||
        departureMeetingTime ||
        returnMeetingTime ||
        meetingPoint ||
        returnPoint ||
        primaryTransportMode ||
        tour.transportModes.length > 1 ||
        fuelShareToman != null ||
        accommodationLabels ||
        accommodationNotes ||
        transportationNotes ||
        mealNotes ||
        leaderProvidesInsurance ||
        leaderInsuranceNotes ||
        groupSizeMin != null ||
        groupSizeMax != null));

  const hasParticipationBlock =
    requirements ||
    technicalSkillRequired ||
    minimumAge != null ||
    genderRestriction ||
    experienceLevel ||
    fitnessLevel ||
    sportsInsuranceRequired ||
    registrationNationalIdRequired ||
    skillsRequired.length > 0 ||
    documentsRequired.length > 0;

  const hasPoliciesBlock =
    cancellationPolicy ||
    refundPolicy ||
    attendanceRules ||
    safetyPolicy ||
    weatherPolicy ||
    reservationRules;

  const hasItineraryBlock = itineraryBody != null;
  const hasProgramNotesBlock = programNotes.length > 0;

  const renderLocked = (
    reason: TourDetailLockedReason,
    variant: TourDetailLockedVariant,
    options?: { unlockAt?: string | null; withRegisterCta?: boolean },
  ) => (
    <TourDetailLockedContent
      reason={reason}
      variant={variant}
      unlockAt={options?.unlockAt}
      onRegister={onRegister}
      showRegister={Boolean(showRegister && options?.withRegisterCta && variant === "guest")}
    />
  );

  const showLogisticsSection =
    hasGuestLogisticsDates || hasLogisticsBlock || isGuest || showGpsLocked;

  const hasDenaliOverview =
    denaliTourKindLabel ||
    privateCarModeLabel ||
    difficultyRating != null ||
    elevationGainMeters != null ||
    itineraryOutline;

  const showPanel =
    Boolean(shortIntro) ||
    hasDenaliOverview ||
    showLogisticsSection ||
    hasParticipationBlock ||
    hasPoliciesBlock ||
    hasItineraryBlock ||
    hasProgramNotesBlock ||
    isGuest ||
    showGpsLocked;

  if (!showPanel) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("detail_tripProgrammeTitle")}</CardTitle>
      </CardHeader>
      <CardBody className={styles.panelBody}>
        {shortIntro ? (
          <>
            <Subheading>{t("detail_tripSummarySection")}</Subheading>
            <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{shortIntro}</p>
          </>
        ) : null}

        {hasDenaliOverview ? (
          <>
            <Subheading>{tDenali("basic.tourType")}</Subheading>
            <dl className={styles.meta}>
              <MetaRow term={tDenali("basic.tourType")}>{denaliTourKindLabel}</MetaRow>
              <MetaRow term={tDenali("transport.privateCarModeLabel")}>{privateCarModeLabel}</MetaRow>
              {difficultyRating != null ? (
                <MetaRow term={tDenali("program.difficultyLevel")}>
                  {difficultyRating.toLocaleString("fa-IR")}
                </MetaRow>
              ) : null}
              {elevationGainMeters != null ? (
                <MetaRow term={tDenali("program.altitudeGain")}>
                  {elevationGainMeters.toLocaleString("fa-IR")} m
                </MetaRow>
              ) : null}
              <MetaRow term={tDenali("program.itineraryOutline")}>
                {itineraryOutline ? <span style={{ whiteSpace: "pre-wrap" }}>{itineraryOutline}</span> : null}
              </MetaRow>
            </dl>
          </>
        ) : null}

        {showLogisticsSection ? (
          <>
            <Subheading>{t("detail_scheduleLogisticsSection")}</Subheading>
            {(hasGuestLogisticsDates ||
              (!isGuest &&
                (departureDate ||
                  returnDate ||
                  departureMeetingTime ||
                  returnMeetingTime))) && (
              <dl className={styles.meta}>
                {departureDate || returnDate ? (
                  <MetaRow term={t("detail_datesLabel")}>
                    {[departureDate, returnDate].filter(Boolean).join(" → ")}
                  </MetaRow>
                ) : null}
                {departureMeetingTime || returnMeetingTime ? (
                  <MetaRow term={t("detail_timesLabel")}>
                    {[departureMeetingTime, returnMeetingTime].filter(Boolean).join(" → ")}
                  </MetaRow>
                ) : null}
              </dl>
            )}
            {isGuest
              ? renderLocked("gathering", "guest", { withRegisterCta: false })
              : null}
            {showGpsLocked
              ? renderLocked("gps", "gps_pending", { unlockAt: viewHints.gpsUnlockAt })
              : null}
            {!isGuest ? (
              <dl className={styles.meta}>
                <MetaRow term={t("detail_meetingPointLabel")}>{meetingPoint}</MetaRow>
                <MetaRow term={t("detail_returnPointLabel")}>{returnPoint}</MetaRow>
                {hasGatheringPoints ? (
                  <MetaRow term={t("detail_meetingPointLabel")}>
                    {(gatheringPoints as { title?: string }[])
                      .map((row) => trimStr(row?.title))
                      .filter(Boolean)
                      .join("، ")}
                  </MetaRow>
                ) : null}
                {primaryTransportMode ? (
                  <MetaRow term={t("detail_primaryTransportLabel")}>
                    {TRANSPORT_LABELS[primaryTransportMode] ?? primaryTransportMode}
                  </MetaRow>
                ) : null}
                {tour.transportModes.length > 1 && transportModesSummary ? (
                  <MetaRow term={t("detail_transportModesCombinedLabel")}>{transportModesSummary}</MetaRow>
                ) : null}
                {fuelShareToman != null ? (
                  <MetaRow term={t("detail_fuelShareLabel")}>
                    {fuelShareToman.toLocaleString("fa-IR")} {t("detail_currencyToman")}
                  </MetaRow>
                ) : null}
                {accommodationLabels ? (
                  <MetaRow term={t("detail_accommodationTypesLabel")}>{accommodationLabels}</MetaRow>
                ) : null}
                <MetaRow term={t("detail_accommodationNotesLabel")}>{accommodationNotes}</MetaRow>
                <MetaRow term={t("detail_transportationNotesLabel")}>{transportationNotes}</MetaRow>
                <MetaRow term={t("detail_mealNotesLabel")}>{mealNotes}</MetaRow>
                {leaderProvidesInsurance ? (
                  <MetaRow term={t("detail_leaderInsuranceLabel")}>
                    {leaderInsuranceNotes || t("detail_leaderInsuranceYes")}
                  </MetaRow>
                ) : null}
                {groupSizeMin != null || groupSizeMax != null ? (
                  <MetaRow term={t("detail_groupSizeLabel")}>
                    {groupSizeMin != null ? groupSizeMin.toLocaleString("fa-IR") : "—"} –{" "}
                    {groupSizeMax != null ? groupSizeMax.toLocaleString("fa-IR") : "—"}
                  </MetaRow>
                ) : null}
              </dl>
            ) : null}
          </>
        ) : null}

        {isGuest || hasProgramNotesBlock ? (
          <>
            <Subheading>{t("detail_locked_program_notes_title")}</Subheading>
            {isGuest || !hasProgramNotesBlock
              ? renderLocked("program_notes", isGuest ? "guest" : "section")
              : (
                <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{programNotes}</p>
              )}
          </>
        ) : null}

        {isGuest || hasItineraryBlock ? (
          <>
            <Subheading>{t("detail_itinerarySection")}</Subheading>
            {isGuest
              ? renderLocked("itinerary", "guest", { withRegisterCta: true })
              : itineraryBody}
          </>
        ) : null}

        {isGuest ? (
          <>
            <Subheading>{t("detail_participationSection")}</Subheading>
            {renderLocked("participation", "guest")}
          </>
        ) : hasParticipationBlock ? (
          <>
            <Subheading>{t("detail_participationSection")}</Subheading>
            <dl className={styles.meta}>
              <MetaRow term={t("detail_requirementsLabel")}>
                {requirements ? <span style={{ whiteSpace: "pre-wrap" }}>{requirements}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_minimumAgeLabel")}>
                {minimumAge != null ? minimumAge.toLocaleString("fa-IR") : null}
              </MetaRow>
              <MetaRow term={t("detail_genderLabel")}>{labelGenderRestriction(genderRestriction)}</MetaRow>
              <MetaRow term={t("detail_experienceLabel")}>{labelExperienceLevel(experienceLevel)}</MetaRow>
              <MetaRow term={t("detail_fitnessLabel")}>{labelFitnessLevel(fitnessLevel)}</MetaRow>
              <MetaRow term={t("detail_technicalSkillLabel")}>{technicalSkillRequired}</MetaRow>
              {skillsRequired.length > 0 ? (
                <MetaRow term={t("detail_skillsRequiredLabel")}>{skillsRequired.join("؛ ")}</MetaRow>
              ) : null}
              {documentsRequired.length > 0 ? (
                <MetaRow term={t("detail_documentsRequiredLabel")}>{documentsRequired.join("؛ ")}</MetaRow>
              ) : null}
              {sportsInsuranceRequired ? (
                <MetaRow term={t("detail_sportsInsuranceLabel")}>{t("detail_requiredYes")}</MetaRow>
              ) : null}
              {registrationNationalIdRequired ? (
                <MetaRow term={t("detail_nationalIdRequiredLabel")}>{t("detail_requiredYes")}</MetaRow>
              ) : null}
            </dl>
          </>
        ) : null}

        {isGuest ? (
          <>
            <Subheading>{t("detail_policiesSection")}</Subheading>
            {renderLocked("policies", "guest")}
          </>
        ) : hasPoliciesBlock ? (
          <>
            <Subheading>{t("detail_policiesSection")}</Subheading>
            <dl className={styles.meta}>
              <MetaRow term={t("detail_cancellationPolicyLabel")}>
                {cancellationPolicy ? <span style={{ whiteSpace: "pre-wrap" }}>{cancellationPolicy}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_refundPolicyLabel")}>
                {refundPolicy ? <span style={{ whiteSpace: "pre-wrap" }}>{refundPolicy}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_attendanceRulesLabel")}>
                {attendanceRules ? <span style={{ whiteSpace: "pre-wrap" }}>{attendanceRules}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_safetyPolicyLabel")}>
                {safetyPolicy ? <span style={{ whiteSpace: "pre-wrap" }}>{safetyPolicy}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_weatherPolicyLabel")}>
                {weatherPolicy ? <span style={{ whiteSpace: "pre-wrap" }}>{weatherPolicy}</span> : null}
              </MetaRow>
              <MetaRow term={t("detail_reservationRulesLabel")}>
                {reservationRules ? <span style={{ whiteSpace: "pre-wrap" }}>{reservationRules}</span> : null}
              </MetaRow>
            </dl>
          </>
        ) : null}
      </CardBody>
    </Card>
  );
}

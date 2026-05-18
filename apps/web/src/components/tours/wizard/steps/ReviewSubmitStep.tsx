import type { CSSProperties, ReactNode } from "react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";

import type { TourCreateFormValues } from "../schemas/tourCreateSchema";
import { labelExperienceLevel, labelFitnessLevel, labelGenderRestriction } from "../participationLabels";
import { useTourDestinations } from "@/hooks/use-tour-destinations";

import { useReviewSubmitRHF } from "../hooks/useReviewSubmitRHF";
import { buildReviewSubmitPayload } from "../utils/buildReviewSubmitPayload";
import { ProfileGate } from "../profile/ProfileGate";
import { useTourWizardProfile } from "@/features/tours/wizard/TourWizardProfileContext";

import { SummarySection } from "../sections/ReviewSubmit/SummarySection";
import { PricingSection } from "../sections/ReviewSubmit/PricingSection";
import { DraftNotice } from "../sections/ReviewSubmit/DraftNotice";

const rowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(8rem, 28%) 1fr",
  gap: "0.35rem 0.75rem",
  fontSize: "0.875rem",
  alignItems: "start",
};
const dtStyle: CSSProperties = { fontWeight: 600, color: "#334155", margin: 0 };
const ddStyle: CSSProperties = { margin: 0, color: "#0f172a", wordBreak: "break-word" };

const transportModeLabels: Record<string, string> = {
  plane: "هواپیما",
  train: "قطار",
  bus: "اتوبوس",
  midibus: "میدل‌باس",
  private_car: "ماشین شخصی",
};

function SummaryRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={rowStyle}>
      <dt style={dtStyle}>{label}</dt>
      <dd style={ddStyle}>{value === "" || value === undefined || value === null ? "—" : value}</dd>
    </div>
  );
}

function resolveOrHint(id: string | undefined, name: string | undefined, noun: string): string | undefined {
  if (!id?.trim()) return undefined;
  if (name?.trim()) return name.trim();
  return `نام این ${noun} در فهرست فعلی تنظیمات نیست؛ گام «مکان و تاریخ» را بازبینی کنید.`;
}

/**
 * ReviewSubmitStep – final step of the tour wizard.
 * Responsibilities:
 *   • Pulls RHF values via `useReviewSubmitRHF`.
 *   • Builds the final payload (pure function) for submission.
 *   • Renders three isolated UI sections.
 *   • Keeps only layout & submit button inline.
 */
export function ReviewSubmitStep() {
  const t = useTranslations("tours.new");
  const { control } = useFormContext<TourCreateFormValues>();
  const { tenantFormContract } = useTourWizardProfile();
  const {
    autoAcceptRegistrations,
    overview,
    pricing,
    schedule,
    location,
    itinerary,
    participation,
    logistics,
    policies,
    onSubmit,
    isSubmitting,
    submitError,
  } = useReviewSubmitRHF();

  const { groupedRegions } = useTourDestinations();

  const regionNameById = useMemo(
    () => new Map(groupedRegions.map((g) => [g.regionId, g.regionName])),
    [groupedRegions],
  );
  const destinationNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groupedRegions) {
      for (const it of g.items) {
        m.set(it.id, it.name);
      }
    }
    return m;
  }, [groupedRegions]);

  const regionId = location?.regionId?.trim();
  const mainDestId = location?.mainDestinationId?.trim();

  const regionDisplay = resolveOrHint(regionId, regionId ? regionNameById.get(regionId) : undefined, "منطقه");
  const mainDestinationDisplay = resolveOrHint(
    mainDestId,
    mainDestId ? destinationNameById.get(mainDestId) : undefined,
    "مقصد",
  );
  const secondaryDestinationDisplays = useMemo(() => {
    const ids = location?.secondaryDestinationIds ?? [];
    if (ids.length === 0) return undefined as string | undefined;
    const parts = ids
      .map((sid) => resolveOrHint(sid, destinationNameById.get(sid), "مقصد"))
      .filter(Boolean) as string[];
    return parts.length > 0 ? parts.join("، ") : undefined;
  }, [location?.secondaryDestinationIds, destinationNameById]);

  const accommodationTypesSummary = useMemo(() => {
    const ids = logistics?.accommodationTypes ?? [];
    if (ids.length === 0) return undefined as string | undefined;
    return ids.map((slug) => t(`trip_accommodation_${slug}`)).join("، ");
  }, [logistics?.accommodationTypes, t]);

  const primarySegmentLabel = itinerary?.days?.[0]?.segments?.[0]?.title ?? "بخش اول";
  const comm = overview?.communicationLink?.trim();
  const communicationHref = comm
    ? /^[a-z][a-z0-9+.-]*:/i.test(comm)
      ? comm
      : `https://${comm.replace(/^\/+/, "")}`
    : "";

  // Build the payload once – pure function, no side‑effects.
  const payload = useMemo(
    () =>
      buildReviewSubmitPayload({
        autoAcceptRegistrations,
        overview,
        pricing,
        schedule,
        location,
        itinerary,
        participation,
        logistics,
        policies,
      }),
    [
      autoAcceptRegistrations,
      overview,
      pricing,
      schedule,
      location,
      itinerary,
      participation,
      logistics,
      policies,
    ],
  );

  return (
    <section aria-labelledby="review-heading" style={{ display: "grid", gap: "1.1rem" }}>
      <p id="review-heading" style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>
        خلاصه اطلاعات قبل از ثبت نهایی. در صورت نیاز با «قبلی» به مراحل قبل برگردید و ویرایش کنید.
      </p>

      {/* Draft notice – rendered only when draft mode is active (profile flag) */}
      <ProfileGate flag="allowDraft">
        <DraftNotice />
      </ProfileGate>

      {/* Individual UI sections – each memoised and isolated */}
      <SummarySection
        overview={overview}
        communicationHref={communicationHref}
        comm={comm}
        SummaryRow={SummaryRow}
      />
      <PricingSection
        participation={participation}
        pricing={pricing}
        autoAcceptRegistrations={autoAcceptRegistrations}
        showRequiresPayment={tenantFormContract.allowFinanceSurfaces}
        SummaryRow={SummaryRow}
      />
      <section>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>مکان و زمان</h3>
        <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
          <SummaryRow label="منطقه" value={regionDisplay} />
          <SummaryRow label="مقصد اصلی" value={mainDestinationDisplay} />
          <SummaryRow label="مقاصد ثانویه" value={secondaryDestinationDisplays} />
          <SummaryRow label="شروع سفر (میلادی)" value={schedule?.startDate} />
          <SummaryRow label="پایان سفر (میلادی)" value={schedule?.endDate} />
          <SummaryRow label="نقطه ملاقات" value={location?.meetingPoint} />
          <SummaryRow label="نقطه بازگشت" value={location?.returnPoint} />
          <SummaryRow label="نمایش مکان" value={location?.displayLocation} />
        </dl>
      </section>

      <section>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>برنامه سفر</h3>
        <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
          <SummaryRow label="تعداد روزها" value={itinerary?.days?.length ?? 0} />
          <SummaryRow label={`${primarySegmentLabel} (روز ۱)`} value={itinerary?.days?.[0]?.segments?.[0]?.description} />
        </dl>
      </section>

      <section>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>شرکت و لجستیک</h3>
        <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
          <SummaryRow label="سطح تجربه" value={labelExperienceLevel(participation?.requiredExperienceLevel)} />
          <SummaryRow label="آمادگی جسمانی" value={labelFitnessLevel(participation?.requiredFitnessLevel)} />
          <SummaryRow
            label="ترکیب سنی"
            value={
              participation?.minimumAge != null || participation?.maximumAge != null
                ? [participation?.minimumAge, participation?.maximumAge]
                    .map((n) => (n == null ? "—" : n.toLocaleString("fa-IR")))
                    .join(" تا ")
                : undefined
            }
          />
          <SummaryRow label="محدودیت جنسیت" value={labelGenderRestriction(participation?.genderRestriction)} />
          <SummaryRow label="الزامات" value={participation?.requirements} />
          <SummaryRow label="مهارت فنی" value={participation?.technicalSkillRequired} />
          <SummaryRow label="پیش‌نیازها (خط‌به‌خط)" value={(participation?.skillsRequired ?? []).join("؛ ")} />
          <SummaryRow
            label="حمل‌ونقل اصلی"
            value={transportModeLabels[(logistics?.primaryTransportMode ?? "").trim()] ?? logistics?.primaryTransportMode}
          />
          <SummaryRow
            label="خودرو شخصی کنار حمل اصلی"
            value={
              logistics?.primaryTransportMode &&
              logistics.primaryTransportMode !== "private_car" &&
              logistics?.supplementalPrivateCar
                ? "بله"
                : undefined
            }
          />
          <SummaryRow label="نوع اقامت (چندگانه)" value={accommodationTypesSummary} />
          <SummaryRow
            label="دنگ بنزین هر سرنشین"
            value={
              logistics?.fuelShareToman != null &&
              (logistics?.primaryTransportMode === "private_car" || logistics?.supplementalPrivateCar === true)
                ? `${logistics.fuelShareToman.toLocaleString("fa-IR")} تومان`
                : undefined
            }
          />
          <SummaryRow
            label="بیمه برگزارکننده"
            value={
              logistics?.leaderProvidesInsurance
                ? logistics.leaderInsuranceNotes?.trim() || "بله، در بسته تور"
                : undefined
            }
          />
          <SummaryRow
            label="بیمه ورزشی شخصی"
            value={participation?.sportsInsuranceRequired ? "برای شرکت الزامی است" : undefined}
          />
          <SummaryRow
            label="کد ملی در ثبت‌نام"
            value={participation?.registrationNationalIdRequired ? "تکمیل در پروفایل الزامی است" : undefined}
          />
          <SummaryRow label="ساعت رفت" value={schedule?.departureMeetingTime} />
          <SummaryRow label="ساعت برگشت" value={schedule?.returnMeetingTime} />
        </dl>
      </section>

      <section>
        <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem" }}>سیاست‌ها</h3>
        <dl style={{ margin: 0, display: "grid", gap: "0.5rem" }}>
          <SummaryRow label="لغو" value={policies?.cancellationPolicy} />
          <SummaryRow label="استرداد" value={policies?.refundPolicy} />
        </dl>
      </section>

      {/* Submit button – stays inline */}
      <div style={{ marginTop: "1rem", textAlign: "right" }}>
        <button
          type="button"
          disabled={isSubmitting}
          onClick={() => onSubmit(payload)}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: "none",
            padding: "0.5rem 1rem",
            borderRadius: "0.25rem",
            cursor: isSubmitting ? "not-allowed" : "pointer",
          }}
        >
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
        {submitError && (
          <p style={{ color: "var(--color-danger-600, #b91c1c)", marginTop: "0.5rem" }}>{submitError.message}</p>
        )}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { parseLocationsResponse } from "@/features/settings/locations-logic";
import {
  resolveDenaliFieldLabel,
  resolveDenaliPublishStatusLabel,
  resolveDenaliTourKindLabel,
  resolveDenaliTransportModeLabel,
} from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

export const DENALI_REVIEW_STEP_TEST_IDS = {
  panel: "denali-review-step",
  title: "denali-review-title",
  destinationName: "denali-review-destination-name",
} as const;

type DenaliReviewStepProps = {
  readonly draft: TourWizardDraft;
};

function ReviewRow({ label, value }: { readonly label: string; readonly value: string }) {
  if (value.trim().length === 0) {
    return null;
  }
  return (
    <div className="denali-review-step__row">
      <dt className="denali-review-step__term">{label}</dt>
      <dd className="denali-review-step__value">{value}</dd>
    </div>
  );
}

export function DenaliReviewStep({ draft }: DenaliReviewStepProps) {
  const t = useTranslations("denali");
  const title = getCanonicalStringValue(draft, "title");
  const category = getCanonicalStringValue(draft, "category");
  const summary = getCanonicalStringValue(draft, "program.shortDescription");
  const startDateTime = getCanonicalStringValue(draft, "startDateTime");
  const endDateTime = getCanonicalStringValue(draft, "endDateTime");
  const destinationId = getCanonicalStringValue(draft, "destinationId");
  const capacityMax = getCanonicalStringValue(draft, "capacityMax");
  const transportMode = getCanonicalStringValue(draft, "transport.mode");
  const publishStatus = getCanonicalStringValue(draft, "publishStatus");
  const [destinationName, setDestinationName] = useState<string>("");

  useEffect(() => {
    if (destinationId.trim().length === 0) {
      setDestinationName("");
      return;
    }
    let cancelled = false;
    void fetch("/api/settings/resources/locations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LOCATIONS_HTTP_${response.status}`);
        }
        return parseLocationsResponse(await response.json());
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const match = payload.destinations.find((row) => row.id === destinationId);
        setDestinationName(match?.name ?? destinationId);
      })
      .catch(() => {
        if (!cancelled) {
          setDestinationName(destinationId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [destinationId]);

  const categoryLabel =
    category.trim().length > 0 ? resolveDenaliTourKindLabel(t, category) : "";
  const transportLabel =
    transportMode.trim().length > 0
      ? resolveDenaliTransportModeLabel(t, transportMode)
      : "";
  const publishLabel =
    publishStatus.trim().length > 0
      ? resolveDenaliPublishStatusLabel(t, publishStatus)
      : "";

  return (
    <section className="denali-review-step" data-testid={DENALI_REVIEW_STEP_TEST_IDS.panel}>
      <h3 className="denali-review-step__heading">{t("review.summaryHeading")}</h3>
      <dl className="denali-review-step__list">
        <div data-testid={DENALI_REVIEW_STEP_TEST_IDS.title}>
          <ReviewRow label={resolveDenaliFieldLabel(t, "title")} value={title} />
        </div>
        <ReviewRow label={resolveDenaliFieldLabel(t, "category")} value={categoryLabel} />
        <div data-testid={DENALI_REVIEW_STEP_TEST_IDS.destinationName}>
          <ReviewRow
            label={resolveDenaliFieldLabel(t, "destinationId")}
            value={destinationName}
          />
        </div>
        <ReviewRow label={resolveDenaliFieldLabel(t, "startDateTime")} value={startDateTime} />
        <ReviewRow label={resolveDenaliFieldLabel(t, "endDateTime")} value={endDateTime} />
        <ReviewRow label={resolveDenaliFieldLabel(t, "capacityMax")} value={capacityMax} />
        <ReviewRow label={resolveDenaliFieldLabel(t, "transport.mode")} value={transportLabel} />
        <ReviewRow label={resolveDenaliFieldLabel(t, "publishStatus")} value={publishLabel} />
        <ReviewRow label={resolveDenaliFieldLabel(t, "program.shortDescription")} value={summary} />
      </dl>
    </section>
  );
}

"use client";

import React from "react";
import { useTranslations } from "next-intl";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { DenaliDatetimeField, DENALI_DATETIME_TEST_IDS } from "./denali-datetime-field";
import { isDenaliMultiDayTourKind } from "./denali-photo-types";

type DenaliDatetimeEndFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

export function DenaliDatetimeEndField({
  draft,
  onDraftChange,
  required = false,
}: DenaliDatetimeEndFieldProps) {
  const t = useTranslations("denali");
  const tourKind = getCanonicalStringValue(draft, "category");
  const multiDay = isDenaliMultiDayTourKind(tourKind);

  return (
    <DenaliDatetimeField
      draft={draft}
      onDraftChange={onDraftChange}
      canonicalPath="endDateTime"
      required={required}
      testId={DENALI_DATETIME_TEST_IDS.end}
      hint={
        multiDay
          ? t("composites.datetimeEnd.multiDayHint")
          : t("composites.datetimeEnd.singleDayHint")
      }
    />
  );
}

"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { isDenaliMultiDayTourKind } from "../logic/denali-photo-types";
import { DENALI_DATETIME_TEST_IDS, DenaliDatetimeField } from "./denali-datetime-field";

type DenaliDatetimeEndFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
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

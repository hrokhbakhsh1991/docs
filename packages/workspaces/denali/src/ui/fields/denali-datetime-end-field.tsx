"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import {
  repairInventedMidnightDatetimeLocal,
  splitDatetimeLocal,
} from "../adapters/datetime-format";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import {
  datetimeLocalInputToIso,
  isoToDatetimeLocalInput,
} from "../logic/denali-datetime-utils";
import { isDenaliMultiDayTourKind } from "../logic/denali-photo-types";
import { DENALI_DATETIME_TEST_IDS, DenaliDatetimeField } from "./denali-datetime-field";

type DenaliDatetimeEndFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliDatetimeEndField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliDatetimeEndFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const repairedKeyRef = useRef<string | null>(null);
  const tourKind = getCanonicalStringValue(draft, "category");
  const multiDay = isDenaliMultiDayTourKind(tourKind);
  const startIso = getCanonicalStringValue(draft, "startDateTime");
  const endIso = getCanonicalStringValue(draft, "endDateTime");
  // ED-DT-END-01: date-only end pick must not collapse to midnight when start already has a clock.
  const startClock = splitDatetimeLocal(isoToDatetimeLocalInput(startIso)).time;

  // One-shot hydrate repair for drafts that already stored invented midnight from a prior date-only pick.
  useEffect(() => {
    const endLocal = isoToDatetimeLocalInput(endIso);
    const startLocal = isoToDatetimeLocalInput(startIso);
    const repairedLocal = repairInventedMidnightDatetimeLocal(endLocal, startLocal);
    if (repairedLocal == null) {
      return;
    }
    const repairKey = `${endIso}|${startIso}|${repairedLocal}`;
    if (repairedKeyRef.current === repairKey) {
      return;
    }
    repairedKeyRef.current = repairKey;
    const nextIso = datetimeLocalInputToIso(repairedLocal);
    if (nextIso.length === 0 || nextIso === endIso) {
      return;
    }
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "endDateTime", nextIso)
    );
  }, [draftRef, endIso, onDraftChange, startIso]);

  return (
    <DenaliDatetimeField
      draft={draft}
      onDraftChange={onDraftChange}
      canonicalPath="endDateTime"
      required={required}
      testId={DENALI_DATETIME_TEST_IDS.end}
      invalid={invalid}
      fallbackTime={startClock.length > 0 ? startClock : undefined}
      hint={
        multiDay
          ? t("composites.datetimeEnd.multiDayHint")
          : t("composites.datetimeEnd.singleDayHint")
      }
    />
  );
}

"use client";

import { useCallback, useMemo, useState } from "react";

import {
  createInitialCreateClubDraft,
  initialCreateClubWizardStep,
  nextCreateClubWizardStep,
  previousCreateClubWizardStep,
  type CreateClubDraft,
  type CreateClubWizardStep,
} from "./use-create-club-wizard";

export function useCreateClubWizard() {
  const [step, setStep] = useState<CreateClubWizardStep>(initialCreateClubWizardStep());
  const [draft, setDraft] = useState<CreateClubDraft>(createInitialCreateClubDraft());

  const next = useCallback(() => {
    setStep((current) => nextCreateClubWizardStep(current));
  }, []);

  const back = useCallback(() => {
    setStep((current) => previousCreateClubWizardStep(current));
  }, []);

  return useMemo(
    () => ({
      step,
      draft,
      setDraft,
      next,
      back,
    }),
    [step, draft, next, back]
  );
}

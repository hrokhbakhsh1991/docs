"use client";

import React, { useState } from "react";
import { FormProvider, useForm } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { buildWorstCaseDenaliWizardForm } from "../fixtures/buildWorstCaseDenaliWizardForm";
import { getDenaliWizardSteps, type DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

import { DenaliCanonicalProvider } from "../../DenaliCanonicalContext";
import { DenaliStepFocusBridge } from "../../DenaliStepFocusBridge";
import { DenaliWizardNavigationProvider } from "../../DenaliWizardNavigationContext";
import { DenaliWizardSyncProvider } from "../../DenaliWizardSyncContext";

function StepStub({ stepId }: { stepId: DenaliCreateWizardStepId }) {
  return (
    <section data-testid={`denali-step-${stepId}`} data-memlab-step={stepId}>
      <p>{stepId}</p>
      <input data-field-path={`memlab.stub.${stepId}`} defaultValue={`value-${stepId}`} />
    </section>
  );
}

/**
 * Minimal wizard shell for memlab traversal (step 1 → 7 → 1) without Next.js / network / auth.
 * Intentionally standalone — memlab esbuild must not bundle test utilities or AuthProvider.
 */
export function WizardMemlabHarness() {
  const formMethods = useForm<DenaliCreateTourWizardForm>({
    defaultValues: buildWorstCaseDenaliWizardForm(),
  });
  const visibleSteps = getDenaliWizardSteps();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const activeStepId = visibleSteps[currentStepIndex] ?? "denali_basic";
  const lastStepIndex = Math.max(visibleSteps.length - 1, 0);

  const goToStep = (index: number) => {
    setCurrentStepIndex(Math.min(Math.max(index, 0), lastStepIndex));
  };

  return (
    <FormProvider {...formMethods}>
      <DenaliCanonicalProvider formMethods={formMethods}>
        <DenaliWizardSyncProvider isSyncing={false}>
          <DenaliWizardNavigationProvider
            visibleSteps={visibleSteps}
            currentStepIndex={currentStepIndex}
            setCurrentStep={setCurrentStepIndex}
          >
            <div data-testid="denali-memlab-harness">
              <button
                type="button"
                data-testid="memlab-traverse-forward"
                onClick={() => goToStep(lastStepIndex)}
              >
                Traverse to review
              </button>
              <button
                type="button"
                data-testid="memlab-traverse-back"
                onClick={() => goToStep(0)}
              >
                Traverse to basics
              </button>
              <p data-testid="memlab-active-step-index">{currentStepIndex}</p>
              <DenaliStepFocusBridge stepId={activeStepId} />
              <StepStub stepId={activeStepId} />
            </div>
          </DenaliWizardNavigationProvider>
        </DenaliWizardSyncProvider>
      </DenaliCanonicalProvider>
    </FormProvider>
  );
}

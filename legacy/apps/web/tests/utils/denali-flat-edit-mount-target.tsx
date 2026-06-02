import React from "react";

import { DenaliSection } from "@/features/tours/denali/fields/DenaliSection";
import { DENALI_EDIT_SECTION_IDS } from "@/features/tours/denali/fields/denaliSectionSuppress";
import { buildWorstCaseDenaliWizardForm } from "@/features/tours/wizard/denali/__benchmarks__/fixtures/buildWorstCaseDenaliWizardForm";
import { DenaliFormHarness } from "@test-utils/denali-integration-harness";

/** Perf guard mount target — no auth shell (latency isolation). */
export function DenaliFlatEditMountTarget() {
  return (
    <DenaliFormHarness defaultValues={buildWorstCaseDenaliWizardForm()} withAppShell={false}>
      {DENALI_EDIT_SECTION_IDS.map((sectionId) => (
        <DenaliSection key={sectionId} sectionId={sectionId} tourId="bench-tour" />
      ))}
    </DenaliFormHarness>
  );
}

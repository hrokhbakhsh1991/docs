"use client";

import { useMemo } from "react";

import { getDenaliFieldRegistryByStep } from "@repo/denali-domain";

import { getDenaliStepTitleFa } from "@/features/tours/wizard/denaliStepConfig";
import { useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";

import editStyles from "@/components/tours/DenaliTourEditForm.module.css";

import { DenaliRegistryFields } from "./DenaliRegistryFields";
import { shouldRenderDenaliRegistryField } from "./denaliFieldRendererAnchors";
import type { DenaliEditSectionId } from "./denaliSectionSuppress";

export type { DenaliEditSectionId } from "./denaliSectionSuppress";
export { DENALI_EDIT_SECTION_IDS } from "./denaliSectionSuppress";

export type DenaliSectionProps = {
  sectionId: DenaliEditSectionId;
  tourId?: string;
};

/** Flat-edit section — registry-driven fields via {@link DenaliFieldRenderer}. */
export function DenaliSection({ sectionId, tourId }: DenaliSectionProps) {
  const { isVisible } = useDenaliStepFieldRules(sectionId);
  const registryRows = useMemo(() => getDenaliFieldRegistryByStep(sectionId), [sectionId]);

  const hasVisibleField = registryRows.some(
    (row) =>
      row.inRuleModel !== false &&
      shouldRenderDenaliRegistryField(row) &&
      isVisible(row.canonicalPath),
  );

  if (!hasVisibleField) {
    return null;
  }

  return (
    <section
      className={editStyles.section}
      data-testid={`denali-section-${sectionId}`}
      data-section-id={sectionId}
    >
      <h2 className={editStyles.sectionTitle}>{getDenaliStepTitleFa(sectionId)}</h2>
      <div className={editStyles.sectionBody}>
        <DenaliRegistryFields sectionId={sectionId} tourId={tourId} />
      </div>
    </section>
  );
}

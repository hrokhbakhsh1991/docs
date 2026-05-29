"use client";

import { useMemo, type ReactNode } from "react";

import { getDenaliFieldRegistryByStep } from "@repo/denali-domain";

import { getDenaliStepTitleFa } from "@/features/tours/wizard/denaliStepConfig";
import { useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";

import editStyles from "@/components/tours/DenaliTourEditForm.module.css";

import { DenaliFieldRenderer } from "./DenaliFieldRenderer";
import {
  getSuppressedCanonicalPathsForSection,
  type DenaliEditSectionId,
} from "./denaliSectionSuppress";
import {
  DenaliBasicInfoSection,
  DenaliLegalSection,
  DenaliLogisticsSection,
  DenaliPhotosSection,
  DenaliPricingSection,
  DenaliProgramNatureSection,
} from "../sections";

export type { DenaliEditSectionId } from "./denaliSectionSuppress";

const SECTION_BODY: Record<
  DenaliEditSectionId,
  (props: { tourId?: string }) => ReactNode
> = {
  denali_basic: () => <DenaliBasicInfoSection />,
  denali_program: () => <DenaliProgramNatureSection />,
  denali_logistics: () => <DenaliLogisticsSection />,
  denali_pricing: () => <DenaliPricingSection />,
  denali_legal: () => <DenaliLegalSection />,
  denali_photos: (props) => <DenaliPhotosSection tourId={props.tourId} />,
};

export type DenaliSectionProps = {
  sectionId: DenaliEditSectionId;
  tourId?: string;
};

/**
 * Flat-edit section: registry visibility gate + section body (decoupled from wizard/steps imports).
 * Supplemental registry rows render via {@link DenaliFieldRenderer} when not suppressed.
 */
export function DenaliSection({ sectionId, tourId }: DenaliSectionProps) {
  const { isVisible } = useDenaliStepFieldRules(sectionId);
  const registryRows = useMemo(() => getDenaliFieldRegistryByStep(sectionId), [sectionId]);
  const suppressedPaths = useMemo(
    () => getSuppressedCanonicalPathsForSection(sectionId),
    [sectionId],
  );

  const hasVisibleField = registryRows.some(
    (row) => row.inRuleModel !== false && isVisible(row.canonicalPath),
  );

  if (!hasVisibleField) {
    return null;
  }

  const supplemental = registryRows.filter(
    (row) =>
      row.inRuleModel !== false &&
      !suppressedPaths.has(row.canonicalPath) &&
      isVisible(row.canonicalPath),
  );

  const Body = SECTION_BODY[sectionId];

  return (
    <section
      className={editStyles.section}
      data-testid={`denali-section-${sectionId}`}
      data-section-id={sectionId}
    >
      <h2 className={editStyles.sectionTitle}>{getDenaliStepTitleFa(sectionId)}</h2>
      <div className={editStyles.sectionBody}>
        <Body tourId={tourId} />
        {supplemental.map((field) => (
          <DenaliFieldRenderer key={field.canonicalPath} field={field} />
        ))}
      </div>
    </section>
  );
}

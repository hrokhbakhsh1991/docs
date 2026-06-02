"use client";

import { useMemo } from "react";

import { getDenaliFieldRegistryByStep } from "@repo/denali-domain";
import { useTranslations } from "next-intl";

import { useDenaliStepFieldRules } from "@/features/tours/wizard/denali/application";

import { DenaliFieldRenderer } from "./DenaliFieldRenderer";
import { shouldRenderDenaliRegistryField } from "./denaliFieldRendererAnchors";
import { DenaliSectionProvider } from "./DenaliSectionContext";
import type { DenaliEditSectionId } from "./denaliSectionSuppress";

const SECTION_BODY_TESTID: Record<DenaliEditSectionId, string> = {
  denali_basic: "denali-section-basics",
  denali_program: "denali-section-program",
  denali_logistics: "denali-section-logistics",
  denali_pricing: "denali-section-pricing",
  denali_legal: "denali-section-legal",
  denali_photos: "denali-section-photos",
};

export type DenaliRegistryFieldsProps = {
  sectionId: DenaliEditSectionId;
  tourId?: string;
};

/** Registry-driven step body — shared by wizard steps and flat-edit sections. */
export function DenaliRegistryFields({ sectionId, tourId }: DenaliRegistryFieldsProps) {
  const t = useTranslations("tours.denali");
  const { isVisible } = useDenaliStepFieldRules(sectionId);
  const registryRows = useMemo(() => getDenaliFieldRegistryByStep(sectionId), [sectionId]);

  const visibleRows = registryRows.filter(
    (row) =>
      row.inRuleModel !== false &&
      shouldRenderDenaliRegistryField(row) &&
      isVisible(row.canonicalPath),
  );

  if (visibleRows.length === 0) {
    return null;
  }

  const gap = sectionId === "denali_logistics" ? "1.25rem" : "0.85rem";

  return (
    <DenaliSectionProvider tourId={tourId}>
      <div
        style={{ display: "grid", gap }}
        data-testid={SECTION_BODY_TESTID[sectionId]}
      >
        {sectionId === "denali_pricing" ? (
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-slate-500)" }}>
            {t("pricing.offlineOnlyHint")}
          </p>
        ) : null}
        {visibleRows.map((field) => (
          <DenaliFieldRenderer key={field.canonicalPath} field={field} />
        ))}
      </div>
    </DenaliSectionProvider>
  );
}

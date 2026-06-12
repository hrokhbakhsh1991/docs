"use client";

import React from "react";
import { useTranslations } from "next-intl";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";

import { DenaliLocationPointEditor } from "./denali-location-point-editor";
import { DENALI_COMPOSITE_TEST_IDS, DENALI_LOCATION_ZONE_PATHS } from "./denali-location-types";

type DenaliLocationZonesFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

export function DenaliLocationZonesField({ draft, onDraftChange }: DenaliLocationZonesFieldProps) {
  const t = useTranslations("denali");
  const title = t("composites.location.sectionTitle");

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_COMPOSITE_TEST_IDS.locationZones}>
      <h3 className="denali-wizard-composite__title">{title}</h3>
      <p className="denali-wizard-composite__status">{t("composites.location.zonesHelper")}</p>
      {DENALI_LOCATION_ZONE_PATHS.map((zone) => (
        <DenaliLocationPointEditor
          key={zone.path}
          draft={draft}
          onDraftChange={onDraftChange}
          canonicalPath={zone.path}
          heading={t(`composites.locationTypes.${zone.path}`)}
          testIdKey={zone.path}
        />
      ))}
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { DenaliLocationPointEditor } from "../components/denali-location-point-editor";
import { DENALI_COMPOSITE_TEST_IDS, DENALI_LOCATION_ZONE_PATHS } from "../logic/denali-location-types";
import { resolveDenaliLocationZoneLabelKey } from "../logic/denali-location-zone-labels";

type DenaliLocationZonesFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

export function DenaliLocationZonesField({
  draft,
  onDraftChange,
  invalid = false,
}: DenaliLocationZonesFieldProps) {
  const t = useTranslations("denali");
  const title = t("composites.location.sectionTitle");
  const tourKind = getCanonicalStringValue(draft, "category");

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_COMPOSITE_TEST_IDS.locationZones}
      aria-invalid={invalid || undefined}
    >
      <h3 className="denali-wizard-composite__title">{title}</h3>
      <p className="denali-wizard-composite__status">{t("composites.location.zonesHelper")}</p>
      {DENALI_LOCATION_ZONE_PATHS.map((zone) => (
        <DenaliLocationPointEditor
          key={zone.path}
          draft={draft}
          onDraftChange={onDraftChange}
          canonicalPath={zone.path}
          heading={t(resolveDenaliLocationZoneLabelKey(zone.path, tourKind))}
          testIdKey={zone.path}
        />
      ))}
    </div>
  );
}

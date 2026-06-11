"use client";

import React from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";

import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { DenaliMapPreview } from "./denali-map-preview";
import {
  DENALI_COMPOSITE_TEST_IDS,
  parseCoordinateInput,
  parseDenaliGatheringPoints,
  type DenaliGatheringPoint,
} from "./denali-location-types";

const GATHERING_POINTS_PATH = "tripDetails.logistics.gatheringPoints";

type DenaliGatheringPointsFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

function updateGatheringPoints(
  draft: TourWizardDraft,
  onDraftChange: (draft: TourWizardDraft) => void,
  next: DenaliGatheringPoint[]
): void {
  onDraftChange(setCanonicalValue(draft, GATHERING_POINTS_PATH, next));
}

export function DenaliGatheringPointsField({
  draft,
  onDraftChange,
}: DenaliGatheringPointsFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const points = parseDenaliGatheringPoints(getCanonicalValue(draft, GATHERING_POINTS_PATH));
  const label = resolveDenaliFieldLabel(t, "gatheringPoints");

  const patchPoint = (index: number, patch: Partial<DenaliGatheringPoint>) => {
    const next = points.map((point, pointIndex) =>
      pointIndex === index ? { ...point, ...patch } : point
    );
    updateGatheringPoints(draft, onDraftChange, next);
  };

  const addPoint = () => {
    updateGatheringPoints(draft, onDraftChange, [
      ...points,
      { name: "", isPrimary: points.length === 0 },
    ]);
  };

  const removePoint = (index: number) => {
    updateGatheringPoints(
      draft,
      onDraftChange,
      points.filter((_, pointIndex) => pointIndex !== index)
    );
  };

  const setPrimary = (index: number) => {
    updateGatheringPoints(
      draft,
      onDraftChange,
      points.map((point, pointIndex) => ({ ...point, isPrimary: pointIndex === index }))
    );
  };

  return (
    <div className="denali-wizard-composite" data-denali-wizard-surface="section" data-testid={DENALI_COMPOSITE_TEST_IDS.gatheringPoints}>
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__status">{t("composites.gatheringPoints.helper")}</p>
      </div>
      {points.map((point, index) => (
        <fieldset key={`gathering-${index}`} className="denali-wizard-composite__panel">
          <legend className="denali-wizard-composite__legend">
            {t("composites.gatheringPoints.station", { n: index + 1 })}
            {point.isPrimary === true ? t("composites.gatheringPoints.primary") : ""}
          </legend>
          <label className="denali-wizard-composite__field">
            <span>{tCommon("name")}</span>
            <Input
              value={point.name ?? ""}
              onChange={(event) => patchPoint(index, { name: event.target.value })}
            />
          </label>
          <label className="denali-wizard-composite__field">
            <span>{tCommon("address")}</span>
            <Input
              value={point.address ?? ""}
              onChange={(event) => patchPoint(index, { address: event.target.value })}
            />
          </label>
          <div className="denali-wizard-composite__grid-2">
            <label className="denali-wizard-composite__field">
              <span>{tCommon("latitude")}</span>
              <PrimitiveLocalizedNumericInput
                mode="decimal"
                value={point.latitude !== undefined ? String(point.latitude) : ""}
                onChange={(value) => patchPoint(index, { latitude: parseCoordinateInput(value) })}
              />
            </label>
            <label className="denali-wizard-composite__field">
              <span>{tCommon("longitude")}</span>
              <PrimitiveLocalizedNumericInput
                mode="decimal"
                value={point.longitude !== undefined ? String(point.longitude) : ""}
                onChange={(value) => patchPoint(index, { longitude: parseCoordinateInput(value) })}
              />
            </label>
          </div>
          <div className="denali-wizard-composite__actions">
            <Button type="button" variant="secondary" onClick={() => setPrimary(index)}>
              {t("composites.gatheringPoints.setPrimary")}
            </Button>
            <Button type="button" variant="secondary" onClick={() => removePoint(index)}>
              {t("composites.gatheringPoints.removeStation")}
            </Button>
          </div>
          <DenaliMapPreview latitude={point.latitude} longitude={point.longitude} />
        </fieldset>
      ))}
      <Button type="button" onClick={addPoint}>
        {t("composites.gatheringPoints.addStation")}
      </Button>
    </div>
  );
}

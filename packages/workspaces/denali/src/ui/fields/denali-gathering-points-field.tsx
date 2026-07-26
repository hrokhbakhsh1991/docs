"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Button, Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { DenaliLocationAddressPicker } from "../components/denali-location-address-picker";
import {
  DENALI_COMPOSITE_TEST_IDS,
  createEmptyDenaliGatheringPoint,
  parseDenaliGatheringPoints,
  type DenaliGatheringPoint,
} from "../logic/denali-location-types";

const GATHERING_POINTS_PATH = "tripDetails.logistics.gatheringPoints";

type DenaliGatheringPointsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
};

export function DenaliGatheringPointsField({
  draft,
  onDraftChange,
}: DenaliGatheringPointsFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const seededRef = useRef(false);
  const draftRef = useLatestWizardDraft(draft);

  const points = parseDenaliGatheringPoints(getCanonicalValue(draft, GATHERING_POINTS_PATH));
  const label = resolveDenaliFieldLabel(t, "gatheringPoints");

  const updateGatheringPoints = (next: DenaliGatheringPoint[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalValue(base, GATHERING_POINTS_PATH, next)
    );
  };

  useEffect(() => {
    if (seededRef.current || points.length > 0) {
      return;
    }
    seededRef.current = true;
    updateGatheringPoints([createEmptyDenaliGatheringPoint(true)]);
  }, [points.length]);

  const patchPoint = (index: number, patch: Partial<DenaliGatheringPoint>) => {
    const currentPoints = parseDenaliGatheringPoints(
      getCanonicalValue(draftRef.current, GATHERING_POINTS_PATH)
    );
    const next = currentPoints.map((point, pointIndex) =>
      pointIndex === index ? { ...point, ...patch } : point
    );
    updateGatheringPoints(next);
  };

  const addPoint = () => {
    const currentPoints = parseDenaliGatheringPoints(
      getCanonicalValue(draftRef.current, GATHERING_POINTS_PATH)
    );
    updateGatheringPoints([
      ...currentPoints,
      createEmptyDenaliGatheringPoint(currentPoints.length === 0),
    ]);
  };

  const removePoint = (index: number) => {
    const currentPoints = parseDenaliGatheringPoints(
      getCanonicalValue(draftRef.current, GATHERING_POINTS_PATH)
    );
    if (currentPoints.length <= 1) {
      return;
    }
    updateGatheringPoints(currentPoints.filter((_, pointIndex) => pointIndex !== index));
  };

  const setPrimary = (index: number) => {
    const currentPoints = parseDenaliGatheringPoints(
      getCanonicalValue(draftRef.current, GATHERING_POINTS_PATH)
    );
    updateGatheringPoints(
      currentPoints.map((point, pointIndex) => ({ ...point, isPrimary: pointIndex === index }))
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_COMPOSITE_TEST_IDS.gatheringPoints}
    >
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
          <DenaliLocationAddressPicker
            testIdKey={`gathering-${index}`}
            value={point}
            onChange={(patch) => patchPoint(index, patch)}
            label={tCommon("address")}
            hint={t("composites.gatheringPoints.addressHint")}
          />
          <div className="denali-wizard-composite__actions">
            <Button type="button" variant="secondary" onClick={() => setPrimary(index)}>
              {t("composites.gatheringPoints.setPrimary")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => removePoint(index)}
              disabled={points.length <= 1}
            >
              {t("composites.gatheringPoints.removeStation")}
            </Button>
          </div>
        </fieldset>
      ))}
      <Button type="button" onClick={addPoint}>
        {t("composites.gatheringPoints.addStation")}
      </Button>
    </div>
  );
}

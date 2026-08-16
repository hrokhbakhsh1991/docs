"use client";

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
  DENALI_GATHERING_POINTS_CANONICAL_PATH,
  DENALI_GATHERING_POINTS_NESTED_PATH,
  createEmptyDenaliGatheringPoint,
  resolveDenaliGatheringPointsEditorState,
  resolveDenaliGatheringPointsFromStorage,
  type DenaliGatheringPoint,
} from "../logic/denali-location-types";

type DenaliGatheringPointsFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly invalid?: boolean;
};

export function DenaliGatheringPointsField({
  draft,
  onDraftChange,
  invalid = false,
}: DenaliGatheringPointsFieldProps) {
  const t = useTranslations("denali");
  const tCommon = useTranslations("denali.composites.common");
  const draftRef = useLatestWizardDraft(draft);

  const stored = resolveDenaliGatheringPointsFromStorage(
    getCanonicalValue(draft, DENALI_GATHERING_POINTS_CANONICAL_PATH),
    getCanonicalValue(draft, DENALI_GATHERING_POINTS_NESTED_PATH)
  );
  const editor = resolveDenaliGatheringPointsEditorState(stored);
  const points = editor.points;
  const label = resolveDenaliFieldLabel(t, "gatheringPoints");

  const updateGatheringPoints = (next: DenaliGatheringPoint[]) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) => {
      const withRoot = setCanonicalValue(base, DENALI_GATHERING_POINTS_CANONICAL_PATH, next);
      return setCanonicalValue(withRoot, DENALI_GATHERING_POINTS_NESTED_PATH, next);
    });
  };

  const readCurrentOrScaffold = (): DenaliGatheringPoint[] => {
    const current = resolveDenaliGatheringPointsFromStorage(
      getCanonicalValue(draftRef.current, DENALI_GATHERING_POINTS_CANONICAL_PATH),
      getCanonicalValue(draftRef.current, DENALI_GATHERING_POINTS_NESTED_PATH)
    );
    return current.length > 0 ? current : [createEmptyDenaliGatheringPoint(true)];
  };

  const patchPoint = (index: number, patch: Partial<DenaliGatheringPoint>) => {
    const next = readCurrentOrScaffold().map((point, pointIndex) =>
      pointIndex === index ? { ...point, ...patch } : point
    );
    updateGatheringPoints(next);
  };

  const addPoint = () => {
    const current = readCurrentOrScaffold();
    updateGatheringPoints([...current, createEmptyDenaliGatheringPoint(current.length === 0)]);
  };

  const removePoint = (index: number) => {
    const current = readCurrentOrScaffold();
    if (current.length <= 1) {
      return;
    }
    updateGatheringPoints(current.filter((_, pointIndex) => pointIndex !== index));
  };

  const setPrimary = (index: number) => {
    const current = readCurrentOrScaffold();
    updateGatheringPoints(
      current.map((point, pointIndex) => ({ ...point, isPrimary: pointIndex === index }))
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-testid={DENALI_COMPOSITE_TEST_IDS.gatheringPoints}
      data-gathering-scaffold={editor.scaffold ? "true" : "false"}
      aria-invalid={invalid || undefined}
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
            onChange={(patch) => {
              const osmName = patch.osmName?.trim() ?? "";
              const currentName = (point.name ?? "").trim();
              const { osmName: _osmName, ...location } = patch;
              patchPoint(index, {
                ...location,
                ...(currentName.length === 0 && osmName.length > 0 ? { name: osmName } : {}),
              });
            }}
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

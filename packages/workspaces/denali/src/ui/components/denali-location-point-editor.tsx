"use client";

import { useEffect, useState, type SyntheticEvent } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import {
  denaliLocationZoneOverviewPath,
  isDenaliLocationDataPopulated,
  mergeDenaliLocationDataPatch,
  resolveDenaliLocationZoneFromStorage,
  toStoredDenaliLocationZoneValue,
  type DenaliLocationData,
  type DenaliLocationZonePath,
} from "../logic/denali-location-types";
import { DenaliLocationAddressPicker } from "./denali-location-address-picker";

type DenaliLocationPointEditorProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly heading: string;
  readonly testIdKey: string;
};

export function DenaliLocationPointEditor({
  draft,
  onDraftChange,
  canonicalPath,
  heading,
  testIdKey,
}: DenaliLocationPointEditorProps) {
  const t = useTranslations("denali.composites.common");
  const tLocation = useTranslations("denali.composites.location");
  const draftRef = useLatestWizardDraft(draft);

  const isStartPoint = canonicalPath === "startPoint";
  const nestedPath = denaliLocationZoneOverviewPath(canonicalPath as DenaliLocationZonePath);
  const location = resolveDenaliLocationZoneFromStorage(
    getCanonicalValue(draft, canonicalPath),
    getCanonicalValue(draft, nestedPath)
  );
  const populated = isDenaliLocationDataPopulated(location);
  const [open, setOpen] = useState(populated || isStartPoint);

  useEffect(() => {
    if (populated || isStartPoint) {
      setOpen(true);
    }
  }, [isStartPoint, populated]);

  const updateLocation = (patch: Partial<DenaliLocationData>) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) => {
      const current = resolveDenaliLocationZoneFromStorage(
        getCanonicalValue(base, canonicalPath),
        getCanonicalValue(base, nestedPath)
      );
      const merged = mergeDenaliLocationDataPatch(current, patch);
      const stored = toStoredDenaliLocationZoneValue(merged);
      const withRoot = setCanonicalValue(base, canonicalPath, stored);
      return setCanonicalValue(withRoot, nestedPath, stored);
    });
  };

  const onToggle = (event: SyntheticEvent<HTMLDetailsElement>) => {
    setOpen(event.currentTarget.open);
  };

  return (
    <details
      className={`denali-wizard-composite__panel denali-location-point${
        isStartPoint ? " denali-location-point--primary" : ""
      }`}
      open={open}
      onToggle={onToggle}
      data-testid={`denali-location-zone-${testIdKey}`}
      data-location-zone-open={open ? "true" : "false"}
      data-location-zone-populated={populated ? "true" : "false"}
      data-location-zone-primary={isStartPoint ? "true" : "false"}
    >
      <summary className="denali-wizard-composite__legend denali-location-point__summary">
        {heading}
        {!populated ? (
          <span className="denali-location-point__summary-hint">
            {" — "}
            {isStartPoint ? tLocation("zoneStartHint") : tLocation("zoneOptionalHint")}
          </span>
        ) : isStartPoint ? (
          <span className="denali-location-point__primary-badge">
            {" — "}
            {tLocation("zonePrimaryBadge")}
          </span>
        ) : null}
      </summary>
      <label className="denali-wizard-composite__field">
        <span>{t("label")}</span>
        <Input
          value={location.label ?? ""}
          onChange={(event) => updateLocation({ label: event.target.value })}
        />
      </label>
      <DenaliLocationAddressPicker
        testIdKey={testIdKey}
        value={location}
        onChange={updateLocation}
        locationContextName={heading}
      />
    </details>
  );
}

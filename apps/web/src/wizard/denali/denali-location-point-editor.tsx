"use client";

import React from "react";
import { Input } from "@app-tour/ui-primitives/input";

import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { Button } from "@app-tour/ui-primitives/button";
import { useTranslations } from "next-intl";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { DenaliMapPreview } from "./denali-map-preview";
import {
  parseCoordinateInput,
  parseDenaliLocationData,
  type DenaliLocationData,
} from "./denali-location-types";

type DenaliLocationPointEditorProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly heading: string;
};

function updateLocation(
  draft: TourWizardDraft,
  onDraftChange: (draft: TourWizardDraft) => void,
  canonicalPath: string,
  patch: Partial<DenaliLocationData>
): void {
  const current = parseDenaliLocationData(getCanonicalValue(draft, canonicalPath));
  onDraftChange(setCanonicalValue(draft, canonicalPath, { ...current, ...patch }));
}

export function DenaliLocationPointEditor({
  draft,
  onDraftChange,
  canonicalPath,
  heading,
}: DenaliLocationPointEditorProps) {
  const t = useTranslations("denali.composites.common");
  const tLocation = useTranslations("denali.composites.location");
  const location = parseDenaliLocationData(getCanonicalValue(draft, canonicalPath));

  const useCurrentPosition = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        updateLocation(draft, onDraftChange, canonicalPath, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <fieldset className="denali-wizard-composite__panel">
      <legend className="denali-wizard-composite__legend">{heading}</legend>
      <label className="denali-wizard-composite__field">
        <span>{t("label")}</span>
        <Input
          value={location.label ?? ""}
          onChange={(event) =>
            updateLocation(draft, onDraftChange, canonicalPath, { label: event.target.value })
          }
        />
      </label>
      <label className="denali-wizard-composite__field">
        <span>{t("address")}</span>
        <Input
          value={location.address ?? ""}
          onChange={(event) =>
            updateLocation(draft, onDraftChange, canonicalPath, { address: event.target.value })
          }
        />
      </label>
      <div className="denali-wizard-composite__grid-2">
        <label className="denali-wizard-composite__field">
          <span>{t("latitude")}</span>
          <PrimitiveLocalizedNumericInput
            mode="decimal"
            value={location.latitude !== undefined ? String(location.latitude) : ""}
            onChange={(value) =>
              updateLocation(draft, onDraftChange, canonicalPath, {
                latitude: parseCoordinateInput(value),
              })
            }
          />
        </label>
        <label className="denali-wizard-composite__field">
          <span>{t("longitude")}</span>
          <PrimitiveLocalizedNumericInput
            mode="decimal"
            value={location.longitude !== undefined ? String(location.longitude) : ""}
            onChange={(value) =>
              updateLocation(draft, onDraftChange, canonicalPath, {
                longitude: parseCoordinateInput(value),
              })
            }
          />
        </label>
      </div>
      <Button type="button" variant="secondary" onClick={useCurrentPosition}>
        {tLocation("useCurrentLocation")}
      </Button>
      <DenaliMapPreview latitude={location.latitude} longitude={location.longitude} />
    </fieldset>
  );
}

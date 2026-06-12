"use client";

import React, { useRef } from "react";
import { Input } from "@app-tour/ui-primitives/input";
import { Button } from "@app-tour/ui-primitives/button";
import { useTranslations } from "next-intl";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import { DenaliLocationAddressPicker } from "./denali-location-address-picker";
import { fetchReverseGeocodeAddress } from "./denali-reverse-geocode-client";
import { parseDenaliLocationData, type DenaliLocationData } from "./denali-location-types";

type DenaliLocationPointEditorProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
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
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const location = parseDenaliLocationData(getCanonicalValue(draft, canonicalPath));

  const updateLocation = (patch: Partial<DenaliLocationData>) => {
    const current = parseDenaliLocationData(getCanonicalValue(draftRef.current, canonicalPath));
    const nextDraft = setCanonicalValue(draftRef.current, canonicalPath, { ...current, ...patch });
    draftRef.current = nextDraft;
    onDraftChange(nextDraft);
  };

  const useCurrentPosition = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        void (async () => {
          const address = await fetchReverseGeocodeAddress(latitude, longitude);
          updateLocation({
            latitude,
            longitude,
            ...(address !== null ? { address } : {}),
          });
        })();
      },
      () => undefined,
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  return (
    <details className="denali-wizard-composite__panel denali-location-point" open>
      <summary className="denali-wizard-composite__legend denali-location-point__summary">{heading}</summary>
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
      />
      <Button type="button" variant="secondary" onClick={useCurrentPosition}>
        {tLocation("useCurrentLocation")}
      </Button>
    </details>
  );
}

"use client";

import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";
import { Button, Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { fetchReverseGeocodeAddress } from "../adapters/reverse-geocode-client";
import { parseDenaliLocationData, type DenaliLocationData } from "../logic/denali-location-types";
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

  const location = parseDenaliLocationData(getCanonicalValue(draft, canonicalPath));

  const updateLocation = (patch: Partial<DenaliLocationData>) => {
    commitWizardDraftEdit(draftRef, onDraftChange, (base) => {
      const current = parseDenaliLocationData(getCanonicalValue(base, canonicalPath));
      return setCanonicalValue(base, canonicalPath, { ...current, ...patch });
    });
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

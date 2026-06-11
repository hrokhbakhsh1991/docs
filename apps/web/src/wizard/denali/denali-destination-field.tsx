"use client";

import React, { useEffect, useState } from "react";
import { Select, type SelectOption } from "@app-tour/ui-primitives/select";
import { useTranslations } from "next-intl";

import type { DestinationResource } from "@/features/settings/settings-module-types";
import { parseLocationsResponse } from "@/features/settings/locations-logic";
import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import { resolveCodedErrorMessage } from "@/i18n/resolve-coded-error-message";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";

import { DENALI_COMPOSITE_TEST_IDS } from "./denali-location-types";

type DenaliDestinationFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
};

function applyDestinationSelection(
  draft: TourWizardDraft,
  canonicalPath: string,
  destinationId: string,
  destinationById: ReadonlyMap<string, DestinationResource>
): TourWizardDraft {
  let next = setCanonicalStringValue(draft, canonicalPath, destinationId);
  const altitudeM = destinationById.get(destinationId)?.altitudeM;
  if (typeof altitudeM === "number" && Number.isFinite(altitudeM) && altitudeM > 0) {
    next = setCanonicalStringValue(next, "tripDetails.overview.peakHeight", String(altitudeM));
  }
  return next;
}

export function DenaliDestinationField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
}: DenaliDestinationFieldProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const [options, setOptions] = useState<readonly SelectOption[]>([]);
  const [destinationById, setDestinationById] = useState<ReadonlyMap<string, DestinationResource>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const value = getCanonicalStringValue(draft, canonicalPath);
  const label = resolveDenaliFieldLabel(t, canonicalPath);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/resources/locations", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`LOCATIONS_HTTP_${response.status}`);
        }
        return parseLocationsResponse(await response.json());
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        const regionById = new Map(payload.regions.map((region) => [region.id, region.name]));
        const byId = new Map(payload.destinations.map((destination) => [destination.id, destination]));
        setDestinationById(byId);
        setOptions(
          payload.destinations
            .filter((destination) => destination.isActive)
            .map((destination) => {
              const regionName = regionById.get(destination.regionId);
              const suffix = regionName ? ` (${regionName})` : "";
              return {
                value: destination.id,
                label: `${destination.name}${suffix}`,
              };
            })
        );
        setError(null);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "LOCATIONS_LOAD_FAILED");
          setOptions([]);
          setDestinationById(new Map());
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="denali-wizard-composite" data-testid={DENALI_COMPOSITE_TEST_IDS.destination}>
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Select
          aria-label={label}
          options={options}
          value={value}
          placeholder={
            loading
              ? t("composites.destination.loadingPlaceholder")
              : t("composites.destination.selectPlaceholder")
          }
          required={required}
          onChange={(event) => {
            const nextId = event.target.value;
            if (nextId.length === 0) {
              onDraftChange(setCanonicalStringValue(draft, canonicalPath, ""));
              return;
            }
            onDraftChange(applyDestinationSelection(draft, canonicalPath, nextId, destinationById));
          }}
        />
      </label>
      {error !== null ? (
        <p className="denali-wizard-composite__error">{resolveCodedErrorMessage(tErrors, error)}</p>
      ) : null}
      {options.length === 0 && !loading && error === null ? (
        <p className="denali-wizard-composite__status">{t("composites.destination.empty")}</p>
      ) : null}
    </div>
  );
}

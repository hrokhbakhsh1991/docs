"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliDestinationCatalogMetricBinding } from "../../settings/destination-catalog-metric-bindings";
import {
  isDestinationCatalogMetricLocked,
  readLockedDestinationCatalogMetricValue,
} from "../../settings/resolve-destination-catalog-metric-lock";
import { patchDestinationCatalogMetric } from "../adapters/persist-destination-catalog-metric";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import { PrimitiveLocalizedNumericInput } from "../components/localized-numeric-input";
import {
  patchDenaliDestinationCatalogCache,
  useDenaliDestinationCatalog,
} from "../hooks/use-destination-catalog";

export const DENALI_DESTINATION_CATALOG_METRIC_TEST_IDS = {
  field: "denali-composite-destination-catalog-metric",
  lockedHint: "denali-composite-destination-catalog-metric-locked-hint",
} as const;

type DenaliDestinationCatalogMetricFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

const METRIC_PATCH_DEBOUNCE_MS = 500;

export function DenaliDestinationCatalogMetricField({
  draft,
  onDraftChange,
  canonicalPath,
  required = false,
  invalid = false,
}: DenaliDestinationCatalogMetricFieldProps) {
  const binding = resolveDenaliDestinationCatalogMetricBinding(canonicalPath);
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");
  const draftRef = useLatestWizardDraft(draft);
  const { destinationById } = useDenaliDestinationCatalog();
  const [writebackError, setWritebackError] = useState<string | null>(null);
  const [writebackPending, setWritebackPending] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const writebackSeqRef = useRef(0);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  if (binding == null) {
    return null;
  }

  const destinationId = getCanonicalStringValue(draft, "destinationId").trim();
  const destination =
    destinationId.length > 0 ? destinationById.get(destinationId) : undefined;
  const locked = isDestinationCatalogMetricLocked(destination, binding);
  const label = resolveDenaliFieldLabel(t, canonicalPath);
  const draftValue = getCanonicalStringValue(draft, canonicalPath);
  const displayValue = locked
    ? readLockedDestinationCatalogMetricValue(destination, binding)
    : draftValue;

  const scheduleCatalogWriteback = (nextRaw: string) => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
    }
    if (destinationId.length === 0 || locked) {
      return;
    }
    const seq = ++writebackSeqRef.current;
    debounceRef.current = setTimeout(() => {
      void (async () => {
        setWritebackPending(true);
        setWritebackError(null);
        const result = await patchDestinationCatalogMetric({
          destinationId,
          binding,
          rawValue: nextRaw,
        });
        if (seq !== writebackSeqRef.current) {
          return;
        }
        setWritebackPending(false);
        if (!result.ok) {
          setWritebackError(result.code);
          return;
        }
        patchDenaliDestinationCatalogCache(result.destination);
      })();
    }, METRIC_PATCH_DEBOUNCE_MS);
  };

  return (
    <div
      className="denali-wizard-composite"
      data-testid={DENALI_DESTINATION_CATALOG_METRIC_TEST_IDS.field}
      data-catalog-metric-locked={locked ? "true" : "false"}
      data-catalog-metric-path={canonicalPath}
    >
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <PrimitiveLocalizedNumericInput
          mode={binding.inputMode}
          aria-label={label}
          value={displayValue}
          disabled={locked || destinationId.length === 0}
          onChange={(value) => {
            setWritebackError(null);
            commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
              setCanonicalStringValue(base, canonicalPath, value)
            );
            scheduleCatalogWriteback(value);
          }}
          required={required}
          aria-required={required || undefined}
          invalid={invalid}
          placeholder={t(`composites.destinationCatalogMetric.${binding.inputMode}Placeholder`)}
        />
      </label>
      {locked ? (
        <p
          className="denali-wizard-composite__helper"
          data-testid={DENALI_DESTINATION_CATALOG_METRIC_TEST_IDS.lockedHint}
        >
          {t("composites.destinationCatalogMetric.lockedFromSettings")}
        </p>
      ) : null}
      {destinationId.length === 0 ? (
        <p className="denali-wizard-composite__status">
          {t("composites.destinationCatalogMetric.selectDestinationFirst")}
        </p>
      ) : null}
      {writebackPending ? (
        <p className="denali-wizard-composite__status" aria-live="polite">
          {t("composites.destinationCatalogMetric.savingToSettings")}
        </p>
      ) : null}
      {writebackError !== null ? (
        <p className="denali-wizard-composite__error">
          {resolveCodedErrorMessage(tErrors, writebackError)}
        </p>
      ) : null}
    </div>
  );
}

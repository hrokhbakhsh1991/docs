"use client";

import { CheckCircle2, UserRound, X } from "lucide-react";
import React, { useMemo, useState } from "react";
import { Button } from "@app-tour/ui-primitives/button";
import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";

import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import { parseStringArray } from "./denali-array-field-utils";

const INCLUDED_PATH = "tripDetails.logistics.includedServices";
const EXCLUDED_PATH = "tripDetails.logistics.excludedServices";

export const DENALI_TOUR_SERVICES_TEST_IDS = {
  panel: "denali-composite-tour-services",
  includedAdd: "denali-tour-services-included-add",
  selfAdd: "denali-tour-services-self-add",
} as const;

type ServiceBucket = "included" | "selfProvided";

type DenaliTourServicesFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
};

function bucketPath(bucket: ServiceBucket): string {
  return bucket === "included" ? INCLUDED_PATH : EXCLUDED_PATH;
}

type ServiceColumnProps = {
  readonly bucket: ServiceBucket;
  readonly title: string;
  readonly helper: string;
  readonly items: readonly string[];
  readonly suggestions: readonly string[];
  readonly otherItems: readonly string[];
  readonly addTestId: string;
  readonly onAdd: (label: string) => void;
  readonly onRemove: (index: number) => void;
  readonly addLabel: string;
  readonly placeholder: string;
  readonly suggestionsLabel: string;
  readonly removeLabel: (name: string) => string;
  readonly emptyBucket: string;
};

function ServiceColumn({
  bucket,
  title,
  helper,
  items,
  suggestions,
  otherItems,
  addTestId,
  onAdd,
  onRemove,
  addLabel,
  placeholder,
  suggestionsLabel,
  removeLabel,
  emptyBucket,
}: ServiceColumnProps) {
  const [draftLabel, setDraftLabel] = useState("");
  const toneClass =
    bucket === "included"
      ? "denali-tour-services__column--included"
      : "denali-tour-services__column--self";

  const tryAdd = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return;
    }
    onAdd(trimmed);
    setDraftLabel("");
  };

  const visibleSuggestions = suggestions.filter(
    (entry) => !items.includes(entry) && !otherItems.includes(entry)
  );

  return (
    <section
      className={`denali-tour-services__column ${toneClass}`}
      data-denali-tour-services-column={bucket}
      aria-label={title}
    >
      <header className="denali-tour-services__column-header">
        <span className="denali-tour-services__column-icon" aria-hidden>
          {bucket === "included" ? <CheckCircle2 /> : <UserRound />}
        </span>
        <div className="denali-tour-services__column-heading">
          <h4 className="denali-tour-services__column-title">{title}</h4>
          <p className="denali-tour-services__column-helper">{helper}</p>
        </div>
      </header>

      {items.length > 0 ? (
        <ul className="denali-tour-services__chips" role="list">
          {items.map((entry, index) => (
            <li key={`${entry}-${index}`} className="denali-tour-services__chip" role="listitem">
              <span className="denali-tour-services__chip-label">{entry}</span>
              <button
                type="button"
                className="denali-tour-services__chip-remove"
                aria-label={removeLabel(entry)}
                onClick={() => onRemove(index)}
              >
                <X aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="denali-tour-services__empty">{emptyBucket}</p>
      )}

      <div className="denali-tour-services__add-row">
        <Input
          value={draftLabel}
          onChange={(event) => setDraftLabel(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              tryAdd(draftLabel);
            }
          }}
          placeholder={placeholder}
          aria-label={addLabel}
        />
        <Button
          type="button"
          variant="secondary"
          data-testid={addTestId}
          onClick={() => tryAdd(draftLabel)}
        >
          {addLabel}
        </Button>
      </div>

      {visibleSuggestions.length > 0 ? (
        <div className="denali-tour-services__suggestions">
          <span className="denali-tour-services__suggestions-label">{suggestionsLabel}</span>
          <div className="denali-tour-services__suggestions-row" role="list">
            {visibleSuggestions.map((entry) => (
              <button
                key={entry}
                type="button"
                role="listitem"
                className="denali-tour-services__suggestion"
                onClick={() => onAdd(entry)}
              >
                {entry}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function DenaliTourServicesField({ draft, onDraftChange }: DenaliTourServicesFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);

  const included = parseStringArray(getCanonicalValue(draft, INCLUDED_PATH));
  const selfProvided = parseStringArray(getCanonicalValue(draft, EXCLUDED_PATH));

  const includedSuggestions = useMemo(
    () => t.raw("composites.tourServices.suggestionsIncluded") as string[],
    [t]
  );
  const selfSuggestions = useMemo(
    () => t.raw("composites.tourServices.suggestionsSelfProvided") as string[],
    [t]
  );

  const writeBucket = (bucket: ServiceBucket, next: string[]) => {
    const path = bucketPath(bucket);
    commitWizardDraftEdit(draftRef, onDraftChange, (base) => setCanonicalValue(base, path, next));
  };

  const readBucket = (bucket: ServiceBucket) =>
    parseStringArray(getCanonicalValue(draftRef.current, bucketPath(bucket)));

  const addToBucket = (bucket: ServiceBucket, raw: string) => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      return;
    }
    const opposite: ServiceBucket = bucket === "included" ? "selfProvided" : "included";
    const current = readBucket(bucket);
    const oppositeItems = readBucket(opposite);
    if (current.includes(trimmed)) {
      return;
    }
    writeBucket(opposite, oppositeItems.filter((entry) => entry !== trimmed));
    writeBucket(bucket, [...current, trimmed]);
  };

  const removeFromBucket = (bucket: ServiceBucket, index: number) => {
    writeBucket(
      bucket,
      readBucket(bucket).filter((_, itemIndex) => itemIndex !== index)
    );
  };

  const totalCount = included.length + selfProvided.length;

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-tour-services
      data-testid={DENALI_TOUR_SERVICES_TEST_IDS.panel}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{t("composites.tourServices.title")}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.tourServices.helper")}</p>
        {totalCount > 0 ? (
          <p className="denali-tour-services__summary">
            {t("composites.tourServices.selectedCount", { count: totalCount })}
          </p>
        ) : null}
      </div>

      <div className="denali-tour-services__grid">
        <ServiceColumn
          bucket="included"
          title={t("composites.tourServices.includedTitle")}
          helper={t("composites.tourServices.includedHelper")}
          items={included}
          suggestions={includedSuggestions}
          otherItems={selfProvided}
          addTestId={DENALI_TOUR_SERVICES_TEST_IDS.includedAdd}
          onAdd={(label) => addToBucket("included", label)}
          onRemove={(index) => removeFromBucket("included", index)}
          addLabel={t("composites.tourServices.addLabel")}
          placeholder={t("composites.tourServices.includedPlaceholder")}
          suggestionsLabel={t("composites.tourServices.suggestionsLabel")}
          removeLabel={(name) => t("composites.tourServices.removeLabel", { name })}
          emptyBucket={t("composites.tourServices.emptyBucket")}
        />
        <ServiceColumn
          bucket="selfProvided"
          title={t("composites.tourServices.selfProvidedTitle")}
          helper={t("composites.tourServices.selfProvidedHelper")}
          items={selfProvided}
          suggestions={selfSuggestions}
          otherItems={included}
          addTestId={DENALI_TOUR_SERVICES_TEST_IDS.selfAdd}
          onAdd={(label) => addToBucket("selfProvided", label)}
          onRemove={(index) => removeFromBucket("selfProvided", index)}
          addLabel={t("composites.tourServices.addLabel")}
          placeholder={t("composites.tourServices.selfProvidedPlaceholder")}
          suggestionsLabel={t("composites.tourServices.suggestionsLabel")}
          removeLabel={(name) => t("composites.tourServices.removeLabel", { name })}
          emptyBucket={t("composites.tourServices.emptyBucket")}
        />
      </div>
    </div>
  );
}

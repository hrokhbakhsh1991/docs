"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import {
  type DenaliTourWizardDraft,
  getCanonicalStringValue,
  setCanonicalStringValue,
} from "../../draft/denali-tour-wizard-draft";
import { resolveDenaliFieldLabel } from "../adapters/field-labels";
import { Input } from "../adapters/platform-primitives";
import { commitWizardDraftEdit, useLatestWizardDraft } from "../adapters/wizard-draft-edit";
import {
  isSocialMediaExternalPending,
  normalizeSocialMediaLink,
} from "../logic/denali-social-media-link-logic";

export const DENALI_SOCIAL_MEDIA_TEST_IDS = {
  root: "denali-composite-social-media-link",
  input: "denali-social-media-input",
} as const;

type DenaliSocialMediaLinkFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
  readonly invalid?: boolean;
};

export function DenaliSocialMediaLinkField({
  draft,
  onDraftChange,
  required = false,
  invalid = false,
}: DenaliSocialMediaLinkFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "socialMediaLink");
  const stored = getCanonicalStringValue(draft, "socialMediaLink");
  const [display, setDisplay] = useState(() =>
    isSocialMediaExternalPending(stored) ? "" : stored.trim()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDisplay(isSocialMediaExternalPending(stored) ? "" : stored.trim());
    setError(null);
  }, [stored]);

  const commitValue = (raw: string) => {
    const result = normalizeSocialMediaLink(raw);
    if (!result.ok) {
      setError(t("composites.socialMedia.invalidUrl"));
      return;
    }
    setError(null);
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "socialMediaLink", result.value)
    );
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-operator-social-media-link
      data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.root}
      aria-invalid={invalid || error !== null || undefined}
    >
      <label className="denali-wizard-composite__field">
        <span>{label}</span>
        <Input
          data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.input}
          type="url"
          dir="ltr"
          value={display}
          required={required}
          aria-required={required || undefined}
          aria-invalid={invalid || error !== null || undefined}
          placeholder={t("composites.socialMedia.urlPlaceholder")}
          onChange={(event) => {
            const next = event.target.value;
            setDisplay(next);
            if (error !== null) {
              setError(null);
            }
          }}
          onBlur={() => commitValue(display)}
        />
      </label>
      <p className="denali-wizard-composite__helper">{t("composites.socialMedia.helper")}</p>
      {error !== null ? <p className="denali-wizard-composite__error">{error}</p> : null}
    </div>
  );
}

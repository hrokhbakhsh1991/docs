"use client";

import React, { useEffect, useState } from "react";
import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";

import { resolveDenaliFieldLabel } from "@/i18n/denali-wizard-labels";
import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalStringValue, setCanonicalStringValue } from "@/tours/tour-wizard-draft-path";
import { commitWizardDraftEdit, useLatestWizardDraft } from "@/wizard/use-latest-wizard-draft";

import {
  detectSocialMediaKind,
  formatTelegramInputDisplay,
  normalizeSocialMediaLinkForKind,
  type SocialMediaKind,
} from "./denali-social-media-link-logic";

export const DENALI_SOCIAL_MEDIA_TEST_IDS = {
  root: "denali-composite-social-media-link",
  telegram: "denali-social-media-kind-telegram",
  other: "denali-social-media-kind-other",
  input: "denali-social-media-input",
} as const;

type DenaliSocialMediaLinkFieldProps = {
  readonly draft: TourWizardDraft;
  readonly onDraftChange: (draft: TourWizardDraft) => void;
  readonly required?: boolean;
};

function readDisplayValue(stored: string, kind: SocialMediaKind): string {
  if (kind === "telegram") {
    return formatTelegramInputDisplay(stored);
  }
  return stored.trim();
}

export function DenaliSocialMediaLinkField({
  draft,
  onDraftChange,
  required = false,
}: DenaliSocialMediaLinkFieldProps) {
  const t = useTranslations("denali");
  const draftRef = useLatestWizardDraft(draft);
  const label = resolveDenaliFieldLabel(t, "socialMediaLink");
  const stored = getCanonicalStringValue(draft, "socialMediaLink");
  const [kind, setKind] = useState<SocialMediaKind>(() => detectSocialMediaKind(stored));
  const [display, setDisplay] = useState(() => readDisplayValue(stored, kind));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextKind = detectSocialMediaKind(stored);
    setKind(nextKind);
    setDisplay(readDisplayValue(stored, nextKind));
    setError(null);
  }, [stored]);

  const commitValue = (nextKind: SocialMediaKind, raw: string) => {
    const result = normalizeSocialMediaLinkForKind(nextKind, raw);
    if (!result.ok) {
      setError(nextKind === "telegram" ? t("composites.socialMedia.invalidTelegram") : t("composites.socialMedia.invalidUrl"));
      return;
    }
    setError(null);
    commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
      setCanonicalStringValue(base, "socialMediaLink", result.value)
    );
  };

  const selectKind = (nextKind: SocialMediaKind) => {
    if (nextKind === kind) {
      return;
    }
    setKind(nextKind);
    setError(null);
    if (nextKind === "telegram") {
      const telegramDisplay = formatTelegramInputDisplay(stored);
      setDisplay(telegramDisplay);
      if (telegramDisplay.length > 0) {
        commitValue("telegram", telegramDisplay);
      } else {
        commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
          setCanonicalStringValue(base, "socialMediaLink", "")
        );
      }
      return;
    }
    const external = stored.trim();
    setDisplay(external);
    if (external.length > 0 && detectSocialMediaKind(external) === "other") {
      commitValue("other", external);
    } else {
      commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
        setCanonicalStringValue(base, "socialMediaLink", "")
      );
    }
  };

  return (
    <div
      className="denali-wizard-composite"
      data-denali-wizard-surface="section"
      data-denali-social-media-link
      data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.root}
    >
      <div className="denali-wizard-composite__header">
        <h3 className="denali-wizard-composite__title">{label}</h3>
        <p className="denali-wizard-composite__helper">{t("composites.socialMedia.helper")}</p>
      </div>

      <div className="denali-social-media__kind" role="group" aria-label={label}>
        <button
          type="button"
          className={
            kind === "telegram"
              ? "denali-social-media__kind-btn denali-social-media__kind-btn--active"
              : "denali-social-media__kind-btn"
          }
          data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.telegram}
          aria-pressed={kind === "telegram"}
          onClick={() => selectKind("telegram")}
        >
          {t("composites.socialMedia.telegram")}
        </button>
        <button
          type="button"
          className={
            kind === "other"
              ? "denali-social-media__kind-btn denali-social-media__kind-btn--active"
              : "denali-social-media__kind-btn"
          }
          data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.other}
          aria-pressed={kind === "other"}
          onClick={() => selectKind("other")}
        >
          {t("composites.socialMedia.other")}
        </button>
      </div>

      <label className="denali-wizard-composite__field">
        <span>
          {kind === "telegram"
            ? t("composites.socialMedia.telegramFieldLabel")
            : t("composites.socialMedia.urlFieldLabel")}
        </span>
        <Input
          data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.input}
          dir="ltr"
          value={display}
          required={required}
          aria-required={required || undefined}
          aria-invalid={error !== null || undefined}
          placeholder={
            kind === "telegram"
              ? t("composites.socialMedia.telegramPlaceholder")
              : t("composites.socialMedia.urlPlaceholder")
          }
          onChange={(event) => {
            const next = event.target.value;
            setDisplay(next);
            if (error !== null) {
              setError(null);
            }
          }}
          onBlur={() => commitValue(kind, display)}
        />
      </label>

      <p className="denali-wizard-composite__helper">
        {kind === "telegram"
          ? t("composites.socialMedia.telegramHint")
          : t("composites.socialMedia.urlHint")}
      </p>
      {error !== null ? <p className="denali-wizard-composite__error">{error}</p> : null}
    </div>
  );
}

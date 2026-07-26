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
  DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING,
  detectSocialMediaKind,
  isSocialMediaExternalPending,
  normalizeSocialMediaLinkForKind,
  type SocialMediaKind,
} from "../logic/denali-social-media-link-logic";

export const DENALI_SOCIAL_MEDIA_TEST_IDS = {
  root: "denali-composite-social-media-link",
  telegram: "denali-social-media-kind-telegram",
  other: "denali-social-media-kind-other",
  input: "denali-social-media-input",
  telegramAutoInfo: "denali-social-media-telegram-auto-info",
} as const;

type DenaliSocialMediaLinkFieldProps = {
  readonly draft: DenaliTourWizardDraft;
  readonly onDraftChange: (draft: DenaliTourWizardDraft) => void;
  readonly required?: boolean;
};

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
  const [display, setDisplay] = useState(() =>
    isSocialMediaExternalPending(stored) ? "" : stored.trim()
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const nextKind = detectSocialMediaKind(stored);
    setKind(nextKind);
    setDisplay(isSocialMediaExternalPending(stored) ? "" : stored.trim());
    setError(null);
  }, [stored]);

  const commitValue = (nextKind: SocialMediaKind, raw: string) => {
    const result = normalizeSocialMediaLinkForKind(nextKind, raw);
    if (!result.ok) {
      setError(
        nextKind === "telegram"
          ? t("composites.socialMedia.invalidTelegram")
          : t("composites.socialMedia.invalidUrl")
      );
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
      setDisplay("");
      commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
        setCanonicalStringValue(base, "socialMediaLink", "")
      );
      return;
    }
    const external = stored.trim();
    setDisplay(external);
    if (external.length > 0 && detectSocialMediaKind(external) === "other") {
      commitValue("other", external);
    } else {
      commitWizardDraftEdit(draftRef, onDraftChange, (base) =>
        setCanonicalStringValue(base, "socialMediaLink", DENALI_SOCIAL_MEDIA_EXTERNAL_PENDING)
      );
    }
  };

  return (
    <div
      className="denali-wizard-composite"
      data-operator-wizard-surface="section"
      data-operator-social-media-link
      data-social-media-kind={kind}
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

      {kind === "telegram" ? (
        <p
          className="denali-wizard-composite__status denali-social-media__auto-info"
          role="status"
          data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.telegramAutoInfo}
        >
          {t("composites.socialMedia.telegramAutoInfo")}
        </p>
      ) : (
        <>
          <label className="denali-wizard-composite__field">
            <span>{t("composites.socialMedia.urlFieldLabel")}</span>
            <Input
              data-testid={DENALI_SOCIAL_MEDIA_TEST_IDS.input}
              dir="ltr"
              value={display}
              required={required}
              aria-required={required || undefined}
              aria-invalid={error !== null || undefined}
              placeholder={t("composites.socialMedia.urlPlaceholder")}
              onChange={(event) => {
                const next = event.target.value;
                setDisplay(next);
                if (error !== null) {
                  setError(null);
                }
              }}
              onBlur={() => commitValue("other", display)}
            />
          </label>
          <p className="denali-wizard-composite__helper">{t("composites.socialMedia.urlHint")}</p>
        </>
      )}

      {error !== null ? <p className="denali-wizard-composite__error">{error}</p> : null}
    </div>
  );
}

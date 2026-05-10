"use client";

import { cn, Button, FormField, Input, useToast } from "@tour/ui";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";
import { convertNumbers, toEnglishIntegerString, uiLocaleDigits } from "../../../src/lib/number-utils";

import styles from "./settings-profile-form.module.css";
import { pickMeErrorMessage, type RefreshWorkspaceMeOptions, type WorkspaceMeData } from "./workspace-me-provider";

export type PhoneSettingsPanelProps = {
  me: WorkspaceMeData;
  refresh: (opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

type PhoneStep = "idle" | "new_number" | "otp";

export function PhoneSettingsPanel({ me, refresh }: PhoneSettingsPanelProps) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const { showToast } = useToast();

  const [step, setStep] = useState<PhoneStep>("idle");
  const [newMobile, setNewMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>(undefined);
  const [otpError, setOtpError] = useState<string | undefined>(undefined);
  const [phoneSuccessInline, setPhoneSuccessInline] = useState("");

  const currentPhone =
    typeof me.phone === "string" && me.phone.trim() !== "" ? me.phone.trim() : null;

  const phoneBadge = useMemo(() => {
    if (!currentPhone) {
      return { kind: "none" as const, label: t("phoneStatusNoNumber") };
    }
    if (me.is_phone_verified === true) {
      return { kind: "verified" as const, label: t("phoneStatusVerified") };
    }
    return { kind: "unverified" as const, label: t("phoneStatusUnverified") };
  }, [currentPhone, me.is_phone_verified, t]);

  const phoneBadgeClass =
    phoneBadge.kind === "verified"
      ? styles.badgeVerified
      : phoneBadge.kind === "unverified"
        ? styles.badgeUnverified
        : styles.badgeNeutral;

  function goIdle(): void {
    setStep("idle");
    setNewMobile("");
    setOtp("");
    setChallengeId(null);
    setPhoneError(undefined);
    setOtpError(undefined);
  }

  async function requestCode(): Promise<void> {
    setOtpError(undefined);
    setPhoneSuccessInline("");
    const normalized = normalizeOtpPhoneInput(newMobile);
    if (normalized.length < 8) {
      const msg = t("phoneValidationTooShort");
      setPhoneError(msg);
      showToast({ type: "error", message: msg });
      return;
    }
    setPhoneError(undefined);
    setRequesting(true);
    try {
      const res = await fetch("/api/me/change-mobile/request", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_mobile: normalized }),
      });
      const body = (await res.json().catch(() => ({}))) as { challenge_id?: string };
      if (!res.ok || typeof body.challenge_id !== "string") {
        const msg = pickMeErrorMessage(body, t("phoneRequestCodeFailedToast"));
        setPhoneError(msg);
        showToast({ type: "error", message: msg });
        return;
      }
      setChallengeId(body.challenge_id);
      setOtp("");
      setStep("otp");
      showToast({ type: "success", message: t("phoneCodeSentToast") });
    } catch {
      const msg = t("phoneRequestCodeFailedToast");
      setPhoneError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setRequesting(false);
    }
  }

  async function verifyCode(): Promise<void> {
    setPhoneSuccessInline("");
    if (!challengeId) {
      const msg = t("phoneRequestCodeFirstToast");
      setOtpError(msg);
      showToast({ type: "error", message: msg });
      return;
    }
    const code = toEnglishIntegerString(otp);
    if (code.length < 1) {
      const msg = t("phoneOtpRequiredToast");
      setOtpError(msg);
      showToast({ type: "error", message: msg });
      return;
    }
    setOtpError(undefined);
    setVerifying(true);
    try {
      const res = await fetch("/api/me/change-mobile/verify", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge_id: challengeId, code }),
      });
      const body = (await res.json().catch(() => ({}))) as { status?: string };
      if (!res.ok || body.status !== "mobile_changed") {
        const msg = pickMeErrorMessage(body, t("phoneVerifyFailedToast"));
        setOtpError(msg);
        showToast({ type: "error", message: msg });
        return;
      }
      setPhoneSuccessInline(t("phoneChangedInlineSuccess"));
      showToast({ type: "success", message: t("phoneChangedToast") });
      goIdle();
      await refresh({ silent: true });
    } catch {
      const msg = t("phoneVerifyFailedToast");
      setOtpError(msg);
      showToast({ type: "error", message: msg });
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className={styles.phoneBlock}>
      {step === "idle" ? (
        <>
          <div className={styles.settingsRow}>
            <p className={styles.currentPhone} dir="ltr">
              {currentPhone ? convertNumbers(currentPhone, "fa") : t("phoneNone")}
            </p>
            <span className={cn(styles.badge, phoneBadgeClass)}>{phoneBadge.label}</span>
          </div>
          {phoneSuccessInline !== "" ? (
            <p className={styles.inlineSuccess} aria-live="polite">
              {phoneSuccessInline}
            </p>
          ) : null}
          <div className={styles.actions}>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setPhoneSuccessInline("");
                setStep("new_number");
              }}
            >
              {t("phoneChangeNumber")}
            </Button>
          </div>
        </>
      ) : null}

      {step === "new_number" ? (
        <>
          <FormField label={t("phoneNewLabel")} description={t("phoneNewDescription")} error={phoneError}>
            <Input
              type="tel"
              autoComplete="tel"
              dir="ltr"
              placeholder={uiLocaleDigits(t("phoneNewPlaceholder"), locale)}
              value={convertNumbers(newMobile, "fa")}
              disabled={requesting}
              aria-invalid={phoneError ? true : undefined}
              onChange={(e) => {
                const ascii = normalizeOtpPhoneInput(convertNumbers(e.target.value, "en"));
                setNewMobile(ascii);
                if (phoneError) {
                  setPhoneError(undefined);
                }
              }}
            />
          </FormField>
          <div className={styles.actions}>
            <Button type="button" variant="primary" loading={requesting} onClick={() => void requestCode()}>
              {t("phoneSendCode")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={requesting}
              onClick={() => {
                setPhoneError(undefined);
                goIdle();
              }}
            >
              {t("phoneCancelChange")}
            </Button>
          </div>
        </>
      ) : null}

      {step === "otp" ? (
        <>
          <FormField label={t("phoneOtpLabel")} error={otpError}>
            <Input
              type="text"
              autoComplete="one-time-code"
              dir="ltr"
              placeholder={uiLocaleDigits(t("phoneOtpPlaceholder"), locale)}
              disabled={verifying}
              aria-invalid={otpError ? true : undefined}
              value={otp === "" ? "" : convertNumbers(otp, "fa")}
              onChange={(e) => {
                const en = toEnglishIntegerString(convertNumbers(e.target.value, "en"));
                setOtp(en);
                if (otpError) {
                  setOtpError(undefined);
                }
              }}
            />
          </FormField>
          {process.env.NODE_ENV === "development" ? <p className={styles.devHint}>{t("phoneDevOtpHint")}</p> : null}
          <div className={styles.actions}>
            <Button type="button" variant="primary" loading={verifying} disabled={requesting} onClick={() => void verifyCode()}>
              {t("phoneVerifySubmit")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={verifying}
              onClick={() => {
                setChallengeId(null);
                setOtp("");
                setOtpError(undefined);
                setStep("new_number");
              }}
            >
              {t("phoneCancelChange")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

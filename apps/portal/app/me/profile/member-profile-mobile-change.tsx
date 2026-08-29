"use client";

import {
  formatIranMobileForDisplay,
  normalizePublicRegistrationMobile,
} from "@app-tour/catalog-registration-auth";
import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  requestMemberMobileChangeOtp,
  verifyMemberMobileChange,
} from "@/me/member-profile-mobile-change.client";

type MemberProfileMobileChangeProps = {
  readonly currentMobile: string | null | undefined;
  readonly onMobileChanged: (mobile: string) => void;
};

type MobileChangeStep = "view" | "phone" | "otp";

function resolveMobileChangeErrorMessage(
  t: (key: string) => string,
  code: string | undefined
): string {
  if (code === undefined || code.length === 0) {
    return t("mobileChange.errors.failed");
  }
  const mapped = t(`mobileChange.errors.${code}`);
  if (mapped !== `mobileChange.errors.${code}`) {
    return mapped;
  }
  return t("mobileChange.errors.failed");
}

export function MemberProfileMobileChange({
  currentMobile,
  onMobileChanged,
}: MemberProfileMobileChangeProps) {
  const t = useTranslations("portalMember.profile");
  const [step, setStep] = useState<MobileChangeStep>("view");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleRequestOtp(): Promise<void> {
    // INV-MP-07 — normalize only; MOBILE_* codes come from BFF.
    const effectivePhone = normalizePublicRegistrationMobile(phone.trim());
    setLoading(true);
    setError(null);
    try {
      const result = await requestMemberMobileChangeOtp(effectivePhone);
      setPhone(effectivePhone);
      setChallengeId(result.challengeId);
      setOtp("");
      setStep("otp");
    } catch (caught) {
      const code = caught instanceof Error ? caught.message : undefined;
      setError(resolveMobileChangeErrorMessage(t, code));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(): Promise<void> {
    // INV-MP-07 — OTP validity codes come from BFF (no local length gate).
    const code = otp.replace(/\D/g, "");
    setLoading(true);
    setError(null);
    try {
      const result = await verifyMemberMobileChange(phone, challengeId, code);
      onMobileChanged(result.mobile);
      setStep("view");
      setPhone("");
      setOtp("");
      setChallengeId("");
      setError(null);
      setSuccess(t("mobileChange.success"));
    } catch (caught) {
      const codeMessage = caught instanceof Error ? caught.message : undefined;
      setError(resolveMobileChangeErrorMessage(t, codeMessage));
    } finally {
      setLoading(false);
    }
  }

  if (step === "phone") {
    return (
      <div data-member-profile-mobile-change data-member-profile-mobile-change-request>
        <div data-member-profile-mobile-change-header>
          <p>{t("fieldLabels.mobile")}</p>
          <p>{t("mobileChange.phoneDescription")}</p>
        </div>
        <label htmlFor="profile-mobile-change-phone">{t("mobileChange.newPhoneLabel")}</label>
        <Input
          id="profile-mobile-change-phone"
          value={phone}
          onChange={(event) => {
            setError(null);
            setPhone(event.target.value);
          }}
          inputMode="tel"
          autoComplete="tel"
        />
        {error !== null ? (
          <p role="alert">
            {error}
          </p>
        ) : null}
        <div
          data-member-profile-action-row
          data-member-profile-mobile-change-actions="request"
        >
          <button
            type="button"
            disabled={loading}
            onClick={() => void handleRequestOtp()}
          >
            {loading ? t("mobileChange.sendingOtp") : t("mobileChange.sendOtp")}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep("view");
              setError(null);
            }}
          >
            {t("mobileChange.cancel")}
          </button>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div data-member-profile-mobile-change data-member-profile-mobile-change-verify>
        <div data-member-profile-mobile-change-header>
          <p>{t("fieldLabels.mobile")}</p>
          <p>{t("mobileChange.otpDescription")}</p>
        </div>
        <label htmlFor="profile-mobile-change-otp">{t("mobileChange.otpLabel")}</label>
        <Input
          id="profile-mobile-change-otp"
          value={otp}
          onChange={(event) => {
            setError(null);
            setOtp(event.target.value);
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
        />
        {error !== null ? (
          <p role="alert">
            {error}
          </p>
        ) : null}
        <div
          data-member-profile-action-row
          data-member-profile-mobile-change-actions="verify"
        >
          <button type="button" disabled={loading} onClick={() => void handleVerify()}>
            {loading ? t("mobileChange.verifying") : t("mobileChange.verify")}
          </button>
          <button
            type="button"
            disabled={loading}
            data-member-profile-mobile-change-resend
            onClick={() => void handleRequestOtp()}
          >
            {loading ? t("mobileChange.resendingOtp") : t("mobileChange.resendOtp")}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => {
              setStep("phone");
              setError(null);
            }}
          >
            {t("mobileChange.back")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div data-member-profile-field="mobile" data-member-profile-mobile-change>
      <div data-member-profile-mobile-change-header>
        <p>{t("fieldLabels.mobile")}</p>
        <p>{t("mobileChange.viewHint")}</p>
      </div>
      <p data-member-profile-mobile-change-value>
        {currentMobile ? formatIranMobileForDisplay(currentMobile) : "—"}
      </p>
      {success !== null ? (
        <p role="status" data-member-profile-mobile-change-success>
          {success}
        </p>
      ) : null}
      <div data-member-profile-mobile-change-actions="view">
        <button
          type="button"
          data-member-profile-mobile-change-start
          onClick={() => {
            setStep("phone");
            setPhone("");
            setError(null);
            setSuccess(null);
          }}
        >
          {t("mobileChange.start")}
        </button>
      </div>
    </div>
  );
}

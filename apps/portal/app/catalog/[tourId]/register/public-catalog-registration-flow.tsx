"use client";

import { Input } from "@app-tour/ui-primitives/input";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";

import { PrimitiveLocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { resolveIntakeDefaults } from "@/catalog/resolve-intake-defaults";
import { resolveCatalogRegistrationErrorMessage } from "@/features/catalog/resolve-catalog-registration-error";
import {
  buildPublicRegistrationProfilePayload,
  initialPublicRegistrationOtp,
  initialPublicRegistrationPhone,
  isPublicRegistrationMobileValid,
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC,
  readPublicRegistrationErrorCode,
  type PublicRegistrationApiError,
  type PublicRegistrationStep,
  type PublicRegistrationWorkspace,
} from "@/features/auth/public-registration-logic";
import {
  normalizeOtpDigits,
  OTP_SEGMENT_LENGTH,
  OtpSegmentInput,
} from "@/features/auth/otp-segment-input";
import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";

type FormProps = {
  readonly workspace: PublicRegistrationWorkspace;
  readonly tenantId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly backHref: string;
};

export function PublicCatalogRegistrationFlow({
  workspace,
  tenantId: _tenantId,
  tourId,
  tourTitle,
  backHref,
}: FormProps) {
  const t = useTranslations("catalogRegistration");
  const phoneErrorId = useId();
  const otpErrorId = useId();
  const nameErrorId = useId();
  const intakeErrorId = useId();

  const [step, setStep] = useState<PublicRegistrationStep>("phone");
  const [phone, setPhone] = useState(initialPublicRegistrationPhone);
  const [otp, setOtp] = useState(initialPublicRegistrationOtp);
  const [challengeId, setChallengeId] = useState("");
  const [onboardingToken, setOnboardingToken] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [intakeEmail, setIntakeEmail] = useState("");
  const [intakeName, setIntakeName] = useState("");
  const [partySize, setPartySize] = useState("1");
  const [notes, setNotes] = useState("");
  const [phoneHint, setPhoneHint] = useState<"existing" | "new" | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [intakeError, setIntakeError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [clientReady, setClientReady] = useState(false);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  const resolveError = useCallback(
    (code: string) => resolveCatalogRegistrationErrorMessage(t, code),
    [t]
  );

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }
    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const beginResendCooldown = useCallback(() => {
    setResendCooldown(PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC);
  }, []);

  const goToIntakeStep = useCallback(
    (input: {
      profileDisplayName?: string;
      profileEmail?: string;
      sessionDisplayName?: string;
      sessionEmail?: string | null;
    }) => {
      const { name, email } = resolveIntakeDefaults(input);
      setIntakeName(name);
      setIntakeEmail(email);
      setStep("intake");
    },
    []
  );

  const hydrateIntakeAfterSession = useCallback(
    async (profileDisplayName = "", profileEmailValue = ""): Promise<void> => {
      let sessionDisplayName = "";
      let sessionEmail: string | null = null;
      try {
        const res = await fetch("/api/public-auth/session-profile");
        const data = (await res.json()) as {
          ok?: boolean;
          display_name?: string;
          email?: string | null;
        };
        if (res.ok && data.ok === true) {
          sessionDisplayName =
            typeof data.display_name === "string" ? data.display_name : "";
          sessionEmail = typeof data.email === "string" ? data.email : null;
        }
      } catch {
        // intake still works with profile-only defaults
      }
      goToIntakeStep({
        profileDisplayName,
        profileEmail: profileEmailValue,
        sessionDisplayName,
        sessionEmail,
      });
    },
    [goToIntakeStep]
  );

  async function runPhonePreflight(effectivePhone: string): Promise<void> {
    try {
      const res = await fetch("/api/public-auth/phone-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: effectivePhone }),
      });
      const data = (await res.json()) as { exists?: boolean };
      if (res.ok) {
        setPhoneHint(data.exists === true ? "existing" : "new");
      }
    } catch {
      setPhoneHint(null);
    }
  }

  async function requestOtp(): Promise<boolean> {
    const effectivePhone = normalizeNumericInputValue(phone, "phone");
    if (effectivePhone !== phone) {
      setPhone(effectivePhone);
    }
    if (effectivePhone.trim().length === 0) {
      setPhoneError(resolveError("MOBILE_REQUIRED"));
      return false;
    }
    if (!isPublicRegistrationMobileValid(effectivePhone)) {
      setPhoneError(resolveError("MOBILE_INVALID"));
      return false;
    }
    setLoading(true);
    setPhoneError(null);
    try {
      await runPhonePreflight(effectivePhone);
      const res = await fetch("/api/public-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: effectivePhone }),
      });
      const data = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !data.ok || typeof data.challenge_id !== "string") {
        setPhoneError(resolveError(readPublicRegistrationErrorCode(data)));
        return false;
      }
      setChallengeId(data.challenge_id);
      setOtp("");
      setOtpError(null);
      setStep("otp");
      beginResendCooldown();
      return true;
    } catch {
      setPhoneError(resolveError("network"));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp(otpOverride?: string): Promise<void> {
    const effectivePhone = normalizeNumericInputValue(phone, "phone");
    const code = normalizeOtpDigits(otpOverride ?? otp);
    if (code.length < OTP_SEGMENT_LENGTH) {
      setOtpError(resolveError("OTP_INVALID"));
      return;
    }
    if (verifyInFlightRef.current) {
      return;
    }
    verifyInFlightRef.current = true;
    setLoading(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/public-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: effectivePhone,
          otp: code,
          challenge_id: challengeId,
        }),
      });
      const data = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !data.ok) {
        setOtpError(resolveError(readPublicRegistrationErrorCode(data)));
        return;
      }
      if (data.requires_registration === true) {
        const token =
          typeof data.onboarding_token === "string" ? data.onboarding_token : "";
        if (token.length === 0) {
          setOtpError(resolveError("network"));
          return;
        }
        setOnboardingToken(token);
        setStep("profile");
        return;
      }
      await hydrateIntakeAfterSession();
    } catch {
      setOtpError(resolveError("network"));
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function completeProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = displayName.trim();
    if (name.length === 0) {
      setProfileError(resolveError("DISPLAY_NAME_REQUIRED"));
      return;
    }
    setLoading(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/public-auth/register-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildPublicRegistrationProfilePayload({
            onboardingToken,
            displayName,
            profileEmail,
          })
        ),
      });
      const data = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !data.ok) {
        const code = readPublicRegistrationErrorCode(data);
        if (code === "ONBOARDING_TOKEN_INVALID") {
          handleChangePhone();
        }
        setProfileError(resolveError(code));
        return;
      }
      await hydrateIntakeAfterSession(name, profileEmail.trim());
    } catch {
      setProfileError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  async function submitIntake(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = intakeName.trim();
    const email = intakeEmail.trim();
    const partySizeRaw = normalizeNumericInputValue(partySize, "digits");
    const parsedPartySize = Number.parseInt(partySizeRaw, 10);

    if (name.length === 0) {
      setIntakeError(resolveError("DISPLAY_NAME_REQUIRED"));
      return;
    }
    if (email.length === 0) {
      setIntakeError(t("intake.emailRequired"));
      return;
    }
    if (!Number.isFinite(parsedPartySize) || parsedPartySize < 1) {
      setIntakeError(t("intake.partySizeInvalid"));
      return;
    }

    setLoading(true);
    setIntakeError(null);
    const effectivePhone = normalizeNumericInputValue(phone, "phone");

    try {
      const res = await fetch("/api/catalog/registrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tourId,
          email,
          fullName: name,
          partySize: parsedPartySize,
          ...(effectivePhone.length > 0 ? { phone: effectivePhone } : {}),
          ...(workspace === "urban" && notes.trim().length > 0 ? { notes: notes.trim() } : {}),
        }),
      });
      const result = (await res.json()) as { ok?: boolean; code?: string };
      if (!res.ok || !result.ok) {
        setIntakeError(resolveError(typeof result.code === "string" ? result.code : "network"));
        return;
      }
      setStep("done");
    } catch {
      setIntakeError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  function handleChangePhone(): void {
    setStep("phone");
    setOtp("");
    setChallengeId("");
    setOnboardingToken("");
    setOtpError(null);
    setPhoneHint(null);
    setResendCooldown(0);
  }

  if (step === "done") {
    return (
      <div
        data-public-registration-success
        {...(workspace === "urban" ? { "data-urban-registration-success": true } : {})}
      >
        <p role="status">{t("success.message", { tourTitle })}</p>
        <p>
          <a href="/me/registrations">View my registrations</a>
        </p>
        <p>
          <a href={backHref}>{t("success.backToTour")}</a>
        </p>
      </div>
    );
  }

  if (step === "intake") {
    return (
      <form onSubmit={submitIntake} data-public-registration-intake data-tour-id={tourId}>
        <h2>{t("intake.title")}</h2>
        <label htmlFor="intakeName">
          {t("intake.nameLabel")} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="intakeName"
          name="fullName"
          value={intakeName}
          onChange={(event) => setIntakeName(event.target.value)}
          required
          autoComplete="name"
        />
        <label htmlFor="intakeEmail">
          {t("intake.emailLabel")} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="intakeEmail"
          name="email"
          type="email"
          value={intakeEmail}
          onChange={(event) => setIntakeEmail(event.target.value)}
          required
          autoComplete="email"
          aria-invalid={intakeError !== null}
          aria-describedby={intakeError !== null ? intakeErrorId : undefined}
        />
        <label htmlFor="partySize">{t("intake.partySizeLabel")}</label>
        <PrimitiveLocalizedNumericInput
          mode="digits"
          value={partySize}
          onChange={setPartySize}
          aria-label={t("intake.partySizeLabel")}
        />
        {workspace === "urban" ? (
          <>
            <label htmlFor="notes">{t("intake.notesLabel")}</label>
            <Input
              id="notes"
              name="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </>
        ) : null}
        {intakeError !== null ? (
          <p id={intakeErrorId} role="alert">
            {intakeError}
          </p>
        ) : null}
        <button type="submit" disabled={loading} data-action="intake-submit">
          {loading ? t("intake.submitting") : t("intake.submit")}
        </button>
      </form>
    );
  }

  if (step === "profile") {
    return (
      <form onSubmit={completeProfile} data-public-registration-profile data-tour-id={tourId}>
        <h2>{t("profile.title")}</h2>
        <p>{t("profile.description")}</p>
        <label htmlFor="displayName">
          {t("profile.nameLabel")} <span aria-hidden="true">*</span>
        </label>
        <Input
          id="displayName"
          name="displayName"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          autoComplete="name"
          aria-invalid={profileError !== null}
          aria-describedby={profileError !== null ? nameErrorId : undefined}
        />
        <label htmlFor="profileEmail">{t("profile.emailLabel")}</label>
        <Input
          id="profileEmail"
          name="email"
          type="email"
          value={profileEmail}
          onChange={(event) => setProfileEmail(event.target.value)}
          autoComplete="email"
        />
        {profileError !== null ? (
          <p id={nameErrorId} role="alert">
            {profileError}
          </p>
        ) : null}
        <button type="submit" disabled={loading} data-action="profile-continue">
          {loading ? t("profile.saving") : t("profile.continue")}
        </button>
      </form>
    );
  }

  if (step === "otp") {
    return (
      <div data-public-registration-otp data-tour-id={tourId}>
        <h2>{t("otp.title")}</h2>
        <p>{t("otp.sentTo", { phone })}</p>
        <OtpSegmentInput
          value={otp}
          onChange={setOtp}
          onComplete={(value) => void verifyOtp(value)}
          disabled={loading}
          aria-invalid={otpError !== null}
          aria-describedby={otpError !== null ? otpErrorId : undefined}
        />
        {otpError !== null ? (
          <p id={otpErrorId} role="alert">
            {otpError}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void verifyOtp()}
          disabled={loading}
          data-action="verify-otp"
        >
          {loading ? t("otp.verifying") : t("otp.verify")}
        </button>
        <button
          type="button"
          onClick={() => void requestOtp()}
          disabled={loading || resendCooldown > 0}
        >
          {resendCooldown > 0
            ? t("otp.resendIn", { seconds: resendCooldown })
            : t("otp.resend")}
        </button>
        <button type="button" onClick={handleChangePhone} disabled={loading}>
          {t("otp.changePhone")}
        </button>
        {process.env.NODE_ENV === "development" ? (
          <p data-dev-otp-hint>{t("otp.devHint", { code: PUBLIC_REGISTRATION_DEV_OTP })}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div
      data-public-registration-phone
      data-registration-ready={clientReady ? "" : undefined}
      data-tour-id={tourId}
    >
      <h2>{t("phone.title")}</h2>
      <p>{t("phone.description")}</p>
      {phoneHint === "existing" ? <p>{t("phone.existingHint")}</p> : null}
      {phoneHint === "new" ? <p>{t("phone.newHint")}</p> : null}
      <label htmlFor="phone">{t("phone.label")}</label>
      <PrimitiveLocalizedNumericInput
        id="phone"
        mode="phone"
        value={phone}
        onChange={setPhone}
        aria-label={t("phone.label")}
        aria-invalid={phoneError !== null}
        aria-describedby={phoneError !== null ? phoneErrorId : undefined}
      />
      {phoneError !== null ? (
        <p id={phoneErrorId} role="alert">
          {phoneError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => void requestOtp()}
        disabled={loading}
        data-action="send-code"
      >
        {loading ? t("phone.sending") : t("phone.sendCode")}
      </button>
    </div>
  );
}

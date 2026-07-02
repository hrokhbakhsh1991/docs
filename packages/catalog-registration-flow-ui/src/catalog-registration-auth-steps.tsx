"use client";

import { Input } from "@app-tour/ui-primitives/input";
import {
  buildPublicRegistrationProfilePayload,
  initialPublicRegistrationPhone,
  isPublicRegistrationMobileValid,
  PUBLIC_REGISTRATION_DEV_OTP,
  PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC,
  readPublicRegistrationErrorCode,
  type PublicRegistrationApiError,
} from "@app-tour/catalog-registration-auth";
import {
  mergeFlowState,
  transitionFlowStep,
  type RegistrationFlowStepProps,
} from "@app-tour/workspace-sdk";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { readCatalogRegistrationFlowData } from "./flow-data";
import { hydrateCatalogRegistrationIntakeAfterSession } from "./hydrate-intake-after-session";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

export function CatalogRegistrationPhoneStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const data = readCatalogRegistrationFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [phoneHint, setPhoneHint] = useState<"existing" | "new" | null>(null);
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  async function requestOtp(): Promise<void> {
    const effectivePhone = normalizePhone(data.phone);
    if (effectivePhone.length === 0) {
      setError(resolveError("MOBILE_REQUIRED"));
      return;
    }
    if (!isPublicRegistrationMobileValid(effectivePhone)) {
      setError(resolveError("MOBILE_INVALID"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const preflight = await fetch("/api/public-auth/phone-preflight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: effectivePhone }),
      });
      const preflightData = (await preflight.json()) as { exists?: boolean };
      if (preflight.ok) {
        setPhoneHint(preflightData.exists === true ? "existing" : "new");
      }
      const res = await fetch("/api/public-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: effectivePhone }),
      });
      const body = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !body.ok || typeof body.challenge_id !== "string") {
        setError(resolveError(readPublicRegistrationErrorCode(body)));
        return;
      }
      mergeFlowState(state, dispatch, {
        phone: effectivePhone,
        challengeId: body.challenge_id,
        otp: "",
      });
      transitionFlowStep(dispatch, "otp");
    } catch {
      setError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  const policiesBlock =
    context.tourPoliciesText != null && context.tourPoliciesText.trim().length > 0 ? (
      <section data-tour-policies data-tour-policies-text aria-label={t("intake.termsHeading")}>
        <h3>{t("intake.termsHeading")}</h3>
        <p>{context.tourPoliciesText}</p>
      </section>
    ) : null;

  return (
    <div
      data-public-registration-phone
      data-registration-ready={clientReady ? "" : undefined}
      data-tour-id={context.tourId}
    >
      {policiesBlock}
      <h2>{t("phone.title")}</h2>
      <p>{t("phone.description")}</p>
      {phoneHint === "existing" ? <p>{t("phone.existingHint")}</p> : null}
      {phoneHint === "new" ? <p>{t("phone.newHint")}</p> : null}
      <label htmlFor="phone">{t("phone.label")}</label>
      <Input
        id="phone"
        value={data.phone}
        onChange={(event) => mergeFlowState(state, dispatch, { phone: event.target.value })}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
      />
      {error !== null ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={() => void requestOtp()} disabled={loading} data-action="send-code">
        {loading ? t("phone.sending") : t("phone.sendCode")}
      </button>
    </div>
  );
}

export function CatalogRegistrationOtpStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const data = readCatalogRegistrationFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC);
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function verifyOtp(otpOverride?: string): Promise<void> {
    const code = (otpOverride ?? data.otp).replace(/\D/g, "");
    if (code.length < 4) {
      setError(resolveError("OTP_INVALID"));
      return;
    }
    if (verifyInFlightRef.current) return;
    verifyInFlightRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public-auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: data.phone,
          otp: code,
          challenge_id: data.challengeId,
        }),
      });
      const body = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !body.ok) {
        setError(resolveError(readPublicRegistrationErrorCode(body)));
        return;
      }
      if (body.requires_registration === true) {
        const token = typeof body.onboarding_token === "string" ? body.onboarding_token : "";
        if (token.length === 0) {
          setError(resolveError("network"));
          return;
        }
        mergeFlowState(state, dispatch, { onboardingToken: token });
        transitionFlowStep(dispatch, "profile");
        return;
      }
      await hydrateCatalogRegistrationIntakeAfterSession(context, state, dispatch);
    } catch {
      setError(resolveError("network"));
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  }

  async function resendOtp(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch("/api/public-auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: data.phone }),
      });
      const body = (await res.json()) as PublicRegistrationApiError;
      if (res.ok && body.ok && typeof body.challenge_id === "string") {
        mergeFlowState(state, dispatch, { challengeId: body.challenge_id, otp: "" });
        setResendCooldown(PUBLIC_REGISTRATION_RESEND_COOLDOWN_SEC);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-public-registration-otp data-tour-id={context.tourId}>
      <h2>{t("otp.title")}</h2>
      <p>{t("otp.sentTo", { phone: data.phone })}</p>
      <label htmlFor="otp">{t("otp.title")}</label>
      <Input
        id="otp"
        value={data.otp}
        onChange={(event) => mergeFlowState(state, dispatch, { otp: event.target.value })}
        onBlur={() => void verifyOtp()}
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
      />
      {error !== null ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <button type="button" onClick={() => void verifyOtp()} disabled={loading} data-action="verify-otp">
        {loading ? t("otp.verifying") : t("otp.verify")}
      </button>
      <button type="button" onClick={() => void resendOtp()} disabled={loading || resendCooldown > 0}>
        {resendCooldown > 0 ? t("otp.resendIn", { seconds: resendCooldown }) : t("otp.resend")}
      </button>
      <button
        type="button"
        onClick={() => {
          mergeFlowState(state, dispatch, {
            phone: initialPublicRegistrationPhone(),
            otp: "",
            challengeId: "",
            onboardingToken: "",
          });
          transitionFlowStep(dispatch, "phone");
        }}
        disabled={loading}
      >
        {t("otp.changePhone")}
      </button>
      {process.env.NODE_ENV === "development" ? (
        <p data-dev-otp-hint>{t("otp.devHint", { code: PUBLIC_REGISTRATION_DEV_OTP })}</p>
      ) : null}
    </div>
  );
}

export function CatalogRegistrationProfileStep({
  context,
  state,
  dispatch,
  resolveError,
}: RegistrationFlowStepProps) {
  const t = useTranslations("catalogRegistration");
  const data = readCatalogRegistrationFlowData(state);
  const errorId = useId();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function completeProfile(event: FormEvent): Promise<void> {
    event.preventDefault();
    const name = data.displayName.trim();
    if (name.length === 0) {
      setError(resolveError("DISPLAY_NAME_REQUIRED"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public-auth/register-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildPublicRegistrationProfilePayload({
            onboardingToken: data.onboardingToken,
            displayName: data.displayName,
            profileEmail: data.profileEmail,
          })
        ),
      });
      const body = (await res.json()) as PublicRegistrationApiError;
      if (!res.ok || !body.ok) {
        const code = readPublicRegistrationErrorCode(body);
        if (code === "ONBOARDING_TOKEN_INVALID") {
          transitionFlowStep(dispatch, "phone");
        }
        setError(resolveError(code));
        return;
      }
      await hydrateCatalogRegistrationIntakeAfterSession(
        context,
        state,
        dispatch,
        name,
        data.profileEmail.trim()
      );
    } catch {
      setError(resolveError("network"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={completeProfile} data-public-registration-profile data-tour-id={context.tourId}>
      <h2>{t("profile.title")}</h2>
      <p>{t("profile.description")}</p>
      <label htmlFor="displayName">
        {t("profile.nameLabel")} <span aria-hidden="true">*</span>
      </label>
      <Input
        id="displayName"
        value={data.displayName}
        onChange={(event) => mergeFlowState(state, dispatch, { displayName: event.target.value })}
        required
        aria-invalid={error !== null}
        aria-describedby={error !== null ? errorId : undefined}
      />
      <label htmlFor="profileEmail">{t("profile.emailLabel")}</label>
      <Input
        id="profileEmail"
        type="email"
        value={data.profileEmail}
        onChange={(event) => mergeFlowState(state, dispatch, { profileEmail: event.target.value })}
      />
      {error !== null ? (
        <p id={errorId} role="alert">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={loading} data-action="profile-continue">
        {loading ? t("profile.saving") : t("profile.continue")}
      </button>
    </form>
  );
}

export const catalogRegistrationAuthFlowSteps = Object.freeze({
  phone: CatalogRegistrationPhoneStep,
  otp: CatalogRegistrationOtpStep,
  profile: CatalogRegistrationProfileStep,
});

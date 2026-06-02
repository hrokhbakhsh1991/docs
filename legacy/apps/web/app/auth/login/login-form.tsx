"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import { useSearchParams } from "next/navigation";

import { useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { ApiError } from "@/lib/api-client";
import { resolveAuthUiErrorMessage } from "@/lib/errors/auth-ui-error-message";
import { useDigitLocalization } from "@/hooks/useDigitLocalization";
import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";
import {
  syntheticChangeForInputValue,
  toEnglishIntegerString,
  withIntegerDigitNormalization,
} from "../../../src/lib/number-utils";

import authStyles from "../auth-forms.module.css";

type LoginFormValues = {
  phone: string;
  otp: string;
};

type LoginStep = "phone" | "otp";

function loginToastMessage(err: unknown, t: (_key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.code === "AUTH_OTP_INVALID") {
      return t("login.toastInvalidPhoneOrOtp");
    }
    if (err.code === "AUTH_OTP_EXPIRED") {
      return t("login.toastGeneric");
    }
    if (err.code === "AUTH_PHONE_INVALID" || err.code === "AUTH_UNAUTHENTICATED") {
      return t("login.toastInvalidPhoneOrOtp");
    }
    return err.message.trim() || t("login.toastGeneric");
  }
  if (err instanceof Error) {
    const m = err.message.trim();
    if (m === "Invalid phone number or OTP code.") {
      return t("login.toastInvalidPhoneOrOtp");
    }
    if (m === "Failed to request OTP") {
      return t("login.toastFailedRequestOtp");
    }
    if (m === "Session was not established. Please try again.") {
      return t("login.toastSessionNotEstablished");
    }
    if (m === "Login failed") {
      return t("login.toastLoginFailed");
    }
    if (m) {
      return resolveAuthUiErrorMessage(err);
    }
  }
  return t("login.toastGeneric");
}

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setSession } = useAuth();
  const t = useTranslations("auth");
  const locale = useLocale();
  const { toPersian, toDisplayPersianDigits } = useDigitLocalization();
  const [step, setStep] = useState<LoginStep>("phone");
  const [otpChallengeId, setOtpChallengeId] = useState<string | null>(null);
  const inviteToken = searchParams.get("invite")?.trim() || "";

  const loginSchema = useMemo(
    () =>
      z.object({
        phone: z
          .string()
          .transform((s) => normalizeOtpPhoneInput(s))
          .pipe(
            z
              .string()
              .min(1, t("login.validationPhoneRequired"))
              .min(8, t("login.validationPhoneInvalid")),
          ),
        otp:
          step === "phone"
            ? z.string()
            : z
                .string()
                .transform((s) => toEnglishIntegerString(s.trim()))
                .pipe(z.string().min(1, t("login.validationOtpRequired"))),
      }),
    [step, t],
  );

  const {
    register,
    handleSubmit,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { phone: "", otp: "" },
    mode: "onChange",
  });

  const phoneRegister = register("phone");
  const otpRegister = withIntegerDigitNormalization(register("otp"));

  async function onValid(data: LoginFormValues): Promise<void> {
    try {
      if (step === "phone") {
        if (!data.phone) return;
        const normalizedPhone = normalizeOtpPhoneInput(data.phone);
        const otpRequestResponse = await fetch("/api/auth/request-otp", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: normalizedPhone,
            ...(inviteToken ? { invite_token: inviteToken } : {}),
          }),
        });
        const otpRequestPayload = (await otpRequestResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          challenge_id?: string;
          error_code?: string;
          message?: string;
          error?: { message?: string };
        };
        const otpRequestMessage =
          otpRequestPayload.message ??
          (typeof otpRequestPayload.error?.message === "string" ? otpRequestPayload.error.message : undefined);
        if (!otpRequestResponse.ok || !otpRequestPayload.ok) {
          throw new Error(otpRequestMessage ?? "Failed to request OTP");
        }
        const challengeId =
          typeof otpRequestPayload.challenge_id === "string"
            ? otpRequestPayload.challenge_id.trim()
            : "";
        setOtpChallengeId(challengeId || null);
        setStep("otp");
        clearErrors();
        return;
      }
      if (step === "otp") {
        if (!data.phone) return;
      }
      const loginBody = {
        phone: normalizeOtpPhoneInput(data.phone),
        otp: toEnglishIntegerString(data.otp.trim()),
        ...(inviteToken ? { invite_token: inviteToken } : {}),
        // Dev static OTP path does not require challenge rows; sending a stale/missing
        // challenge_id yields AUTH_OTP_INVALID and blocks registration redirect.
        ...(process.env.NODE_ENV !== "development" && otpChallengeId
          ? { challenge_id: otpChallengeId }
          : {}),
      };
      const postLoginWebSession = (body: Record<string, string>) =>
        fetch("/api/auth/login-web-session", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

      let response = await postLoginWebSession(loginBody);
      let payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        requires_registration?: boolean;
        onboarding_token?: string;
        session_token?: string;
        user_id?: string;
        tenant_id?: string;
        error_code?: string;
        message?: string;
        error?: { code?: string; message?: string };
      };
      const loginErrorCode =
        payload.error?.code?.trim() || payload.error_code?.trim() || "";
      if (
        (!response.ok || !payload.ok) &&
        loginErrorCode === "AUTH_OTP_INVALID" &&
        "challenge_id" in loginBody
      ) {
        const { challenge_id: _dropped, ...loginBodyWithoutChallenge } = loginBody;
        response = await postLoginWebSession(loginBodyWithoutChallenge);
        payload = (await response.json().catch(() => ({}))) as typeof payload;
      }
      if (
        payload.requires_registration === true &&
        typeof payload.onboarding_token === "string" &&
        payload.onboarding_token.trim() !== ""
      ) {
        const params = new URLSearchParams({
          onboarding: payload.onboarding_token.trim(),
        });
        if (inviteToken) {
          params.set("invite", inviteToken);
        }
        router.push(`/auth/register?${params.toString()}`);
        return;
      }
      if (!response.ok || !payload.ok) {
        const code =
          payload.error?.code?.trim() ||
          payload.error_code?.trim() ||
          "AUTH_FAILED";
        if (code === "AUTH_OTP_INVALID" || code === "AUTH_PHONE_INVALID") {
          throw new Error("Invalid phone number or OTP code.");
        }
        throw new Error(
          payload.error?.message?.trim() || payload.message?.trim() || "Login failed",
        );
      }
      const tokenFromLogin =
        typeof payload.session_token === "string" ? payload.session_token.trim() : "";
      const userIdFromLogin =
        typeof payload.user_id === "string" ? payload.user_id.trim() : "";
      const tenantIdFromLogin =
        typeof payload.tenant_id === "string" ? payload.tenant_id.trim() : "";

      if (tokenFromLogin && userIdFromLogin && tenantIdFromLogin) {
        await setSession({
          session_token: tokenFromLogin,
          user_id: userIdFromLogin,
          tenant_id: tenantIdFromLogin,
          entry_mode: "web",
        });
      } else {
        const sessionPayload = (await fetch("/api/auth/session", {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
          .then((r) => r.json())
          .catch(() => ({}))) as {
          authenticated?: boolean;
          session_token?: string;
          user_id?: string;
          tenant_id?: string;
        };
        if (
          sessionPayload.authenticated &&
          typeof sessionPayload.session_token === "string" &&
          typeof sessionPayload.user_id === "string" &&
          typeof sessionPayload.tenant_id === "string"
        ) {
          await setSession({
            session_token: sessionPayload.session_token,
            user_id: sessionPayload.user_id,
            tenant_id: sessionPayload.tenant_id,
            entry_mode: "web",
          });
        } else {
          throw new Error("Session was not established. Please try again.");
        }
      }
      showToast({ type: "success", message: t("login.toastSuccess") });
      void router.refresh();
      router.push("/dashboard");
    } catch (err: unknown) {
      showToast({ type: "error", message: loginToastMessage(err, t) });
    }
  }

  return (
    <>
      <h1 className={authStyles.heading}>{t("login.title")}</h1>
      <p className={authStyles.lead}>{t("login.subtitle")}</p>
      <form className={authStyles.form} onSubmit={handleSubmit(onValid)} noValidate>
        {step === "phone" && (
          <FormField label={t("login.phoneLabel")} error={errors.phone?.message}>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder={
                locale === "fa" ? toDisplayPersianDigits(t("login.phonePlaceholder")) : t("login.phonePlaceholder")
              }
              aria-invalid={errors.phone ? true : undefined}
              disabled={isSubmitting}
              {...phoneRegister}
              onChange={(e) => {
                const el = e.target;
                const ascii = normalizeOtpPhoneInput(el.value);
                el.value = toPersian(ascii);
                void phoneRegister.onChange(syntheticChangeForInputValue(e, el, ascii));
              }}
            />
          </FormField>
        )}
        {step === "otp" && (
          <FormField label={t("login.otpLabel")} error={errors.otp?.message}>
            <Input
              type="text"
              autoComplete="one-time-code"
              placeholder={
                locale === "fa" ? toDisplayPersianDigits(t("login.otpPlaceholder")) : t("login.otpPlaceholder")
              }
              aria-invalid={errors.otp ? true : undefined}
              disabled={step !== "otp" || isSubmitting}
              {...otpRegister}
            />
          </FormField>
        )}
        {step === "otp" && (
          <p dir="ltr" style={{ unicodeBidi: "plaintext" }}>
            {toPersian(watch("phone") ?? "")}
          </p>
        )}
        {step === "otp" && (
          <p
            onClick={() => {
              setStep("phone");
              setOtpChallengeId(null);
              clearErrors();
              setValue("otp", "");
            }}
            style={{ cursor: "pointer" }}
          >
            {t("login.editPhone")}
          </p>
        )}
        {process.env.NODE_ENV === "development" ? (
          <p className={authStyles.helperText}>{t("login.devOtpHint")}</p>
        ) : null}
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
          {step === "phone" ? t("login.continue") : t("login.submit")}
        </Button>
      </form>
    </>
  );
}

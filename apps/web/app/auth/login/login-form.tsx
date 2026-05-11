"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocale, useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import { useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
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

function loginToastMessage(err: unknown, t: (key: string) => string): string {
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
    if (m === "No active workspace membership for this account.") {
      return t("login.toastNoMembership");
    }
    if (m === "Could not continue with this phone") {
      return t("login.toastCouldNotContinuePhone");
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
        const preflightResponse = await fetch("/api/auth/phone-preflight", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phone: normalizedPhone,
            ...(inviteToken ? { invite_token: inviteToken } : {}),
          }),
        });
        const preflightPayload = (await preflightResponse.json().catch(() => ({}))) as {
          ok?: boolean;
          error_code?: string;
          message?: string;
          error?: { message?: string };
        };
        const preflightMessage =
          preflightPayload.message ??
          (typeof preflightPayload.error?.message === "string" ? preflightPayload.error.message : undefined);
        if (!preflightResponse.ok || !preflightPayload.ok) {
          throw new Error(preflightMessage ?? "Could not continue with this phone");
        }
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
        setStep("otp");
        clearErrors();
        return;
      }
      if (step === "otp") {
        if (!data.phone) return;
      }
      const response = await fetch("/api/auth/login-web-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeOtpPhoneInput(data.phone),
          otp: toEnglishIntegerString(data.otp.trim()),
          ...(inviteToken ? { invite_token: inviteToken } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        requires_registration?: boolean;
        onboarding_token?: string;
        error_code?: string;
        message?: string;
      };
      if (!response.ok || !payload.ok) {
        const code = payload.error_code ?? "AUTH_FAILED";
        if (code === "AUTH_OTP_INVALID" || code === "AUTH_PHONE_INVALID") {
          throw new Error("Invalid phone number or OTP code.");
        }
        if (code === "AUTH_NO_ACTIVE_MEMBERSHIP" || code === "TENANT_SCOPE_FORBIDDEN") {
          throw new Error("No active workspace membership for this account.");
        }
        throw new Error(payload.message?.trim() || "Login failed");
      }
      if (payload.requires_registration && typeof payload.onboarding_token === "string") {
        const params = new URLSearchParams({
          onboarding: payload.onboarding_token,
        });
        if (inviteToken) {
          params.set("invite", inviteToken);
        }
        router.push(`/auth/register?${params.toString()}`);
        return;
      }
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
      <p className={authStyles.footerNote}>
        {t("login.footerNoAccount")}{" "}
        <Link href="/auth/register" className={authStyles.footerLink}>
          {t("login.footerRegister")}
        </Link>
      </p>
    </>
  );
}

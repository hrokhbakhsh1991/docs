"use client";

import { PasswordSettings } from "@app-tour/account-security-ui";
import { useTranslations } from "next-intl";

const ERROR_KEYS = new Set([
  "PASSWORD_TOO_SHORT",
  "PASSWORD_TOO_LONG",
  "PASSWORD_TOO_COMMON",
  "OTP_INVALID",
  "OTP_EXPIRED",
  "OTP_CHALLENGE_INVALID",
  "OTP_RATE_LIMITED",
  "PASSWORD_CHALLENGE_INVALID",
  "PASSWORD_SESSION_INVALID",
  "AUTH_UNAUTHENTICATED",
  "BACKEND_UNREACHABLE",
]);

export function OperatorPasswordSettings() {
  const t = useTranslations("settings.passwordSettings");
  return (
    <PasswordSettings
      basePath="/api/identity/me/password"
      labels={{
        title: t("title"),
        create: t("create"),
        change: t("change"),
        requestOtp: t("requestOtp"),
        retry: t("retry"),
        resend: t("resend"),
        otp: t("otp"),
        otpHint: t("otpHint"),
        password: t("password"),
        confirm: t("confirm"),
        hint: t("hint"),
        save: t("save"),
        loading: t("loading"),
        saved: t("saved"),
        mismatch: t("mismatch"),
        show: t("show"),
        hide: t("hide"),
        cancel: t("cancel"),
        error: (code) => t(`errors.${ERROR_KEYS.has(code) ? code : "default"}`),
      }}
    />
  );
}

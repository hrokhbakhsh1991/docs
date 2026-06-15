"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Smartphone, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LocalizedNumericInput } from "@/components/i18n/localized-numeric-input";
import { normalizeNumericInputValue } from "@/i18n/format-localized-digits";
import { Label } from "@/components/ui/label";
import { LoginTenantBrand } from "@/features/auth/login-tenant-brand";
import {
  normalizeOtpDigits,
  OTP_SEGMENT_LENGTH,
  OtpSegmentInput,
} from "@/features/auth/otp-segment-input";
import { resolveLoginErrorMessage } from "@/features/auth/resolve-login-error";
import type { PublicTenantBrandingSnapshot } from "@/tenant/fetch-public-tenant-branding.server";
import { OPERATOR_LOGIN_TEST_IDS } from "@/features/auth/operator-login-copy";
import {
  shouldShowInviteOnlyBanner,
  shouldShowOwnerOnlyBanner,
  shouldShowOwnershipTransferredBanner,
} from "@/features/auth/operator-login-logic";
import {
  INVITE_ACCEPT_TEST_IDS,
  readInviteTokenFromSearchParams,
} from "@/features/users/invite-accept-logic";
import { navigateAfterLogin } from "@/auth/navigate-after-auth-session-change";

type Step = "phone" | "otp";

const RESEND_COOLDOWN_SEC = 45;
/** Denali dev owner — ASCII in state/API; LocalizedNumericInput shows Persian digits when locale is fa. */
const DEV_LOGIN_PHONE =
  process.env.NEXT_PUBLIC_DEV_LOGIN_PHONE?.trim() || "+989190082452";
const DEV_LOGIN_OTP = process.env.NEXT_PUBLIC_DEV_LOGIN_OTP?.trim() || "1234";

function initialLoginPhone(): string {
  return "";
}

function initialLoginOtp(): string {
  return "";
}

type LoginFormProps = {
  readonly pluginId: string;
  readonly initialBranding?: PublicTenantBrandingSnapshot;
  /** Server-serialized query (excludes `phone`) — avoids client `useSearchParams` hydration stall. */
  readonly searchQuery?: string;
};

type ApiErrorPayload = {
  ok?: boolean;
  challenge_id?: string;
  error?: { code?: string };
};

function readErrorCode(data: ApiErrorPayload): string {
  return typeof data.error?.code === "string" ? data.error.code : "network";
}

function readPhoneForSubmit(statePhone: string): string {
  const fromState = normalizeNumericInputValue(statePhone, "phone");
  if (fromState.length > 0) {
    return fromState;
  }
  if (typeof document === "undefined") {
    return statePhone;
  }
  const element = document.getElementById("phone");
  if (!(element instanceof HTMLInputElement)) {
    return statePhone;
  }
  return normalizeNumericInputValue(element.value, "phone");
}

export function LoginForm({ pluginId, initialBranding, searchQuery = "" }: LoginFormProps) {
  const t = useTranslations("auth");
  const router = useRouter();
  const phoneErrorId = useId();
  const otpErrorId = useId();
  const urlParams = new URLSearchParams(searchQuery);
  const inviteToken = readInviteTokenFromSearchParams(urlParams);
  const showInviteOnlyBanner = shouldShowInviteOnlyBanner(urlParams);
  const showTenantMismatchBanner = urlParams.get("access") === "tenant-mismatch";
  const showOwnerOnlyBanner = shouldShowOwnerOnlyBanner(urlParams);
  const showOwnershipTransferredBanner = shouldShowOwnershipTransferredBanner(urlParams);
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState(initialLoginPhone);
  const [otp, setOtp] = useState(initialLoginOtp);
  const [challengeId, setChallengeId] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const loginInFlightRef = useRef(false);
  const devOtpBootstrappedRef = useRef(false);
  const devLoginAttemptedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      setPhone(DEV_LOGIN_PHONE);
      setOtp(DEV_LOGIN_OTP);
    }
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || devOtpBootstrappedRef.current) {
      return;
    }
    const effectivePhone = normalizeNumericInputValue(phone, "phone");
    if (effectivePhone.length === 0 || challengeId.length > 0) {
      return;
    }
    devOtpBootstrappedRef.current = true;
    void requestOtp();
  }, [phone, challengeId]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || devLoginAttemptedRef.current) {
      return;
    }
    if (step !== "otp" || challengeId.length === 0) {
      return;
    }
    const code = normalizeOtpDigits(otp);
    if (code.length < OTP_SEGMENT_LENGTH) {
      return;
    }
    devLoginAttemptedRef.current = true;
    void login(code);
  }, [step, challengeId, otp]);

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
    setResendCooldown(RESEND_COOLDOWN_SEC);
  }, []);

  async function requestOtp(): Promise<boolean> {
    const effectivePhone = readPhoneForSubmit(phone);
    if (effectivePhone !== phone) {
      setPhone(effectivePhone);
    }
    setLoading(true);
    setPhoneError(null);
    try {
      const res = await fetch("/api/auth/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ phone: effectivePhone }),
      });
      const data = (await res.json()) as ApiErrorPayload;
      if (!res.ok || !data.ok || typeof data.challenge_id !== "string") {
        setPhoneError(resolveLoginErrorMessage(t, readErrorCode(data)));
        return false;
      }
      setChallengeId(data.challenge_id);
      setOtp("");
      setOtpError(null);
      setStep("otp");
      beginResendCooldown();
      return true;
    } catch {
      setPhoneError(resolveLoginErrorMessage(t, "network"));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function login(otpOverride?: string): Promise<void> {
    const effectivePhone = readPhoneForSubmit(phone);
    const code = normalizeOtpDigits(otpOverride ?? otp);
    if (code.length < OTP_SEGMENT_LENGTH) {
      setOtpError(resolveLoginErrorMessage(t, "OTP_INVALID"));
      return;
    }
    if (loginInFlightRef.current) {
      return;
    }
    loginInFlightRef.current = true;
    setLoading(true);
    setOtpError(null);
    try {
      const res = await fetch("/api/auth/login-web-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          phone: effectivePhone,
          otp: code,
          challenge_id: challengeId,
        }),
      });
      const data = (await res.json()) as ApiErrorPayload;
      if (!res.ok || !data.ok) {
        const codeKey = readErrorCode(data);
        setOtpError(resolveLoginErrorMessage(t, codeKey));
        if (codeKey === "OTP_CHALLENGE_INVALID" || codeKey === "OTP_EXPIRED") {
          setOtp("");
        }
        return;
      }

      const abilityRes = await fetch("/api/auth/membership-ability-context", {
        credentials: "same-origin",
      });
      if (!abilityRes.ok) {
        setOtpError(resolveLoginErrorMessage(t, "abilitiesFailed"));
        return;
      }

      if (inviteToken !== null) {
        const acceptRes = await fetch(`/api/auth/invite/${inviteToken}/accept`, {
          method: "POST",
        });
        if (!acceptRes.ok) {
          setOtpError(
            t("errors.inviteAcceptFailed", { status: acceptRes.status })
          );
          return;
        }
      }

      navigateAfterLogin(router, searchQuery);
    } catch {
      setOtpError(resolveLoginErrorMessage(t, "network"));
    } finally {
      loginInFlightRef.current = false;
      setLoading(false);
    }
  }

  function handleChangePhone(): void {
    setStep("phone");
    setOtp("");
    setChallengeId("");
    setOtpError(null);
    setResendCooldown(0);
  }

  const showDevOtpHint = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center overflow-x-hidden bg-muted/40 px-4 py-4 sm:py-6">
      <LoginTenantBrand pluginId={pluginId} initialBranding={initialBranding} />
      <Card className="w-full max-w-md overflow-hidden shadow-lg">
        <CardHeader className="space-y-2 pb-4 text-center sm:text-start">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 sm:mx-0 sm:me-auto">
            {step === "phone" ? (
              <Smartphone className="h-5 w-5 text-primary" />
            ) : (
              <ShieldCheck className="h-5 w-5 text-primary" />
            )}
          </div>
          <CardTitle className="text-xl">{t("title")}</CardTitle>
          <CardDescription>
            {step === "phone" ? t("phoneStepDescription") : t("otpStepDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className={step === "otp" ? "space-y-3" : "space-y-4"}>
          <span data-testid={OPERATOR_LOGIN_TEST_IDS.hydrated} hidden aria-hidden="true" />
          {showTenantMismatchBanner ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="operator-login-tenant-mismatch-banner"
            >
              {t("tenantMismatchBanner")}
            </p>
          ) : null}
          {showOwnerOnlyBanner ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid={OPERATOR_LOGIN_TEST_IDS.ownerOnlyBanner}
            >
              {t("ownerOnlyBanner")}
            </p>
          ) : null}
          {showOwnershipTransferredBanner ? (
            <p
              role="status"
              className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
              data-testid={OPERATOR_LOGIN_TEST_IDS.ownershipTransferredBanner}
            >
              {t("ownershipTransferredBanner")}
            </p>
          ) : null}
          {showInviteOnlyBanner ? (
            <p
              className="rounded-md border border-muted-foreground/20 bg-muted/50 px-3 py-2 text-sm text-muted-foreground"
              data-testid={OPERATOR_LOGIN_TEST_IDS.inviteOnlyBanner}
            >
              {t("inviteOnlyBanner")}
            </p>
          ) : null}
          {inviteToken ? (
            <p
              className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-primary"
              data-testid={INVITE_ACCEPT_TEST_IDS.loginInviteBanner}
            >
              {t("pendingInviteBanner")}
            </p>
          ) : null}

          {step === "phone" ? (
            <form
              className="space-y-4"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phoneLabel")}</Label>
                <LocalizedNumericInput
                  id="phone"
                  autoComplete="tel"
                  mode="phone"
                  value={phone}
                  onChange={(value) => {
                    setPhone(value);
                    if (phoneError !== null) {
                      setPhoneError(null);
                    }
                  }}
                  aria-invalid={phoneError !== null}
                  aria-describedby={phoneError !== null ? phoneErrorId : undefined}
                />
                {phoneError ? (
                  <p
                    id={phoneErrorId}
                    role="alert"
                    className="text-sm text-destructive"
                    data-testid={OPERATOR_LOGIN_TEST_IDS.phoneError}
                  >
                    {phoneError}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={loading}
                onClick={() => {
                  void requestOtp();
                }}
              >
                {loading ? t("sendingOtp") : t("sendOtp")}
              </Button>
            </form>
          ) : (
            <form
              className="space-y-3"
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="space-y-2">
                <Label className="sr-only" htmlFor="otp">
                  {t("otpLabel")}
                </Label>
                <p className="text-center text-sm text-muted-foreground sm:text-start">{t("otpLabel")}</p>
                <OtpSegmentInput
                  value={otp}
                  onChange={(value) => {
                    setOtp(value);
                    if (otpError !== null) {
                      setOtpError(null);
                    }
                  }}
                  onComplete={(value) => {
                    void login(value);
                  }}
                  disabled={loading}
                  aria-invalid={otpError !== null}
                  aria-describedby={otpError !== null ? otpErrorId : undefined}
                />
                {otpError ? (
                  <p
                    id={otpErrorId}
                    role="alert"
                    className="text-center text-sm text-destructive"
                    data-testid={OPERATOR_LOGIN_TEST_IDS.otpError}
                  >
                    {otpError}
                  </p>
                ) : null}
              </div>
              <Button
                type="button"
                className="w-full"
                disabled={loading || otp.replace(/\D/g, "").length < OTP_SEGMENT_LENGTH}
                onClick={() => {
                  void login();
                }}
              >
                {loading ? t("signingIn") : t("signIn")}
              </Button>
              <div className="flex flex-col gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  disabled={loading || resendCooldown > 0}
                  onClick={() => {
                    void requestOtp();
                  }}
                >
                  {resendCooldown > 0
                    ? t("resendOtpIn", { seconds: resendCooldown })
                    : t("resendOtp")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={handleChangePhone}
                  disabled={loading}
                >
                  {t("changePhone")}
                </Button>
              </div>
            </form>
          )}

          {showDevOtpHint ? (
            <p className="text-center text-xs text-muted-foreground">{t("devOtpHint")}</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

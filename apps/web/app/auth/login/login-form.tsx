"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import { useAuth } from "@/lib/auth/auth-context";
import { resolveAuthUiErrorMessage } from "@/lib/errors/auth-ui-error-message";
import { normalizeOtpPhoneInput } from "@/lib/otp-phone-normalize";

import authStyles from "../auth-forms.module.css";

type LoginFormValues = {
  phone: string;
  otp: string;
};

type LoginStep = "phone" | "otp";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setSession } = useAuth();
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
              .min(1, "Phone is required.")
              .min(8, "Enter a valid phone number."),
          ),
        otp:
          step === "phone"
            ? z.string()
            : z.string().trim().min(1, "OTP is required."),
      }),
    [step],
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

  async function onValid(data: LoginFormValues): Promise<void> {
    if (step === "phone") {
      if (!data.phone) return;
      const normalizedPhone = normalizeOtpPhoneInput(data.phone);
      const preflightResponse = await fetch("/api/auth/phone-preflight", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          ...(inviteToken ? { invite_token: inviteToken } : {})
        })
      });
      const preflightPayload = (await preflightResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        error_code?: string;
        message?: string;
      };
      if (!preflightResponse.ok || !preflightPayload.ok) {
        throw new Error(preflightPayload.message ?? "Could not continue with this phone");
      }
      const otpRequestResponse = await fetch("/api/auth/request-otp", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizedPhone,
          ...(inviteToken ? { invite_token: inviteToken } : {})
        })
      });
      const otpRequestPayload = (await otpRequestResponse.json().catch(() => ({}))) as {
        ok?: boolean;
        error_code?: string;
        message?: string;
      };
      if (!otpRequestResponse.ok || !otpRequestPayload.ok) {
        throw new Error(otpRequestPayload.message ?? "Failed to request OTP");
      }
      setStep("otp");
      clearErrors();
      return;
    }
    if (step === "otp") {
      if (!data.phone) return;
    }
    try {
      const response = await fetch("/api/auth/login-web-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: normalizeOtpPhoneInput(data.phone),
          otp: data.otp.trim(),
          ...(inviteToken ? { invite_token: inviteToken } : {})
        })
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
        throw new Error(payload.message ?? "Login failed");
      }
      if (payload.requires_registration && typeof payload.onboarding_token === "string") {
        const params = new URLSearchParams({
          onboarding: payload.onboarding_token
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
        cache: "no-store"
      }).then((r) => r.json()).catch(() => ({}))) as {
        authenticated?: boolean;
        session_token?: string;
        user_id?: string;
        tenant_id?: string;
      };
      // #region agent log
      fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Debug-Session-Id": "770f2e"
        },
        body: JSON.stringify({
          sessionId: "770f2e",
          runId: "initial",
          hypothesisId: "H9",
          location: "app/auth/login/login-form.tsx:101",
          message: "login_form_session_payload_received",
          data: {
            authenticated: sessionPayload.authenticated === true,
            has_session_token: typeof sessionPayload.session_token === "string",
            has_user_id: typeof sessionPayload.user_id === "string",
            has_tenant_id: typeof sessionPayload.tenant_id === "string"
          },
          timestamp: Date.now()
        })
      }).catch(() => {});
      // #endregion
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
          entry_mode: "web"
        });
        // #region agent log
        fetch("http://127.0.0.1:7323/ingest/c60f1c6f-cda4-48f9-ac76-d6e5407c03d1", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "770f2e"
          },
          body: JSON.stringify({
            sessionId: "770f2e",
            runId: "initial",
            hypothesisId: "H9",
            location: "app/auth/login/login-form.tsx:118",
            message: "login_form_set_session_called",
            data: {},
            timestamp: Date.now()
          })
        }).catch(() => {});
        // #endregion
      } else {
        throw new Error("Session was not established. Please try again.");
      }
      showToast({ type: "success", message: "Login successful" });
      void router.refresh();
      router.push("/dashboard");
    } catch (err: unknown) {
      showToast({ type: "error", message: resolveAuthUiErrorMessage(err) });
    }
  }

  return (
    <>
      <h1 className={authStyles.heading}>Login</h1>
      <p className={authStyles.lead}>Sign in with your phone number and one-time password.</p>
      <form className={authStyles.form} onSubmit={handleSubmit(onValid)} noValidate>
        {step === "phone" && (
          <FormField label="Phone" error={errors.phone?.message}>
            <Input
              type="tel"
              autoComplete="tel"
              placeholder="+989121234567"
              aria-invalid={errors.phone ? true : undefined}
              disabled={isSubmitting}
              {...register("phone")}
            />
          </FormField>
        )}
        {step === "otp" && (
          <FormField label="OTP" error={errors.otp?.message}>
            <Input
              type="text"
              autoComplete="one-time-code"
              placeholder="1234"
              aria-invalid={errors.otp ? true : undefined}
              disabled={step !== "otp" || isSubmitting}
              {...register("otp")}
            />
          </FormField>
        )}
        {step === "otp" && <p>{watch("phone")}</p>}
        {step === "otp" && (
          <p
            onClick={() => {
              setStep("phone");
              clearErrors();
              setValue("otp", "");
            }}
            style={{cursor:"pointer"}}
          >
            Edit phone
          </p>
        )}
        {process.env.NODE_ENV === "development" ? (
          <p className={authStyles.helperText}>Development OTP: 1234</p>
        ) : null}
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
          {step === "phone" ? "Continue" : "Sign in"}
        </Button>
      </form>
      <p className={authStyles.footerNote}>
        No account?{" "}
        <Link href="/auth/register" className={authStyles.footerLink}>
          Register
        </Link>
      </p>
    </>
  );
}

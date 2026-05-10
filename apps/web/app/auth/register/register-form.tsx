"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import { Link, useRouter } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";

import authStyles from "../auth-forms.module.css";

function registerSchemaFactory(t: (key: string) => string) {
  return z.object({
    name: z.string().trim().min(1, t("register.validationNameRequired")),
    email: z
      .string()
      .trim()
      .email(t("register.validationEmailInvalid"))
      .optional()
      .or(z.literal("")),
  });
}

type RegisterFormValues = z.infer<ReturnType<typeof registerSchemaFactory>>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setSession } = useAuth();
  const t = useTranslations("auth");
  const onboardingToken = searchParams.get("onboarding")?.trim() || "";
  const inviteToken = searchParams.get("invite")?.trim() || "";

  const registerSchema = useMemo(() => registerSchemaFactory(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "" },
  });

  async function onValid(data: RegisterFormValues) {
    if (!onboardingToken) {
      showToast({ type: "error", message: t("register.toastMissingSession") });
      return;
    }
    const response = await fetch("/api/auth/complete-registration", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboarding_token: onboardingToken,
        full_name: data.name.trim(),
        email: data.email?.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: { message?: string };
      session_token?: string;
      user_id?: string;
      tenant_id?: string;
    };
    if (!response.ok || !payload.ok) {
      showToast({
        type: "error",
        message: payload.error?.message?.trim() || t("register.toastCompletionFailed"),
      });
      return;
    }
    if (
      typeof payload.session_token === "string" &&
      typeof payload.user_id === "string" &&
      typeof payload.tenant_id === "string"
    ) {
      await setSession({
        session_token: payload.session_token,
        user_id: payload.user_id,
        tenant_id: payload.tenant_id,
        entry_mode: "web",
      });
    }
    if (inviteToken) {
      const inviteResponse = await fetch("/api/auth/accept-invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_token: inviteToken }),
      });
      if (!inviteResponse.ok) {
        showToast({ type: "error", message: t("register.toastInviteFailed") });
      }
    }
    showToast({ type: "success", message: t("register.toastSuccess") });
    void router.refresh();
    router.push("/dashboard");
  }

  return (
    <>
      <h1 className={authStyles.heading}>{t("register.title")}</h1>
      <p className={authStyles.lead}>{t("register.subtitle")}</p>
      <form className={authStyles.form} onSubmit={handleSubmit(onValid)} noValidate>
        <FormField label={t("register.nameLabel")} error={errors.name?.message}>
          <Input
            autoComplete="name"
            placeholder={t("register.namePlaceholder")}
            aria-invalid={errors.name ? true : undefined}
            disabled={isSubmitting}
            {...register("name")}
          />
        </FormField>
        <FormField label={t("register.emailLabel")} error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder={t("register.emailPlaceholder")}
            aria-invalid={errors.email ? true : undefined}
            disabled={isSubmitting}
            {...register("email")}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!onboardingToken}>
          {t("register.submit")}
        </Button>
      </form>
      <p className={authStyles.footerNote}>
        {t("register.footerHaveAccount")}{" "}
        <Link href="/login" className={authStyles.footerLink}>
          {t("register.footerLogin")}
        </Link>
      </p>
    </>
  );
}

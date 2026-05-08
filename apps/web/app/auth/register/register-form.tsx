"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";
import { useAuth } from "@/lib/auth/auth-context";

import authStyles from "../auth-forms.module.css";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z
    .string()
    .trim()
    .email("Enter a valid email address.")
    .optional()
    .or(z.literal("")),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();
  const { setSession } = useAuth();
  const onboardingToken = searchParams.get("onboarding")?.trim() || "";
  const inviteToken = searchParams.get("invite")?.trim() || "";

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
      showToast({ type: "error", message: "Registration session is missing. Start from login again." });
      return;
    }
    const response = await fetch("/api/auth/complete-registration", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        onboarding_token: onboardingToken,
        full_name: data.name.trim(),
        email: data.email?.trim() || undefined
      })
    });
    const payload = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: { message?: string };
      session_token?: string;
      user_id?: string;
      tenant_id?: string;
    };
    if (!response.ok || !payload.ok) {
      showToast({ type: "error", message: payload.error?.message ?? "Registration completion failed." });
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
        entry_mode: "web"
      });
    }
    if (inviteToken) {
      const inviteResponse = await fetch("/api/auth/accept-invite", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_token: inviteToken })
      });
      if (!inviteResponse.ok) {
        showToast({ type: "error", message: "Registration completed, but invite acceptance failed." });
      }
    }
    showToast({ type: "success", message: "Registration completed." });
    void router.refresh();
    router.push("/dashboard");
  }

  return (
    <>
      <h1 className={authStyles.heading}>Register</h1>
      <p className={authStyles.lead}>
        Complete your profile to finish onboarding for this workspace.
      </p>
      <form className={authStyles.form} onSubmit={handleSubmit(onValid)} noValidate>
        <FormField label="Name" error={errors.name?.message}>
          <Input
            autoComplete="name"
            placeholder="Jane Operator"
            aria-invalid={errors.name ? true : undefined}
            disabled={isSubmitting}
            {...register("name")}
          />
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          <Input
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            aria-invalid={errors.email ? true : undefined}
            disabled={isSubmitting}
            {...register("email")}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={!onboardingToken}>
          Complete registration
        </Button>
      </form>
      <p className={authStyles.footerNote}>
        Already have an account?{" "}
        <Link href="/login" className={authStyles.footerLink}>
          Login
        </Link>
      </p>
    </>
  );
}

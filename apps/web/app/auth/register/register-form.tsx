"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, FormField, Input, useToast } from "@tour/ui";

import authStyles from "../auth-forms.module.css";

const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function onValid(data: RegisterFormValues) {
    void data;
    showToast({ type: "info", message: "Registration is currently unavailable." });
  }

  return (
    <>
      <h1 className={authStyles.heading}>Register</h1>
      <p className={authStyles.lead}>
        Create account is currently unavailable in this workspace. Signed-in tour signup follows the canonical placement
        API described in{" "}
        <code style={{ fontSize: "0.95em" }}>docs/architecture/frontend_mvp_contract.md</code> (tour-scoped register and
        waitlist endpoints).
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
        <FormField label="Password" error={errors.password?.message}>
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            aria-invalid={errors.password ? true : undefined}
            disabled={isSubmitting}
            {...register("password")}
          />
        </FormField>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Register
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

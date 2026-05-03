"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Checkbox, FormField, Input, useToast } from "@tour/ui";

import styles from "./settings-profile-form.module.css";

export type SettingsProfileValues = {
  fullName: string;
  email: string;
  notificationsEnabled: boolean;
};

const SettingsProfileSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required."),
  email: z.string().trim().min(1, "Email is required.").email("Enter a valid email."),
  notificationsEnabled: z.boolean(),
}) satisfies z.ZodType<SettingsProfileValues>;

const DEFAULT_SETTINGS_VALUES: SettingsProfileValues = {
  fullName: "Jordan Operator",
  email: "jordan.lee@example.com",
  notificationsEnabled: true,
};

export function SettingsProfileForm() {
  const { showToast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SettingsProfileValues>({
    resolver: zodResolver(SettingsProfileSchema) as Resolver<SettingsProfileValues>,
    defaultValues: DEFAULT_SETTINGS_VALUES,
  });

  async function onValid(_data: SettingsProfileValues) {
    await new Promise<void>((resolve) => setTimeout(resolve, 450));
    showToast({ type: "success", message: "Settings saved" });
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onValid)} noValidate>
      <FormField label="Full name" required error={errors.fullName?.message}>
        <Input autoComplete="name" aria-invalid={errors.fullName ? true : undefined} {...register("fullName")} />
      </FormField>

      <FormField label="Email" required error={errors.email?.message}>
        <Input type="email" autoComplete="email" aria-invalid={errors.email ? true : undefined} {...register("email")} />
      </FormField>

      <FormField
        label="Notifications enabled"
        description="Workspace alerts and digests."
        error={errors.notificationsEnabled?.message}
      >
        <Checkbox bare {...register("notificationsEnabled")} />
      </FormField>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={isSubmitting}>
          Save settings
        </Button>
      </div>
    </form>
  );
}

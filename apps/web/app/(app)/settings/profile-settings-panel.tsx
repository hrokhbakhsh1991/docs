"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useEffect, useMemo } from "react";
import type { Resolver } from "react-hook-form";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button, Checkbox, FormField, Input, useToast } from "@tour/ui";

import styles from "./settings-profile-form.module.css";
import { mapMeToProfileForm } from "./settings-me-shared";
import { pickMeErrorMessage, type RefreshWorkspaceMeOptions, type WorkspaceMeData } from "./workspace-me-provider";

export type ProfileSettingsPanelProps = {
  me: WorkspaceMeData;
  refresh: (opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

type ProfileFormValues = {
  fullName: string;
  notificationsEnabled: boolean;
};

export function ProfileSettingsPanel({ me, refresh }: ProfileSettingsPanelProps) {
  const t = useTranslations("settings");
  const { showToast } = useToast();

  const schema = useMemo(
    () =>
      z.object({
        fullName: z.string().trim().min(1, t("validationFullNameRequired")),
        notificationsEnabled: z.boolean(),
      }) satisfies z.ZodType<ProfileFormValues>,
    [t],
  );

  const resolver = useMemo(() => zodResolver(schema) as Resolver<ProfileFormValues>, [schema]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver,
    defaultValues: mapMeToProfileForm(me),
  });

  useEffect(() => {
    reset(mapMeToProfileForm(me));
  }, [me, reset]);

  async function onValid(formData: ProfileFormValues) {
    try {
      const res = await fetch("/api/me", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: formData.fullName.trim(),
          notifications_enabled: formData.notificationsEnabled,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as WorkspaceMeData | { status?: string };
      if (!res.ok) {
        showToast({
          type: "error",
          message: pickMeErrorMessage(body, t("saveFailedToast")),
        });
        return;
      }
      reset(mapMeToProfileForm(body as WorkspaceMeData));
      showToast({ type: "success", message: t("toastSaved") });
      await refresh({ silent: true });
    } catch {
      showToast({ type: "error", message: t("saveFailedToast") });
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onValid)} noValidate>
      <FormField label={t("fieldFullName")} required error={errors.fullName?.message}>
        <Input autoComplete="name" aria-invalid={errors.fullName ? true : undefined} {...register("fullName")} />
      </FormField>

      <FormField
        label={t("fieldNotifications")}
        description={t("fieldNotificationsDescription")}
        error={errors.notificationsEnabled?.message}
      >
        <Checkbox bare {...register("notificationsEnabled")} />
      </FormField>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={isSubmitting} disabled={isSubmitting}>
          {t("submitButton")}
        </Button>
      </div>
    </form>
  );
}

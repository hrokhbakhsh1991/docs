"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { FormField, JalaliDatePicker, Select, Button, Checkbox, Input, useToast } from "@tour/ui";
import { ME_PROFILE_GENDER_VALUES } from "@repo/types";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef } from "react";
import type { Resolver } from "react-hook-form";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import { PersianNumberInput } from "@/components/forms/PersianNumberInput";
import { asciiDigitsFromNationalIdRaw, isValidIranNationalIdChecksum } from "@/lib/iran-national-id";
import {
  isBirthDateGregorianEligible,
  utcOldestBirthYmdYearsAgo,
  utcTodayGregorianYmd,
} from "@/lib/profile-birth-date";
import { pickMeErrorMessage } from "@/lib/me-api-error";

import { patchMe } from "@/lib/me-client";

import styles from "./settings-profile-form.module.css";
import { mapMeToProfileForm } from "./settings-me-shared";
import { type RefreshWorkspaceMeOptions, type WorkspaceMeData } from "./workspace-me-provider";

export type ProfileSettingsPanelProps = {
  me: WorkspaceMeData;
  refresh: (opts?: RefreshWorkspaceMeOptions) => Promise<void>;
};

type ProfileFormValues = ReturnType<typeof mapMeToProfileForm>;

const genderLiterals = [...ME_PROFILE_GENDER_VALUES] as [string, ...string[]];

export function ProfileSettingsPanel({ me, refresh }: ProfileSettingsPanelProps) {
  const t = useTranslations("settings");
  const { showToast } = useToast();
  const initialSnapshotRef = useRef(mapMeToProfileForm(me));
  /** Keeps If-Match in sync after PATCH responses so rapid saves / overlapping refreshes avoid stale versions. */
  const profileRowVersionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (typeof me.profile_row_version === "number") {
      profileRowVersionRef.current = me.profile_row_version;
    }
  }, [me.profile_row_version]);

  const birthMinYmd = useMemo(() => utcOldestBirthYmdYearsAgo(120), []);
  const birthMaxYmd = useMemo(() => utcTodayGregorianYmd(), []);

  const schema = useMemo(() => {
    const genderEnum = z.union([z.literal(""), z.enum(genderLiterals)]);
    return z
      .object({
        fullName: z.string().trim().max(255, { message: t("validationFullNameMax") }),
        notificationsEnabled: z.boolean(),
        nationalId: z.string(),
        gender: genderEnum,
        birthDate: z.string(),
      })
      .superRefine((data, ctx) => {
        const nid = asciiDigitsFromNationalIdRaw(data.nationalId.trim());
        if (nid.length > 0 && nid.length !== 10) {
          ctx.addIssue({
            code: "custom",
            message: t("validationNationalIdLength"),
            path: ["nationalId"],
          });
        }
        if (nid.length === 10 && !isValidIranNationalIdChecksum(nid)) {
          ctx.addIssue({
            code: "custom",
            message: t("validationNationalIdInvalid"),
            path: ["nationalId"],
          });
        }
        const dob = data.birthDate.trim();
        if (dob !== "" && !isBirthDateGregorianEligible(dob)) {
          ctx.addIssue({
            code: "custom",
            message: t("validationBirthDateInvalid"),
            path: ["birthDate"],
          });
        }
      });
  }, [t]);

  const resolver = useMemo(() => zodResolver(schema) as Resolver<ProfileFormValues>, [schema]);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormValues>({
    resolver,
    defaultValues: mapMeToProfileForm(me),
  });

  useEffect(() => {
    const defaults = mapMeToProfileForm(me);
    initialSnapshotRef.current = defaults;
    reset(defaults);
  }, [me, reset]);

  async function onValid(formData: ProfileFormValues) {
    try {
      const init = initialSnapshotRef.current;
      const patchBody: Record<string, unknown> = {};
      if (formData.notificationsEnabled !== init.notificationsEnabled) {
        patchBody.notifications_enabled = formData.notificationsEnabled;
      }

      const trimmedName = formData.fullName.trim();
      const initNameTrimmed = init.fullName.trim();
      if (trimmedName !== initNameTrimmed) {
        patchBody.full_name = trimmedName === "" ? null : trimmedName;
      }

      const nidAscii = asciiDigitsFromNationalIdRaw(formData.nationalId.trim());
      const initNid = asciiDigitsFromNationalIdRaw(init.nationalId.trim());
      if (nidAscii !== initNid) {
        patchBody.national_id = nidAscii === "" ? null : nidAscii;
      }

      if (formData.gender !== init.gender) {
        patchBody.gender = formData.gender === "" ? null : formData.gender;
      }

      const bd = formData.birthDate.trim();
      const ibd = init.birthDate.trim();
      if (bd !== ibd) {
        patchBody.birth_date = bd === "" ? null : bd;
      }

      if (Object.keys(patchBody).length === 0) {
        showToast({ type: "info", message: t("toastNoChanges") });
        return;
      }

      const versionForMatch = profileRowVersionRef.current ?? me.profile_row_version;
      const ifMatch =
        typeof versionForMatch === "number" ? `W/"${String(versionForMatch)}"` : undefined;

      const res = await patchMe(patchBody, ifMatch !== undefined ? { ifMatch } : undefined);
      const body = (await res.json().catch(() => ({}))) as WorkspaceMeData | { status?: string };
      if (!res.ok) {
        showToast({
          type: "error",
          message: pickMeErrorMessage(body, t("saveFailedToast"), t),
        });
        return;
      }
      if (
        typeof body !== "object" ||
        body === null ||
        !("id" in body) ||
        typeof (body as WorkspaceMeData).profile_row_version !== "number"
      ) {
        showToast({ type: "error", message: t("saveFailedToast") });
        await refresh({ silent: true });
        return;
      }
      const profileBody = body as WorkspaceMeData;
      profileRowVersionRef.current = profileBody.profile_row_version;
      const nextDefaults = mapMeToProfileForm(profileBody);
      initialSnapshotRef.current = nextDefaults;
      reset(nextDefaults);
      showToast({ type: "success", message: t("toastSaved") });
      await refresh({ silent: true });
    } catch {
      showToast({ type: "error", message: t("saveFailedToast") });
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit(onValid)} noValidate>
      <FormField label={t("fieldFullName")} error={errors.fullName?.message}>
        <Input autoComplete="name" aria-invalid={errors.fullName ? true : undefined} {...register("fullName")} />
      </FormField>

      <FormField label={t("fieldNationalId")} description={t("fieldNationalIdDescription")} error={errors.nationalId?.message}>
        <Controller
          name="nationalId"
          control={control}
          render={({ field }) => (
            <PersianNumberInput
              ref={field.ref}
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              numericMode="integer"
              maxLength={10}
              aria-invalid={errors.nationalId ? true : undefined}
              autoComplete="off"
            />
          )}
        />
      </FormField>

      <FormField label={t("fieldGender")} error={errors.gender?.message}>
        <Select invalid={Boolean(errors.gender)} {...register("gender")}>
          <option value="">{t("genderUnset")}</option>
          <option value="female">{t("genderFemale")}</option>
          <option value="male">{t("genderMale")}</option>
          <option value="non_binary">{t("genderNonBinary")}</option>
          <option value="prefer_not_to_say">{t("genderPreferNotToSay")}</option>
        </Select>
      </FormField>

      <FormField label={t("fieldBirthDate")} description={t("fieldBirthDateDescription")} error={errors.birthDate?.message}>
        <Controller
          name="birthDate"
          control={control}
          render={({ field }) => (
            <JalaliDatePicker
              ref={field.ref}
              name={field.name}
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              onBlur={field.onBlur}
              invalid={Boolean(errors.birthDate)}
              maxDate={birthMaxYmd}
              minDate={birthMinYmd}
              clearLabel={t("profileJalaliClear")}
              openCalendarAriaLabel={t("profileOpenCalendarAria")}
            />
          )}
        />
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

"use client";

import { Button, FormField, Select, Textarea } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FieldPath } from "react-hook-form";
import { useForm } from "react-hook-form";

import { listDenaliRuleFieldPaths } from "@/features/tours/wizard/denali/rules/denaliRuleModel";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { ApiError } from "@/lib/api-client";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { handleValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import {
  applyUniversalValidationIssuesToForm,
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  type TourWizardTemplateBuilderFormValues,
} from "@/lib/validation/tour-wizard-template-builder-form";
import { validateDenaliWorkspaceTemplate } from "@/lib/validation/universal-validator";
import { useUpdateTourWizardTemplate } from "@/hooks/use-update-tour-wizard-template";

import formStyles from "../settings-profile-form.module.css";
import styles from "./tour-wizard-template.module.css";

const VISIBILITY_OPTIONS = ["", "always", "active", "hidden"] as const;
const REQUIRED_OPTIONS = ["", "required", "recommended", "optional", "forbidden"] as const;

export type TourWizardTemplateBuilderFormProps = {
  template: TenantWizardTemplate | null;
  onSaved?: () => void;
};

export function TourWizardTemplateBuilderForm({
  template,
  onSaved,
}: TourWizardTemplateBuilderFormProps) {
  const t = useTranslations("settings");
  const ability = useAbility();
  const updateMutation = useUpdateTourWizardTemplate();
  const [rootMessage, setRootMessage] = useState<string | null>(null);

  const canManageTemplate = ability.can(AbilityAction.Update, "TourWizardTemplate");
  const canPublish = ability.can(AbilityAction.Update, "TourWizardTemplate");

  const fieldPaths = useMemo(() => listDenaliRuleFieldPaths(), []);

  const defaultValues = useMemo(
    () => buildTourWizardTemplateBuilderDefaults(template, fieldPaths),
    [template, fieldPaths],
  );

  const form = useForm<TourWizardTemplateBuilderFormValues>({
    defaultValues,
    mode: "onSubmit",
  });

  const { register, handleSubmit, reset, setError, clearErrors, formState } = form;

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const applyClientValidation = useCallback(
    (mode: "save" | "publish") => {
      let payload;
      try {
        payload = buildTourWizardTemplatePayloadFromForm(form.getValues());
      } catch {
        setError("canonicalDataJson", {
          type: "manual",
          message: t("tourWizardTemplateCanonicalJsonInvalid"),
        });
        setRootMessage(t("tourWizardTemplateValidationFailed"));
        return null;
      }

      const issues = validateDenaliWorkspaceTemplate(payload, { mode });
      clearErrors();
      setRootMessage(null);
      if (issues.length === 0) {
        return payload;
      }
      applyUniversalValidationIssuesToForm(setError, issues);
      setRootMessage(t("tourWizardTemplateValidationFailed"));
      return null;
    },
    [clearErrors, form, setError, t],
  );

  const submit = useCallback(
    async (mode: "save" | "publish") => {
      const payload = applyClientValidation(mode);
      if (!payload) {
        return;
      }

      clearErrors("root");
      setRootMessage(null);

      try {
        await updateMutation.mutateAsync({
          fieldRulesOverlay: payload.fieldRulesOverlay,
          canonicalData: payload.canonicalData as Record<string, unknown>,
          publish: mode === "publish",
        });
        onSaved?.();
      } catch (error) {
        if (error instanceof ApiError) {
          const handled = handleValidationApiError(error, setError);
          if (handled) {
            setRootMessage(t("tourWizardTemplateValidationFailed"));
            return;
          }
          setRootMessage(error.message);
          return;
        }
        setRootMessage(t("tourWizardTemplateSaveFailed"));
      }
    },
    [applyClientValidation, clearErrors, onSaved, setError, t, updateMutation],
  );

  if (!template) {
    return <p className={formStyles.loadError}>{t("tourWizardTemplateNotConfigured")}</p>;
  }

  if (!canManageTemplate) {
    return <p className={formStyles.readOnlyBanner}>{t("tourWizardTemplateReadOnlyBanner")}</p>;
  }

  return (
    <form className={formStyles.form} onSubmit={handleSubmit(() => void submit("save"))} noValidate>
      <p className={styles.hint}>{t("tourWizardTemplateOverlayHint")}</p>

      <div className={styles.overlayTableWrap}>
        <table className={styles.overlayTable}>
          <thead>
            <tr>
              <th>{t("tourWizardTemplateFieldPathColumn")}</th>
              <th>{t("tourWizardTemplateVisibilityColumn")}</th>
              <th>{t("tourWizardTemplateRequiredColumn")}</th>
            </tr>
          </thead>
          <tbody>
            {fieldPaths.map((path) => {
              const visibilityName =
                `fieldRulesOverlay.${path}.visibility` as FieldPath<TourWizardTemplateBuilderFormValues>;
              const requiredName =
                `fieldRulesOverlay.${path}.required` as FieldPath<TourWizardTemplateBuilderFormValues>;
              const visibilityError = formState.errors.fieldRulesOverlay?.[path]?.visibility;
              const requiredError = formState.errors.fieldRulesOverlay?.[path]?.required;

              return (
                <tr key={path}>
                  <td>
                    <code>{path}</code>
                  </td>
                  <td>
                    <FormField error={visibilityError?.message}>
                      <Select {...register(visibilityName)}>
                        {VISIBILITY_OPTIONS.map((value) => (
                          <option key={value || "inherit"} value={value}>
                            {value === ""
                              ? t("tourWizardTemplateInheritOption")
                              : t(`tourWizardTemplateVisibility_${value}`)}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </td>
                  <td>
                    <FormField error={requiredError?.message}>
                      <Select {...register(requiredName)}>
                        {REQUIRED_OPTIONS.map((value) => (
                          <option key={value || "inherit"} value={value}>
                            {value === ""
                              ? t("tourWizardTemplateInheritOption")
                              : t(`tourWizardTemplateRequired_${value}`)}
                          </option>
                        ))}
                      </Select>
                    </FormField>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <FormField
        label={t("tourWizardTemplateCanonicalLabel")}
        description={t("tourWizardTemplateCanonicalDescription")}
        error={formState.errors.canonicalDataJson?.message}
      >
        <Textarea rows={14} {...register("canonicalDataJson")} spellCheck={false} />
      </FormField>

      {rootMessage ? <p className={formStyles.loadError}>{rootMessage}</p> : null}

      <div className={formStyles.actions}>
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? t("tourWizardTemplateSaving") : t("tourWizardTemplateSave")}
        </Button>
        {canPublish ? (
          <Button
            type="button"
            variant="primary"
            disabled={updateMutation.isPending}
            onClick={() => void submit("publish")}
          >
            {t("tourWizardTemplatePublish")}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

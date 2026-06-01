"use client";

import { Button } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch, type UseFormReturn } from "react-hook-form";

import {
  DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS,
  getDenaliSettingsOverlayFieldHints,
  type DenaliOverlayFieldHint,
} from "@repo/denali-domain";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { ApiError } from "@/lib/api-client";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { handleValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";
import {
  applyUniversalValidationIssuesToForm,
  buildPreviewWizardTemplate,
  packTemplateCanonicalForPersist,
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  canonicalSeedRegistrationPath,
  packCanonicalFormValuesToTemplateData,
  mapOverlayValidationPathToFormPath,
  type TourWizardTemplateBuilderFormValues,
} from "@/lib/validation/tour-wizard-template-builder-form";
import { validateDenaliWorkspaceTemplate } from "@/lib/validation/universal-validator";
import { useUpdateTourWizardTemplate } from "@/hooks/use-update-tour-wizard-template";

import { isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";

import formStyles from "../settings-profile-form.module.css";
import styles from "./tour-wizard-template.module.css";
import { TemplateBuilderFieldRow } from "./TemplateBuilderFieldRow";
import { groupTemplateBuilderFieldPaths, resolveModernTemplateBuilderFieldPaths } from "./tour-wizard-template-section-groups";
import { TourWizardTemplatePreviewPanel } from "./tour-wizard-template-preview-panel";

const CONFIG_FORM_ID = "tour-wizard-template-builder-form";

function overlayHintMessageKey(hint: DenaliOverlayFieldHint): string {
  if (hint.kind === "matrix") {
    return `tourWizardTemplateMatrix_${hint.messageKey}`;
  }
  return `tourWizardTemplateConditional_${hint.messageKey}`;
}

function overlayHintBadgeLabelKey(hint: DenaliOverlayFieldHint): string {
  return hint.kind === "matrix"
    ? "tourWizardTemplateMatrixBadge"
    : "tourWizardTemplateConditionalBadge";
}

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
  const previewFormRef = useRef<UseFormReturn<DenaliCreateTourWizardForm> | null>(null);

  const canManageTemplate = ability.can(AbilityAction.Update, "TourWizardTemplate");
  const canPublish = ability.can(AbilityAction.Update, "TourWizardTemplate");

  const fieldPaths = useMemo(
    () => resolveModernTemplateBuilderFieldPaths(DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS),
    [],
  );
  const fieldHints = useMemo(() => getDenaliSettingsOverlayFieldHints(), []);
  const sectionGroups = useMemo(() => groupTemplateBuilderFieldPaths(fieldPaths), [fieldPaths]);

  const destinationsQuery = useTourDestinations();
  const crewMembersQuery = useWorkspaceTourCrewMembers();

  const destinationById = useMemo(
    () => new Map((destinationsQuery.destinations ?? []).map((item) => [item.id, item])),
    [destinationsQuery.destinations],
  );

  const activeDestinations = useMemo(
    () =>
      destinationsQuery.groupedRegions.flatMap((group) =>
        group.items.map((item) => ({
          id: item.id,
          name: item.name,
          regionId: group.regionId,
          regionName: group.regionName,
        })),
      ),
    [destinationsQuery.groupedRegions],
  );

  const leaderOptions = useMemo(() => {
    const crewRoleLabel = (role: string) => {
      if (role === "owner") return "Owner";
      if (role === "admin") return "Admin";
      if (role === "leader") return "Leader";
      return role;
    };
    return (crewMembersQuery.data ?? []).map((member) => ({
      id: member.id,
      name: String(member.name?.trim() || member.email || member.phone || member.id),
      regionId: member.role,
      regionName: crewRoleLabel(member.role),
    }));
  }, [crewMembersQuery.data]);

  const defaultValues = useMemo(
    () => buildTourWizardTemplateBuilderDefaults(template, fieldPaths),
    [template, fieldPaths],
  );

  const configForm = useForm<TourWizardTemplateBuilderFormValues>({
    defaultValues,
    mode: "onSubmit",
  });

  const { register, handleSubmit, reset, setError, clearErrors, formState, control, setValue } =
    configForm;

  const watchedOverlay = useWatch({ control, name: "fieldRulesOverlay" });
  const watchedCanonicalData = useWatch({ control, name: "canonicalData" });

  const packedCanonicalData = useMemo(
    () => packCanonicalFormValuesToTemplateData(watchedCanonicalData ?? defaultValues.canonicalData),
    [defaultValues.canonicalData, watchedCanonicalData],
  );

  const previewTemplate = useMemo(() => {
    if (!template) {
      return null;
    }
    return buildPreviewWizardTemplate(
      template,
      { fieldRulesOverlay: watchedOverlay ?? defaultValues.fieldRulesOverlay },
      fieldPaths,
    );
  }, [defaultValues.fieldRulesOverlay, fieldPaths, template, watchedOverlay]);

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  const handleDestinationSelected = useCallback(
    (destinationId: string) => {
      const altitudeM = destinationById.get(destinationId)?.altitudeM;
      if (typeof altitudeM === "number" && Number.isFinite(altitudeM) && altitudeM > 0) {
        setValue(canonicalSeedRegistrationPath("overview.peakHeight"), altitudeM, {
          shouldDirty: true,
        });
      }
    },
    [destinationById, setValue],
  );

  const applyClientValidation = useCallback(
    (mode: "save" | "publish") => {
      const formValues = configForm.getValues();
      const canonicalLayerA = packTemplateCanonicalForPersist(
        previewFormRef.current?.getValues(),
        formValues.canonicalData ?? {},
      );
      const payload = buildTourWizardTemplatePayloadFromForm(formValues, fieldPaths, {
        canonicalLayerA,
      });

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
    [clearErrors, configForm, fieldPaths, setError, t],
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
          const handled = handleValidationApiError(error, setError, {
            mapPath: mapOverlayValidationPathToFormPath,
          });
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

  const canonicalTopLevelKeys = Object.keys(packedCanonicalData).filter(
    (key) => packedCanonicalData[key] !== undefined,
  );
  const isCanonicalEmpty = isDenaliCanonicalTemplateDataEmpty(packedCanonicalData);

  return (
    <div className={styles.builderRoot} data-testid="tour-wizard-template-builder">
      <aside
        className={styles.templateStatusBanner}
        aria-label={t("tourWizardTemplateStatusAria")}
        data-testid="tour-wizard-template-status-banner"
      >
        <strong>{t("tourWizardTemplateStatusTitle")}</strong>
        <ul className={styles.templateStatusList}>
          <li>
            {t("tourWizardTemplateStatusId")}: <code>{template.id}</code>
          </li>
          <li>
            {t("tourWizardTemplateStatusProfile")}: {template.baseProfile}
          </li>
          <li>
            {t("tourWizardTemplateStatusCanonicalEmpty")}: {isCanonicalEmpty ? "true" : "false"}
          </li>
          <li>
            {t("tourWizardTemplateStatusCanonicalKeys")}:{" "}
            {canonicalTopLevelKeys.length > 0 ? canonicalTopLevelKeys.join(", ") : "—"}
          </li>
          {template.createdAt ? (
            <li>
              {t("tourWizardTemplateStatusCreatedAt")}: {template.createdAt}
            </li>
          ) : null}
          {template.updatedAt ? (
            <li>
              {t("tourWizardTemplateStatusUpdatedAt")}: {template.updatedAt}
            </li>
          ) : null}
          {template.createdAt && template.updatedAt ? (
            <li>
              {t("tourWizardTemplateStatusAutoSeedEligible")}:{" "}
              {template.createdAt === template.updatedAt ? "true" : "false"}
            </li>
          ) : null}
        </ul>
      </aside>

      <div className={styles.dualPanel}>
        <form
          id={CONFIG_FORM_ID}
          className={`${styles.configForm} ${styles.configPanel}`}
          onSubmit={handleSubmit(() => void submit("save"))}
          noValidate
        >
          <header className={styles.dashboardHeader}>
            <h2 className={styles.dashboardTitle}>{t("tourWizardTemplateDashboardTitle")}</h2>
            <p className={styles.hint}>{t("tourWizardTemplateOverlayHint")}</p>
          </header>

          <div className={styles.sectionGrid} data-testid="tour-wizard-template-section-grid">
            {sectionGroups.map((section) => (
              <section
                key={section.id}
                className={styles.sectionCard}
                data-testid={`tour-wizard-template-section-${section.id}`}
              >
                <header className={styles.sectionCardHeader}>
                  <h3 className={styles.sectionCardTitle}>{t(section.titleKey)}</h3>
                </header>

                <div className={styles.fieldRows}>
                  {section.paths.map((path) => (
                    <TemplateBuilderFieldRow
                      key={path}
                      storagePath={path}
                      control={control}
                      register={register}
                      destinationOptions={activeDestinations}
                      leaderOptions={leaderOptions}
                      onDestinationSelected={
                        path === "destinationId" ? handleDestinationSelected : undefined
                      }
                      visibilityError={formState.errors.fieldRulesOverlay?.[path]?.visibility?.message}
                      requiredError={formState.errors.fieldRulesOverlay?.[path]?.required?.message}
                      seedError={formState.errors.canonicalData?.[path]?.message}
                      hints={fieldHints.get(path)}
                      overlayHintMessageKey={overlayHintMessageKey}
                      overlayHintBadgeLabelKey={overlayHintBadgeLabelKey}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </form>

        {previewTemplate ? (
          <TourWizardTemplatePreviewPanel
            previewTemplate={previewTemplate}
            canonicalData={packedCanonicalData}
            previewFormRef={previewFormRef}
          />
        ) : null}
      </div>

      {rootMessage ? <p className={formStyles.loadError}>{rootMessage}</p> : null}

      <div className={styles.builderActions}>
        <Button type="submit" form={CONFIG_FORM_ID} disabled={updateMutation.isPending}>
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
    </div>
  );
}

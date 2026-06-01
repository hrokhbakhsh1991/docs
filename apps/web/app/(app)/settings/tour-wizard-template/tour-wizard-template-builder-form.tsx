"use client";

import { Button } from "@tour/ui";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import {
  getDenaliSettingsOverlayFieldHints,
  listDenaliTemplateStorageFieldPaths,
  type DenaliOverlayFieldHint,
} from "@repo/denali-domain";
import { isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { buildDenaliTourCreateDefaultValues } from "@/features/tours/wizard/schemas/denaliCore.schema";
import { DENALI_QUIET_FORM_RESET_OPTIONS } from "@/features/tours/wizard/denali/denaliCanonicalFormAdapter";
import { orchestrateDenaliWizardFromTemplate } from "@/features/tours/wizard/domain/orchestrateDenaliWizardFromTemplate";
import type { TenantWizardTemplate } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import { ApiError } from "@/lib/api-client";
import { AbilityAction } from "@/lib/casl/ability-actions";
import { useAbility } from "@/lib/casl/ability-provider";
import { handleValidationApiError } from "@/lib/errors/apply-api-validation-errors";
import { useTourDestinations } from "@/hooks/use-tour-destinations";
import { useWorkspaceTourCrewMembers } from "@/hooks/use-workspace-tour-crew-members";
import {
  applyUniversalValidationIssuesToOverlayForm,
  applyUniversalValidationIssuesToWizardForm,
  buildPreviewWizardTemplate,
  buildTourWizardTemplateBuilderDefaults,
  buildTourWizardTemplatePayloadFromForm,
  canonicalDataFromWizardForm,
  isWizardFormCanonicalExportError,
  mapOverlayValidationPathToFormPath,
  templateSeedRhfPath,
  type TourWizardTemplateBuilderFormValues,
} from "@/lib/validation/tour-wizard-template-builder-form";
import { validateDenaliWorkspaceTemplate } from "@/lib/validation/universal-validator";
import { useUpdateTourWizardTemplate } from "@/hooks/use-update-tour-wizard-template";

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
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = useRef(false);
  const [rootMessage, setRootMessage] = useState<string | null>(null);
  const [canonicalSyncToken, setCanonicalSyncToken] = useState(0);
  const [wizardHydrated, setWizardHydrated] = useState(false);
  const [wizardHydrationError, setWizardHydrationError] = useState<readonly string[] | null>(null);

  const canManageTemplate = ability.can(AbilityAction.Update, "TourWizardTemplate");
  const canPublish = ability.can(AbilityAction.Update, "TourWizardTemplate");

  const fieldPaths = useMemo(
    () => resolveModernTemplateBuilderFieldPaths(listDenaliTemplateStorageFieldPaths()),
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

  const overlayDefaults = useMemo(
    () => buildTourWizardTemplateBuilderDefaults(template, fieldPaths),
    [template, fieldPaths],
  );

  const overlayForm = useForm<TourWizardTemplateBuilderFormValues>({
    defaultValues: overlayDefaults,
    mode: "onSubmit",
  });

  const wizardForm = useForm<DenaliCreateTourWizardForm>({
    defaultValues: buildDenaliTourCreateDefaultValues(),
    mode: "onSubmit",
  });

  const { register, handleSubmit, reset, setError, clearErrors, formState, control } = overlayForm;
  const watchedOverlay = useWatch({ control, name: "fieldRulesOverlay" });

  const savedTemplateKey = template
    ? `${template.id}:${template.updatedAt ?? template.createdAt ?? ""}`
    : null;

  useEffect(() => {
    if (!template || !savedTemplateKey) {
      setWizardHydrated(false);
      setWizardHydrationError(null);
      return;
    }

    let cancelled = false;
    setWizardHydrated(false);
    setWizardHydrationError(null);

    void orchestrateDenaliWizardFromTemplate(
      template,
      (template.canonicalData ?? {}) as Record<string, unknown>,
    ).then((result) => {
      if (cancelled) {
        return;
      }
      if (!result.success) {
        setWizardHydrationError(result.errors);
        return;
      }
      wizardForm.reset(result.form, DENALI_QUIET_FORM_RESET_OPTIONS);
      setCanonicalSyncToken((token) => token + 1);
      setWizardHydrated(true);
    });

    return () => {
      cancelled = true;
    };
  }, [savedTemplateKey, template, wizardForm]);

  useEffect(() => {
    reset(overlayDefaults);
  }, [overlayDefaults, reset]);

  const previewTemplate = useMemo(() => {
    if (!template) {
      return null;
    }
    return buildPreviewWizardTemplate(
      template,
      { fieldRulesOverlay: watchedOverlay ?? overlayDefaults.fieldRulesOverlay },
      fieldPaths,
      (template.canonicalData ?? {}) as Record<string, unknown>,
    );
  }, [fieldPaths, overlayDefaults.fieldRulesOverlay, template, watchedOverlay]);

  const handleDestinationSelected = useCallback(
    (destinationId: string) => {
      const altitudeM = destinationById.get(destinationId)?.altitudeM;
      const peakPath = templateSeedRhfPath("overview.peakHeight");
      if (
        typeof altitudeM === "number" &&
        Number.isFinite(altitudeM) &&
        altitudeM > 0 &&
        peakPath
      ) {
        wizardForm.setValue(peakPath, altitudeM, { shouldDirty: true });
      }
    },
    [destinationById, wizardForm],
  );

  const applyClientValidation = useCallback(
    (mode: "save" | "publish") => {
      const overlayValues = overlayForm.getValues();
      let canonicalData;
      try {
        canonicalData = canonicalDataFromWizardForm(wizardForm.getValues());
      } catch (error) {
        clearErrors();
        wizardForm.clearErrors();
        if (isWizardFormCanonicalExportError(error)) {
          wizardForm.setError("basicInfo.tourType", {
            type: "manual",
            message: error.message,
          });
        }
        setRootMessage(t("tourWizardTemplateValidationFailed"));
        return null;
      }

      const payload = buildTourWizardTemplatePayloadFromForm(overlayValues, fieldPaths, {
        canonicalData,
      });

      const issues = validateDenaliWorkspaceTemplate(payload, { mode });
      clearErrors();
      wizardForm.clearErrors();
      setRootMessage(null);
      if (issues.length === 0) {
        return payload;
      }
      applyUniversalValidationIssuesToOverlayForm(setError, issues);
      applyUniversalValidationIssuesToWizardForm(wizardForm.setError, issues);
      setRootMessage(t("tourWizardTemplateValidationFailed"));
      return null;
    },
    [clearErrors, fieldPaths, overlayForm, setError, t, wizardForm],
  );

  const submit = useCallback(
    async (mode: "save" | "publish") => {
      if (mode === "save") {
        if (isSavingRef.current || updateMutation.isPending) {
          return;
        }
        isSavingRef.current = true;
        setIsSaving(true);
      } else if (isSavingRef.current || updateMutation.isPending) {
        return;
      }

      try {
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
      } finally {
        if (mode === "save") {
          isSavingRef.current = false;
          setIsSaving(false);
        }
      }
    },
    [applyClientValidation, clearErrors, onSaved, setError, t, updateMutation],
  );

  const submitSave = useCallback(() => void submit("save"), [submit]);

  const isSaveBusy = isSaving || updateMutation.isPending;

  if (!template) {
    return <p className={formStyles.loadError}>{t("tourWizardTemplateNotConfigured")}</p>;
  }

  if (!canManageTemplate) {
    return <p className={formStyles.readOnlyBanner}>{t("tourWizardTemplateReadOnlyBanner")}</p>;
  }

  const isCanonicalEmpty = isDenaliCanonicalTemplateDataEmpty(template.canonicalData);
  const canonicalTopLevelKeys = Object.keys(template.canonicalData ?? {}).filter(
    (key) => (template.canonicalData as Record<string, unknown>)[key] !== undefined,
  );

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
        </ul>
      </aside>

      <div className={styles.dualPanel}>
        <form
          id={CONFIG_FORM_ID}
          className={`${styles.configForm} ${styles.configPanel}`}
          onSubmit={handleSubmit(submitSave)}
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
                  {section.paths.map((path) => {
                    const seedRhfPath = templateSeedRhfPath(path);
                    return (
                      <TemplateBuilderFieldRow
                        key={path}
                        storagePath={path}
                        overlayControl={control}
                        wizardControl={wizardForm.control}
                        setWizardValue={wizardForm.setValue}
                        register={register}
                        destinationOptions={activeDestinations}
                        leaderOptions={leaderOptions}
                        onDestinationSelected={
                          path === "destinationId" ? handleDestinationSelected : undefined
                        }
                        visibilityError={formState.errors.fieldRulesOverlay?.[path]?.visibility?.message}
                        requiredError={formState.errors.fieldRulesOverlay?.[path]?.required?.message}
                        seedError={
                          seedRhfPath
                            ? wizardForm.getFieldState(seedRhfPath).error?.message
                            : undefined
                        }
                        hints={fieldHints.get(path)}
                        overlayHintMessageKey={overlayHintMessageKey}
                        overlayHintBadgeLabelKey={overlayHintBadgeLabelKey}
                      />
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </form>

        {previewTemplate ? (
          <TourWizardTemplatePreviewPanel
            previewTemplate={previewTemplate}
            formMethods={wizardForm}
            canonicalSyncToken={canonicalSyncToken}
            wizardHydrated={wizardHydrated}
            hydrationError={wizardHydrationError}
          />
        ) : null}
      </div>

      {rootMessage ? <p className={formStyles.loadError}>{rootMessage}</p> : null}

      <div className={styles.builderActions}>
        <Button type="submit" form={CONFIG_FORM_ID} disabled={isSaveBusy} aria-busy={isSaveBusy}>
          {isSaveBusy ? t("tourWizardTemplateSaving") : t("tourWizardTemplateSave")}
        </Button>
        {canPublish ? (
          <Button
            type="button"
            variant="primary"
            disabled={isSaveBusy}
            onClick={() => void submit("publish")}
          >
            {t("tourWizardTemplatePublish")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { FormField, Select } from "@tour/ui";
import { useTranslations } from "next-intl";
import type { Control, UseFormRegister } from "react-hook-form";

import type { DenaliOverlayFieldHint } from "@repo/denali-domain";
import { getDenaliTemplateSeedFieldDefinition } from "@/lib/validation/tour-wizard-template-builder-form";
import {
  overlayRowRegistrationPath,
  type TourWizardTemplateBuilderFormValues,
} from "@/lib/validation/tour-wizard-template-builder-form";
import { resolveDenaliRegistryFieldLabel } from "@/features/tours/wizard/denali/denaliRegistryFieldLabel";

import { DenaliTemplateSeedField } from "./DenaliTemplateSeedField";
import styles from "./tour-wizard-template.module.css";

const VISIBILITY_OPTIONS = ["", "always", "active", "hidden"] as const;
const REQUIRED_OPTIONS = ["", "required", "recommended", "optional", "forbidden"] as const;

type DestinationOption = {
  id: string;
  name: string;
  regionId: string;
  regionName: string;
};

export type TemplateBuilderFieldRowProps = {
  storagePath: string;
  control: Control<TourWizardTemplateBuilderFormValues>;
  register: UseFormRegister<TourWizardTemplateBuilderFormValues>;
  destinationOptions: readonly DestinationOption[];
  leaderOptions: readonly DestinationOption[];
  onDestinationSelected?: (_destinationId: string) => void;
  visibilityError?: string;
  requiredError?: string;
  seedError?: string;
  hints?: readonly DenaliOverlayFieldHint[];
  overlayHintMessageKey: (_hint: DenaliOverlayFieldHint) => string;
  overlayHintBadgeLabelKey: (_hint: DenaliOverlayFieldHint) => string;
};

export function TemplateBuilderFieldRow({
  storagePath,
  control,
  register,
  destinationOptions,
  leaderOptions,
  onDestinationSelected,
  visibilityError,
  requiredError,
  seedError,
  hints,
  overlayHintMessageKey,
  overlayHintBadgeLabelKey,
}: TemplateBuilderFieldRowProps) {
  const tSettings = useTranslations("settings");
  const tDenali = useTranslations("tours.denali");
  const definition = getDenaliTemplateSeedFieldDefinition(storagePath);
  const fieldLabel = definition
    ? resolveDenaliRegistryFieldLabel(definition.rhfPath, tDenali)
    : storagePath;

  const visibilityName = overlayRowRegistrationPath(storagePath, "visibility");
  const requiredName = overlayRowRegistrationPath(storagePath, "required");

  return (
    <div className={styles.fieldRow} data-testid={`template-builder-field-row-${storagePath}`}>
      <div className={styles.fieldRowHeader}>
        <div className={styles.fieldRowTitleBlock}>
          <span className={styles.fieldRowLabel}>{fieldLabel}</span>
          <code className={styles.fieldRowPath}>{storagePath}</code>
        </div>
        {hints?.length ? (
          <ul className={styles.fieldHintList} aria-label={tSettings("tourWizardTemplateFieldPathColumn")}>
            {hints.map((hint) => (
              <li
                key={`${storagePath}-${hint.kind}-${hint.messageKey}`}
                className={`${styles.fieldHintBadge} ${
                  hint.kind === "matrix" ? styles.fieldHintBadgeMatrix : styles.fieldHintBadgeContextual
                }`}
                title={tSettings(overlayHintMessageKey(hint))}
              >
                <span className={styles.fieldHintBadgeLabel}>
                  {tSettings(overlayHintBadgeLabelKey(hint))}
                </span>
                <span>{tSettings(overlayHintMessageKey(hint))}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.fieldRowBody}>
        <div className={styles.overlayControls}>
          <FormField
            label={tSettings("tourWizardTemplateVisibilityColumn")}
            error={visibilityError}
            className={styles.overlayControl}
          >
            <Select {...register(visibilityName)}>
              {VISIBILITY_OPTIONS.map((value) => (
                <option key={value || "inherit"} value={value}>
                  {value === ""
                    ? tSettings("tourWizardTemplateInheritOption")
                    : tSettings(`tourWizardTemplateVisibility_${value}`)}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField
            label={tSettings("tourWizardTemplateRequiredColumn")}
            error={requiredError}
            className={styles.overlayControl}
          >
            <Select {...register(requiredName)}>
              {REQUIRED_OPTIONS.map((value) => (
                <option key={value || "inherit"} value={value}>
                  {value === ""
                    ? tSettings("tourWizardTemplateInheritOption")
                    : tSettings(`tourWizardTemplateRequired_${value}`)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <div className={styles.seedControl}>
          <DenaliTemplateSeedField
            storagePath={storagePath}
            control={control}
            destinationOptions={destinationOptions}
            leaderOptions={leaderOptions}
            onDestinationSelected={onDestinationSelected}
            errorMessage={seedError}
            compact
          />
        </div>
      </div>
    </div>
  );
}

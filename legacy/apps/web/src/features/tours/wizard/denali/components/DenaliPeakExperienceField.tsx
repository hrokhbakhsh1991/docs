"use client";

import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FormField, Select } from "@tour/ui";

import { PEAK_EXPERIENCE_MIN_OPTIONS } from "@/features/tours/domain/peak-experience";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliCore.schema";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import {
  isPeakExperienceVisible,
  useDenaliCanonical,
  useDenaliCanonicalValue,
  useDenaliStepFieldRules,
} from "../application";
import { DENALI_FIELD_HINTS } from "../denaliFieldHints";

const MIN_REQUIRED_PEAKS_PATH = "participantRequirements.minRequiredPeaks" as const;
const PRICING_STEP = "denali_pricing" as const;

/** Peak auto-approval threshold — visible for mountaineering tours with manual admin approval enabled. */
export function DenaliPeakExperienceField() {
  const { control, getValues } = useFormContext<DenaliCreateTourWizardForm>();
  const tourType = useWatch({ control, name: "basicInfo.tourType" });
  const requiresManualAdminApproval = useWatch({
    control,
    name: "basicInfo.requiresManualAdminApproval",
  });
  const { updateCanonical } = useDenaliCanonical();
  const participants = useDenaliCanonicalValue<DenaliCanonicalTourModel["participants"]>(
    "participants",
  );
  const { isVisible } = useDenaliStepFieldRules(PRICING_STEP);

  const visible = useMemo(() => {
    const form = getValues();
    const snapshot: DenaliCreateTourWizardForm = {
      ...form,
      basicInfo: {
        ...form.basicInfo,
        tourType: tourType ?? form.basicInfo.tourType,
        requiresManualAdminApproval:
          requiresManualAdminApproval ?? form.basicInfo.requiresManualAdminApproval,
      },
    };
    return (
      isPeakExperienceVisible(snapshot) &&
      isVisible(MIN_REQUIRED_PEAKS_PATH, snapshot)
    );
  }, [getValues, isVisible, requiresManualAdminApproval, tourType]);

  if (!visible) {
    return null;
  }

  const raw = participants.minRequiredPeaks;
  const selected =
    typeof raw === "number" && Number.isInteger(raw) && raw >= 1 && raw <= 4
      ? String(raw)
      : "0";

  return (
    <FormField
      label="حداقل قله‌های صعودشده (شرط تایید خودکار)"
      description={DENALI_FIELD_HINTS.minRequiredPeaks}
    >
      <Select
        data-testid="denali-pricing-min-required-peaks"
        value={selected}
        onChange={(e) => {
          const n = Number.parseInt(e.target.value, 10);
          updateCanonical({
            participants: {
              ...participants,
              minRequiredPeaks: Number.isFinite(n) && n > 0 ? n : undefined,
            },
          });
        }}
      >
        {PEAK_EXPERIENCE_MIN_OPTIONS.map((opt) => (
          <option key={opt.value} value={String(opt.value)}>
            {opt.label}
          </option>
        ))}
      </Select>
    </FormField>
  );
}

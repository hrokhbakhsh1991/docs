"use client";

import { useEffect, useRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useWatch } from "react-hook-form";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import type { TourFormProfile } from "@repo/types";

import { preserveDenaliWizardBlobMedia } from "../preserveDenaliWizardBlobMedia";
import type { DenaliRuleSet } from "../rules/denaliRuleModel";
import { applyDenaliInvariantState } from "../validation/denaliInvariantEngine";

/** Same RHF paths watched by {@link DenaliCanonicalProvider} for registry UI context. */
export const DENALI_RULE_TRIGGER_FIELD_PATHS = [
  "basicInfo.tourType",
  "transport.transportMode",
  "transport.adminCapacityApproval",
  "transport.allowPersonalCar",
  "pricingPayment.requiresPayment",
] as const;

function buildDenaliRuleTriggerSignature(input: {
  tourType: DenaliCreateTourWizardForm["basicInfo"]["tourType"];
  transportMode: DenaliCreateTourWizardForm["transport"]["transportMode"];
  adminCapacityApproval: DenaliCreateTourWizardForm["transport"]["adminCapacityApproval"];
  allowPersonalCar: DenaliCreateTourWizardForm["transport"]["allowPersonalCar"];
  requiresPayment: DenaliCreateTourWizardForm["pricingPayment"]["requiresPayment"];
}): string {
  return JSON.stringify(input);
}

/**
 * When registry rule inputs change on the flat edit form, normalize hidden fields and
 * re-run RHF validation — mirroring create wizard step navigation cleanup.
 */
export function useDenaliEditRuleSync(
  formMethods: Pick<
    UseFormReturn<DenaliCreateTourWizardForm>,
    "control" | "getValues" | "reset" | "trigger"
  >,
  mergedRuleSet: DenaliRuleSet,
  onSynced: () => void,
  options?: { enabled?: boolean; workspaceFormProfile?: TourFormProfile },
): void {
  const enabled = options?.enabled ?? true;
  const workspaceFormProfile = options?.workspaceFormProfile;
  const { control, getValues, reset, trigger } = formMethods;

  const tourTypeWatch = useWatch({ control, name: "basicInfo.tourType" });
  const transportModeWatch = useWatch({ control, name: "transport.transportMode" });
  const adminCapacityApprovalWatch = useWatch({
    control,
    name: "transport.adminCapacityApproval",
  });
  const allowPersonalCarWatch = useWatch({ control, name: "transport.allowPersonalCar" });
  const requiresPaymentWatch = useWatch({
    control,
    name: "pricingPayment.requiresPayment",
  });

  const ruleSyncStartedRef = useRef(false);
  const lastSignatureRef = useRef("");

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const signature = buildDenaliRuleTriggerSignature({
      tourType: tourTypeWatch,
      transportMode: transportModeWatch,
      adminCapacityApproval: adminCapacityApprovalWatch,
      allowPersonalCar: allowPersonalCarWatch,
      requiresPayment: requiresPaymentWatch,
    });

    if (!ruleSyncStartedRef.current) {
      ruleSyncStartedRef.current = true;
      lastSignatureRef.current = signature;
      return;
    }

    if (signature === lastSignatureRef.current) {
      return;
    }
    lastSignatureRef.current = signature;

    const values = getValues();
    const normalized = applyDenaliInvariantState(
      values,
      workspaceFormProfile ? { workspaceFormProfile } : undefined,
      mergedRuleSet,
    );
    const withBlobs = preserveDenaliWizardBlobMedia(values, normalized);
    reset(withBlobs, { keepDefaultValues: true, keepDirty: true });
    onSynced();
    void trigger();
  }, [
    adminCapacityApprovalWatch,
    allowPersonalCarWatch,
    enabled,
    getValues,
    mergedRuleSet,
    onSynced,
    requiresPaymentWatch,
    reset,
    tourTypeWatch,
    transportModeWatch,
    trigger,
    workspaceFormProfile,
  ]);
}

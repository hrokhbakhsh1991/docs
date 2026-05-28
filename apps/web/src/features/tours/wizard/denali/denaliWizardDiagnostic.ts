import type { SettingsEquipmentDto } from "@/lib/settings-equipment.client";

import { denaliFormToCanonical } from "./denaliCanonicalFormAdapter";
import { getDenaliWizardSubmitIssues } from "./validation/denaliWizardFormZod";
import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateFormModel";

export type DenaliWizardDiagnosticReport = {
  generatedAt: string;
  source: string;
  validationIssues: Array<{ path: string; message: string; code: string }>;
  gearMismatch: {
    gearItems: Array<{ id: string; isRequired: boolean }>;
    activeEquipmentCount: number;
    unmatchedGearIds: string[];
    gearIdMatchDetails: Array<{ id: string; matched: boolean }>;
  };
  requiredFieldsAfterHydration: {
    peakHeight: number | undefined;
    elevationGain: number | undefined;
    themeIds: string[];
    peakHeightPresent: boolean;
    elevationGainPresent: boolean;
    themeIdsPresent: boolean;
  };
  canonicalSnapshot: {
    title: string;
    tourType: string | undefined;
    category: string;
    duration: string;
  };
};

function activeEquipmentIds(rows: readonly SettingsEquipmentDto[] | undefined): string[] {
  return (rows ?? [])
    .filter((row) => row.isActive)
    .map((row) => row.id.trim())
    .filter(Boolean);
}

/**
 * Builds a structured diagnostic report for Denali wizard state (submit gate + gear catalog + clone fields).
 */
export function buildDenaliWizardDiagnosticReport(input: {
  form: DenaliCreateTourWizardForm;
  activeEquipment?: readonly SettingsEquipmentDto[];
  source?: string;
}): DenaliWizardDiagnosticReport {
  const { form, activeEquipment, source = "denali-wizard" } = input;
  const canonical = denaliFormToCanonical(form);
  const issues = getDenaliWizardSubmitIssues(form);
  const gearItems = (canonical.participants.gearItems ?? []).map((row) => ({
    id: row.id.trim(),
    isRequired: row.isRequired === true,
  }));
  const activeSet = new Set(activeEquipmentIds(activeEquipment));
  const gearIdMatchDetails = gearItems.map((row) => ({
    id: row.id,
    matched: activeSet.has(row.id),
  }));

  return {
    generatedAt: new Date().toISOString(),
    source,
    validationIssues: issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
      code: String(issue.code),
    })),
    gearMismatch: {
      gearItems,
      activeEquipmentCount: activeSet.size,
      unmatchedGearIds: gearIdMatchDetails.filter((row) => !row.matched).map((row) => row.id),
      gearIdMatchDetails,
    },
    requiredFieldsAfterHydration: {
      peakHeight: canonical.overview?.peakHeight,
      elevationGain: canonical.metrics?.elevationGain,
      themeIds: [...(canonical.program.themeIds ?? [])],
      peakHeightPresent:
        canonical.overview?.peakHeight != null &&
        Number.isFinite(canonical.overview.peakHeight),
      elevationGainPresent:
        canonical.metrics?.elevationGain != null &&
        Number.isFinite(canonical.metrics.elevationGain),
      themeIdsPresent: (canonical.program.themeIds ?? []).length > 0,
    },
    canonicalSnapshot: {
      title: canonical.title,
      tourType: form.basicInfo.tourType,
      category: String(canonical.category),
      duration: String(canonical.duration),
    },
  };
}

/** Logs {@link buildDenaliWizardDiagnosticReport} as one JSON object (browser console or Node). */
export function logDenaliWizardDiagnosticReport(
  input: Parameters<typeof buildDenaliWizardDiagnosticReport>[0],
): DenaliWizardDiagnosticReport {
  const report = buildDenaliWizardDiagnosticReport(input);
  const _json = JSON.stringify(report, null, 2);
  if (
    typeof console !== "undefined" &&
    process.env.NEXT_PUBLIC_DENALI_WIZARD_DIAGNOSTIC === "1"
  ) {
  }
  return report;
}

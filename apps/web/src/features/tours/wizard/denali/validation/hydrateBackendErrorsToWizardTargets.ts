export type BackendValidationFieldError = {
  code: string;
  path?: string;
  message: string;
  tenantId?: string;
  workspaceId?: string;
};

export type BackendValidationEnvelope = {
  error?: {
    fields?: BackendValidationFieldError[];
    details?: {
      validationErrors?: BackendValidationFieldError[];
    };
  };
};

export type DenaliWizardStepId =
  | "denali_basic"
  | "denali_program"
  | "denali_logistics"
  | "denali_pricing"
  | "denali_photos"
  | "review";

export type HydratedWizardValidationIssue = {
  stepId: DenaliWizardStepId;
  formPath: string;
  code: string;
  message: string;
};

const BACKEND_TO_FORM_PATH: Record<string, string> = {
  "tripDetails.logistics.gatheringPoints": "transport.gatheringPoints",
  "tripDetails.logistics.startPoint": "basicInfo.startPoint",
  "tripDetails.overview.leaderUserIds": "basicInfo.leaderUserIds",
  "tripDetails.pricing.basePricePerPerson": "pricingPayment.basePricePerPerson",
  lifecycle_status: "basicInfo.publishStatus",
};

const FORM_PATH_TO_STEP: Array<{ prefix: string; stepId: DenaliWizardStepId }> = [
  { prefix: "basicInfo.", stepId: "denali_basic" },
  { prefix: "programNature.", stepId: "denali_program" },
  { prefix: "transport.", stepId: "denali_logistics" },
  { prefix: "pricingPayment.", stepId: "denali_pricing" },
  { prefix: "photosData.", stepId: "denali_photos" },
];

function toFormPath(rawPath?: string): string {
  if (!rawPath?.trim()) return "basicInfo.publishStatus";
  const path = rawPath.trim();
  return BACKEND_TO_FORM_PATH[path] ?? path;
}

function toStepId(formPath: string): DenaliWizardStepId {
  return FORM_PATH_TO_STEP.find((row) => formPath.startsWith(row.prefix))?.stepId ?? "review";
}

function extractBackendFieldErrors(payload: BackendValidationEnvelope): BackendValidationFieldError[] {
  const fromFields = payload.error?.fields;
  if (Array.isArray(fromFields) && fromFields.length > 0) return fromFields;
  const fromDetails = payload.error?.details?.validationErrors;
  if (Array.isArray(fromDetails) && fromDetails.length > 0) return fromDetails;
  return [];
}

export function hydrateBackendErrorsToWizardTargets(
  payload: BackendValidationEnvelope,
  options?: { expectedTenantId?: string },
): HydratedWizardValidationIssue[] {
  const rows = extractBackendFieldErrors(payload);
  const expectedTenantId = options?.expectedTenantId?.trim();
  const filtered =
    expectedTenantId == null
      ? rows
      : rows.filter((row) => {
          const tenantId = row.tenantId?.trim();
          return !tenantId || tenantId === expectedTenantId;
        });

  return filtered.map((row) => {
    const formPath = toFormPath(row.path);
    return {
      stepId: toStepId(formPath),
      formPath,
      code: row.code,
      message: row.message,
    };
  });
}

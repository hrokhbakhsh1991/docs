import type { DenaliFieldDefinition } from "@repo/denali-domain";

/** RHF path for workspace-defined custom service labels (registry: tripDetails.overview.customServiceLabels). */
export const DENALI_CUSTOM_SERVICE_LABELS_PATH =
  "tripDetails.overview.customServiceLabels" as const satisfies DenaliFieldDefinition["rhfPath"];

export type DenaliCustomServiceLabelsPath = typeof DENALI_CUSTOM_SERVICE_LABELS_PATH;

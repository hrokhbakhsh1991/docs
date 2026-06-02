import type { DenaliFieldRegistryEntry } from "@repo/denali-domain";

export type DenaliZodKindFieldProps = {
  field: DenaliFieldRegistryEntry;
  required: boolean;
};

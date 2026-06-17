import { z } from "zod";

import { DENALI_CANONICAL_OBJECT_ROOTS } from "../denali-plugin-adapter";

/** Fixpoint iteration guard — see createDenaliDraftSchemaGate (Phase 5A). */
export const MAX_SANITY_ATTEMPTS = 2 as const;

const canonicalRootEnum = z.enum(
  [...DENALI_CANONICAL_OBJECT_ROOTS] as [string, ...string[]]
);

export const DenaliWizardDraftMetaSchema = z.object({
  currentStepIndex: z.number().int().min(0),
  wizardSessionId: z.string().optional(),
  freshStart: z.boolean().optional(),
  deletedRoots: z.array(canonicalRootEnum).optional(),
});

export const DenaliWizardDraftEnvelopeSchema = z.object({
  form: z.object({ data: z.record(z.unknown()) }),
  meta: DenaliWizardDraftMetaSchema,
});

export type ParsedDenaliWizardDraftEnvelope = z.infer<typeof DenaliWizardDraftEnvelopeSchema>;

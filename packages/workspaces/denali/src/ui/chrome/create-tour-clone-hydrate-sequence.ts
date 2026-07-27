export function resolveCreateTourCloneHydrateKey(
  cloneTourId: string,
  wizardSessionId: string
): string {
  return `${cloneTourId}:${wizardSessionId}`;
}

export type CreateTourCloneHydrateSequenceInput<TDraft> = {
  readonly cloneTourId: string;
  readonly pluginId: string;
  readonly wizardSessionId: string;
  readonly hydrateCreateTourFromClone: (input: {
    readonly cloneTourId: string;
    readonly pluginId: string;
    readonly wizardSessionId: string;
  }) => Promise<{
    readonly draft: TDraft;
    readonly photoRemintFailed?: boolean;
  }>;
  readonly clearDraft: () => Promise<void>;
  readonly applyHydratedDraft: (draft: TDraft) => void;
};

export type CreateTourCloneHydrateSequenceResult = {
  readonly photoRemintFailed: boolean;
};

/** Phase 15.2 — hydrate clone, clear remote draft, then apply envelope (no effect deps on draftSync). */
export async function runCreateTourCloneHydrateSequence<TDraft>(
  input: CreateTourCloneHydrateSequenceInput<TDraft>
): Promise<CreateTourCloneHydrateSequenceResult> {
  const hydrated = await input.hydrateCreateTourFromClone({
    cloneTourId: input.cloneTourId,
    pluginId: input.pluginId,
    wizardSessionId: input.wizardSessionId,
  });
  await input.clearDraft();
  input.applyHydratedDraft(hydrated.draft);
  return { photoRemintFailed: hydrated.photoRemintFailed === true };
}

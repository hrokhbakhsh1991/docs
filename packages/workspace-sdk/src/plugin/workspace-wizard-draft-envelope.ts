/**
 * Phase 13.0b — opaque wizard draft envelope (DEC-P13-002).
 *
 * Workspace plugins own meta field semantics; SDK only provides structural hooks.
 */
export type WorkspaceWizardDraftMeta = Readonly<Record<string, unknown>>;

export type WorkspaceWizardDraftEnvelope<TForm = unknown> = {
  readonly form: TForm;
  readonly meta: WorkspaceWizardDraftMeta;
};

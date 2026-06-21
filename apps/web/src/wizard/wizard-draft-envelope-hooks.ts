import type { WorkspacePlugin, WorkspaceWizardDraftMeta } from "@app-tour/workspace-sdk";

import type { NewTourWizardDraftEnvelope } from "@/draft/denali-wizard-draft-merge";

/** Phase 13.5 / 13.8 — prepare client envelope via wizardHost; caller injects product fallback. */
export function prepareWizardDraftEnvelope<TForm>(
  plugin: WorkspacePlugin,
  form: TForm,
  meta: WorkspaceWizardDraftMeta,
  fallback: (form: TForm, meta: WorkspaceWizardDraftMeta) => NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  const prepare = plugin.wizardHost?.prepareDraftEnvelope;
  if (prepare != null) {
    return prepare(form, meta) as NewTourWizardDraftEnvelope;
  }
  return fallback(form, meta);
}

/** Phase 13.5 / 13.8 — post-fetch sanitize via wizardHost; caller injects product fallback. */
export function normalizeWizardRemoteEnvelope(
  plugin: WorkspacePlugin,
  envelope: NewTourWizardDraftEnvelope,
  fallback: (envelope: NewTourWizardDraftEnvelope) => NewTourWizardDraftEnvelope
): NewTourWizardDraftEnvelope {
  const normalize = plugin.wizardHost?.normalizeRemoteEnvelope;
  if (normalize != null) {
    return normalize(envelope) as NewTourWizardDraftEnvelope;
  }
  return fallback(envelope);
}

/** Phase 13.5 — wizard media session id via wizardHost with caller fallback. */
export function createWizardAssetSessionId(
  plugin: WorkspacePlugin,
  fallback: () => string
): string {
  const create = plugin.wizardHost?.media?.createAssetSessionId;
  return create != null ? create() : fallback();
}

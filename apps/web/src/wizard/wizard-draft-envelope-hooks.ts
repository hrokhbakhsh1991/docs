import type {
  WorkspacePlugin,
  WorkspaceWizardDraftEnvelope,
  WorkspaceWizardDraftMeta,
} from "@app-tour/workspace-sdk";

/** Phase 13.5 / 14.2 — prepare client envelope via wizardHost; caller injects product fallback. */
export function prepareWizardDraftEnvelope<TForm>(
  plugin: WorkspacePlugin,
  form: TForm,
  meta: WorkspaceWizardDraftMeta,
  fallback: (
    form: TForm,
    meta: WorkspaceWizardDraftMeta
  ) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const prepare = plugin.wizardHost?.prepareDraftEnvelope;
  if (prepare != null) {
    return prepare(form, meta) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  return fallback(form, meta);
}

/** Phase 13.5 / 14.2 — post-fetch sanitize via wizardHost; caller injects product fallback. */
export function normalizeWizardRemoteEnvelope<TForm>(
  plugin: WorkspacePlugin,
  envelope: WorkspaceWizardDraftEnvelope<TForm>,
  fallback: (envelope: WorkspaceWizardDraftEnvelope<TForm>) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const normalize = plugin.wizardHost?.normalizeRemoteEnvelope;
  if (normalize != null) {
    return normalize(envelope) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  return fallback(envelope);
}

/** Phase 14.2 — merge local + server envelopes via wizardHost; caller injects product fallback. */
export function mergeWizardDraftEnvelope<TForm>(
  plugin: WorkspacePlugin,
  local: WorkspaceWizardDraftEnvelope<TForm>,
  server: WorkspaceWizardDraftEnvelope<TForm>,
  fallback?: (
    local: WorkspaceWizardDraftEnvelope<TForm>,
    server: WorkspaceWizardDraftEnvelope<TForm>
  ) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const merge = plugin.wizardHost?.mergeDraftEnvelope;
  if (merge != null) {
    return merge(local, server) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  if (fallback != null) {
    return fallback(local, server);
  }
  return server;
}

/** Phase 13.5 — wizard media session id via wizardHost with caller fallback. */
export function createWizardAssetSessionId(
  plugin: WorkspacePlugin,
  fallback: () => string
): string {
  const create = plugin.wizardHost?.media?.createAssetSessionId;
  return create != null ? create() : fallback();
}

import {
  resolveDraftShellCapability,
  resolveWizardHostCapability,
  type WorkspacePlugin,
  type WorkspaceWizardDraftEnvelope,
  type WorkspaceWizardDraftMeta,
} from "@app-tour/workspace-sdk";

/** Phase 13.5 / 14.2 — prepare client envelope via resolveWizardHostCapability; caller injects product fallback. */
export function prepareWizardDraftEnvelope<TForm>(
  plugin: WorkspacePlugin,
  form: TForm,
  meta: WorkspaceWizardDraftMeta,
  fallback: (
    form: TForm,
    meta: WorkspaceWizardDraftMeta
  ) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const prepare = resolveWizardHostCapability(plugin)?.prepareDraftEnvelope;
  if (prepare != null) {
    return prepare(form, meta) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  return fallback(form, meta);
}

/** Phase 13.5 / 14.2 — post-fetch sanitize via resolveWizardHostCapability; caller injects product fallback. */
export function normalizeWizardRemoteEnvelope<TForm>(
  plugin: WorkspacePlugin,
  envelope: WorkspaceWizardDraftEnvelope<TForm>,
  fallback: (envelope: WorkspaceWizardDraftEnvelope<TForm>) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const normalize = resolveWizardHostCapability(plugin)?.normalizeRemoteEnvelope;
  if (normalize != null) {
    return normalize(envelope) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  return fallback(envelope);
}

/** Phase 14.2 — merge local + server envelopes via resolveWizardHostCapability; caller injects product fallback. */
export function mergeWizardDraftEnvelope<TForm>(
  plugin: WorkspacePlugin,
  local: WorkspaceWizardDraftEnvelope<TForm>,
  server: WorkspaceWizardDraftEnvelope<TForm>,
  fallback?: (
    local: WorkspaceWizardDraftEnvelope<TForm>,
    server: WorkspaceWizardDraftEnvelope<TForm>
  ) => WorkspaceWizardDraftEnvelope<TForm>
): WorkspaceWizardDraftEnvelope<TForm> {
  const merge = resolveWizardHostCapability(plugin)?.mergeDraftEnvelope;
  if (merge != null) {
    return merge(local, server) as WorkspaceWizardDraftEnvelope<TForm>;
  }
  if (fallback != null) {
    return fallback(local, server);
  }
  return server;
}

/** Phase 13.5 / 4v — media session id, then draftShell session id, then caller fallback. */
export function createWizardAssetSessionId(
  plugin: WorkspacePlugin,
  fallback: () => string
): string {
  const mediaCreate = resolveWizardHostCapability(plugin)?.media?.createAssetSessionId;
  if (mediaCreate != null) {
    return mediaCreate();
  }
  const draftCreate = resolveDraftShellCapability(plugin)?.createWizardDraftSessionId;
  if (draftCreate != null) {
    return draftCreate();
  }
  return fallback();
}

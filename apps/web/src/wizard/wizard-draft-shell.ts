/**
 * Thin shell draft helpers — Phase 3d/4v–4al.
 * Phase 4al: capability-only (generated draft-shell binder deleted).
 * Envelope prepare/hydrate belong on `wizardHost` (see wizard-draft-envelope-hooks).
 */
import {
  resolveDraftShellCapability,
  type WorkspacePlugin,
} from "@app-cloud/workspace-sdk";

export type { NewTourWizardDraftEnvelope } from "@/draft/tour-wizard-draft-envelope";

export {
  createOperatorDraftOnPushSuccess,
  resolveOperatorDraftConflictStrategy,
} from "@/draft/draft-unification-v3-options";

/** Shell-local draft meta mirror (Gap Closure B.8 — no product type re-export). */
export type OperatorWizardDraftMeta = {
  readonly currentStepIndex: number;
  readonly wizardSessionId?: string;
  /** Set after explicit clear — conflict merge must prefer local template over stale server. */
  readonly freshStart?: boolean;
  /** Server-persisted only — stripped on client hydrate/prepare (Track B). */
  readonly deletedRoots?: readonly string[];
};

function requireDraftShell(plugin: WorkspacePlugin) {
  const draft = resolveDraftShellCapability(plugin);
  if (draft == null) {
    throw new Error(`draftShell capability missing for plugin ${plugin.id}`);
  }
  return draft;
}

/**
 * Prefer `plugin.capabilities.draftShell.createWizardDraftSessionId`.
 * Fail closed when capability absent (Phase 4al).
 */
export function createWizardDraftSessionIdForPlugin(plugin: WorkspacePlugin): string {
  return requireDraftShell(plugin).createWizardDraftSessionId();
}

/**
 * Prefer `capabilities.draftShell.isFreshStartEnvelope`. Fail closed when absent.
 */
export function isFreshStartEnvelopeForPlugin(
  plugin: WorkspacePlugin,
  envelope: unknown
): boolean {
  const fromCap = requireDraftShell(plugin).isFreshStartEnvelope;
  if (fromCap == null) {
    throw new Error(
      `draftShell.isFreshStartEnvelope missing for plugin ${plugin.id}`
    );
  }
  return fromCap(envelope);
}

/**
 * Prefer `capabilities.draftShell.resolveDraftMerge`. Fail closed when capability absent;
 * returns undefined when merge disabled for mode.
 */
export function resolveDraftMergeForPlugin(
  plugin: WorkspacePlugin,
  mode: string
): ((local: unknown, server: unknown) => unknown) | undefined {
  const fromCap = requireDraftShell(plugin).resolveDraftMerge;
  if (fromCap == null) {
    throw new Error(`draftShell.resolveDraftMerge missing for plugin ${plugin.id}`);
  }
  return fromCap(mode);
}

export type OperatorRemoteDraftIdentity = {
  readonly namespace: string;
  readonly draftKey: string;
};

/**
 * Prefer draftShell identity fields; undefined when capability absent
 * (caller may fall back to host-adapter surface).
 */
export function resolveCreateTourDraftIdentityForPlugin(
  plugin: WorkspacePlugin
): OperatorRemoteDraftIdentity | undefined {
  const draft = resolveDraftShellCapability(plugin);
  if (draft == null) {
    return undefined;
  }
  return {
    namespace: draft.operatorDraftNamespace,
    draftKey: draft.createTourDraftKey,
  };
}

/**
 * Prefer `capabilities.draftShell.buildCreatePrefilledForm`. Fail closed when absent.
 */
export function buildCreatePrefilledFormForPlugin(
  plugin: WorkspacePlugin,
  gate: unknown
): unknown {
  const fromCap = requireDraftShell(plugin).buildCreatePrefilledForm;
  if (fromCap == null) {
    throw new Error(
      `draftShell.buildCreatePrefilledForm missing for plugin ${plugin.id}`
    );
  }
  return fromCap(gate);
}

/**
 * Prefer `capabilities.draftShell.createDraftSchemaGate`. Fail closed when absent.
 */
export function createDraftSchemaGateForPlugin(
  plugin: WorkspacePlugin,
  rules: unknown,
  evalContext: unknown
): unknown {
  const fromCap = requireDraftShell(plugin).createDraftSchemaGate;
  if (fromCap == null) {
    throw new Error(
      `draftShell.createDraftSchemaGate missing for plugin ${plugin.id}`
    );
  }
  return fromCap(rules, evalContext);
}

/**
 * Prefer `capabilities.draftShell.isDraftEssentiallyEmpty`. Fail closed when absent.
 */
export function isDraftEssentiallyEmptyForPlugin(
  plugin: WorkspacePlugin,
  draft: unknown
): boolean {
  const fromCap = requireDraftShell(plugin).isDraftEssentiallyEmpty;
  if (fromCap == null) {
    throw new Error(
      `draftShell.isDraftEssentiallyEmpty missing for plugin ${plugin.id}`
    );
  }
  return fromCap(draft);
}

/**
 * Prefer draftShell identity fields for flat-edit remote draft.
 */
export function resolveEditTourDraftIdentityForPlugin(
  plugin: WorkspacePlugin,
  tourId: string
): OperatorRemoteDraftIdentity | undefined {
  const draft = resolveDraftShellCapability(plugin);
  if (draft == null) {
    return undefined;
  }
  return {
    namespace: draft.operatorDraftNamespace,
    draftKey: draft.editTourDraftKey(tourId),
  };
}

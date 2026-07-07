/**
 * Phase 13.0 — provisional wizard asset upload (DEC-P13-001).
 *
 * Web host and upload clients read these hooks from `WorkspacePlugin.wizardHost.media`.
 * Storage backends stay in workspace packages — not in SDK.
 */
export type WorkspaceWizardMediaHooks = {
  /** Mint wizard-scoped upload session id (UUID v4). */
  readonly createAssetSessionId: () => string;
  /** Validate client/session id before upload. */
  readonly isAssetSessionId: (value: string) => boolean;
  /**
   * Opaque BFF route key for upload client resolution (e.g. `"wizard-photos"`).
   */
  readonly mediaRouteKey: string;
};

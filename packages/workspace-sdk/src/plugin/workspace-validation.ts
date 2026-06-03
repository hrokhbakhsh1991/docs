/**
 * Runtime-only hooks — not persisted in stored plugin JSON (see ingress `allowFunctions: false`).
 * Hosts attach {@link noopWorkspaceValidationHooks} or real validators after storage ingress.
 */
export interface WorkspaceViolation {
  readonly code: string;
  readonly message: string;
}

export interface WorkspaceValidationHooks {
  checkCapacity(_capacity: number): WorkspaceViolation | null;
  checkTripDetails(
    _tripDetails: unknown,
    _transportModes?: readonly string[] | null,
  ): WorkspaceViolation | null;
}

const noopHooksImpl: WorkspaceValidationHooks = {
  checkCapacity: () => null,
  checkTripDetails: () => null,
};

/** Frozen template — ingress attaches a fresh clone per parse (CRIT-STATE-02). */
export const noopWorkspaceValidationHooks: WorkspaceValidationHooks =
  Object.freeze(noopHooksImpl);

/** Host/runtime hook bag isolated from shared module state. */
export function createNoopWorkspaceValidationHooks(): WorkspaceValidationHooks {
  return {
    checkCapacity: () => null,
    checkTripDetails: () => null,
  };
}

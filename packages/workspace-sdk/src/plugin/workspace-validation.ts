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

export const noopWorkspaceValidationHooks: WorkspaceValidationHooks = {
  checkCapacity: () => null,
  checkTripDetails: () => null,
};

/** True while create mutation is in flight or has succeeded (prevents double submit). */
export function isWizardSubmitLocked(mutation: {
  isPending: boolean;
  isSuccess: boolean;
}): boolean {
  return mutation.isPending || mutation.isSuccess;
}

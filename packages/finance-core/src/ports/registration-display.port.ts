export type FinanceRegistrationDisplay = {
  readonly registrationId: string;
  readonly tourId: string;
  readonly tourTitle: string;
  readonly memberDisplayName: string;
};

export interface RegistrationDisplayPort {
  getByRegistrationIds(
    tenantId: string,
    registrationIds: readonly string[]
  ): Promise<ReadonlyMap<string, FinanceRegistrationDisplay>>;

  /**
   * PR23-B2 — resolve tour scope to registration IDs before pending-receipt limit.
   * Empty array means no registrations on that tour (queue is truly empty for tour).
   */
  listRegistrationIdsByTourId(
    tenantId: string,
    tourId: string
  ): Promise<readonly string[]>;
}

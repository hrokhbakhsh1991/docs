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
}
